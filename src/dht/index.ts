// src/dht/index.ts

export * from './network';
export * from './protocol';
export * from './kbucket';

export const DEFAULT_CONFIG = {
    kBucketSize: 20,
    numberOfBuckets: 256,
    staleThreshold: 60 * 60 * 1000, // 1 hour
    refreshInterval: 60 * 1000,      // 1 minute
    replicationFactor: 3,
    requestTimeout: 30 * 1000        // 30 seconds
};