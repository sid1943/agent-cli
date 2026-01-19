# Agent CLI

A natural language CLI for orchestrating AI coding agents across your projects. Run Claude-powered agents from a single terminal with intuitive commands.

## Features

- **Natural Language Commands** - Just type what you want: "go to projects", "use frontend agent"
- **Multiple Agent Types** - Fullstack, Frontend, Backend, Tester, Refactor, Docs specialists
- **Smart Navigation** - Navigate directories with plain English
- **AI Interpretation** - Ambiguous commands are interpreted by Claude
- **Single Terminal** - No server setup, everything runs from one place
- **Multi-Agent Mode** - Optional parallel agents for complex projects

## Installation

```bash
# Clone and install
git clone https://github.com/sid1943/agent-cli.git
cd agent-cli
npm install
npm run build
npm link
```

Or install directly:
```bash
npm install -g github:sid1943/agent-cli
```

## Quick Start

```bash
agent -i
```

That's it! You're now in interactive mode.

## Usage

### Interactive Mode (Recommended)

```bash
agent -i
```

This opens an interactive prompt where you can:

```
[fullstack] Projects > go to smart-task-hub
📁 Changed to: C:\Users\...\smart-task-hub
   42 files, 8 folders, git repo, node project

[fullstack] smart-task-hub > use frontend agent
🤖 Switched to: Frontend Specialist
   React, CSS, UI components

[frontend] smart-task-hub > fix the button alignment in Header.tsx
════════════════════════════════════════════════════════════
🤖 Agent: Frontend Specialist
📁 Working in: C:\Users\...\smart-task-hub
📋 Task: fix the button alignment in Header.tsx
════════════════════════════════════════════════════════════
... Claude executes the task ...
```

### Quick Task Mode

```bash
agent "fix the login bug"
agent "add dark mode" -t frontend
agent "write unit tests" -t tester -f src/auth.ts
```

### Command Line Options

| Option | Description |
|--------|-------------|
| `-i, --interactive` | Start interactive mode |
| `-t, --type <type>` | Agent type: fullstack, frontend, backend, tester, refactor, docs |
| `-f, --files <list>` | Target files (comma-separated) |
| `-d, --dirs <list>` | Target directories (comma-separated) |
| `-m, --model <model>` | Claude model (default: claude-sonnet-4-20250514) |
| `-w, --workdir <path>` | Working directory |

## Natural Language Commands

### Navigation

| Say This | Does This |
|----------|-----------|
| `go to projects` | Navigate to Projects folder |
| `open smart-task-hub` | Open that project |
| `cd src/components` | Change to directory |
| `back` or `..` | Go up one directory |
| `home` | Go to home directory |
| `desktop` | Go to Desktop |
| `list` or `ls` | List files |

### Agent Selection

| Say This | Does This |
|----------|-----------|
| `use frontend agent` | Switch to Frontend Specialist |
| `be a tester` | Switch to QA/Test Engineer |
| `switch to backend` | Switch to Backend Engineer |
| `fullstack mode` | Switch to Full-Stack Developer |

### Status & Help

| Say This | Does This |
|----------|-----------|
| `status` | Show current status |
| `where am i` | Show current directory & agent |
| `help` | Show all commands |
| `quit` or `exit` | Exit the CLI |

## Agent Types

| Agent | Focus | Best For |
|-------|-------|----------|
| **fullstack** | Frontend, backend, database | General development |
| **frontend** | React, CSS, UI components | UI/UX work |
| **backend** | APIs, databases, server logic | Server-side code |
| **tester** | Tests, bugs, quality | Writing tests, QA |
| **refactor** | Code quality, performance | Cleanup, optimization |
| **docs** | Documentation, comments | README, API docs |

## Slash Commands

In interactive mode, you can also use slash commands:

```
/cd <path>       - Change directory
/ls              - List files
/pwd             - Print current directory
/projects        - Jump to Projects folder
/type            - Change agent type (shows menu)
/files <list>    - Set target files
/dirs <list>     - Set target directories
/clear           - Clear file/dir targets
/status          - Show full status
/help            - Show all commands
/quit            - Exit
```

## Examples

### Frontend Development
```bash
agent -i
> go to my-react-app
> use frontend agent
> add a responsive navbar component
> fix the CSS grid layout in Dashboard.tsx
```

### Backend API Work
```bash
agent -i
> open backend-service
> switch to backend
> add authentication middleware
> create a new /users endpoint
```

### Testing
```bash
agent "write tests for the auth module" -t tester -d src/auth/
```

### Quick Fixes
```bash
agent "fix the TypeScript errors in utils.ts" -f src/utils.ts
```

---

## Multi-Agent Mode (Advanced)

For complex projects requiring parallel agents working simultaneously:

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        YOUR PROJECT                              │
│                                                                  │
│  .agent-coordinator/                                             │
│  ├── state.json          # Shared state file                     │
│  ├── tasks/              # Task definitions                      │
│  ├── locks/              # File lock registry                    │
│  └── agents/             # Per-agent inbox/outbox                │
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

### Multi-Agent Commands

```bash
# Terminal 1: Start the server
agent-server

# Terminal 2-N: Start agents
agent-client -n agent1 -t frontend
agent-client -n agent2 -t backend

# Add tasks to queue
agent-task add "implement login UI" --priority high --files src/Login.tsx
agent-task add "create auth API" --files src/api/auth.ts

# Monitor status
agent-status
```

### Task Priority

Tasks are processed in priority order:

1. `critical` - Urgent issues, processed immediately
2. `high` - Important tasks
3. `normal` - Standard priority (default)
4. `low` - Background tasks

### File Locking

The system prevents multiple agents from editing the same files simultaneously.

---

## Project Structure

```
agent-cli/
├── src/
│   ├── cli/
│   │   └── run.ts          # Main CLI with natural language processing
│   ├── client/
│   │   └── AgentClient.ts  # Agent client (for multi-agent mode)
│   ├── server/
│   │   └── TaskServer.ts   # Task server (for multi-agent mode)
│   └── shared/
│       ├── types.ts        # Type definitions
│       ├── config.ts       # Configuration
│       └── utils.ts        # Utilities
├── bin/
│   └── agent.js            # CLI entry point
└── package.json
```

## Requirements

- Node.js 18+
- Claude Code CLI (`npx claude`)

## License

MIT

## Contributing

Contributions welcome! Please open an issue or PR on [GitHub](https://github.com/sid1943/agent-cli).
