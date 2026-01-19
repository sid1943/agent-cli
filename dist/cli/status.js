#!/usr/bin/env node
// CLI for checking Agent Coordinator status
import { findProjectRoot, getCoordinatorPaths } from '../shared/config.js';
import { StateManager } from '../shared/protocol.js';
import * as fs from 'fs';
// ANSI color codes
const colors = {
    reset: '\x1b[0m',
    bold: '\x1b[1m',
    dim: '\x1b[2m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    red: '\x1b[31m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
};
function colorize(text, color) {
    return `${colors[color]}${text}${colors.reset}`;
}
function formatDuration(ms) {
    if (ms < 1000)
        return `${ms}ms`;
    if (ms < 60000)
        return `${(ms / 1000).toFixed(1)}s`;
    if (ms < 3600000)
        return `${(ms / 60000).toFixed(1)}m`;
    return `${(ms / 3600000).toFixed(1)}h`;
}
function statusColor(status) {
    switch (status) {
        case 'idle':
            return colorize(status, 'green');
        case 'working':
            return colorize(status, 'blue');
        case 'blocked':
            return colorize(status, 'yellow');
        case 'error':
        case 'offline':
            return colorize(status, 'red');
        case 'pending':
            return colorize(status, 'yellow');
        case 'in_progress':
            return colorize(status, 'blue');
        case 'completed':
            return colorize(status, 'green');
        case 'failed':
            return colorize(status, 'red');
        default:
            return status;
    }
}
function priorityColor(priority) {
    switch (priority) {
        case 'critical':
            return colorize(priority, 'red');
        case 'high':
            return colorize(priority, 'yellow');
        case 'normal':
            return colorize(priority, 'white');
        case 'low':
            return colorize(priority, 'dim');
        default:
            return priority;
    }
}
function printHeader(text) {
    console.log('');
    console.log(colorize(`═══ ${text} ═══`, 'bold'));
}
function printAgents(agents) {
    printHeader('AGENTS');
    if (agents.length === 0) {
        console.log(colorize('  No agents registered', 'dim'));
        return;
    }
    for (const agent of agents) {
        const uptime = formatDuration(Date.now() - agent.startedAt);
        const lastSeen = formatDuration(Date.now() - agent.lastHeartbeat);
        console.log(`  ${colorize(agent.id, 'cyan')}`);
        console.log(`    Status: ${statusColor(agent.status)}`);
        console.log(`    Task: ${agent.currentTask || colorize('none', 'dim')}`);
        console.log(`    Completed: ${agent.completedTasks} | Failed: ${agent.failedTasks}`);
        console.log(`    Uptime: ${uptime} | Last seen: ${lastSeen} ago`);
        console.log('');
    }
}
function printTasks(tasks, queue) {
    printHeader('TASKS');
    const pending = tasks.filter(t => t.status === 'pending');
    const inProgress = tasks.filter(t => t.status === 'in_progress' || t.status === 'assigned');
    const completed = tasks.filter(t => t.status === 'completed');
    const failed = tasks.filter(t => t.status === 'failed');
    console.log(`  Total: ${tasks.length} | Pending: ${pending.length} | In Progress: ${inProgress.length} | Completed: ${completed.length} | Failed: ${failed.length}`);
    console.log('');
    // Show queue
    if (queue.length > 0) {
        console.log(colorize('  Queue:', 'bold'));
        for (let i = 0; i < Math.min(5, queue.length); i++) {
            const task = tasks.find(t => t.id === queue[i]);
            if (task) {
                console.log(`    ${i + 1}. [${priorityColor(task.priority)}] ${task.title}`);
            }
        }
        if (queue.length > 5) {
            console.log(colorize(`    ... and ${queue.length - 5} more`, 'dim'));
        }
        console.log('');
    }
    // Show in-progress tasks
    if (inProgress.length > 0) {
        console.log(colorize('  In Progress:', 'bold'));
        for (const task of inProgress) {
            const duration = task.startedAt ? formatDuration(Date.now() - task.startedAt) : '-';
            console.log(`    ${colorize(task.id, 'cyan')}: ${task.title}`);
            console.log(`      Agent: ${task.assignedAgent || '-'} | Running: ${duration}`);
        }
        console.log('');
    }
    // Show recent completed
    const recentCompleted = completed
        .sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0))
        .slice(0, 3);
    if (recentCompleted.length > 0) {
        console.log(colorize('  Recently Completed:', 'bold'));
        for (const task of recentCompleted) {
            const ago = task.completedAt ? formatDuration(Date.now() - task.completedAt) : '-';
            console.log(`    ${colorize('✓', 'green')} ${task.title} (${ago} ago)`);
        }
        console.log('');
    }
    // Show failed
    if (failed.length > 0) {
        console.log(colorize('  Failed:', 'bold'));
        for (const task of failed.slice(0, 3)) {
            console.log(`    ${colorize('✗', 'red')} ${task.title}`);
            if (task.error) {
                console.log(`      Error: ${task.error.substring(0, 50)}...`);
            }
        }
        console.log('');
    }
}
function printLocks(locks) {
    if (locks.length === 0)
        return;
    printHeader('LOCKS');
    for (const lock of locks.slice(0, 10)) {
        const remaining = formatDuration(Math.max(0, lock.expiresAt - Date.now()));
        console.log(`  ${lock.path}`);
        console.log(`    Held by: ${lock.agentId} | Expires in: ${remaining}`);
    }
    if (locks.length > 10) {
        console.log(colorize(`  ... and ${locks.length - 10} more locks`, 'dim'));
    }
    console.log('');
}
async function main() {
    const args = process.argv.slice(2);
    const projectPath = args[0] || findProjectRoot();
    console.log(colorize('╔════════════════════════════════════════════════════════════╗', 'bold'));
    console.log(colorize('║           Agent Coordinator Status                          ║', 'bold'));
    console.log(colorize('╚════════════════════════════════════════════════════════════╝', 'bold'));
    const paths = getCoordinatorPaths(projectPath);
    // Check if coordinator is set up
    if (!fs.existsSync(paths.root)) {
        console.log('');
        console.log(colorize('No coordinator found in this directory.', 'yellow'));
        console.log('Run `agent-server` to initialize.');
        console.log('');
        process.exit(0);
    }
    // Read state
    const stateManager = new StateManager(paths.state);
    const state = await stateManager.readState();
    if (!state) {
        console.log('');
        console.log(colorize('No state file found. Server may not have been started.', 'yellow'));
        console.log('');
        process.exit(0);
    }
    console.log('');
    console.log(`Project: ${colorize(state.projectPath, 'cyan')}`);
    console.log(`Started: ${new Date(state.startedAt).toLocaleString()}`);
    // Print sections
    const agents = Object.values(state.agents);
    const tasks = Object.values(state.tasks);
    printAgents(agents);
    printTasks(tasks, state.taskQueue);
    // Read locks
    const locksFile = paths.locks + '/active.json';
    if (fs.existsSync(locksFile)) {
        try {
            const locks = JSON.parse(fs.readFileSync(locksFile, 'utf-8'));
            printLocks(locks);
        }
        catch {
            // Ignore
        }
    }
    console.log(colorize('─'.repeat(60), 'dim'));
    console.log('');
}
main().catch(console.error);
//# sourceMappingURL=status.js.map