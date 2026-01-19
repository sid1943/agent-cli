// Configuration for Agent Coordination System

import { ServerConfig } from './types.js';
import * as fs from 'fs';
import * as path from 'path';

// Re-export ServerConfig for convenience
export type { ServerConfig } from './types.js';

// Default configuration
export const DEFAULT_CONFIG: ServerConfig = {
  projectPath: process.cwd(),
  maxAgents: 10,
  heartbeatInterval: 5000,      // 5 seconds
  heartbeatTimeout: 30000,      // 30 seconds (agent considered dead)
  lockTimeout: 300000,          // 5 minutes default lock timeout
  taskTimeout: 3600000,         // 1 hour default task timeout
  autoAssign: true,             // Auto-assign tasks to idle agents
  gitIntegration: true,         // Use git branches for isolation
  branchPrefix: 'agent/',       // Branch naming: agent/agent-1/task-123
  stateFile: '.agent-coordinator/state.json',
  logFile: '.agent-coordinator/coordinator.log',
};

// Environment variable overrides
export function loadConfigFromEnv(baseConfig: Partial<ServerConfig> = {}): ServerConfig {
  return {
    ...DEFAULT_CONFIG,
    ...baseConfig,
    projectPath: process.env.AGENT_PROJECT_PATH || baseConfig.projectPath || DEFAULT_CONFIG.projectPath,
    maxAgents: parseInt(process.env.AGENT_MAX_AGENTS || '') || baseConfig.maxAgents || DEFAULT_CONFIG.maxAgents,
    heartbeatInterval: parseInt(process.env.AGENT_HEARTBEAT_INTERVAL || '') || DEFAULT_CONFIG.heartbeatInterval,
    heartbeatTimeout: parseInt(process.env.AGENT_HEARTBEAT_TIMEOUT || '') || DEFAULT_CONFIG.heartbeatTimeout,
    autoAssign: process.env.AGENT_AUTO_ASSIGN !== 'false',
    gitIntegration: process.env.AGENT_GIT_INTEGRATION !== 'false',
    branchPrefix: process.env.AGENT_BRANCH_PREFIX || DEFAULT_CONFIG.branchPrefix,
  };
}

// Load configuration from file
export function loadConfigFromFile(configPath: string): Partial<ServerConfig> {
  try {
    if (fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, 'utf-8');
      return JSON.parse(content);
    }
  } catch (error) {
    console.error(`Failed to load config from ${configPath}:`, error);
  }
  return {};
}

// Find project root (looks for .git, package.json, or .agent-coordinator)
export function findProjectRoot(startDir: string = process.cwd()): string {
  let currentDir = startDir;
  const markers = ['.git', 'package.json', '.agent-coordinator'];

  while (currentDir !== path.dirname(currentDir)) {
    for (const marker of markers) {
      if (fs.existsSync(path.join(currentDir, marker))) {
        return currentDir;
      }
    }
    currentDir = path.dirname(currentDir);
  }

  return startDir;
}

// Coordinator directory paths
export function getCoordinatorPaths(projectPath: string) {
  const coordinatorDir = path.join(projectPath, '.agent-coordinator');

  return {
    root: coordinatorDir,
    state: path.join(coordinatorDir, 'state.json'),
    log: path.join(coordinatorDir, 'coordinator.log'),
    tasks: path.join(coordinatorDir, 'tasks'),
    locks: path.join(coordinatorDir, 'locks'),
    agents: path.join(coordinatorDir, 'agents'),
    messages: path.join(coordinatorDir, 'messages'),
    inbox: (agentId: string) => path.join(coordinatorDir, 'agents', agentId, 'inbox'),
    outbox: (agentId: string) => path.join(coordinatorDir, 'agents', agentId, 'outbox'),
  };
}

// Ensure coordinator directories exist
export function ensureCoordinatorDirs(projectPath: string): void {
  const paths = getCoordinatorPaths(projectPath);

  const dirsToCreate = [
    paths.root,
    paths.tasks,
    paths.locks,
    paths.agents,
    paths.messages,
  ];

  for (const dir of dirsToCreate) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  // Create .gitignore to avoid committing state
  const gitignorePath = path.join(paths.root, '.gitignore');
  if (!fs.existsSync(gitignorePath)) {
    fs.writeFileSync(gitignorePath, `# Agent Coordinator State
state.json
*.log
agents/
messages/
locks/
`);
  }
}

// Full configuration loader
export function loadConfig(projectPath?: string): ServerConfig {
  const root = projectPath || findProjectRoot();
  const configPath = path.join(root, '.agent-coordinator', 'config.json');

  const fileConfig = loadConfigFromFile(configPath);
  const config = loadConfigFromEnv({ ...fileConfig, projectPath: root });

  return config;
}

export default {
  DEFAULT_CONFIG,
  loadConfig,
  loadConfigFromEnv,
  loadConfigFromFile,
  findProjectRoot,
  getCoordinatorPaths,
  ensureCoordinatorDirs,
};
