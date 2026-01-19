import * as fs from 'fs';
import { ChildProcess } from 'child_process';
export declare function generateAgentId(): string;
export declare function generateTaskId(): string;
export declare function gitCommand(cwd: string, args: string[]): Promise<{
    stdout: string;
    stderr: string;
}>;
export declare function getCurrentBranch(cwd: string): Promise<string>;
export declare function branchExists(cwd: string, branch: string): Promise<boolean>;
export declare function createBranch(cwd: string, branch: string, baseBranch?: string): Promise<void>;
export declare function switchBranch(cwd: string, branch: string): Promise<void>;
export declare function getModifiedFiles(cwd: string): Promise<string[]>;
export declare function commitChanges(cwd: string, message: string): Promise<string>;
export declare function hasUncommittedChanges(cwd: string): Promise<boolean>;
export declare function stashChanges(cwd: string, message?: string): Promise<void>;
export declare function popStash(cwd: string): Promise<void>;
export declare function ensureDir(dir: string): void;
export declare function readJsonFile<T>(filepath: string): Promise<T | null>;
export declare function writeJsonFile<T>(filepath: string, data: T): Promise<void>;
export declare function appendToFile(filepath: string, content: string): Promise<void>;
export declare function watchFile(filepath: string, callback: (eventType: string, filename: string | null) => void): fs.FSWatcher;
export declare function watchDirectory(dir: string, callback: (eventType: string, filename: string | null) => void): fs.FSWatcher;
export interface ProcessResult {
    exitCode: number;
    stdout: string;
    stderr: string;
}
export declare function runCommand(command: string, args: string[], options?: {
    cwd?: string;
    env?: NodeJS.ProcessEnv;
    timeout?: number;
}): Promise<ProcessResult>;
export declare function spawnProcess(command: string, args: string[], options?: {
    cwd?: string;
    env?: NodeJS.ProcessEnv;
}): ChildProcess;
export declare function sleep(ms: number): Promise<void>;
export declare function formatDuration(ms: number): string;
export declare function formatTimestamp(timestamp: number): string;
export declare function truncate(str: string, maxLength: number): string;
export declare function padRight(str: string, length: number): string;
export declare function padLeft(str: string, length: number): string;
export declare function isValidAgentId(id: string): boolean;
export declare function isValidTaskId(id: string): boolean;
export declare function sanitizeFilePath(filepath: string, basePath: string): string | null;
declare const _default: {
    generateAgentId: typeof generateAgentId;
    generateTaskId: typeof generateTaskId;
    gitCommand: typeof gitCommand;
    getCurrentBranch: typeof getCurrentBranch;
    branchExists: typeof branchExists;
    createBranch: typeof createBranch;
    switchBranch: typeof switchBranch;
    getModifiedFiles: typeof getModifiedFiles;
    commitChanges: typeof commitChanges;
    hasUncommittedChanges: typeof hasUncommittedChanges;
    stashChanges: typeof stashChanges;
    popStash: typeof popStash;
    ensureDir: typeof ensureDir;
    readJsonFile: typeof readJsonFile;
    writeJsonFile: typeof writeJsonFile;
    appendToFile: typeof appendToFile;
    watchFile: typeof watchFile;
    watchDirectory: typeof watchDirectory;
    runCommand: typeof runCommand;
    spawnProcess: typeof spawnProcess;
    sleep: typeof sleep;
    formatDuration: typeof formatDuration;
    formatTimestamp: typeof formatTimestamp;
    truncate: typeof truncate;
    padRight: typeof padRight;
    padLeft: typeof padLeft;
    isValidAgentId: typeof isValidAgentId;
    isValidTaskId: typeof isValidTaskId;
    sanitizeFilePath: typeof sanitizeFilePath;
};
export default _default;
//# sourceMappingURL=utils.d.ts.map