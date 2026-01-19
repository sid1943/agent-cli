// LockManager - File locking to prevent concurrent edits
import * as fs from 'fs';
import * as path from 'path';
import { getCoordinatorPaths } from '../shared/config.js';
export class LockManager {
    locks = new Map();
    projectPath;
    locksDir;
    defaultTimeout;
    constructor(projectPath, defaultTimeout = 300000) {
        this.projectPath = projectPath;
        this.locksDir = getCoordinatorPaths(projectPath).locks;
        this.defaultTimeout = defaultTimeout;
        // Ensure locks directory exists
        if (!fs.existsSync(this.locksDir)) {
            fs.mkdirSync(this.locksDir, { recursive: true });
        }
        // Load existing locks
        this.loadLocks();
    }
    /**
     * Acquire locks for multiple paths
     */
    acquireLocks(request) {
        const acquired = [];
        const failed = [];
        const conflicts = [];
        // Clean expired locks first
        this.cleanExpiredLocks();
        // Try to acquire each lock
        for (const filePath of request.paths) {
            const normalizedPath = this.normalizePath(filePath);
            const existingLock = this.locks.get(normalizedPath);
            // Check if already locked by another agent
            if (existingLock && existingLock.agentId !== request.agentId) {
                // Check if it's a compatible lock
                if (!this.isCompatibleLock(existingLock.lockType, request.lockType)) {
                    failed.push(filePath);
                    conflicts.push({ path: filePath, heldBy: existingLock.agentId });
                    continue;
                }
            }
            // Acquire the lock
            const lock = {
                path: normalizedPath,
                agentId: request.agentId,
                taskId: request.taskId,
                lockedAt: Date.now(),
                expiresAt: Date.now() + (request.timeoutMs || this.defaultTimeout),
                lockType: request.lockType,
            };
            this.locks.set(normalizedPath, lock);
            acquired.push(filePath);
        }
        // Persist locks if any acquired
        if (acquired.length > 0) {
            this.saveLocks();
        }
        return {
            success: failed.length === 0,
            acquired,
            failed,
            conflicts: conflicts.length > 0 ? conflicts : undefined,
        };
    }
    /**
     * Release locks for specific paths
     */
    releaseLocks(agentId, paths) {
        const released = [];
        for (const filePath of paths) {
            const normalizedPath = this.normalizePath(filePath);
            const lock = this.locks.get(normalizedPath);
            // Only release if the agent owns the lock
            if (lock && lock.agentId === agentId) {
                this.locks.delete(normalizedPath);
                released.push(filePath);
            }
        }
        if (released.length > 0) {
            this.saveLocks();
        }
        return released;
    }
    /**
     * Release all locks for an agent
     */
    releaseAllLocks(agentId) {
        const released = [];
        for (const [path, lock] of this.locks) {
            if (lock.agentId === agentId) {
                this.locks.delete(path);
                released.push(path);
            }
        }
        if (released.length > 0) {
            this.saveLocks();
        }
        return released;
    }
    /**
     * Release all locks for a task
     */
    releaseTaskLocks(taskId) {
        const released = [];
        for (const [path, lock] of this.locks) {
            if (lock.taskId === taskId) {
                this.locks.delete(path);
                released.push(path);
            }
        }
        if (released.length > 0) {
            this.saveLocks();
        }
        return released;
    }
    /**
     * Check if a path is locked
     */
    isLocked(filePath) {
        const normalizedPath = this.normalizePath(filePath);
        const lock = this.locks.get(normalizedPath);
        if (!lock)
            return false;
        // Check if expired
        if (Date.now() > lock.expiresAt) {
            this.locks.delete(normalizedPath);
            return false;
        }
        return true;
    }
    /**
     * Get lock info for a path
     */
    getLock(filePath) {
        const normalizedPath = this.normalizePath(filePath);
        return this.locks.get(normalizedPath) || null;
    }
    /**
     * Get all locks
     */
    getAllLocks() {
        this.cleanExpiredLocks();
        return Array.from(this.locks.values());
    }
    /**
     * Get locks for an agent
     */
    getAgentLocks(agentId) {
        return Array.from(this.locks.values()).filter(lock => lock.agentId === agentId);
    }
    /**
     * Extend lock timeout
     */
    extendLock(agentId, filePath, additionalMs) {
        const normalizedPath = this.normalizePath(filePath);
        const lock = this.locks.get(normalizedPath);
        if (!lock || lock.agentId !== agentId)
            return false;
        lock.expiresAt += additionalMs;
        this.saveLocks();
        return true;
    }
    /**
     * Check for conflicts with a set of paths
     */
    checkConflicts(agentId, paths) {
        this.cleanExpiredLocks();
        const conflicts = [];
        for (const filePath of paths) {
            const normalizedPath = this.normalizePath(filePath);
            const lock = this.locks.get(normalizedPath);
            if (lock && lock.agentId !== agentId) {
                conflicts.push({ path: filePath, heldBy: lock.agentId });
            }
        }
        return conflicts;
    }
    /**
     * Force release a lock (admin only)
     */
    forceRelease(filePath) {
        const normalizedPath = this.normalizePath(filePath);
        if (this.locks.has(normalizedPath)) {
            this.locks.delete(normalizedPath);
            this.saveLocks();
            return true;
        }
        return false;
    }
    // Normalize path relative to project root
    normalizePath(filePath) {
        // If absolute path, make relative to project
        if (path.isAbsolute(filePath)) {
            return path.relative(this.projectPath, filePath);
        }
        return filePath;
    }
    // Check if lock types are compatible
    isCompatibleLock(existing, requested) {
        // Multiple read locks are allowed
        if (existing === 'read' && requested === 'read') {
            return true;
        }
        // All other combinations are incompatible
        return false;
    }
    // Clean expired locks
    cleanExpiredLocks() {
        const now = Date.now();
        let cleaned = 0;
        for (const [path, lock] of this.locks) {
            if (now > lock.expiresAt) {
                this.locks.delete(path);
                cleaned++;
            }
        }
        if (cleaned > 0) {
            this.saveLocks();
        }
        return cleaned;
    }
    // Load locks from disk
    loadLocks() {
        const locksFile = path.join(this.locksDir, 'active.json');
        try {
            if (fs.existsSync(locksFile)) {
                const content = fs.readFileSync(locksFile, 'utf-8');
                const data = JSON.parse(content);
                for (const lock of data) {
                    // Only load non-expired locks
                    if (Date.now() < lock.expiresAt) {
                        this.locks.set(lock.path, lock);
                    }
                }
            }
        }
        catch (error) {
            console.error('Failed to load locks:', error);
        }
    }
    // Save locks to disk
    saveLocks() {
        const locksFile = path.join(this.locksDir, 'active.json');
        try {
            const locks = Array.from(this.locks.values());
            fs.writeFileSync(locksFile, JSON.stringify(locks, null, 2));
        }
        catch (error) {
            console.error('Failed to save locks:', error);
        }
    }
}
export default LockManager;
//# sourceMappingURL=LockManager.js.map