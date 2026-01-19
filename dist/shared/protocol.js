// File-based communication protocol for Agent Coordination
// Uses JSON files for message passing (no server process required)
import * as fs from 'fs';
import * as path from 'path';
import { getCoordinatorPaths } from './config.js';
// Generate unique message ID
export function generateId() {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}
// Create a new message
export function createMessage(type, source, payload, target, correlationId) {
    return {
        id: generateId(),
        type,
        timestamp: Date.now(),
        source,
        target,
        payload,
        correlationId,
    };
}
// File-based message queue
export class FileMessageQueue {
    projectPath;
    paths;
    constructor(projectPath) {
        this.projectPath = projectPath;
        this.paths = getCoordinatorPaths(projectPath);
    }
    // Send message to specific agent
    async sendToAgent(agentId, message) {
        const inboxDir = this.paths.inbox(agentId);
        await this.ensureDir(inboxDir);
        const filename = `${message.timestamp}-${message.id}.json`;
        const filepath = path.join(inboxDir, filename);
        await fs.promises.writeFile(filepath, JSON.stringify(message, null, 2));
    }
    // Broadcast message to all agents
    async broadcast(message, excludeAgent) {
        const agentsDir = this.paths.agents;
        if (!fs.existsSync(agentsDir))
            return;
        const agents = await fs.promises.readdir(agentsDir);
        for (const agentId of agents) {
            if (agentId === excludeAgent)
                continue;
            const agentDir = path.join(agentsDir, agentId);
            const stat = await fs.promises.stat(agentDir);
            if (stat.isDirectory()) {
                await this.sendToAgent(agentId, message);
            }
        }
    }
    // Post message to global message board
    async postGlobal(message) {
        const messagesDir = this.paths.messages;
        await this.ensureDir(messagesDir);
        const filename = `${message.timestamp}-${message.id}.json`;
        const filepath = path.join(messagesDir, filename);
        await fs.promises.writeFile(filepath, JSON.stringify(message, null, 2));
    }
    // Read messages from agent inbox
    async readInbox(agentId, deleteAfterRead = true) {
        const inboxDir = this.paths.inbox(agentId);
        if (!fs.existsSync(inboxDir))
            return [];
        const files = await fs.promises.readdir(inboxDir);
        const messages = [];
        for (const file of files.sort()) {
            if (!file.endsWith('.json'))
                continue;
            const filepath = path.join(inboxDir, file);
            try {
                const content = await fs.promises.readFile(filepath, 'utf-8');
                const message = JSON.parse(content);
                messages.push(message);
                if (deleteAfterRead) {
                    await fs.promises.unlink(filepath);
                }
            }
            catch (error) {
                console.error(`Failed to read message ${file}:`, error);
            }
        }
        return messages;
    }
    // Read global messages (newer than timestamp)
    async readGlobalMessages(since = 0) {
        const messagesDir = this.paths.messages;
        if (!fs.existsSync(messagesDir))
            return [];
        const files = await fs.promises.readdir(messagesDir);
        const messages = [];
        for (const file of files.sort()) {
            if (!file.endsWith('.json'))
                continue;
            const filepath = path.join(messagesDir, file);
            try {
                const content = await fs.promises.readFile(filepath, 'utf-8');
                const message = JSON.parse(content);
                if (message.timestamp > since) {
                    messages.push(message);
                }
            }
            catch (error) {
                // Ignore read errors (file might be being written)
            }
        }
        return messages;
    }
    // Clean old global messages
    async cleanOldMessages(maxAgeMs = 3600000) {
        const messagesDir = this.paths.messages;
        if (!fs.existsSync(messagesDir))
            return 0;
        const files = await fs.promises.readdir(messagesDir);
        const cutoff = Date.now() - maxAgeMs;
        let deleted = 0;
        for (const file of files) {
            if (!file.endsWith('.json'))
                continue;
            const filepath = path.join(messagesDir, file);
            try {
                const content = await fs.promises.readFile(filepath, 'utf-8');
                const message = JSON.parse(content);
                if (message.timestamp < cutoff) {
                    await fs.promises.unlink(filepath);
                    deleted++;
                }
            }
            catch (error) {
                // Ignore errors
            }
        }
        return deleted;
    }
    // Send to agent's outbox (for responses)
    async sendToOutbox(agentId, message) {
        const outboxDir = this.paths.outbox(agentId);
        await this.ensureDir(outboxDir);
        const filename = `${message.timestamp}-${message.id}.json`;
        const filepath = path.join(outboxDir, filename);
        await fs.promises.writeFile(filepath, JSON.stringify(message, null, 2));
    }
    // Read agent's outbox (server reads this)
    async readOutbox(agentId, deleteAfterRead = true) {
        const outboxDir = this.paths.outbox(agentId);
        if (!fs.existsSync(outboxDir))
            return [];
        const files = await fs.promises.readdir(outboxDir);
        const messages = [];
        for (const file of files.sort()) {
            if (!file.endsWith('.json'))
                continue;
            const filepath = path.join(outboxDir, file);
            try {
                const content = await fs.promises.readFile(filepath, 'utf-8');
                const message = JSON.parse(content);
                messages.push(message);
                if (deleteAfterRead) {
                    await fs.promises.unlink(filepath);
                }
            }
            catch (error) {
                // Ignore errors
            }
        }
        return messages;
    }
    async ensureDir(dir) {
        if (!fs.existsSync(dir)) {
            await fs.promises.mkdir(dir, { recursive: true });
        }
    }
}
// State file operations
export class StateManager {
    statePath;
    lockPath;
    constructor(statePath) {
        this.statePath = statePath;
        this.lockPath = statePath + '.lock';
    }
    // Read state with file locking
    async readState() {
        try {
            if (!fs.existsSync(this.statePath))
                return null;
            const content = await fs.promises.readFile(this.statePath, 'utf-8');
            return JSON.parse(content);
        }
        catch (error) {
            console.error('Failed to read state:', error);
            return null;
        }
    }
    // Write state with file locking
    async writeState(state) {
        const lockAcquired = await this.acquireLock();
        if (!lockAcquired)
            return false;
        try {
            // Ensure directory exists
            const dir = path.dirname(this.statePath);
            if (!fs.existsSync(dir)) {
                await fs.promises.mkdir(dir, { recursive: true });
            }
            // Write to temp file first
            const tempPath = this.statePath + '.tmp';
            await fs.promises.writeFile(tempPath, JSON.stringify(state, null, 2));
            // Atomic rename
            await fs.promises.rename(tempPath, this.statePath);
            return true;
        }
        catch (error) {
            console.error('Failed to write state:', error);
            return false;
        }
        finally {
            await this.releaseLock();
        }
    }
    // Update state with callback
    async updateState(updater) {
        const lockAcquired = await this.acquireLock();
        if (!lockAcquired)
            return false;
        try {
            const currentState = await this.readState();
            const newState = updater(currentState);
            const dir = path.dirname(this.statePath);
            if (!fs.existsSync(dir)) {
                await fs.promises.mkdir(dir, { recursive: true });
            }
            const tempPath = this.statePath + '.tmp';
            await fs.promises.writeFile(tempPath, JSON.stringify(newState, null, 2));
            await fs.promises.rename(tempPath, this.statePath);
            return true;
        }
        catch (error) {
            console.error('Failed to update state:', error);
            return false;
        }
        finally {
            await this.releaseLock();
        }
    }
    async acquireLock(timeoutMs = 5000) {
        const startTime = Date.now();
        while (Date.now() - startTime < timeoutMs) {
            try {
                // Create lock file exclusively
                await fs.promises.writeFile(this.lockPath, String(process.pid), { flag: 'wx' });
                return true;
            }
            catch (error) {
                // Lock exists, check if it's stale
                try {
                    const stat = await fs.promises.stat(this.lockPath);
                    const age = Date.now() - stat.mtimeMs;
                    // If lock is older than 30 seconds, assume it's stale
                    if (age > 30000) {
                        await fs.promises.unlink(this.lockPath);
                        continue;
                    }
                }
                catch {
                    // Lock file gone, try again
                    continue;
                }
                // Wait and retry
                await new Promise(resolve => setTimeout(resolve, 50));
            }
        }
        return false;
    }
    async releaseLock() {
        try {
            await fs.promises.unlink(this.lockPath);
        }
        catch {
            // Ignore errors
        }
    }
}
export default {
    generateId,
    createMessage,
    FileMessageQueue,
    StateManager,
};
//# sourceMappingURL=protocol.js.map