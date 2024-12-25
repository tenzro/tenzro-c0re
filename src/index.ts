// src/index.ts

import { C0reNode } from './integration/core';

// Core exports
export * from './types';

// DHT and network
export * from './dht/network';
export * from './dht/protocol';

// Storage
export {
    StorageManager,
    type StorageConfig
} from './storage/manager';

export type {
    ChunkInfo,
    ChunkManager,
    StorageOptions,
    StorageStats,
    StorageProvider
} from './storage/types';

// Registry and versioning
export * from './registry/client';
export * from './registry/version';
export * from './registry/validators';

// Discovery and search
export * from './discovery/content';
export * from './search/engine';
export * from './search/index';

// Integration
export * from './integration/bridge';

// Version information
export const VERSION = '0.1.0';

export function getVersion(): string {
    return VERSION;
}

// Factory function for creating nodes
export function createC0reNode(config: any) {
    return new C0reNode(config);
}

// Default configurations
export const DEFAULT_CONFIG = {
    network: {
        dht: {
            kBucketSize: 20,
            numberOfBuckets: 256,
            refreshInterval: 60000
        },
        discovery: {
            enabled: true,
            interval: 30000
        }
    },
    storage: {
        chunkSize: 1024 * 1024, // 1MB
        replicationFactor: 3,
        refreshInterval: 300000  // 5 minutes
    },
    search: {
        indexRefreshInterval: 60000,  // 1 minute
        maxResults: 1000,
        cacheTimeout: 300000  // 5 minutes
    }
};