export type AgentStatus = 'idle' | 'working' | 'blocked' | 'error' | 'offline';
export interface AgentInfo {
    id: string;
    name: string;
    status: AgentStatus;
    currentTask: string | null;
    workingBranch: string | null;
    workingDirectory: string;
    startedAt: number;
    lastHeartbeat: number;
    completedTasks: number;
    failedTasks: number;
    capabilities?: string[];
    metadata?: Record<string, unknown>;
}
export interface AgentHeartbeat {
    agentId: string;
    timestamp: number;
    status: AgentStatus;
    currentTask: string | null;
    progress?: number;
    message?: string;
}
export type TaskStatus = 'pending' | 'assigned' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
export type TaskPriority = 'critical' | 'high' | 'normal' | 'low';
export interface Task {
    id: string;
    title: string;
    description: string;
    priority: TaskPriority;
    status: TaskStatus;
    assignedAgent: string | null;
    assignedAt: number | null;
    createdAt: number;
    startedAt: number | null;
    completedAt: number | null;
    deadline?: number;
    estimatedMinutes?: number;
    actualMinutes?: number;
    attempts: number;
    maxAttempts: number;
    targetFiles?: string[];
    targetDirectories?: string[];
    excludeFiles?: string[];
    dependsOn?: string[];
    blockedBy?: string[];
    branch?: string;
    baseBranch?: string;
    commits?: string[];
    result?: TaskResult;
    error?: string;
    context?: TaskContext;
    tags?: string[];
    metadata?: Record<string, unknown>;
}
export interface TaskResult {
    success: boolean;
    summary: string;
    filesModified: string[];
    filesCreated: string[];
    filesDeleted: string[];
    testsRun?: number;
    testsPassed?: number;
    warnings?: string[];
    commits?: string[];
}
export interface TaskContext {
    projectPath: string;
    relevantFiles?: string[];
    codebaseContext?: string;
    previousTasks?: string[];
    relatedTasks?: string[];
    instructions?: string;
}
export interface FileLock {
    path: string;
    agentId: string;
    taskId: string;
    lockedAt: number;
    expiresAt: number;
    lockType: 'read' | 'write' | 'exclusive';
}
export interface LockRequest {
    agentId: string;
    taskId: string;
    paths: string[];
    lockType: 'read' | 'write' | 'exclusive';
    timeoutMs?: number;
}
export interface LockResult {
    success: boolean;
    acquired: string[];
    failed: string[];
    conflicts?: {
        path: string;
        heldBy: string;
    }[];
}
export type MessageType = 'AGENT_REGISTER' | 'AGENT_HEARTBEAT' | 'AGENT_DISCONNECT' | 'TASK_REQUEST' | 'TASK_ASSIGN' | 'TASK_UPDATE' | 'TASK_COMPLETE' | 'TASK_FAILED' | 'LOCK_REQUEST' | 'LOCK_RELEASE' | 'LOCK_RESPONSE' | 'CONFLICT_DETECTED' | 'MERGE_REQUEST' | 'SYNC_STATE' | 'BROADCAST';
export interface Message<T = unknown> {
    id: string;
    type: MessageType;
    timestamp: number;
    source: string;
    target?: string;
    payload: T;
    correlationId?: string;
}
export interface ServerState {
    version: string;
    startedAt: number;
    projectPath: string;
    agents: Record<string, AgentInfo>;
    tasks: Record<string, Task>;
    locks: Record<string, FileLock>;
    taskQueue: string[];
    completedTasks: string[];
    config: ServerConfig;
}
export interface ServerConfig {
    projectPath: string;
    maxAgents: number;
    heartbeatInterval: number;
    heartbeatTimeout: number;
    lockTimeout: number;
    taskTimeout: number;
    autoAssign: boolean;
    gitIntegration: boolean;
    branchPrefix: string;
    stateFile: string;
    logFile: string;
}
export type EventType = 'agent:registered' | 'agent:disconnected' | 'agent:status_changed' | 'task:created' | 'task:assigned' | 'task:started' | 'task:progress' | 'task:completed' | 'task:failed' | 'lock:acquired' | 'lock:released' | 'lock:conflict' | 'merge:requested' | 'merge:completed' | 'error';
export interface Event<T = unknown> {
    type: EventType;
    timestamp: number;
    source: string;
    data: T;
}
export interface TaskCreateOptions {
    title: string;
    description?: string;
    priority?: TaskPriority;
    files?: string[];
    directories?: string[];
    dependsOn?: string[];
    tags?: string[];
    estimatedMinutes?: number;
}
export interface AgentStartOptions {
    name?: string;
    workDir?: string;
    capabilities?: string[];
    autoAccept?: boolean;
}
export interface AgentCoordinatorAPI {
    registerAgent(options: AgentStartOptions): Promise<AgentInfo>;
    unregisterAgent(agentId: string): Promise<void>;
    getAgents(): Promise<AgentInfo[]>;
    createTask(options: TaskCreateOptions): Promise<Task>;
    getTasks(filter?: Partial<Task>): Promise<Task[]>;
    assignTask(taskId: string, agentId: string): Promise<Task>;
    completeTask(taskId: string, result: TaskResult): Promise<Task>;
    failTask(taskId: string, error: string): Promise<Task>;
    acquireLocks(request: LockRequest): Promise<LockResult>;
    releaseLocks(agentId: string, paths: string[]): Promise<void>;
    getLocks(): Promise<FileLock[]>;
    getState(): Promise<ServerState>;
    onEvent(callback: (event: Event) => void): () => void;
}
//# sourceMappingURL=types.d.ts.map