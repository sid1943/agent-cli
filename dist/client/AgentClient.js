// AgentClient - Client that runs in each terminal to participate in coordination
import * as fs from 'fs';
import * as path from 'path';
import { loadConfig, getCoordinatorPaths, ensureCoordinatorDirs } from '../shared/config.js';
import { FileMessageQueue, StateManager, createMessage } from '../shared/protocol.js';
import { generateAgentId, sleep } from '../shared/utils.js';
export class AgentClient {
    config;
    agentId;
    agentInfo = null;
    paths;
    messageQueue;
    stateManager;
    running = false;
    heartbeatInterval = null;
    messageCheckInterval = null;
    currentTask = null;
    taskCallback = null;
    messageCallbacks = [];
    autoAcceptTasks = true;
    constructor(options = {}) {
        this.config = loadConfig(options.workDir);
        this.agentId = options.name || generateAgentId();
        this.paths = getCoordinatorPaths(this.config.projectPath);
        this.messageQueue = new FileMessageQueue(this.config.projectPath);
        this.stateManager = new StateManager(this.paths.state);
        this.autoAcceptTasks = options.autoAccept ?? true;
        // Ensure directories exist
        ensureCoordinatorDirs(this.config.projectPath);
    }
    /**
     * Get agent ID
     */
    getId() {
        return this.agentId;
    }
    /**
     * Get current agent info
     */
    getInfo() {
        return this.agentInfo;
    }
    /**
     * Get current task
     */
    getCurrentTask() {
        return this.currentTask;
    }
    /**
     * Register with the coordinator
     */
    async register(capabilities) {
        // Ensure agent directories exist
        const agentDir = path.join(this.paths.agents, this.agentId);
        fs.mkdirSync(path.join(agentDir, 'inbox'), { recursive: true });
        fs.mkdirSync(path.join(agentDir, 'outbox'), { recursive: true });
        // Create agent info
        this.agentInfo = {
            id: this.agentId,
            name: this.agentId,
            status: 'idle',
            currentTask: null,
            workingBranch: null,
            workingDirectory: this.config.projectPath,
            startedAt: Date.now(),
            lastHeartbeat: Date.now(),
            completedTasks: 0,
            failedTasks: 0,
            capabilities: capabilities || [],
        };
        // Register with state
        await this.stateManager.updateState((state) => {
            if (!state) {
                state = {
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
            state.agents[this.agentId] = this.agentInfo;
            return state;
        });
        // Send registration message
        await this.sendMessage(createMessage('AGENT_REGISTER', this.agentId, { agent: this.agentInfo }, 'server'));
        console.log(`[Agent ${this.agentId}] Registered`);
        return this.agentInfo;
    }
    /**
     * Start the agent (begin listening for tasks)
     */
    async start(taskCallback) {
        if (this.running)
            return;
        this.running = true;
        this.taskCallback = taskCallback || null;
        // Start heartbeat
        this.heartbeatInterval = setInterval(() => {
            this.sendHeartbeat();
        }, this.config.heartbeatInterval);
        // Start checking for messages
        this.messageCheckInterval = setInterval(() => {
            this.checkMessages();
        }, 1000);
        console.log(`[Agent ${this.agentId}] Started and listening for tasks`);
    }
    /**
     * Stop the agent
     */
    async stop() {
        this.running = false;
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
        if (this.messageCheckInterval) {
            clearInterval(this.messageCheckInterval);
            this.messageCheckInterval = null;
        }
        // Send disconnect message
        await this.sendMessage(createMessage('AGENT_DISCONNECT', this.agentId, { agentId: this.agentId }, 'server'));
        console.log(`[Agent ${this.agentId}] Stopped`);
    }
    /**
     * Request a task
     */
    async requestTask() {
        await this.sendMessage(createMessage('TASK_REQUEST', this.agentId, { agentId: this.agentId }, 'server'));
        // Wait for response
        for (let i = 0; i < 10; i++) {
            await sleep(500);
            const messages = await this.messageQueue.readInbox(this.agentId);
            for (const msg of messages) {
                if (msg.type === 'TASK_ASSIGN') {
                    return msg.payload.task;
                }
            }
        }
        return null;
    }
    /**
     * Accept and start working on a task
     */
    async acceptTask(task) {
        this.currentTask = task;
        this.updateStatus('working');
        // Notify server that we started
        await this.sendMessage(createMessage('TASK_UPDATE', this.agentId, { taskId: task.id, status: 'in_progress' }, 'server'));
        console.log(`[Agent ${this.agentId}] Accepted task: ${task.id} - ${task.title}`);
    }
    /**
     * Complete current task
     */
    async completeTask(result) {
        if (!this.currentTask)
            return;
        await this.sendMessage(createMessage('TASK_COMPLETE', this.agentId, { taskId: this.currentTask.id, result }, 'server'));
        if (this.agentInfo) {
            this.agentInfo.completedTasks++;
        }
        console.log(`[Agent ${this.agentId}] Completed task: ${this.currentTask.id}`);
        this.currentTask = null;
        this.updateStatus('idle');
    }
    /**
     * Fail current task
     */
    async failTask(error) {
        if (!this.currentTask)
            return;
        await this.sendMessage(createMessage('TASK_FAILED', this.agentId, { taskId: this.currentTask.id, error }, 'server'));
        if (this.agentInfo) {
            this.agentInfo.failedTasks++;
        }
        console.log(`[Agent ${this.agentId}] Failed task: ${this.currentTask.id} - ${error}`);
        this.currentTask = null;
        this.updateStatus('idle');
    }
    /**
     * Report progress on current task
     */
    async reportProgress(progress, message) {
        if (!this.currentTask)
            return;
        await this.sendMessage(createMessage('TASK_UPDATE', this.agentId, {
            taskId: this.currentTask.id,
            progress,
            message,
        }, 'server'));
    }
    /**
     * Request file locks
     */
    async requestLocks(paths, lockType = 'write') {
        const request = {
            agentId: this.agentId,
            taskId: this.currentTask?.id || '',
            paths,
            lockType,
        };
        await this.sendMessage(createMessage('LOCK_REQUEST', this.agentId, request, 'server'));
        // Wait for response
        for (let i = 0; i < 20; i++) {
            await sleep(250);
            const messages = await this.messageQueue.readInbox(this.agentId);
            for (const msg of messages) {
                if (msg.type === 'LOCK_RESPONSE') {
                    return msg.payload;
                }
                // Handle other messages
                await this.handleMessage(msg);
            }
        }
        return { success: false, acquired: [], failed: paths };
    }
    /**
     * Release file locks
     */
    async releaseLocks(paths) {
        await this.sendMessage(createMessage('LOCK_RELEASE', this.agentId, { paths }, 'server'));
    }
    /**
     * Subscribe to messages
     */
    onMessage(callback) {
        this.messageCallbacks.push(callback);
        return () => {
            const index = this.messageCallbacks.indexOf(callback);
            if (index > -1)
                this.messageCallbacks.splice(index, 1);
        };
    }
    /**
     * Get coordinator state
     */
    async getState() {
        return this.stateManager.readState();
    }
    // =========================================================================
    // Private Methods
    // =========================================================================
    updateStatus(status) {
        if (this.agentInfo) {
            this.agentInfo.status = status;
            this.agentInfo.lastHeartbeat = Date.now();
        }
    }
    async sendMessage(message) {
        await this.messageQueue.sendToOutbox(this.agentId, message);
    }
    async sendHeartbeat() {
        if (!this.agentInfo)
            return;
        this.agentInfo.lastHeartbeat = Date.now();
        await this.sendMessage(createMessage('AGENT_HEARTBEAT', this.agentId, {
            status: this.agentInfo.status,
            currentTask: this.currentTask?.id || null,
        }, 'server'));
        // Also update state directly
        await this.stateManager.updateState((state) => {
            if (state && state.agents[this.agentId]) {
                state.agents[this.agentId].lastHeartbeat = Date.now();
                state.agents[this.agentId].status = this.agentInfo.status;
            }
            return state;
        });
    }
    async checkMessages() {
        if (!this.running)
            return;
        try {
            const messages = await this.messageQueue.readInbox(this.agentId);
            for (const message of messages) {
                await this.handleMessage(message);
            }
        }
        catch (error) {
            // Ignore errors during message checking
        }
    }
    async handleMessage(message) {
        // Notify callbacks
        for (const callback of this.messageCallbacks) {
            try {
                callback(message);
            }
            catch (error) {
                console.error('Message callback error:', error);
            }
        }
        switch (message.type) {
            case 'TASK_ASSIGN':
                const task = message.payload.task;
                if (this.autoAcceptTasks && this.taskCallback && !this.currentTask) {
                    await this.acceptTask(task);
                    try {
                        const result = await this.taskCallback(task);
                        await this.completeTask(result);
                    }
                    catch (error) {
                        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                        await this.failTask(errorMessage);
                    }
                }
                break;
            case 'BROADCAST':
                console.log(`[Agent ${this.agentId}] Broadcast:`, message.payload);
                break;
            case 'SYNC_STATE':
                // Handle state sync if needed
                break;
        }
    }
}
export default AgentClient;
//# sourceMappingURL=AgentClient.js.map