# Agent Coordinator

Multi-terminal AI agent coordination system that enables multiple Claude Code instances to work in parallel on the same codebase.

## Features

- **Parallel Agents** - Run multiple Claude Code agents in separate terminals
- **Task Queue** - Priority-based task queue with automatic assignment
- **File Locking** - Prevents concurrent edits to the same files
- **Git Integration** - Automatic branch creation for isolation
- **Message Bus** - File-based communication (no server process required)
- **Status Dashboard** - Real-time status monitoring

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        YOUR PROJECT                              │
│                                                                  │
│  .agent-coordinator/                                             │
│  ├── state.json          # Shared state file                     │
│  ├── tasks/              # Task definitions                      │
│  ├── locks/              # File lock registry                    │
│  ├── agents/             # Per-agent inbox/outbox                │
│  │   ├── swift-falcon-42/                                       │
│  │   │   ├── inbox/      # Messages TO this agent               │
│  │   │   └── outbox/     # Messages FROM this agent             │
│  │   └── keen-wolf-87/                                          │
│  │       ├── inbox/                                              │
│  │       └── outbox/                                             │
│  └── messages/           # Global message board                  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

Terminal 1 (Server):     Terminal 2 (Agent):     Terminal 3 (Agent):
┌──────────────────┐     ┌──────────────────┐    ┌──────────────────┐
│ agent-server     │     │ agent-client     │    │ agent-client     │
│                  │     │ --name alpha     │    │ --name beta      │
│ - Monitors state │     │                  │    │                  │
│ - Assigns tasks  │     │ - Accepts tasks  │    │ - Accepts tasks  │
│ - Resolves locks │     │ - Runs Claude    │    │ - Runs Claude    │
└──────────────────┘     └──────────────────┘    └──────────────────┘
```

## Installation

```bash
cd agents
npm install
npm run build
npm link  # Makes commands available globally
```

## Quick Start

### 1. Start the Coordinator (Terminal 1)

```bash
cd your-project
agent-server
```

### 2. Add Tasks

```bash
# Add tasks to the queue
agent-task add "Fix login bug" --priority high --files src/auth.ts
agent-task add "Add unit tests for user service" --files tests/user.test.ts
agent-task add "Refactor database module" --priority normal --dirs src/db/
```

### 3. Start Agents (Terminal 2, 3, etc.)

```bash
# Terminal 2
agent-client --name alpha

# Terminal 3
agent-client --name beta
```

### 4. Monitor Status

```bash
# In another terminal
agent-status
```

## CLI Commands

### agent-server

Starts the coordination server that watches for agents and assigns tasks.

```bash
agent-server [project-path]
```

### agent-client

Starts an agent that connects to the coordinator and executes tasks.

```bash
agent-client [options]

Options:
  -n, --name <name>    Agent name (default: auto-generated)
  -d, --dir <path>     Working directory
  --no-auto            Don't auto-accept tasks
  -m, --model <model>  Claude model (default: claude-sonnet-4-20250514)
```

### agent-task

Manage tasks in the queue.

```bash
agent-task add <title> [options]
agent-task list
agent-task show <id>
agent-task interactive

Options for 'add':
  --desc <text>         Description
  --priority <p>        critical, high, normal, low
  --files <f1,f2>       Target files
  --dirs <d1,d2>        Target directories
  --depends <id1,id2>   Dependencies
```

### agent-status

Show current status of agents and tasks.

```bash
agent-status [project-path]
```

## Programmatic Usage

```typescript
import { createCoordinator, createAgent, TaskServer, AgentClient } from '@anthropic/agent-coordinator';

// Server side
const server = await createCoordinator('/path/to/project');
server.startWatching();

// Create tasks
await server.createTask({
  title: 'Fix login bug',
  description: 'Users cannot log in with email',
  priority: 'high',
  files: ['src/auth.ts'],
});

// Client side (each agent in separate process)
const agent = await createAgent({ name: 'worker-1' });

await agent.start(async (task) => {
  // Execute task with Claude Code or custom logic
  console.log(`Working on: ${task.title}`);

  // Return result
  return {
    success: true,
    summary: 'Fixed the login bug',
    filesModified: ['src/auth.ts'],
    filesCreated: [],
    filesDeleted: [],
  };
});
```

## File Locking

The system prevents multiple agents from editing the same files:

```typescript
// Agent automatically acquires locks for task.targetFiles
// Or manually request locks:
const result = await agent.requestLocks(['src/auth.ts', 'src/user.ts']);

if (result.success) {
  // Safe to edit files
  // ...
  await agent.releaseLocks(['src/auth.ts', 'src/user.ts']);
}
```

## Configuration

Create `.agent-coordinator/config.json` in your project:

```json
{
  "maxAgents": 10,
  "heartbeatInterval": 5000,
  "heartbeatTimeout": 30000,
  "lockTimeout": 300000,
  "taskTimeout": 3600000,
  "autoAssign": true,
  "gitIntegration": true,
  "branchPrefix": "agent/"
}
```

Or use environment variables:

```bash
export AGENT_MAX_AGENTS=5
export AGENT_AUTO_ASSIGN=true
export AGENT_GIT_INTEGRATION=false
```

## Task Priority

Tasks are processed in priority order:

1. `critical` - Urgent issues, processed immediately
2. `high` - Important tasks
3. `normal` - Standard priority (default)
4. `low` - Background tasks

## Events

Subscribe to coordination events:

```typescript
server.onEvent((event) => {
  switch (event.type) {
    case 'agent:registered':
      console.log(`New agent: ${event.data.agent.id}`);
      break;
    case 'task:completed':
      console.log(`Task done: ${event.data.task.title}`);
      break;
    case 'lock:conflict':
      console.log(`Lock conflict: ${event.data.path}`);
      break;
  }
});
```

## License

MIT
