// src/types/network.ts

import type { ResourceType } from './metadata';

export interface PeerInfo {
    id: string;
    multiaddr: string[];
    protocols: string[];
    metadata: {
        type: 'global' | 'regional' | 'local' | 'unknown';
        region: string;
        version: string;
        capabilities: string[];
        uptime: number;
        lastSeen: number;
    };
    metrics: {
        latency: number;
        bandwidth: number;
        reliability: number;
        storage: {
            total: number;
            used: number;
            available: number;
        };
    };
}

export interface NetworkConfig {
    // Peer configuration
    peerId?: string;
    privateKey?: string;
    
    // Network settings
    listenAddrs: string[];
    announceAddrs?: string[];
    
    // Bootstrap configuration
    bootstrapPeers: string[];
    
    // Protocol settings
    protocols: {
        names: string[];
        versions: string[];
    };
    
    // DHT configuration
    dht: {
        enabled: boolean;
        clientMode?: boolean;
        bootstrapPeers?: string[];
        kBucketSize?: number;
        maxParallelDials?: number;
    };
    
    // Discovery settings
    discovery: {
        bootstrap: boolean;
        mdns: boolean;
        webRTCStar: boolean;
        interval: number;
    };
    
    // Connection management
    connections: {
        maxPeers: number;
        minPeers: number;
        maxParallelDials: number;
        timeout: number;
    };
}

export interface NetworkMessage {
    type: 'query' | 'response' | 'update' | 'announce';
    protocol: string;
    version: string;
    payload: {
        id: string;
        timestamp: number;
        resourceType?: ResourceType;
        action?: string;
        data: unknown;
    };
    metadata?: Record<string, unknown>;
    signature?: string;
}

export interface RoutingTable {
    addPeer(peer: PeerInfo): Promise<void>;
    removePeer(peerId: string): Promise<void>;
    getPeer(peerId: string): Promise<PeerInfo | null>;
    getClosestPeers(key: string, count?: number): Promise<PeerInfo[]>;
    getAllPeers(): Promise<PeerInfo[]>;
    size(): number;
}

export interface NetworkStats {
    peers: {
        total: number;
        connected: number;
        disconnected: number;
        byType: {
            global: number;
            regional: number;
            local: number;
        };
    };
    protocols: {
        supported: string[];
        active: {
            [key: string]: number;
        };
    };
    bandwidth: {
        in: number;
        out: number;
        rate: number;
    };
    dht: {
        tableSize: number;
        totalQueries: number;
        successfulQueries: number;
    };
    uptime: number;
    lastUpdate: number;
}

export interface DHTOptions {
    kBucketSize?: number;
    replicationFactor?: number;
    refreshInterval?: number;
    requestTimeout?: number;
    maxStorageSize?: number;
}

export interface DHTInterface {
    // Core DHT operations
    put(key: string, value: any): Promise<void>;
    get(key: string): Promise<any>;
    delete(key: string): Promise<void>;
    
    // Network operations
    start(): Promise<void>;
    stop(): Promise<void>;
    findPeer(peerId: string): Promise<PeerInfo | null>;
    findPeers(key: string, count?: number): Promise<PeerInfo[]>;
    
    // Status and metrics
    getStats(): NetworkStats;
    isConnected(): boolean;
    getPeerCount(): number;
    
    // Event handling
    on(event: string, listener: (...args: any[]) => void): void;
    off(event: string, listener: (...args: any[]) => void): void;
    emit(event: string, ...args: any[]): void;
}

export interface NetworkEventEmitter {
    on(event: string, listener: (...args: any[]) => void): void;
    off(event: string, listener: (...args: any[]) => void): void;
    emit(event: string, ...args: any[]): void;
}

export type NetworkEvent = 
    | { type: 'peer:discovery'; peer: PeerInfo }
    | { type: 'peer:connect'; peer: PeerInfo }
    | { type: 'peer:disconnect'; peerId: string }
    | { type: 'message:received'; message: NetworkMessage }
    | { type: 'message:sent'; message: NetworkMessage }
    | { type: 'dht:query'; key: string }
    | { type: 'dht:response'; key: string; value: unknown }
    | { type: 'dht:put'; key: string }
    | { type: 'dht:delete'; key: string }
    | { type: 'error'; error: Error };

export interface NetworkError extends Error {
    code: string;
    details?: any;
}

export interface PeerConnection {
    id: string;
    peer: PeerInfo;
    status: 'connecting' | 'connected' | 'disconnecting' | 'disconnected';
    protocols: string[];
    metrics: {
        latency: number;
        bandwidth: number;
        uptime: number;
        lastSeen: number;
        errorCount: number;
    };
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    send(message: NetworkMessage): Promise<void>;
}

export interface NetworkTransport {
    listen(addr: string): Promise<void>;
    dial(addr: string): Promise<PeerConnection>;
    close(): Promise<void>;
    getAddrs(): string[];
}

export interface DiscoveryService {
    start(): Promise<void>;
    stop(): Promise<void>;
    findPeers(options?: {
        protocol?: string;
        region?: string;
        count?: number;
    }): Promise<PeerInfo[]>;
}

export interface NetworkProtocol {
    name: string;
    version: string;
    handlers: Map<string, (message: NetworkMessage) => Promise<NetworkMessage>>;
    handleMessage(message: NetworkMessage): Promise<NetworkMessage>;
    registerHandler(type: string, handler: (message: NetworkMessage) => Promise<NetworkMessage>): void;
}