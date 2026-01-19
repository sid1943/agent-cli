// TaskServer - Central coordinator for multi-agent task management
// Uses file-based communication (no running server process required)
import * as fs from 'fs';
import * as path from 'path';
import { DEFAULT_CONFIG, getCoordinatorPaths, ensureCoordinatorDirs } from '../shared/config.js';
import { FileMessageQueue, StateManager, createMessage } from '../shared/protocol.js';
import { generateTaskId } from '../shared/utils.js';
import { LockManager } from './LockManager.js';
export class TaskServer {
    config;
    state;
    paths;
    stateManager;
    messageQueue;
    lockManager;
    eventListeners = [];
    watchInterval = null;
    constructor(config = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.paths = getCoordinatorPaths(this.config.projectPath);
        this.stateManager = new StateManager(this.paths.state);
        this.messageQueue = new FileMessageQueue(this.config.projectPath);
        this.lockManager = new LockManager(this.config.projectPath, this.config.lockTimeout);
        // Initialize state
        this.state = this.createInitialState();
        // Ensure directories exist
        ensureCoordinatorDirs(this.config.projectPath);
    }
    /**
     * Initialize the server
     */
    async initialize() {
        // Load existing state
        const existingState = await this.stateManager.readState();
        if (existingState) {
            this.state = existingState;
            this.state.config = this.config;
        }
        // Clean up disconnected agents
        this.cleanupDisconnectedAgents();
        // Save initial state
        await this.saveState();
        console.log(`[TaskServer] Initialized in ${this.config.projectPath}`);
        console.log(`[TaskServer] Agents: ${Object.keys(this.state.agents).length}, Tasks: ${Object.keys(this.state.tasks).length}`);
    }
    /**
     * Start watching for agent messages
     */
    startWatching() {
        if (this.watchInterval)
            return;
        this.watchInterval = setInterval(async () => {
            await this.processAgentMessages();
            this.checkAgentHeartbeats();
            if (this.config.autoAssign) {
                await this.autoAssignTasks();
            }
        }, this.config.heartbeatInterval);
        console.log('[TaskServer] Started watching for agent messages');
    }
    /**
     * Stop watching
     */
    stopWatching() {
        if (this.watchInterval) {
            clearInterval(this.watchInterval);
            this.watchInterval = null;
        }
    }
    // =========================================================================
    // Agent Management
    // =========================================================================
    /**
     * Register a new agent
     */
    async registerAgent(agentId, info) {
        const agent = {
            id: agentId,
            name: info.name || agentId,
            status: 'idle',
            currentTask: null,
            workingBranch: null,
            workingDirectory: info.workingDirectory || this.config.projectPath,
            startedAt: Date.now(),
            lastHeartbeat: Date.now(),
            completedTasks: 0,
            failedTasks: 0,
            capabilities: info.capabilities || [],
            metadata: info.metadata || {},
        };
        this.state.agents[agentId] = agent;
        await this.saveState();
        // Ensure agent directories exist
        const agentDir = path.join(this.paths.agents, agentId);
        if (!fs.existsSync(agentDir)) {
            fs.mkdirSync(agentDir, { recursive: true });
            fs.mkdirSync(path.join(agentDir, 'inbox'), { recursive: true });
            fs.mkdirSync(path.join(agentDir, 'outbox'), { recursive: true });
        }
        this.emitEvent('agent:registered', agentId, { agent });
        console.log(`[TaskServer] Agent registered: ${agentId}`);
        return agent;
    }
    /**
     * Unregister an agent
     */
    async unregisterAgent(agentId) {
        const agent = this.state.agents[agentId];
        if (!agent)
            return;
        // Release all locks
        this.lockManager.releaseAllLocks(agentId);
        // Unassign current task
        if (agent.currentTask) {
            await this.unassignTask(agent.currentTask);
        }
        delete this.state.agents[agentId];
        await this.saveState();
        this.emitEvent('agent:disconnected', agentId, { agentId });
        console.log(`[TaskServer] Agent unregistered: ${agentId}`);
    }
    /**
     * Update agent heartbeat
     */
    async updateHeartbeat(agentId, status, progress) {
        const agent = this.state.agents[agentId];
        if (!agent)
            return;
        agent.lastHeartbeat = Date.now();
        if (status && status !== agent.status) {
            agent.status = status;
            this.emitEvent('agent:status_changed', agentId, { agentId, status });
        }
        await this.saveState();
    }
    /**
     * Get all agents
     */
    getAgents() {
        return Object.values(this.state.agents);
    }
    /**
     * Get idle agents
     */
    getIdleAgents() {
        return this.getAgents().filter(a => a.status === 'idle');
    }
    // =========================================================================
    // Task Management
    // =========================================================================
    /**
     * Create a new task
     */
    async createTask(options) {
        const taskId = generateTaskId();
        const task = {
            id: taskId,
            title: options.title,
            description: options.description || '',
            priority: options.priority || 'normal',
            status: 'pending',
            assignedAgent: null,
            assignedAt: null,
            createdAt: Date.now(),
            startedAt: null,
            completedAt: null,
            attempts: 0,
            maxAttempts: 3,
            targetFiles: options.files,
            targetDirectories: options.directories,
            dependsOn: options.dependsOn,
            tags: options.tags,
            metadata: {},
        };
        // Check dependencies
        if (options.dependsOn) {
            const blockers = options.dependsOn.filter(depId => {
                const dep = this.state.tasks[depId];
                return dep && dep.status !== 'completed';
            });
            if (blockers.length > 0) {
                task.blockedBy = blockers;
            }
        }
        this.state.tasks[taskId] = task;
        this.state.taskQueue.push(taskId);
        await this.saveState();
        this.emitEvent('task:created', 'server', { task });
        console.log(`[TaskServer] Task created: ${taskId} - ${options.title}`);
        return task;
    }
    /**
     * Assign task to agent
     */
    async assignTask(taskId, agentId) {
        const task = this.state.tasks[taskId];
        const agent = this.state.agents[agentId];
        if (!task || !agent)
            return null;
        if (task.status !== 'pending')
            return null;
        if (agent.status !== 'idle')
            return null;
        // Check for blocking dependencies
        if (task.blockedBy && task.blockedBy.length > 0) {
            const stillBlocked = task.blockedBy.filter(depId => {
                const dep = this.state.tasks[depId];
                return dep && dep.status !== 'completed';
            });
            if (stillBlocked.length > 0) {
                console.log(`[TaskServer] Task ${taskId} blocked by: ${stillBlocked.join(', ')}`);
                return null;
            }
            task.blockedBy = [];
        }
        // Check for file conflicts
        if (task.targetFiles) {
            const conflicts = this.lockManager.checkConflicts(agentId, task.targetFiles);
            if (conflicts.length > 0) {
                console.log(`[TaskServer] Task ${taskId} has file conflicts:`, conflicts);
                return null;
            }
        }
        // Assign the task
        task.status = 'assigned';
        task.assignedAgent = agentId;
        task.assignedAt = Date.now();
        task.attempts++;
        // Create branch name if git integration enabled
        if (this.config.gitIntegration) {
            task.branch = `${this.config.branchPrefix}${agentId}/${taskId}`;
            task.baseBranch = 'main';
        }
        // Update agent
        agent.status = 'working';
        agent.currentTask = taskId;
        agent.workingBranch = task.branch || null;
        // Remove from queue
        const queueIndex = this.state.taskQueue.indexOf(taskId);
        if (queueIndex > -1) {
            this.state.taskQueue.splice(queueIndex, 1);
        }
        // Acquire locks
        if (task.targetFiles) {
            this.lockManager.acquireLocks({
                agentId,
                taskId,
                paths: task.targetFiles,
                lockType: 'write',
            });
        }
        await this.saveState();
        // Send task to agent
        await this.messageQueue.sendToAgent(agentId, createMessage('TASK_ASSIGN', 'server', { task }, agentId));
        this.emitEvent('task:assigned', 'server', { task, agentId });
        console.log(`[TaskServer] Task ${taskId} assigned to ${agentId}`);
        return task;
    }
    /**
     * Start task (agent confirms it started working)
     */
    async startTask(taskId, agentId) {
        const task = this.state.tasks[taskId];
        if (!task || task.assignedAgent !== agentId)
            return;
        task.status = 'in_progress';
        task.startedAt = Date.now();
        await this.saveState();
        this.emitEvent('task:started', agentId, { taskId });
    }
    /**
     * Complete task
     */
    async completeTask(taskId, agentId, result) {
        const task = this.state.tasks[taskId];
        const agent = this.state.agents[agentId];
        if (!task || task.assignedAgent !== agentId)
            return;
        task.status = 'completed';
        task.completedAt = Date.now();
        task.result = result;
        if (task.startedAt) {
            task.actualMinutes = Math.round((task.completedAt - task.startedAt) / 60000);
        }
        // Release locks
        this.lockManager.releaseTaskLocks(taskId);
        // Update agent
        if (agent) {
            agent.status = 'idle';
            agent.currentTask = null;
            agent.workingBranch = null;
            agent.completedTasks++;
        }
        // Move to completed list
        this.state.completedTasks.push(taskId);
        // Unblock dependent tasks
        this.unblockDependentTasks(taskId);
        await this.saveState();
        this.emitEvent('task:completed', agentId, { task, result });
        console.log(`[TaskServer] Task ${taskId} completed by ${agentId}`);
    }
    /**
     * Fail task
     */
    async failTask(taskId, agentId, error) {
        const task = this.state.tasks[taskId];
        const agent = this.state.agents[agentId];
        if (!task || task.assignedAgent !== agentId)
            return;
        // Release locks
        this.lockManager.releaseTaskLocks(taskId);
        // Check if can retry
        if (task.attempts < task.maxAttempts) {
            task.status = 'pending';
            task.assignedAgent = null;
            task.assignedAt = null;
            task.error = error;
            this.state.taskQueue.unshift(taskId); // Add back to front of queue
        }
        else {
            task.status = 'failed';
            task.completedAt = Date.now();
            task.error = error;
        }
        // Update agent
        if (agent) {
            agent.status = 'idle';
            agent.currentTask = null;
            agent.workingBranch = null;
            agent.failedTasks++;
        }
        await this.saveState();
        this.emitEvent('task:failed', agentId, { task, error });
        console.log(`[TaskServer] Task ${taskId} failed: ${error}`);
    }
    /**
     * Unassign task (return to queue)
     */
    async unassignTask(taskId) {
        const task = this.state.tasks[taskId];
        if (!task)
            return;
        const agentId = task.assignedAgent;
        // Release locks
        this.lockManager.releaseTaskLocks(taskId);
        // Update task
        task.status = 'pending';
        task.assignedAgent = null;
        task.assignedAt = null;
        this.state.taskQueue.unshift(taskId);
        // Update agent
        if (agentId) {
            const agent = this.state.agents[agentId];
            if (agent && agent.currentTask === taskId) {
                agent.status = 'idle';
                agent.currentTask = null;
                agent.workingBranch = null;
            }
        }
        await this.saveState();
    }
    /**
     * Get pending tasks
     */
    getPendingTasks() {
        return this.state.taskQueue
            .map(id => this.state.tasks[id])
            .filter(t => t && t.status === 'pending');
    }
    /**
     * Get all tasks
     */
    getTasks() {
        return Object.values(this.state.tasks);
    }
    // =========================================================================
    // Lock Management (delegate to LockManager)
    // =========================================================================
    getLocks() {
        return this.lockManager.getAllLocks();
    }
    // =========================================================================
    // State Management
    // =========================================================================
    /**
     * Get current state
     */
    getState() {
        return { ...this.state };
    }
    /**
     * Subscribe to events
     */
    onEvent(callback) {
        this.eventListeners.push(callback);
        return () => {
            const index = this.eventListeners.indexOf(callback);
            if (index > -1)
                this.eventListeners.splice(index, 1);
        };
    }
    // =========================================================================
    // Private Methods
    // =========================================================================
    createInitialState() {
        return {
            version: '1.0.0',
            startedAt: Date.now(),
            projectPath: this.config.projectPath,
            agents: {},
            tasks: {},
            locks: {},
            taskQueue: [],
            completedTasks: [],
            config: this.config,
        };
    }
    async saveState() {
        await this.stateManager.writeState(this.state);
    }
    emitEvent(type, source, data) {
        const event = {
            type,
            timestamp: Date.now(),
            source,
            data,
        };
        for (const listener of this.eventListeners) {
            try {
                listener(event);
            }
            catch (error) {
                console.error('Event listener error:', error);
            }
        }
    }
    async processAgentMessages() {
        // Read messages from all agent outboxes
        for (const agentId of Object.keys(this.state.agents)) {
            const messages = await this.messageQueue.readOutbox(agentId);
            for (const message of messages) {
                await this.handleAgentMessage(agentId, message);
            }
        }
    }
    async handleAgentMessage(agentId, message) {
        switch (message.type) {
            case 'AGENT_HEARTBEAT':
                await this.updateHeartbeat(agentId, message.payload.status, message.payload.progress);
                break;
            case 'TASK_UPDATE':
                this.emitEvent('task:progress', agentId, message.payload);
                break;
            case 'TASK_COMPLETE':
                await this.completeTask(message.payload.taskId, agentId, message.payload.result);
                break;
            case 'TASK_FAILED':
                await this.failTask(message.payload.taskId, agentId, message.payload.error);
                break;
            case 'LOCK_REQUEST':
                const lockResult = this.lockManager.acquireLocks(message.payload);
                await this.messageQueue.sendToAgent(agentId, createMessage('LOCK_RESPONSE', 'server', lockResult, agentId, message.id));
                break;
            case 'LOCK_RELEASE':
                this.lockManager.releaseLocks(agentId, message.payload.paths);
                break;
            case 'AGENT_DISCONNECT':
                await this.unregisterAgent(agentId);
                break;
        }
    }
    checkAgentHeartbeats() {
        const now = Date.now();
        for (const agent of Object.values(this.state.agents)) {
            const timeSinceHeartbeat = now - agent.lastHeartbeat;
            if (timeSinceHeartbeat > this.config.heartbeatTimeout) {
                console.log(`[TaskServer] Agent ${agent.id} timed out (${timeSinceHeartbeat}ms since last heartbeat)`);
                // Mark agent as offline
                agent.status = 'offline';
                // Unassign their current task
                if (agent.currentTask) {
                    this.unassignTask(agent.currentTask);
                }
                // Release their locks
                this.lockManager.releaseAllLocks(agent.id);
            }
        }
    }
    cleanupDisconnectedAgents() {
        const now = Date.now();
        for (const [agentId, agent] of Object.entries(this.state.agents)) {
            const timeSinceHeartbeat = now - agent.lastHeartbeat;
            // Remove agents that have been offline for more than 5 minutes
            if (timeSinceHeartbeat > 300000) {
                console.log(`[TaskServer] Removing stale agent: ${agentId}`);
                delete this.state.agents[agentId];
                this.lockManager.releaseAllLocks(agentId);
            }
        }
    }
    async autoAssignTasks() {
        const idleAgents = this.getIdleAgents();
        const pendingTasks = this.getPendingTasks();
        // Sort tasks by priority
        const priorityOrder = { critical: 0, high: 1, normal: 2, low: 3 };
        pendingTasks.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
        for (const agent of idleAgents) {
            if (pendingTasks.length === 0)
                break;
            // Find suitable task for this agent
            for (let i = 0; i < pendingTasks.length; i++) {
                const task = pendingTasks[i];
                // Skip blocked tasks
                if (task.blockedBy && task.blockedBy.length > 0)
                    continue;
                // Try to assign
                const assigned = await this.assignTask(task.id, agent.id);
                if (assigned) {
                    pendingTasks.splice(i, 1);
                    break;
                }
            }
        }
    }
    unblockDependentTasks(completedTaskId) {
        for (const task of Object.values(this.state.tasks)) {
            if (task.blockedBy) {
                const index = task.blockedBy.indexOf(completedTaskId);
                if (index > -1) {
                    task.blockedBy.splice(index, 1);
                }
            }
        }
    }
}
export default TaskServer;
//# sourceMappingURL=TaskServer.js.map