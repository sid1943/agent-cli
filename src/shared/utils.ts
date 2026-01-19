// Utility functions for Agent Coordination System

import * as fs from 'fs';
import * as path from 'path';
import { exec, spawn, ChildProcess } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// ============================================================================
// ID Generation
// ============================================================================

export function generateAgentId(): string {
  const adjectives = ['swift', 'clever', 'bold', 'keen', 'bright', 'quick', 'sharp', 'agile'];
  const nouns = ['falcon', 'wolf', 'hawk', 'tiger', 'eagle', 'panther', 'fox', 'owl'];

  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const num = Math.floor(Math.random() * 1000);

  return `${adj}-${noun}-${num}`;
}

export function generateTaskId(): string {
  return `task-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
}

// ============================================================================
// Git Operations
// ============================================================================

export async function gitCommand(cwd: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
  const command = `git ${args.join(' ')}`;
  return execAsync(command, { cwd });
}

export async function getCurrentBranch(cwd: string): Promise<string> {
  const { stdout } = await gitCommand(cwd, ['branch', '--show-current']);
  return stdout.trim();
}

export async function branchExists(cwd: string, branch: string): Promise<boolean> {
  try {
    await gitCommand(cwd, ['rev-parse', '--verify', branch]);
    return true;
  } catch {
    return false;
  }
}

export async function createBranch(cwd: string, branch: string, baseBranch?: string): Promise<void> {
  const base = baseBranch || await getCurrentBranch(cwd);
  await gitCommand(cwd, ['checkout', '-b', branch, base]);
}

export async function switchBranch(cwd: string, branch: string): Promise<void> {
  await gitCommand(cwd, ['checkout', branch]);
}

export async function getModifiedFiles(cwd: string): Promise<string[]> {
  const { stdout } = await gitCommand(cwd, ['status', '--porcelain']);
  return stdout
    .split('\n')
    .filter(line => line.trim())
    .map(line => line.substring(3).trim());
}

export async function commitChanges(cwd: string, message: string): Promise<string> {
  await gitCommand(cwd, ['add', '-A']);
  const { stdout } = await gitCommand(cwd, ['commit', '-m', message]);

  // Extract commit hash
  const match = stdout.match(/\[[\w-]+ ([a-f0-9]+)\]/);
  return match ? match[1] : '';
}

export async function hasUncommittedChanges(cwd: string): Promise<boolean> {
  const { stdout } = await gitCommand(cwd, ['status', '--porcelain']);
  return stdout.trim().length > 0;
}

export async function stashChanges(cwd: string, message?: string): Promise<void> {
  const args = ['stash', 'push'];
  if (message) args.push('-m', message);
  await gitCommand(cwd, args);
}

export async function popStash(cwd: string): Promise<void> {
  await gitCommand(cwd, ['stash', 'pop']);
}

// ============================================================================
// File Operations
// ============================================================================

export function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export async function readJsonFile<T>(filepath: string): Promise<T | null> {
  try {
    if (!fs.existsSync(filepath)) return null;
    const content = await fs.promises.readFile(filepath, 'utf-8');
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

export async function writeJsonFile<T>(filepath: string, data: T): Promise<void> {
  const dir = path.dirname(filepath);
  ensureDir(dir);
  await fs.promises.writeFile(filepath, JSON.stringify(data, null, 2));
}

export async function appendToFile(filepath: string, content: string): Promise<void> {
  const dir = path.dirname(filepath);
  ensureDir(dir);
  await fs.promises.appendFile(filepath, content);
}

export function watchFile(
  filepath: string,
  callback: (eventType: string, filename: string | null) => void
): fs.FSWatcher {
  return fs.watch(filepath, callback);
}

export function watchDirectory(
  dir: string,
  callback: (eventType: string, filename: string | null) => void
): fs.FSWatcher {
  ensureDir(dir);
  return fs.watch(dir, { recursive: true }, callback);
}

// ============================================================================
// Process Management
// ============================================================================

export interface ProcessResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export async function runCommand(
  command: string,
  args: string[],
  options: { cwd?: string; env?: NodeJS.ProcessEnv; timeout?: number } = {}
): Promise<ProcessResult> {
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
      if (timeout) clearTimeout(timeout);
      resolve({
        exitCode: code ?? 1,
        stdout,
        stderr,
      });
    });

    proc.on('error', (error) => {
      if (timeout) clearTimeout(timeout);
      reject(error);
    });
  });
}

export function spawnProcess(
  command: string,
  args: string[],
  options: { cwd?: string; env?: NodeJS.ProcessEnv } = {}
): ChildProcess {
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

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`;
  return `${(ms / 3600000).toFixed(1)}h`;
}

export function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toISOString();
}

// ============================================================================
// String Utilities
// ============================================================================

export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - 3) + '...';
}

export function padRight(str: string, length: number): string {
  return str.padEnd(length);
}

export function padLeft(str: string, length: number): string {
  return str.padStart(length);
}

// ============================================================================
// Validation
// ============================================================================

export function isValidAgentId(id: string): boolean {
  return /^[a-z0-9-]+$/.test(id);
}

export function isValidTaskId(id: string): boolean {
  return /^task-\d+-[a-z0-9]+$/.test(id);
}

export function sanitizeFilePath(filepath: string, basePath: string): string | null {
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
