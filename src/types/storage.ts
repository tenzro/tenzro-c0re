// src/types/storage.ts

import { StorageStrategy } from "@/storage/manager";
import { ChunkInfo } from "@/storage/types";

export type StorageType = 'p2p' | 'network' | 'hybrid';

export interface StorageLocation {
    // Node identification
    nodeId: string;
    region: string;
    
    // Storage details
    type: 'source' | 'replica';
    storageType: 'p2p' | 'network' | 'local';
    
    // Access information
    endpoint?: string;
    protocol: string;
    
    // Status
    availability: number;
    lastSeen: number;
    health: number;
    
    // Resources
    capacity: number;
    used: number;
    
    // Performance metrics
    latency: number;
    bandwidth: number;
}

export interface StorageOptions {
    encryption?: {
        enabled: boolean;
        algorithm?: string;
        key?: Buffer;
    };
    compression?: {
        enabled: boolean;
        algorithm?: string;
        level?: number;
    };
    chunks?: {
        size: number;
        parallel: number;
    };
    persist?: boolean;
}

export interface StorageStats {
    locations: number;
    totalSize: number;
    availableSize: number;
    replicationCount: number;
    healthScore: number;
    regions: string[];
}

export interface StorageRequest {
    id: string;
    type: 'store' | 'retrieve' | 'delete';
    resourceId: string;
    options: StorageOptions;
    chunk?: ChunkInfo;
    data: Buffer;
    strategy?: StorageStrategy;
    priority?: number;
}

export interface StorageResponse {
    success: boolean;
    locations?: StorageLocation[];
    data?: Buffer;
    error?: string;
    stats?: StorageStats;
}

export interface StorageProvider {
    store(data: Buffer, options: StorageOptions): Promise<StorageLocation[]>;
    retrieve(id: string, locations: StorageLocation[]): Promise<Buffer>;
    delete(id: string, locations: StorageLocation[]): Promise<boolean>;
    getStats(id: string): Promise<StorageStats>;
}

export interface ChunkManager {
    split(data: Buffer, chunkSize: number | undefined): Promise<ChunkInfo[]>;
    combine(chunks: Buffer[], info: ChunkInfo[]): Promise<Buffer>;
    validate(chunk: Buffer, info: ChunkInfo): Promise<boolean>;
}

