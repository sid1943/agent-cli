import { ServerConfig } from './types.js';
export type { ServerConfig } from './types.js';
export declare const DEFAULT_CONFIG: ServerConfig;
export declare function loadConfigFromEnv(baseConfig?: Partial<ServerConfig>): ServerConfig;
export declare function loadConfigFromFile(configPath: string): Partial<ServerConfig>;
export declare function findProjectRoot(startDir?: string): string;
export declare function getCoordinatorPaths(projectPath: string): {
    root: string;
    state: string;
    log: string;
    tasks: string;
    locks: string;
    agents: string;
    messages: string;
    inbox: (agentId: string) => string;
    outbox: (agentId: string) => string;
};
export declare function ensureCoordinatorDirs(projectPath: string): void;
export declare function loadConfig(projectPath?: string): ServerConfig;
declare const _default: {
    DEFAULT_CONFIG: ServerConfig;
    loadConfig: typeof loadConfig;
    loadConfigFromEnv: typeof loadConfigFromEnv;
    loadConfigFromFile: typeof loadConfigFromFile;
    findProjectRoot: typeof findProjectRoot;
    getCoordinatorPaths: typeof getCoordinatorPaths;
    ensureCoordinatorDirs: typeof ensureCoordinatorDirs;
};
export default _default;
//# sourceMappingURL=config.d.ts.map