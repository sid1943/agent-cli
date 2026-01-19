#!/usr/bin/env node
// CLI for running the Agent Coordinator Server

import { TaskServer } from '../server/TaskServer.js';
import { loadConfig, findProjectRoot } from '../shared/config.js';

async function main() {
  const args = process.argv.slice(2);
  const projectPath = args[0] || findProjectRoot();

  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║           Agent Coordinator Server                          ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');

  const config = loadConfig(projectPath);
  console.log(`Project: ${config.projectPath}`);
  console.log(`Max Agents: ${config.maxAgents}`);
  console.log(`Auto-assign: ${config.autoAssign}`);
  console.log(`Git Integration: ${config.gitIntegration}`);
  console.log('');

  const server = new TaskServer(config);
  await server.initialize();
  server.startWatching();

  // Subscribe to events
  server.onEvent((event) => {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    console.log(`[${timestamp}] ${event.type}: ${JSON.stringify(event.data)}`);
  });

  console.log('Server running. Press Ctrl+C to stop.');
  console.log('');

  // Print status periodically
  setInterval(() => {
    const state = server.getState();
    const agents = Object.values(state.agents);
    const idleAgents = agents.filter(a => a.status === 'idle').length;
    const workingAgents = agents.filter(a => a.status === 'working').length;
    const pendingTasks = state.taskQueue.length;

    console.log(`\n[Status] Agents: ${agents.length} (${idleAgents} idle, ${workingAgents} working) | Tasks: ${pendingTasks} pending`);
  }, 30000);

  // Handle shutdown
  process.on('SIGINT', () => {
    console.log('\nShutting down...');
    server.stopWatching();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    server.stopWatching();
    process.exit(0);
  });

  // Keep running
  await new Promise(() => {});
}

main().catch(console.error);
