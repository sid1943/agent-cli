import { ServerState, ServerConfig, AgentInfo, AgentStatus, Task, TaskResult, Event, TaskCreateOptions } from '../shared/types.js';
export declare class TaskServer {
    private config;
    private state;
    private paths;
    private stateManager;
    private messageQueue;
    private lockManager;
    private eventListeners;
    private watchInterval;
    constructor(config?: Partial<ServerConfig>);
    /**
     * Initialize the server
     */
    initialize(): Promise<void>;
    /**
     * Start watching for agent messages
     */
    startWatching(): void;
    /**
     * Stop watching
     */
    stopWatching(): void;
    /**
     * Register a new agent
     */
    registerAgent(agentId: string, info: Partial<AgentInfo>): Promise<AgentInfo>;
    /**
     * Unregister an agent
     */
    unregisterAgent(agentId: string): Promise<void>;
    /**
     * Update agent heartbeat
     */
    updateHeartbeat(agentId: string, status?: AgentStatus, progress?: number): Promise<void>;
    /**
     * Get all agents
     */
    getAgents(): AgentInfo[];
    /**
     * Get idle agents
     */
    getIdleAgents(): AgentInfo[];
    /**
     * Create a new task
     */
    createTask(options: TaskCreateOptions): Promise<Task>;
    /**
     * Assign task to agent
     */
    assignTask(taskId: string, agentId: string): Promise<Task | null>;
    /**
     * Start task (agent confirms it started working)
     */
    startTask(taskId: string, agentId: string): Promise<void>;
    /**
     * Complete task
     */
    completeTask(taskId: string, agentId: string, result: TaskResult): Promise<void>;
    /**
     * Fail task
     */
    failTask(taskId: string, agentId: string, error: string): Promise<void>;
    /**
     * Unassign task (return to queue)
     */
    unassignTask(taskId: string): Promise<void>;
    /**
     * Get pending tasks
     */
    getPendingTasks(): Task[];
    /**
     * Get all tasks
     */
    getTasks(): Task[];
    getLocks(): import("../shared/types.js").FileLock[];
    /**
     * Get current state
     */
    getState(): ServerState;
    /**
     * Subscribe to events
     */
    onEvent(callback: (event: Event) => void): () => void;
    private createInitialState;
    private saveState;
    private emitEvent;
    private processAgentMessages;
    private handleAgentMessage;
    private checkAgentHeartbeats;
    private cleanupDisconnectedAgents;
    private autoAssignTasks;
    private unblockDependentTasks;
}
export default TaskServer;
//# sourceMappingURL=TaskServer.d.ts.map