import { Message, MessageType } from './types.js';
export declare function generateId(): string;
export declare function createMessage<T>(type: MessageType, source: string, payload: T, target?: string, correlationId?: string): Message<T>;
export declare class FileMessageQueue {
    private projectPath;
    private paths;
    constructor(projectPath: string);
    sendToAgent(agentId: string, message: Message): Promise<void>;
    broadcast(message: Message, excludeAgent?: string): Promise<void>;
    postGlobal(message: Message): Promise<void>;
    readInbox(agentId: string, deleteAfterRead?: boolean): Promise<Message[]>;
    readGlobalMessages(since?: number): Promise<Message[]>;
    cleanOldMessages(maxAgeMs?: number): Promise<number>;
    sendToOutbox(agentId: string, message: Message): Promise<void>;
    readOutbox(agentId: string, deleteAfterRead?: boolean): Promise<Message[]>;
    private ensureDir;
}
export declare class StateManager {
    private statePath;
    private lockPath;
    constructor(statePath: string);
    readState<T>(): Promise<T | null>;
    writeState<T>(state: T): Promise<boolean>;
    updateState<T>(updater: (state: T | null) => T): Promise<boolean>;
    private acquireLock;
    private releaseLock;
}
declare const _default: {
    generateId: typeof generateId;
    createMessage: typeof createMessage;
    FileMessageQueue: typeof FileMessageQueue;
    StateManager: typeof StateManager;
};
export default _default;
//# sourceMappingURL=protocol.d.ts.map