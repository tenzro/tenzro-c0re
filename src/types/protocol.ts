// src/types/protocol.ts

import type { C0reMetadata } from './metadata';
import type { StorageLocation, StorageOptions } from './storage';
import type { NetworkMessage, PeerInfo } from './network';

export type ProtocolCommand = 
    | 'REGISTER'
    | 'DISCOVER'
    | 'STORE'
    | 'RETRIEVE'
    | 'UPDATE'
    | 'DELETE'
    | 'SYNC'
    | 'PING';

export interface ProtocolMessage extends NetworkMessage {
    command: ProtocolCommand;
    requestId: string;
    sender: string;
    receiver?: string;
    timestamp: number;
    ttl: number;
    payload: any;
}

export interface RegisterRequest {
    command: 'REGISTER';
    metadata: C0reMetadata;
    storage: StorageOptions;
    signature: string;
}

export interface DiscoverRequest {
    command: 'DISCOVER';
    query: {
        type?: string;
        tags?: string[];
        author?: string;
        after?: number;
        before?: number;
        limit?: number;
        offset?: number;
    };
}

export interface StoreRequest {
    command: 'STORE';
    resourceId: string;
    data: Buffer;
    options: StorageOptions;
}

export interface RetrieveRequest {
    command: 'RETRIEVE';
    resourceId: string;
    options?: {
        preferred?: StorageLocation[];
        timeout?: number;
    };
}

export interface UpdateRequest {
    command: 'UPDATE';
    resourceId: string;
    metadata: Partial<C0reMetadata>;
    signature: string;
}

export interface DeleteRequest {
    command: 'DELETE';
    resourceId: string;
    signature: string;
}

export interface SyncRequest {
    command: 'SYNC';
    since: number;
    filter?: {
        types?: string[];
        regions?: string[];
    };
}

export type ProtocolRequest =
    | RegisterRequest
    | DiscoverRequest
    | StoreRequest
    | RetrieveRequest
    | UpdateRequest
    | DeleteRequest
    | SyncRequest;

export interface ProtocolResponse {
    success: boolean;
    requestId: string;
    timestamp: number;
    data?: any;
    error?: {
        code: string;
        message: string;
        details?: any;
    };
    metadata?: {
        processedBy: string[];
        processingTime: number;
        cacheable: boolean;
    };
}

export interface ProtocolHandler {
    handleMessage(message: ProtocolMessage): Promise<ProtocolResponse>;
    canHandle(message: ProtocolMessage): boolean;
}

export interface ProtocolMiddleware {
    preProcess(message: ProtocolMessage): Promise<ProtocolMessage>;
    postProcess(response: ProtocolResponse): Promise<ProtocolResponse>;
}

export interface ProtocolMetrics {
    requestsTotal: number;
    requestsSuccessful: number;
    requestsFailed: number;
    requestLatency: number;
    activeRequests: number;
    byCommand: {
        [key in ProtocolCommand]: {
            total: number;
            successful: number;
            failed: number;
            latency: number;
        };
    };
}

export interface ProtocolConfig {
    handlers: {
        [key in ProtocolCommand]?: ProtocolHandler;
    };
    middleware?: ProtocolMiddleware[];
    timeout?: number;
    maxRetries?: number;
    maxParallel?: number;
    metrics?: {
        enabled: boolean;
        interval: number;
    };
}