// Utility functions for Agent Coordination System
import * as fs from 'fs';
import * as path from 'path';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
const execAsync = promisify(exec);
// ============================================================================
// ID Generation
// ============================================================================
export function generateAgentId() {
    const adjectives = ['swift', 'clever', 'bold', 'keen', 'bright', 'quick', 'sharp', 'agile'];
    const nouns = ['falcon', 'wolf', 'hawk', 'tiger', 'eagle', 'panther', 'fox', 'owl'];
    const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    const num = Math.floor(Math.random() * 1000);
    return `${adj}-${noun}-${num}`;
}
export function generateTaskId() {
    return `task-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
}
// ============================================================================
// Git Operations
// ============================================================================
export async function gitCommand(cwd, args) {
    const command = `git ${args.join(' ')}`;
    return execAsync(command, { cwd });
}
export async function getCurrentBranch(cwd) {
    const { stdout } = await gitCommand(cwd, ['branch', '--show-current']);
    return stdout.trim();
}
export async function branchExists(cwd, branch) {
    try {
        await gitCommand(cwd, ['rev-parse', '--verify', branch]);
        return true;
    }
    catch {
        return false;
    }
}
export async function createBranch(cwd, branch, baseBranch) {
    const base = baseBranch || await getCurrentBranch(cwd);
    await gitCommand(cwd, ['checkout', '-b', branch, base]);
}
export async function switchBranch(cwd, branch) {
    await gitCommand(cwd, ['checkout', branch]);
}
export async function getModifiedFiles(cwd) {
    const { stdout } = await gitCommand(cwd, ['status', '--porcelain']);
    return stdout
        .split('\n')
        .filter(line => line.trim())
        .map(line => line.substring(3).trim());
}
export async function commitChanges(cwd, message) {
    await gitCommand(cwd, ['add', '-A']);
    const { stdout } = await gitCommand(cwd, ['commit', '-m', message]);
    // Extract commit hash
    const match = stdout.match(/\[[\w-]+ ([a-f0-9]+)\]/);
    return match ? match[1] : '';
}
export async function hasUncommittedChanges(cwd) {
    const { stdout } = await gitCommand(cwd, ['status', '--porcelain']);
    return stdout.trim().length > 0;
}
export async function stashChanges(cwd, message) {
    const args = ['stash', 'push'];
    if (message)
        args.push('-m', message);
    await gitCommand(cwd, args);
}
export async function popStash(cwd) {
    await gitCommand(cwd, ['stash', 'pop']);
}
// ============================================================================
// File Operations
// ============================================================================
export function ensureDir(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}
export async function readJsonFile(filepath) {
    try {
        if (!fs.existsSync(filepath))
            return null;
        const content = await fs.promises.readFile(filepath, 'utf-8');
        return JSON.parse(content);
    }
    catch {
        return null;
    }
}
export async function writeJsonFile(filepath, data) {
    const dir = path.dirname(filepath);
    ensureDir(dir);
    await fs.promises.writeFile(filepath, JSON.stringify(data, null, 2));
}
export async function appendToFile(filepath, content) {
    const dir = path.dirname(filepath);
    ensureDir(dir);
    await fs.promises.appendFile(filepath, content);
}
export function watchFile(filepath, callback) {
    return fs.watch(filepath, callback);
}
export function watchDirectory(dir, callback) {
    ensureDir(dir);
    return fs.watch(dir, { recursive: true }, callback);
}
export async function runCommand(command, args, options = {}) {
    return new Promise((resolve, reject) => {
        const proc = spawn(command, args, {
            cwd: options.cwd,
            env: { ...process.env, ...options.env },
            shell: true,
        });
        let stdout = '';
        let stderr = '';
        proc.stdout?.on('data', (data) => {
            stdout += data.toString();
        });
        proc.stderr?.on('data', (data) => {
            stderr += data.toString();
        });
        const timeout = options.timeout
            ? setTimeout(() => {
                proc.kill();
                reject(new Error('Process timeout'));
            }, options.timeout)
            : null;
        proc.on('close', (code) => {
            if (timeout)
                clearTimeout(timeout);
            resolve({
                exitCode: code ?? 1,
                stdout,
                stderr,
            });
        });
        proc.on('error', (error) => {
            if (timeout)
                clearTimeout(timeout);
            reject(error);
        });
    });
}
export function spawnProcess(command, args, options = {}) {
    return spawn(command, args, {
        cwd: options.cwd,
        env: { ...process.env, ...options.env },
        shell: true,
        detached: false,
        stdio: 'inherit',
    });
}
// ============================================================================
// Timing Utilities
// ============================================================================
export function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
export function formatDuration(ms) {
    if (ms < 1000)
        return `${ms}ms`;
    if (ms < 60000)
        return `${(ms / 1000).toFixed(1)}s`;
    if (ms < 3600000)
        return `${(ms / 60000).toFixed(1)}m`;
    return `${(ms / 3600000).toFixed(1)}h`;
}
export function formatTimestamp(timestamp) {
    return new Date(timestamp).toISOString();
}
// ============================================================================
// String Utilities
// ============================================================================
export function truncate(str, maxLength) {
    if (str.length <= maxLength)
        return str;
    return str.substring(0, maxLength - 3) + '...';
}
export function padRight(str, length) {
    return str.padEnd(length);
}
export function padLeft(str, length) {
    return str.padStart(length);
}
// ============================================================================
// Validation
// ============================================================================
export function isValidAgentId(id) {
    return /^[a-z0-9-]+$/.test(id);
}
export function isValidTaskId(id) {
    return /^task-\d+-[a-z0-9]+$/.test(id);
}
export function sanitizeFilePath(filepath, basePath) {
    const resolved = path.resolve(basePath, filepath);
    // Ensure the path is within the base path (prevent directory traversal)
    if (!resolved.startsWith(basePath)) {
        return null;
    }
    return resolved;
}
export default {
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
    ensureDir,
    readJsonFile,
    writeJsonFile,
    appendToFile,
    watchFile,
    watchDirectory,
    runCommand,
    spawnProcess,
    sleep,
    formatDuration,
    formatTimestamp,
    truncate,
    padRight,
    padLeft,
    isValidAgentId,
    isValidTaskId,
    sanitizeFilePath,
};
//# sourceMappingURL=utils.js.map