#!/usr/bin/env node
// CLI for running an Agent Client (in a terminal)

import { AgentClient } from '../client/AgentClient.js';
import { Task, TaskResult } from '../shared/types.js';
import { findProjectRoot } from '../shared/config.js';
import { spawn } from 'child_process';
import * as readline from 'readline';

// Agent type definitions
interface AgentType {
  id: string;
  name: string;
  description: string;
  capabilities: string[];
  defaultPromptPrefix?: string;
}

const AGENT_TYPES: AgentType[] = [
  {
    id: 'fullstack',
    name: 'Full-Stack Developer',
    description: 'Can handle frontend, backend, and database tasks',
    capabilities: ['frontend', 'backend', 'database', 'api', 'testing'],
    defaultPromptPrefix: 'You are a full-stack developer.',
  },
  {
    id: 'frontend',
    name: 'Frontend Specialist',
    description: 'Focuses on React, CSS, and UI components',
    capabilities: ['frontend', 'react', 'css', 'ui', 'components'],
    defaultPromptPrefix: 'You are a frontend specialist focused on React and UI.',
  },
  {
    id: 'backend',
    name: 'Backend Engineer',
    description: 'Handles APIs, databases, and server logic',
    capabilities: ['backend', 'api', 'database', 'server', 'auth'],
    defaultPromptPrefix: 'You are a backend engineer focused on APIs and databases.',
  },
  {
    id: 'tester',
    name: 'QA/Test Engineer',
    description: 'Writes and runs tests, finds bugs',
    capabilities: ['testing', 'unit-tests', 'integration', 'e2e', 'qa'],
    defaultPromptPrefix: 'You are a QA engineer focused on testing and quality.',
  },
  {
    id: 'refactor',
    name: 'Code Refactorer',
    description: 'Improves code quality, performance, and structure',
    capabilities: ['refactor', 'optimization', 'cleanup', 'architecture'],
    defaultPromptPrefix: 'You are focused on code quality and refactoring.',
  },
  {
    id: 'docs',
    name: 'Documentation Writer',
    description: 'Writes docs, comments, and README files',
    capabilities: ['documentation', 'readme', 'comments', 'api-docs'],
    defaultPromptPrefix: 'You are a technical writer focused on documentation.',
  },
  {
    id: 'custom',
    name: 'Custom Agent',
    description: 'Define your own agent type',
    capabilities: [],
  },
];

// Create readline interface
function createRL(): readline.Interface {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

// Prompt for input
async function prompt(rl: readline.Interface, question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

// Display agent type selection menu
function displayAgentMenu(): void {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║              Select Agent Type                              ║');
  console.log('╠════════════════════════════════════════════════════════════╣');

  AGENT_TYPES.forEach((agent, index) => {
    const num = `${index + 1}.`.padEnd(4);
    const name = agent.name.padEnd(25);
    console.log(`║  ${num}${name} - ${agent.description.substring(0, 25).padEnd(25)} ║`);
  });

  console.log('╚════════════════════════════════════════════════════════════╝');
}

// Interactive setup
async function interactiveSetup(): Promise<{
  name: string;
  agentType: AgentType;
  customCapabilities?: string[];
}> {
  const rl = createRL();

  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║              Agent Setup Wizard                             ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  // Get agent name
  console.log('\n📝 Step 1: Name your agent');
  console.log('   (This helps identify it in logs and status)');
  const name = await prompt(rl, '\n   Agent name: ');

  if (!name) {
    console.log('   Using auto-generated name...');
  }

  // Select agent type
  console.log('\n🤖 Step 2: Select agent type');
  displayAgentMenu();

  const typeChoice = await prompt(rl, '\n   Enter number (1-7): ');
  const typeIndex = parseInt(typeChoice) - 1;

  let agentType: AgentType;
  let customCapabilities: string[] | undefined;

  if (typeIndex >= 0 && typeIndex < AGENT_TYPES.length) {
    agentType = AGENT_TYPES[typeIndex];
  } else {
    console.log('   Invalid choice, using Full-Stack Developer...');
    agentType = AGENT_TYPES[0];
  }

  // Custom agent setup
  if (agentType.id === 'custom') {
    console.log('\n⚙️  Custom Agent Setup');
    const capsInput = await prompt(rl, '   Capabilities (comma-separated): ');
    customCapabilities = capsInput.split(',').map(c => c.trim()).filter(c => c);

    if (customCapabilities.length === 0) {
      customCapabilities = ['general'];
    }
  }

  console.log('\n✅ Agent configured:');
  console.log(`   Name: ${name || '(auto-generated)'}`);
  console.log(`   Type: ${agentType.name}`);
  console.log(`   Capabilities: ${(customCapabilities || agentType.capabilities).join(', ')}`);

  const confirm = await prompt(rl, '\n   Start agent? (Y/n): ');

  rl.close();

  if (confirm.toLowerCase() === 'n') {
    console.log('\nAborted.');
    process.exit(0);
  }

  return { name, agentType, customCapabilities };
}

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options: {
    name?: string;
    workDir?: string;
    autoAccept?: boolean;
    claudeModel?: string;
    type?: string;
    interactive?: boolean;
  } = {};

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--name':
      case '-n':
        options.name = args[++i];
        break;
      case '--dir':
      case '-d':
        options.workDir = args[++i];
        break;
      case '--no-auto':
        options.autoAccept = false;
        break;
      case '--model':
      case '-m':
        options.claudeModel = args[++i];
        break;
      case '--type':
      case '-t':
        options.type = args[++i];
        break;
      case '--interactive':
      case '-i':
        options.interactive = true;
        break;
      case '--help':
      case '-h':
        console.log(`
Agent Client - Connect to the Agent Coordinator

Usage: agent-client [options]

Options:
  -n, --name <name>    Agent name (default: prompted)
  -t, --type <type>    Agent type: fullstack, frontend, backend, tester, refactor, docs
  -d, --dir <path>     Working directory (default: current)
  -i, --interactive    Force interactive setup
  --no-auto            Don't auto-accept tasks
  -m, --model <model>  Claude model to use (default: claude-sonnet-4-20250514)
  -h, --help           Show this help

Examples:
  agent-client                           # Interactive setup
  agent-client -n alpha -t frontend      # Named frontend agent
  agent-client --name worker1 --type backend
`);
        process.exit(0);
    }
  }

  return options;
}

// Execute task using Claude Code CLI
async function executeTaskWithClaude(
  task: Task,
  workDir: string,
  model: string,
  agentType: AgentType
): Promise<TaskResult> {
  return new Promise((resolve, reject) => {
    const prompt = buildTaskPrompt(task, agentType);

    console.log(`\n[Claude] Executing task: ${task.title}`);
    console.log(`[Claude] Agent type: ${agentType.name}`);
    console.log('');

    const claudeProcess = spawn('npx', [
      'claude',
      '--print',
      '--model', model,
      '-p', prompt
    ], {
      cwd: workDir,
      shell: true,
      stdio: ['inherit', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    claudeProcess.stdout?.on('data', (data) => {
      const text = data.toString();
      stdout += text;
      process.stdout.write(text);
    });

    claudeProcess.stderr?.on('data', (data) => {
      const text = data.toString();
      stderr += text;
      process.stderr.write(text);
    });

    claudeProcess.on('close', (code) => {
      console.log(`\n[Claude] Process exited with code: ${code}`);

      if (code === 0) {
        resolve({
          success: true,
          summary: extractSummary(stdout),
          filesModified: extractModifiedFiles(stdout),
          filesCreated: extractCreatedFiles(stdout),
          filesDeleted: [],
        });
      } else {
        reject(new Error(`Claude exited with code ${code}: ${stderr}`));
      }
    });

    claudeProcess.on('error', (error) => {
      reject(error);
    });
  });
}

// Build prompt for Claude based on task and agent type
function buildTaskPrompt(task: Task, agentType: AgentType): string {
  let prompt = '';

  // Add agent context
  if (agentType.defaultPromptPrefix) {
    prompt += `${agentType.defaultPromptPrefix}\n\n`;
  }

  prompt += `# Task: ${task.title}\n\n`;

  if (task.description) {
    prompt += `## Description\n${task.description}\n\n`;
  }

  if (task.targetFiles && task.targetFiles.length > 0) {
    prompt += `## Target Files\n`;
    for (const file of task.targetFiles) {
      prompt += `- ${file}\n`;
    }
    prompt += '\n';
  }

  if (task.targetDirectories && task.targetDirectories.length > 0) {
    prompt += `## Target Directories\n`;
    for (const dir of task.targetDirectories) {
      prompt += `- ${dir}\n`;
    }
    prompt += '\n';
  }

  if (task.context?.instructions) {
    prompt += `## Instructions\n${task.context.instructions}\n\n`;
  }

  prompt += `## Requirements
- Complete the task as described
- Make minimal, focused changes
- Follow existing code patterns
- Test your changes if applicable
- Commit your changes with a clear message

Please proceed with the implementation.`;

  return prompt;
}

// Extract summary from Claude output
function extractSummary(output: string): string {
  const lines = output.split('\n').filter(l => l.trim());
  const lastLines = lines.slice(-5);
  return lastLines.join(' ').substring(0, 500);
}

// Extract modified files from output
function extractModifiedFiles(output: string): string[] {
  const files: string[] = [];
  const patterns = [
    /(?:modified|updated|changed|edited):\s*([^\s]+)/gi,
    /(?:writing to|wrote to|saved)\s+([^\s]+)/gi,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(output)) !== null) {
      files.push(match[1]);
    }
  }

  return [...new Set(files)];
}

// Extract created files from output
function extractCreatedFiles(output: string): string[] {
  const files: string[] = [];
  const patterns = [
    /(?:created|new file):\s*([^\s]+)/gi,
    /(?:creating|wrote new)\s+([^\s]+)/gi,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(output)) !== null) {
      files.push(match[1]);
    }
  }

  return [...new Set(files)];
}

async function main() {
  const options = parseArgs();
  const workDir = options.workDir || findProjectRoot();
  const model = options.claudeModel || 'claude-sonnet-4-20250514';

  let agentName: string;
  let agentType: AgentType;
  let capabilities: string[];

  // Check if we need interactive setup
  const needsInteractive = !options.name || !options.type || options.interactive;

  if (needsInteractive && !options.type) {
    // Run interactive setup
    const setup = await interactiveSetup();
    agentName = setup.name || options.name || '';
    agentType = setup.agentType;
    capabilities = setup.customCapabilities || agentType.capabilities;
  } else {
    // Use command line options
    agentName = options.name || '';
    agentType = AGENT_TYPES.find(t => t.id === options.type) || AGENT_TYPES[0];
    capabilities = agentType.capabilities;
  }

  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║              Agent Client (Claude Code)                     ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');

  const client = new AgentClient({
    name: agentName || undefined,
    workDir,
    autoAccept: options.autoAccept !== false,
  });

  // Register with coordinator
  await client.register(capabilities);

  console.log(`Agent ID:    ${client.getId()}`);
  console.log(`Agent Type:  ${agentType.name}`);
  console.log(`Directory:   ${workDir}`);
  console.log(`Model:       ${model}`);
  console.log(`Capabilities: ${capabilities.join(', ')}`);
  console.log('');

  // Start listening for tasks
  await client.start(async (task: Task) => {
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`📋 RECEIVED TASK: ${task.title}`);
    console.log(`   ID: ${task.id}`);
    console.log(`   Priority: ${task.priority}`);
    console.log(`${'═'.repeat(60)}\n`);

    // Execute with Claude
    const result = await executeTaskWithClaude(task, workDir, model, agentType);

    console.log(`\n${'═'.repeat(60)}`);
    console.log(`✅ TASK COMPLETED`);
    console.log(`   Files modified: ${result.filesModified.length}`);
    console.log(`${'═'.repeat(60)}\n`);

    return result;
  });

  // Subscribe to messages
  client.onMessage((message) => {
    if (message.type === 'BROADCAST') {
      console.log(`\n📢 [Broadcast] ${JSON.stringify(message.payload)}`);
    }
  });

  console.log('🟢 Agent running. Waiting for tasks...');
  console.log('   Type "help" for commands, Ctrl+C to stop.\n');

  // Interactive mode
  const rl = createRL();

  rl.on('line', async (line) => {
    const cmd = line.trim().toLowerCase();

    switch (cmd) {
      case 'status':
        const info = client.getInfo();
        const task = client.getCurrentTask();
        console.log(`\n📊 Status: ${info?.status}`);
        console.log(`   Current Task: ${task?.title || 'None'}`);
        console.log(`   Completed: ${info?.completedTasks}`);
        console.log(`   Failed: ${info?.failedTasks}\n`);
        break;

      case 'request':
        console.log('🔍 Requesting task...');
        const newTask = await client.requestTask();
        if (newTask) {
          console.log(`   Received: ${newTask.title}`);
        } else {
          console.log('   No tasks available');
        }
        break;

      case 'help':
        console.log(`
Commands:
  status   - Show agent status
  request  - Request a task manually
  help     - Show this help
  quit     - Stop the agent
`);
        break;

      case 'quit':
      case 'exit':
        await client.stop();
        rl.close();
        process.exit(0);
    }
  });

  // Handle shutdown
  process.on('SIGINT', async () => {
    console.log('\n👋 Shutting down...');
    await client.stop();
    rl.close();
    process.exit(0);
  });
}

main().catch(console.error);
