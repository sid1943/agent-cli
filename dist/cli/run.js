#!/usr/bin/env node
// Unified Agent CLI - Run everything from a single terminal
import { ensureCoordinatorDirs } from '../shared/config.js';
import { spawn } from 'child_process';
import * as readline from 'readline';
import * as path from 'path';
import * as fs from 'fs';
const AGENT_TYPES = [
    {
        id: 'fullstack',
        name: 'Full-Stack Developer',
        description: 'Frontend, backend, database',
        capabilities: ['frontend', 'backend', 'database', 'api', 'testing'],
        promptPrefix: 'You are a full-stack developer.',
    },
    {
        id: 'frontend',
        name: 'Frontend Specialist',
        description: 'React, CSS, UI components',
        capabilities: ['frontend', 'react', 'css', 'ui', 'components'],
        promptPrefix: 'You are a frontend specialist focused on React and UI.',
    },
    {
        id: 'backend',
        name: 'Backend Engineer',
        description: 'APIs, databases, server logic',
        capabilities: ['backend', 'api', 'database', 'server', 'auth'],
        promptPrefix: 'You are a backend engineer focused on APIs and databases.',
    },
    {
        id: 'tester',
        name: 'QA/Test Engineer',
        description: 'Tests, bugs, quality',
        capabilities: ['testing', 'unit-tests', 'integration', 'e2e', 'qa'],
        promptPrefix: 'You are a QA engineer focused on testing and quality.',
    },
    {
        id: 'refactor',
        name: 'Code Refactorer',
        description: 'Code quality, performance',
        capabilities: ['refactor', 'optimization', 'cleanup', 'architecture'],
        promptPrefix: 'You are focused on code quality and refactoring.',
    },
    {
        id: 'docs',
        name: 'Documentation Writer',
        description: 'Docs, comments, README',
        capabilities: ['documentation', 'readme', 'comments', 'api-docs'],
        promptPrefix: 'You are a technical writer focused on documentation.',
    },
];
// Readline helpers
function createRL() {
    return readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
}
async function prompt(rl, question) {
    return new Promise((resolve) => {
        rl.question(question, (answer) => resolve(answer.trim()));
    });
}
// Directory helpers
function resolveDir(input, currentDir) {
    // Handle common shortcuts
    if (input === '~') {
        return process.env.HOME || process.env.USERPROFILE || currentDir;
    }
    if (input === '-') {
        return currentDir; // Could track previous dir
    }
    // Handle relative and absolute paths
    if (path.isAbsolute(input)) {
        return input;
    }
    return path.resolve(currentDir, input);
}
function listDirectory(dir) {
    try {
        return fs.readdirSync(dir);
    }
    catch {
        return [];
    }
}
function getDirectoryInfo(dir) {
    const items = listDirectory(dir);
    let files = 0;
    let dirs = 0;
    for (const item of items) {
        const fullPath = path.join(dir, item);
        try {
            const stat = fs.statSync(fullPath);
            if (stat.isDirectory())
                dirs++;
            else
                files++;
        }
        catch {
            // Skip inaccessible items
        }
    }
    return {
        files,
        dirs,
        hasGit: fs.existsSync(path.join(dir, '.git')),
        hasPackageJson: fs.existsSync(path.join(dir, 'package.json')),
    };
}
// Status display
function showStatus(state) {
    const info = getDirectoryInfo(state.currentDir);
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║                    Agent Status                             ║');
    console.log('╠════════════════════════════════════════════════════════════╣');
    console.log(`║  🤖 Agent:     ${state.agentType.name.padEnd(42)}║`);
    console.log(`║  📁 Directory: ${state.currentDir.slice(-42).padEnd(42)}║`);
    console.log(`║  📊 Contents:  ${`${info.files} files, ${info.dirs} folders`.padEnd(42)}║`);
    console.log(`║  🔧 Git:       ${(info.hasGit ? 'Yes' : 'No').padEnd(42)}║`);
    console.log(`║  📦 Node:      ${(info.hasPackageJson ? 'Yes' : 'No').padEnd(42)}║`);
    if (state.targetFiles.length > 0) {
        console.log(`║  📄 Files:     ${state.targetFiles.slice(0, 3).join(', ').slice(0, 42).padEnd(42)}║`);
    }
    if (state.targetDirs.length > 0) {
        console.log(`║  📂 Dirs:      ${state.targetDirs.slice(0, 3).join(', ').slice(0, 42).padEnd(42)}║`);
    }
    console.log('╚════════════════════════════════════════════════════════════╝\n');
}
// Execute task with Claude
async function executeWithClaude(taskDescription, state) {
    let fullPrompt = `${state.agentType.promptPrefix}\n\n`;
    fullPrompt += `Current working directory: ${state.currentDir}\n\n`;
    fullPrompt += `# Task: ${taskDescription}\n\n`;
    if (state.targetFiles.length > 0) {
        fullPrompt += `## Target Files\n${state.targetFiles.map(f => `- ${f}`).join('\n')}\n\n`;
    }
    if (state.targetDirs.length > 0) {
        fullPrompt += `## Target Directories\n${state.targetDirs.map(d => `- ${d}`).join('\n')}\n\n`;
    }
    fullPrompt += `## Requirements
- Complete the task as described
- Make minimal, focused changes
- Follow existing code patterns
- Test if applicable

Please proceed.`;
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`🤖 Agent: ${state.agentType.name}`);
    console.log(`📁 Working in: ${state.currentDir}`);
    console.log(`📋 Task: ${taskDescription}`);
    console.log(`${'═'.repeat(60)}\n`);
    return new Promise((resolve, reject) => {
        const claudeProcess = spawn('npx', [
            'claude',
            '--print',
            '--model', state.model,
            '-p', fullPrompt
        ], {
            cwd: state.currentDir,
            shell: true,
            stdio: 'inherit'
        });
        claudeProcess.on('close', (code) => {
            console.log(`\n${'═'.repeat(60)}`);
            if (code === 0) {
                console.log(`✅ Task completed successfully`);
            }
            else {
                console.log(`❌ Task failed with code ${code}`);
            }
            console.log(`${'═'.repeat(60)}\n`);
            resolve();
        });
        claudeProcess.on('error', reject);
    });
}
// Interactive mode - main loop
async function interactiveMode(initialDir, model) {
    const rl = createRL();
    const state = {
        currentDir: initialDir,
        agentType: AGENT_TYPES[0],
        targetFiles: [],
        targetDirs: [],
        history: [],
        model,
    };
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║              Agent Command Center                           ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    showStatus(state);
    console.log('Commands:');
    console.log('  /cd <path>     - Change directory');
    console.log('  /ls            - List current directory');
    console.log('  /status, /s    - Show full status');
    console.log('  /type, /t      - Change agent type');
    console.log('  /files, /f     - Set target files');
    console.log('  /dirs, /d      - Set target directories');
    console.log('  /clear, /c     - Clear targets');
    console.log('  /help, /h      - Show all commands');
    console.log('  /quit, /q      - Exit');
    console.log('\nOr just type a task to execute it!\n');
    const processInput = async (input) => {
        const trimmed = input.trim();
        if (!trimmed)
            return true;
        // Add to history
        state.history.push(trimmed);
        // Commands
        if (trimmed.startsWith('/')) {
            const [cmd, ...args] = trimmed.slice(1).split(' ');
            const argStr = args.join(' ').trim();
            switch (cmd.toLowerCase()) {
                case 'cd':
                    if (!argStr) {
                        // Go to home directory
                        state.currentDir = process.env.HOME || process.env.USERPROFILE || state.currentDir;
                    }
                    else {
                        const newDir = resolveDir(argStr, state.currentDir);
                        if (fs.existsSync(newDir) && fs.statSync(newDir).isDirectory()) {
                            state.currentDir = newDir;
                            console.log(`\n📁 Changed to: ${state.currentDir}`);
                            const info = getDirectoryInfo(state.currentDir);
                            console.log(`   ${info.files} files, ${info.dirs} folders${info.hasGit ? ', git repo' : ''}${info.hasPackageJson ? ', node project' : ''}\n`);
                        }
                        else {
                            console.log(`\n❌ Directory not found: ${newDir}\n`);
                        }
                    }
                    break;
                case 'ls':
                case 'dir':
                    const items = listDirectory(state.currentDir);
                    console.log(`\n📂 ${state.currentDir}\n`);
                    const dirs = [];
                    const files = [];
                    for (const item of items.slice(0, 30)) {
                        const fullPath = path.join(state.currentDir, item);
                        try {
                            if (fs.statSync(fullPath).isDirectory()) {
                                dirs.push(`📁 ${item}/`);
                            }
                            else {
                                files.push(`   ${item}`);
                            }
                        }
                        catch {
                            files.push(`   ${item}`);
                        }
                    }
                    dirs.forEach(d => console.log(d));
                    files.forEach(f => console.log(f));
                    if (items.length > 30) {
                        console.log(`   ... and ${items.length - 30} more`);
                    }
                    console.log('');
                    break;
                case 'pwd':
                    console.log(`\n📁 ${state.currentDir}\n`);
                    break;
                case 'status':
                case 's':
                    showStatus(state);
                    break;
                case 'type':
                case 't':
                    console.log('\nSelect agent type:');
                    AGENT_TYPES.forEach((t, i) => {
                        const marker = t.id === state.agentType.id ? '→' : ' ';
                        console.log(`  ${marker} ${i + 1}. ${t.name.padEnd(22)} - ${t.description}`);
                    });
                    const typeChoice = await prompt(rl, '\nChoice (1-6): ');
                    const typeIndex = parseInt(typeChoice) - 1;
                    if (typeIndex >= 0 && typeIndex < AGENT_TYPES.length) {
                        state.agentType = AGENT_TYPES[typeIndex];
                        console.log(`\n✅ Switched to: ${state.agentType.name}\n`);
                    }
                    break;
                case 'files':
                case 'f':
                    if (argStr) {
                        state.targetFiles = argStr.split(',').map(f => f.trim());
                        console.log(`\n✅ Target files: ${state.targetFiles.join(', ')}\n`);
                    }
                    else {
                        const filesInput = await prompt(rl, 'Files (comma-separated): ');
                        state.targetFiles = filesInput.split(',').map(f => f.trim()).filter(f => f);
                        console.log(`\n✅ Target files: ${state.targetFiles.join(', ') || '(none)'}\n`);
                    }
                    break;
                case 'dirs':
                case 'd':
                    if (argStr) {
                        state.targetDirs = argStr.split(',').map(d => d.trim());
                        console.log(`\n✅ Target dirs: ${state.targetDirs.join(', ')}\n`);
                    }
                    else {
                        const dirsInput = await prompt(rl, 'Directories (comma-separated): ');
                        state.targetDirs = dirsInput.split(',').map(d => d.trim()).filter(d => d);
                        console.log(`\n✅ Target dirs: ${state.targetDirs.join(', ') || '(none)'}\n`);
                    }
                    break;
                case 'clear':
                case 'c':
                    state.targetFiles = [];
                    state.targetDirs = [];
                    console.log('\n✅ Cleared files and directories\n');
                    break;
                case 'projects':
                case 'p':
                    // Quick jump to common project locations
                    const projectPaths = [
                        path.join(process.env.USERPROFILE || '', 'OneDrive', 'Desktop', 'Projects'),
                        path.join(process.env.USERPROFILE || '', 'Desktop', 'Projects'),
                        path.join(process.env.USERPROFILE || '', 'Projects'),
                        path.join(process.env.HOME || '', 'projects'),
                    ];
                    for (const p of projectPaths) {
                        if (fs.existsSync(p)) {
                            state.currentDir = p;
                            console.log(`\n📁 Changed to: ${state.currentDir}`);
                            const items = listDirectory(p);
                            console.log(`   Projects found: ${items.filter(i => {
                                try {
                                    return fs.statSync(path.join(p, i)).isDirectory();
                                }
                                catch {
                                    return false;
                                }
                            }).length}\n`);
                            break;
                        }
                    }
                    break;
                case 'help':
                case 'h':
                case '?':
                    console.log(`
╔════════════════════════════════════════════════════════════╗
║  Navigation Commands                                        ║
╠════════════════════════════════════════════════════════════╣
║  /cd <path>       - Change directory                       ║
║  /ls, /dir        - List current directory                 ║
║  /pwd             - Print current directory                ║
║  /projects, /p    - Jump to Projects folder                ║
╠════════════════════════════════════════════════════════════╣
║  Agent Commands                                             ║
╠════════════════════════════════════════════════════════════╣
║  /type, /t        - Change agent type                      ║
║  /files, /f       - Set target files                       ║
║  /dirs, /d        - Set target directories                 ║
║  /clear, /c       - Clear files/dirs                       ║
║  /status, /s      - Show current settings                  ║
╠════════════════════════════════════════════════════════════╣
║  General                                                    ║
╠════════════════════════════════════════════════════════════╣
║  /help, /h        - Show this help                         ║
║  /quit, /q        - Exit                                   ║
╠════════════════════════════════════════════════════════════╣
║  Or just type a task description to run it!                ║
╚════════════════════════════════════════════════════════════╝
`);
                    break;
                case 'quit':
                case 'q':
                case 'exit':
                    console.log('\n👋 Goodbye!\n');
                    return false;
                default:
                    console.log(`\n❌ Unknown command: /${cmd}. Type /help for commands.\n`);
            }
            return true;
        }
        // It's a task - execute it
        await executeWithClaude(trimmed, state);
        return true;
    };
    // Main loop
    const askForInput = () => {
        const shortDir = state.currentDir.split(path.sep).slice(-2).join(path.sep);
        rl.question(`[${state.agentType.id}] ${shortDir} > `, async (input) => {
            try {
                const continueLoop = await processInput(input);
                if (continueLoop) {
                    askForInput();
                }
                else {
                    rl.close();
                    process.exit(0);
                }
            }
            catch (error) {
                console.error('Error:', error);
                askForInput();
            }
        });
    };
    askForInput();
}
// Quick run - single task execution
async function quickRun(task, agentTypeId, workDir, model, files, dirs) {
    const agentType = AGENT_TYPES.find(t => t.id === agentTypeId) || AGENT_TYPES[0];
    const state = {
        currentDir: workDir,
        agentType,
        targetFiles: files || [],
        targetDirs: dirs || [],
        history: [],
        model,
    };
    await executeWithClaude(task, state);
}
// Parse arguments
function parseArgs() {
    const args = process.argv.slice(2);
    const options = {};
    let i = 0;
    while (i < args.length) {
        const arg = args[i];
        switch (arg) {
            case '-t':
            case '--type':
                options.type = args[++i];
                break;
            case '-f':
            case '--files':
                options.files = args[++i]?.split(',').map(f => f.trim());
                break;
            case '-d':
            case '--dirs':
                options.dirs = args[++i]?.split(',').map(d => d.trim());
                break;
            case '-m':
            case '--model':
                options.model = args[++i];
                break;
            case '-w':
            case '--workdir':
                options.workDir = args[++i];
                break;
            case '-i':
            case '--interactive':
                options.interactive = true;
                break;
            case '-h':
            case '--help':
                console.log(`
Agent - Run AI agents on your codebase

Usage:
  agent "task description"              Run a task immediately
  agent -i                              Interactive mode
  agent --help                          Show this help

Options:
  -t, --type <type>      Agent type: fullstack, frontend, backend, tester, refactor, docs
  -f, --files <list>     Target files (comma-separated)
  -d, --dirs <list>      Target directories (comma-separated)
  -m, --model <model>    Claude model (default: claude-sonnet-4-20250514)
  -w, --workdir <path>   Working directory
  -i, --interactive      Start interactive mode

Interactive Commands:
  /cd <path>     - Change directory
  /ls            - List files
  /projects      - Jump to Projects folder
  /status        - Show agent status
  /type          - Change agent type
  /help          - Show all commands

Examples:
  agent "Fix the login bug"
  agent "Add dark mode" -t frontend -d src/components/
  agent "Write tests" -t tester -f src/auth.ts
  agent -i
`);
                process.exit(0);
                break;
            default:
                if (!arg.startsWith('-') && !options.task) {
                    options.task = arg;
                }
        }
        i++;
    }
    return options;
}
async function main() {
    const options = parseArgs();
    const workDir = options.workDir || process.cwd();
    const model = options.model || 'claude-sonnet-4-20250514';
    // Ensure coordinator dirs exist (for any future multi-agent use)
    try {
        ensureCoordinatorDirs(workDir);
    }
    catch {
        // Ignore if not in a project
    }
    if (options.interactive || (!options.task && process.argv.length <= 2)) {
        // Interactive mode
        await interactiveMode(workDir, model);
    }
    else if (options.task) {
        // Quick run
        await quickRun(options.task, options.type || 'fullstack', workDir, model, options.files, options.dirs);
    }
    else {
        console.log('No task provided. Use -i for interactive mode or provide a task.');
        console.log('Run: agent --help for usage');
    }
}
main().catch(console.error);
//# sourceMappingURL=run.js.map