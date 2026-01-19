// Agent Coordinator - Multi-terminal AI Agent Coordination System
// Enables multiple Claude Code instances to work in parallel on the same codebase

// Server exports
export { TaskServer } from './server/TaskServer.js';
export { LockManager } from './server/LockManager.js';

// Client exports
export { AgentClient } from './client/AgentClient.js';

// Shared types
export type {
  AgentInfo,
  AgentStatus,
  Task,
  TaskStatus,
  TaskPriority,
  TaskResult,
  TaskContext,
  TaskCreateOptions,
  FileLock,
  LockRequest,
  LockResult,
  ServerState,
  ServerConfig,
  Message,
  MessageType,
  Event,
  EventType,
  AgentStartOptions,
  AgentCoordinatorAPI,
} from './shared/types.js';

// Configuration
export {
  DEFAULT_CONFIG,
  loadConfig,
  loadConfigFromEnv,
  loadConfigFromFile,
  findProjectRoot,
  getCoordinatorPaths,
  ensureCoordinatorDirs,
} from './shared/config.js';

// Protocol
export {
  generateId,
  createMessage,
  FileMessageQueue,
  StateManager,
} from './shared/protocol.js';

// Utilities
export {
  generateAgentId,
  generateTaskId,
  gitCommand,
  getCurrentBranch,
  branchExists,
  createBranch,
  switchBranch,
  getModifiedFiles,
  commitChanges,
  hasUncommittedChanges,
  stashChanges,
  popStash,
  sleep,
  formatDuration,
  formatTimestamp,
} from './shared/utils.js';

// Quick start function
export async function createCoordinator(projectPath?: string) {
  const { TaskServer } = await import('./server/TaskServer.js');
  const { loadConfig, findProjectRoot } = await import('./shared/config.js');

  const path = projectPath || findProjectRoot();
  const config = loadConfig(path);
  const server = new TaskServer(config);

  await server.initialize();

  return server;
}

// Quick start client function
export async function createAgent(options?: {
  name?: string;
  workDir?: string;
  autoAccept?: boolean;
}) {
  const { AgentClient } = await import('./client/AgentClient.js');

  const client = new AgentClient(options);
  await client.register();

  return client;
}
