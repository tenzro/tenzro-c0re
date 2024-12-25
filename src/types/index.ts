// src/types/index.ts

export * from './metadata';
export * from './storage';
export * from './network';
export * from './protocol';

// Common types used across the system
export interface C0reConfig {
    // Node identity
    nodeId: string;
    nodeType: 'global' | 'regional' | 'local';
    region: string;
    
    // Network configuration
    network: {
        listenAddrs: string[];
        bootstrapPeers: string[];
        maxConnections: number;
    };
    
    // Storage configuration
    storage: {
        path: string;
        maxSize: number;
        redundancy: number;
    };
    
    // Protocol settings
    protocol: {
        timeout: number;
        maxRetries: number;
        maxParallel: number;
    };
    
    // Security settings
    security: {
        privateKey?: string;
        certificate?: string;
        trustedPeers?: string[];
    };
    
    // Discovery settings
    discovery: {
        interval: number;
        bootstrap: boolean;
        mdns: boolean;
    };
    
    // Metrics and monitoring
    metrics: {
        enabled: boolean;
        interval: number;
        retention: number;
    };
}

export interface C0reStats {
    version: string;
    uptime: number;
    nodeId: string;
    nodeType: string;
    region: string;
    network: {
        peers: number;
        connections: number;
        bandwidth: {
            in: number;
            out: number;
        };
    };
    storage: {
        used: number;
        available: number;
        items: number;
    };
    protocol: {
        requests: {
            total: number;
            active: number;
            failed: number;
        };
        latency: number;
    };
    lastUpdate: number;
}

// Error types
export class C0reError extends Error {
    constructor(
        message: string,
        public code: string,
        public details?: any
    ) {
        super(message);
        this.name = 'C0reError';
    }
}

export class NetworkError extends C0reError {
    constructor(message: string, details?: any) {
        super(message, 'NETWORK_ERROR', details);
        this.name = 'NetworkError';
    }
}

export class StorageError extends C0reError {
    constructor(message: string, details?: any) {
        super(message, 'STORAGE_ERROR', details);
        this.name = 'StorageError';
    }
}

export class ProtocolError extends C0reError {
    constructor(message: string, details?: any) {
        super(message, 'PROTOCOL_ERROR', details);
        this.name = 'ProtocolError';
    }
}

export class ValidationError extends C0reError {
    constructor(message: string, details?: any) {
        super(message, 'VALIDATION_ERROR', details);
        this.name = 'ValidationError';
    }
}