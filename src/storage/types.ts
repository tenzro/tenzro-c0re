// src/storage/types.ts

import { StorageLocation } from '../types/storage';

export interface StorageMetadata {
    id: string;
    size: number;
    chunks: ChunkInfo[];
    encryption?: EncryptionInfo;
    compression?: CompressionInfo;
    created: number;
    modified: number;
    checksum: string;
    storageType: 'local' | 'network' | 'p2p';
    replicas: number;
}

export interface ChunkInfo {
    index: number;
    size: number;
    checksum: string;
    location: StorageLocation;
    replicas: number;
    encryption?: {
        iv: string;
        algorithm: string;
    };
    compression?: {
        algorithm: string;
        originalSize: number;
    };
}

export interface EncryptionInfo {
    algorithm: string;
    keyId: string;
    params?: Record<string, any>;
}

export interface CompressionInfo {
    algorithm: string;
    level: number;
    originalSize: number;
}

export interface StorageOptions {
    encryption?: {
        enabled: boolean;
        algorithm?: string;
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
    replicas?: number;
    persist?: boolean;
}

export interface StorageStats {
    used: number;
    available: number;
    files: number;
    chunks: number;
    operations: {
        reads: number;
        writes: number;
        deletes: number;
    };
}

export interface StorageProvider {
    // Core operations
    store(data: Buffer, options?: StorageOptions): Promise<StorageMetadata>;
    retrieve(id: string): Promise<Buffer>;
    delete(id: string): Promise<boolean>;
    
    // Metadata operations
    getMetadata(id: string): Promise<StorageMetadata>;
    updateMetadata(id: string, metadata: Partial<StorageMetadata>): Promise<void>;
    
    // Management operations
    getStats(): Promise<StorageStats>;
    validateChecksum(id: string): Promise<boolean>;
    cleanup(): Promise<void>;
}

export interface ChunkManager {
    split(data: Buffer, chunkSize: number | undefined): Promise<ChunkInfo[]>;
    combine(chunks: Buffer[], info: ChunkInfo[]): Promise<Buffer>;
    validate(chunk: Buffer, info: ChunkInfo): Promise<boolean>;
}

export interface StorageError extends Error {
    code: string;
    details?: any;
}