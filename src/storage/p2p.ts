// src/storage/p2p.ts

import { createHash } from 'crypto';
import { EventEmitter } from 'events';
import { StorageProvider, StorageMetadata, StorageOptions, StorageStats, ChunkInfo } from './types';
import { DHTNetwork } from '../dht/network';
import { createChunkManager } from './chunk';
import { StorageError } from '@/types';

export interface P2PStorageConfig {
    dht: DHTNetwork;
    nodeId: string;
    maxChunkSize?: number;
    maxStorageSize?: number;
    minPeers?: number;
    maxPeers?: number;
    region?: string;
    announceInterval?: number;
}

export class P2PStorageProvider extends EventEmitter implements StorageProvider {
    private readonly chunkManager;
    private readonly localChunks: Map<string, Buffer>;
    private readonly peerChunks: Map<string, Set<string>>;
    private stats: StorageStats;

    constructor(private readonly config: P2PStorageConfig) {
        super();
        
        this.chunkManager = createChunkManager({
            chunkSize: config.maxChunkSize
        });

        this.localChunks = new Map<string, Buffer>();
        this.peerChunks = new Map<string, Set<string>>();
        
        this.stats = {
            used: 0,
            available: config.maxStorageSize ?? Infinity,
            files: 0,
            chunks: 0,
            operations: {
                reads: 0,
                writes: 0,
                deletes: 0
            }
        };

        this.startAnnouncing();
        this.listenForPeerEvents();
    }

    async store(data: Buffer, options?: StorageOptions): Promise<StorageMetadata> {
        this.stats.operations.writes++;

        const id = this.generateId(data);

        try {
            // Split into chunks
            const chunks = await this.chunkManager.split(data, options?.chunks?.size);

            // Store chunks using P2P network
            const storedChunks = await Promise.all(
                chunks.map(chunk => this.storeChunk(chunk, options))
            );

            const metadata: StorageMetadata = {
                id,
                size: data.length,
                chunks: storedChunks,
                created: Date.now(),
                modified: Date.now(),
                checksum: this.calculateChecksum(data),
                storageType: 'p2p',
                replicas: this.getPeerCount(storedChunks)
            };

            // Store metadata in DHT
            await this.storeMetadata(id, metadata);

            // Update stats
            this.updateStatsOnStore(metadata);

            // Announce new content
            this.announceContent(id, metadata);

            return metadata;
        } catch (error) {
            throw new StorageError('Failed to store data in P2P network', {
                code: 'P2P_STORE_ERROR',
                details: error
            });
        }
    }

    async retrieve(id: string): Promise<Buffer> {
        this.stats.operations.reads++;

        try {
            // Get metadata from DHT
            const metadata = await this.getMetadata(id);

            // Retrieve chunks from peers
            const chunks = await Promise.all(
                metadata.chunks.map(chunk => this.retrieveChunk(chunk))
            );

            // Combine chunks
            const data = await this.chunkManager.combine(chunks, metadata.chunks);

            return data;
        } catch (error) {
            throw new StorageError('Failed to retrieve data from P2P network', {
                code: 'P2P_RETRIEVE_ERROR',
                details: error
            });
        }
    }

    async delete(id: string): Promise<boolean> {
        this.stats.operations.deletes++;

        try {
            const metadata = await this.getMetadata(id);

            // Remove chunks from local storage
            metadata.chunks.forEach(chunk => {
                this.localChunks.delete(chunk.checksum);
            });

            // Announce deletion to network
            await this.announceDelete(id);

            // Update stats
            this.updateStatsOnDelete(metadata);

            return true;
        } catch (error) {
            return false;
        }
    }

    async getMetadata(id: string): Promise<StorageMetadata> {
        const value = await this.config.dht.get(`p2p:metadata:${id}`);
        if (!value) {
            throw new StorageError('Metadata not found', {
                code: 'METADATA_NOT_FOUND'
            });
        }
        return JSON.parse(value);
    }

    async updateMetadata(id: string, update: Partial<StorageMetadata>): Promise<void> {
        const metadata = await this.getMetadata(id);
        const updated = { ...metadata, ...update, modified: Date.now() };
        await this.storeMetadata(id, updated);
    }

    async getStats(): Promise<StorageStats> {
        return { ...this.stats };
    }

    async validateChecksum(id: string): Promise<boolean> {
        const metadata = await this.getMetadata(id);
        const data = await this.retrieve(id);
        return this.calculateChecksum(data) === metadata.checksum;
    }

    async cleanup(): Promise<void> {
        // Clean up local storage based on policies
        // For example, remove least recently used chunks
        this.localChunks.clear();
        this.peerChunks.clear();
    }

    private async storeChunk(chunk: ChunkInfo, options?: StorageOptions): Promise<ChunkInfo> {
        // Store locally if we have space
        if (this.hasStorageSpace(chunk.size)) {
            this.localChunks.set(chunk.checksum, Buffer.alloc(chunk.size)); // Placeholder for actual data
            this.updatePeerChunks(chunk.checksum, [this.config.nodeId]);
        }

        // Find peers to store the chunk
        const peers = await this.findStoragePeers(chunk.size);
        
        // Distribute to peers
        const locations = await Promise.all(
            peers.map(peer => this.distributeChunkToPeer(peer, chunk))
        );

        return {
            ...chunk,
            location: {
                nodeId: this.config.nodeId,
                type: 'source',
                storageType: 'p2p',
                protocol: 'p2p',
                endpoint: '',
                region: this.config.region || '',
                availability: this.calculateAvailability(locations),
                lastSeen: Date.now(),
                health: 1,
                capacity: 0,
                used: 0,
                latency: 0,
                bandwidth: 0
            }
        };
    }

    private async retrieveChunk(chunk: ChunkInfo): Promise<Buffer> {
        // Check if we have it locally
        if (this.localChunks.has(chunk.checksum)) {
            return this.localChunks.get(chunk.checksum)!;
        }

        // Get peers that have this chunk
        const peers = this.peerChunks.get(chunk.checksum);
        if (!peers || peers.size === 0) {
            throw new StorageError('Chunk not found in P2P network', {
                code: 'CHUNK_NOT_FOUND'
            });
        }

        // Try to retrieve from peers
        for (const peerId of peers) {
            try {
                return await this.retrieveChunkFromPeer(peerId, chunk);
            } catch (error) {
                continue;
            }
        }

        throw new StorageError('Failed to retrieve chunk from any peer', {
            code: 'CHUNK_RETRIEVAL_FAILED'
        });
    }

    private async storeMetadata(id: string, metadata: StorageMetadata): Promise<void> {
        await this.config.dht.put(
            `p2p:metadata:${id}`,
            JSON.stringify(metadata)
        );
    }

    private generateId(data: Buffer): string {
        return createHash('sha256')
            .update(data)
            .update(Date.now().toString())
            .digest('hex');
    }

    private calculateChecksum(data: Buffer): string {
        return createHash('sha256').update(data).digest('hex');
    }

    private hasStorageSpace(size: number): boolean {
        return this.stats.used + size <= this.stats.available;
    }

    private updatePeerChunks(chunkId: string, peerIds: string[]) {
        if (!this.peerChunks.has(chunkId)) {
            this.peerChunks.set(chunkId, new Set());
        }
        peerIds.forEach(peerId => {
            this.peerChunks.get(chunkId)!.add(peerId);
        });
    }

    private updateStatsOnStore(metadata: StorageMetadata) {
        this.stats.files++;
        this.stats.chunks += metadata.chunks.length;
        this.stats.used += metadata.size;
    }

    private updateStatsOnDelete(metadata: StorageMetadata) {
        this.stats.files--;
        this.stats.chunks -= metadata.chunks.length;
        this.stats.used -= metadata.size;
    }

    private startAnnouncing() {
        const interval = this.config.announceInterval ?? 60000; // 1 minute default
        setInterval(() => {
            this.announceStoredChunks();
        }, interval);
    }

    private async announceStoredChunks() {
        const announcement = {
            nodeId: this.config.nodeId,
            chunks: Array.from(this.localChunks.keys()),
            timestamp: Date.now()
        };

        await this.config.dht.put(
            `p2p:announce:${this.config.nodeId}`,
            JSON.stringify(announcement)
        );
    }

    private listenForPeerEvents() {
        this.config.dht.on('peer:connect', (peer) => {
            // Handle new peer connection
        });

        this.config.dht.on('peer:disconnect', (peerId) => {
            // Handle peer disconnection
        });
    }

    private async findStoragePeers(size: number): Promise<string[]> {
        // Implementation needed: Find suitable peers for storage
        return [];
    }

    private async distributeChunkToPeer(peerId: string, chunk: ChunkInfo): Promise<any> {
        // Implementation needed: Send chunk to peer
        return null;
    }

    private async retrieveChunkFromPeer(peerId: string, chunk: ChunkInfo): Promise<Buffer> {
        // Implementation needed: Retrieve chunk from peer
        return Buffer.alloc(0);
    }

    private async announceContent(id: string, metadata: StorageMetadata) {
        // Implementation needed: Announce new content to network
    }

    private async announceDelete(id: string) {
        // Implementation needed: Announce content deletion to network
    }

    private getPeerCount(chunks: ChunkInfo[]): number {
        const uniquePeers = new Set<string>();
        chunks.forEach(chunk => {
            this.peerChunks.get(chunk.checksum)?.forEach(peerId => {
                uniquePeers.add(peerId);
            });
        });
        return uniquePeers.size;
    }

    private calculateAvailability(locations: any[]): number {
        // Implementation needed: Calculate chunk availability based on peer reliability
        return 1;
    }
}

export function createP2PStorage(config: P2PStorageConfig): StorageProvider {
    return new P2PStorageProvider(config);
}