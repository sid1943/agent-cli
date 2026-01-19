import { AgentInfo, Task, TaskResult, Message, LockResult, AgentStartOptions } from '../shared/types.js';
export type TaskCallback = (task: Task) => Promise<TaskResult>;
export type MessageCallback = (message: Message) => void;
export declare class AgentClient {
    private config;
    private agentId;
    private agentInfo;
    private paths;
    private messageQueue;
    private stateManager;
    private running;
    private heartbeatInterval;
    private messageCheckInterval;
    private currentTask;
    private taskCallback;
    private messageCallbacks;
    private autoAcceptTasks;
    constructor(options?: AgentStartOptions);
    /**
     * Get agent ID
     */
    getId(): string;
    /**
     * Get current agent info
     */
    getInfo(): AgentInfo | null;
    /**
     * Get current task
     */
    getCurrentTask(): Task | null;
    /**
     * Register with the coordinator
     */
    register(capabilities?: string[]): Promise<AgentInfo>;
    /**
     * Start the agent (begin listening for tasks)
     */
    start(taskCallback?: TaskCallback): Promise<void>;
    /**
     * Stop the agent
     */
    stop(): Promise<void>;
    /**
     * Request a task
     */
    requestTask(): Promise<Task | null>;
    /**
     * Accept and start working on a task
     */
    acceptTask(task: Task): Promise<void>;
    /**
     * Complete current task
     */
    completeTask(result: TaskResult): Promise<void>;
    /**
     * Fail current task
     */
    failTask(error: string): Promise<void>;
    /**
     * Report progress on current task
     */
    reportProgress(progress: number, message?: string): Promise<void>;
    /**
     * Request file locks
     */
    requestLocks(paths: string[], lockType?: 'read' | 'write' | 'exclusive'): Promise<LockResult>;
    /**
     * Release file locks
     */
    releaseLocks(paths: string[]): Promise<void>;
    /**
     * Subscribe to messages
     */
    onMessage(callback: MessageCallback): () => void;
    /**
     * Get coordinator state
     */
    getState(): Promise<any>;
    private updateStatus;
    private sendMessage;
    private sendHeartbeat;
    private checkMessages;
    private handleMessage;
}
export default AgentClient;
//# sourceMappingURL=AgentClient.d.ts.map