import { FileLock, LockRequest, LockResult } from '../shared/types.js';
export declare class LockManager {
    private locks;
    private projectPath;
    private locksDir;
    private defaultTimeout;
    constructor(projectPath: string, defaultTimeout?: number);
    /**
     * Acquire locks for multiple paths
     */
    acquireLocks(request: LockRequest): LockResult;
    /**
     * Release locks for specific paths
     */
    releaseLocks(agentId: string, paths: string[]): string[];
    /**
     * Release all locks for an agent
     */
    releaseAllLocks(agentId: string): string[];
    /**
     * Release all locks for a task
     */
    releaseTaskLocks(taskId: string): string[];
    /**
     * Check if a path is locked
     */
    isLocked(filePath: string): boolean;
    /**
     * Get lock info for a path
     */
    getLock(filePath: string): FileLock | null;
    /**
     * Get all locks
     */
    getAllLocks(): FileLock[];
    /**
     * Get locks for an agent
     */
    getAgentLocks(agentId: string): FileLock[];
    /**
     * Extend lock timeout
     */
    extendLock(agentId: string, filePath: string, additionalMs: number): boolean;
    /**
     * Check for conflicts with a set of paths
     */
    checkConflicts(agentId: string, paths: string[]): {
        path: string;
        heldBy: string;
    }[];
    /**
     * Force release a lock (admin only)
     */
    forceRelease(filePath: string): boolean;
    private normalizePath;
    private isCompatibleLock;
    private cleanExpiredLocks;
    private loadLocks;
    private saveLocks;
}
export default LockManager;
//# sourceMappingURL=LockManager.d.ts.map