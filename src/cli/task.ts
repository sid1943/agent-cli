#!/usr/bin/env node
// CLI for managing tasks in the Agent Coordinator

import { TaskServer } from '../server/TaskServer.js';
import { findProjectRoot, loadConfig } from '../shared/config.js';
import { TaskPriority } from '../shared/types.js';
import * as readline from 'readline';

function parseArgs() {
  const args = process.argv.slice(2);
  const command = args[0];
  const options: Record<string, string> = {};

  for (let i = 1; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].substring(2);
      const value = args[i + 1];
      if (value && !value.startsWith('--')) {
        options[key] = value;
        i++;
      } else {
        options[key] = 'true';
      }
    }
  }

  return { command, options, args: args.slice(1) };
}

function printHelp() {
  console.log(`
Agent Task Manager - Create and manage tasks

Usage: agent-task <command> [options]

Commands:
  add <title>           Add a new task
  list                  List all tasks
  show <id>             Show task details
  cancel <id>           Cancel a pending task
  prioritize <id> <p>   Change task priority

Options for 'add':
  --desc <text>         Task description
  --priority <p>        Priority: critical, high, normal, low
  --files <f1,f2>       Target files (comma-separated)
  --dirs <d1,d2>        Target directories (comma-separated)
  --depends <id1,id2>   Task dependencies (comma-separated)
  --tags <t1,t2>        Tags (comma-separated)

Examples:
  agent-task add "Fix login bug" --priority high --files src/auth.ts
  agent-task add "Add unit tests" --desc "Add tests for auth module" --dirs tests/
  agent-task list
  agent-task prioritize task-123 critical
`);
}

async function addTask(server: TaskServer, title: string, options: Record<string, string>) {
  const task = await server.createTask({
    title,
    description: options.desc,
    priority: (options.priority as TaskPriority) || 'normal',
    files: options.files?.split(',').map(f => f.trim()),
    directories: options.dirs?.split(',').map(d => d.trim()),
    dependsOn: options.depends?.split(',').map(d => d.trim()),
    tags: options.tags?.split(',').map(t => t.trim()),
  });

  console.log(`\nTask created: ${task.id}`);
  console.log(`  Title: ${task.title}`);
  console.log(`  Priority: ${task.priority}`);
  console.log(`  Status: ${task.status}`);
  if (task.targetFiles) console.log(`  Files: ${task.targetFiles.join(', ')}`);
  console.log('');
}

async function listTasks(server: TaskServer) {
  const tasks = server.getTasks();

  if (tasks.length === 0) {
    console.log('\nNo tasks found.\n');
    return;
  }

  console.log('\n┌────────────────────────────────────────────────────────────────┐');
  console.log('│ TASKS                                                          │');
  console.log('├────────────────────────────────────────────────────────────────┤');

  const pending = tasks.filter(t => t.status === 'pending');
  const inProgress = tasks.filter(t => t.status === 'in_progress' || t.status === 'assigned');
  const completed = tasks.filter(t => t.status === 'completed');
  const failed = tasks.filter(t => t.status === 'failed');

  if (pending.length > 0) {
    console.log('│ Pending:                                                       │');
    for (const task of pending) {
      const priority = task.priority.padEnd(8);
      const title = task.title.substring(0, 40).padEnd(40);
      console.log(`│   [${priority}] ${title} │`);
    }
  }

  if (inProgress.length > 0) {
    console.log('│ In Progress:                                                   │');
    for (const task of inProgress) {
      const agent = (task.assignedAgent || '').padEnd(15);
      const title = task.title.substring(0, 35).padEnd(35);
      console.log(`│   ${agent} ${title} │`);
    }
  }

  if (completed.length > 0) {
    console.log(`│ Completed: ${completed.length}                                                │`);
  }

  if (failed.length > 0) {
    console.log(`│ Failed: ${failed.length}                                                   │`);
  }

  console.log('└────────────────────────────────────────────────────────────────┘');
  console.log('');
}

async function showTask(server: TaskServer, taskId: string) {
  const tasks = server.getTasks();
  const task = tasks.find(t => t.id === taskId || t.id.includes(taskId));

  if (!task) {
    console.log(`\nTask not found: ${taskId}\n`);
    return;
  }

  console.log(`
Task: ${task.id}
═══════════════════════════════════════════════════

Title:       ${task.title}
Description: ${task.description || '(none)'}
Status:      ${task.status}
Priority:    ${task.priority}
`);

  if (task.assignedAgent) {
    console.log(`Assigned to: ${task.assignedAgent}`);
  }

  if (task.targetFiles) {
    console.log(`Files:       ${task.targetFiles.join(', ')}`);
  }

  if (task.targetDirectories) {
    console.log(`Directories: ${task.targetDirectories.join(', ')}`);
  }

  if (task.dependsOn) {
    console.log(`Depends on:  ${task.dependsOn.join(', ')}`);
  }

  if (task.error) {
    console.log(`\nError: ${task.error}`);
  }

  if (task.result) {
    console.log(`\nResult:`);
    console.log(`  Success: ${task.result.success}`);
    console.log(`  Summary: ${task.result.summary}`);
    if (task.result.filesModified.length > 0) {
      console.log(`  Modified: ${task.result.filesModified.join(', ')}`);
    }
  }

  console.log('');
}

async function interactiveMode(server: TaskServer) {
  console.log('\nInteractive mode. Type "help" for commands, "exit" to quit.\n');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const prompt = () => {
    rl.question('task> ', async (input) => {
      const parts = input.trim().split(/\s+/);
      const cmd = parts[0]?.toLowerCase();

      switch (cmd) {
        case 'add':
          if (parts.length < 2) {
            console.log('Usage: add <title> [--priority <p>]');
          } else {
            const title = parts.slice(1).join(' ').split('--')[0].trim();
            await addTask(server, title, {});
          }
          break;

        case 'list':
        case 'ls':
          await listTasks(server);
          break;

        case 'show':
          if (parts[1]) {
            await showTask(server, parts[1]);
          } else {
            console.log('Usage: show <task-id>');
          }
          break;

        case 'help':
          console.log(`
Commands:
  add <title>     Create a new task
  list, ls        List all tasks
  show <id>       Show task details
  status          Show coordinator status
  help            Show this help
  exit, quit      Exit interactive mode
`);
          break;

        case 'status':
          const state = server.getState();
          const agents = Object.values(state.agents);
          console.log(`\nAgents: ${agents.length} | Tasks: ${Object.keys(state.tasks).length} | Queue: ${state.taskQueue.length}\n`);
          break;

        case 'exit':
        case 'quit':
          rl.close();
          process.exit(0);
          return;

        case '':
          break;

        default:
          console.log(`Unknown command: ${cmd}. Type "help" for available commands.`);
      }

      prompt();
    });
  };

  prompt();
}

async function main() {
  const { command, options, args } = parseArgs();
  const projectPath = findProjectRoot();
  const config = loadConfig(projectPath);

  if (command === 'help' || command === '-h' || command === '--help') {
    printHelp();
    process.exit(0);
  }

  // Initialize server (reads existing state)
  const server = new TaskServer(config);
  await server.initialize();

  switch (command) {
    case 'add':
      const title = args.filter(a => !a.startsWith('--')).join(' ');
      if (!title) {
        console.log('Error: Task title required');
        console.log('Usage: agent-task add <title> [--priority <p>]');
        process.exit(1);
      }
      await addTask(server, title, options);
      break;

    case 'list':
    case 'ls':
      await listTasks(server);
      break;

    case 'show':
      if (!args[0]) {
        console.log('Error: Task ID required');
        process.exit(1);
      }
      await showTask(server, args[0]);
      break;

    case 'prioritize':
      // TODO: Implement priority change
      console.log('Priority change not yet implemented');
      break;

    case 'cancel':
      // TODO: Implement cancel
      console.log('Cancel not yet implemented');
      break;

    case 'interactive':
    case 'i':
      await interactiveMode(server);
      break;

    case undefined:
      // No command - show status
      await listTasks(server);
      break;

    default:
      console.log(`Unknown command: ${command}`);
      printHelp();
      process.exit(1);
  }
}

main().catch(console.error);
