export { TaskServer } from './server/TaskServer.js';
export { LockManager } from './server/LockManager.js';
export { AgentClient } from './client/AgentClient.js';
export type { AgentInfo, AgentStatus, Task, TaskStatus, TaskPriority, TaskResult, TaskContext, TaskCreateOptions, FileLock, LockRequest, LockResult, ServerState, ServerConfig, Message, MessageType, Event, EventType, AgentStartOptions, AgentCoordinatorAPI, } from './shared/types.js';
export { DEFAULT_CONFIG, loadConfig, loadConfigFromEnv, loadConfigFromFile, findProjectRoot, getCoordinatorPaths, ensureCoordinatorDirs, } from './shared/config.js';
export { generateId, createMessage, FileMessageQueue, StateManager, } from './shared/protocol.js';
export { generateAgentId, generateTaskId, gitCommand, getCurrentBranch, branchExists, createBranch, switchBranch, getModifiedFiles, commitChanges, hasUncommittedChanges, stashChanges, popStash, sleep, formatDuration, formatTimestamp, } from './shared/utils.js';
export declare function createCoordinator(projectPath?: string): Promise<import("./server/TaskServer.js").TaskServer>;
export declare function createAgent(options?: {
    name?: string;
    workDir?: string;
    autoAccept?: boolean;
}): Promise<import("./client/AgentClient.js").AgentClient>;
//# sourceMappingURL=index.d.ts.map