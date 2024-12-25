// src/storage/network.ts

import { createHash } from 'crypto';
import { StorageProvider, StorageMetadata, StorageOptions, StorageStats, ChunkInfo } from './types';
import { DHTNetwork } from '../dht/network';
import { createChunkManager } from './chunk';
import { StorageError } from '@/types';
import { DHTInterface } from '../types/network';

export interface NetworkStorageConfig {
    dht: DHTNetwork;
    maxChunkSize?: number;
    minReplicas?: number;
    maxReplicas?: number;
    reliability?: number;
    region?: string;
}

export class NetworkStorageProvider implements StorageProvider {
    private readonly chunkManager;
    private stats: StorageStats;

    constructor(private readonly config: NetworkStorageConfig) {
        this.chunkManager = createChunkManager({
            chunkSize: config.maxChunkSize
        });

        this.stats = {
            used: 0,
            available: 0,
            files: 0,
            chunks: 0,
            operations: {
                reads: 0,
                writes: 0,
                deletes: 0
            }
        };
    }

    async store(data: Buffer, options?: StorageOptions): Promise<StorageMetadata> {
        this.stats.operations.writes++;

        // Generate unique ID for the data
        const id = this.generateId(data);

        try {
            // Split data into chunks
            const chunks = await this.chunkManager.split(data, options?.chunks?.size);

            // Store each chunk with replication
            const storedChunks = await Promise.all(
                chunks.map(chunk => this.storeChunk(chunk, options))
            );

            // Create metadata
            const metadata: StorageMetadata = {
                id,
                size: data.length,
                chunks: storedChunks,
                created: Date.now(),
                modified: Date.now(),
                checksum: this.calculateChecksum(data),
                storageType: 'network',
                replicas: options?.replicas ?? this.config.minReplicas ?? 3,
                encryption: options?.encryption?.enabled ? {
                    algorithm: options.encryption.algorithm ?? 'aes-256-gcm',
                    keyId: this.generateKeyId(),
                    params: {}
                } : undefined,
                compression: options?.compression?.enabled ? {
                    algorithm: options.compression.algorithm ?? 'gzip',
                    level: options.compression.level ?? 6,
                    originalSize: data.length
                } : undefined
            };

            // Store metadata in DHT
            await this.storeMetadata(id, metadata);

            // Update stats
            this.updateStatsOnStore(metadata);

            return metadata;
        } catch (error) {
            throw new StorageError('Failed to store data in network', {
                code: 'NETWORK_STORE_ERROR',
                details: error
            });
        }
    }

    async retrieve(id: string): Promise<Buffer> {
        this.stats.operations.reads++;

        try {
            // Get metadata from DHT
            const metadata = await this.getMetadata(id);

            // Retrieve all chunks
            const chunks = await Promise.all(
                metadata.chunks.map(chunk => this.retrieveChunk(chunk))
            );

            // Combine chunks
            const data = await this.chunkManager.combine(chunks, metadata.chunks);

            // Handle decompression if needed
            if (metadata.compression) {
                return this.decompress(data, metadata.compression);
            }

            return data;
        } catch (error) {
            throw new StorageError('Failed to retrieve data from network', {
                code: 'NETWORK_RETRIEVE_ERROR',
                details: error
            });
        }
    }

    async delete(id: string): Promise<boolean> {
        this.stats.operations.deletes++;

        try {
            const metadata = await this.getMetadata(id);

            // Delete all chunks
            await Promise.all(
                metadata.chunks.map(chunk => this.deleteChunk(chunk))
            );

            // Delete metadata from DHT
            await this.deleteMetadata(id);

            // Update stats
            this.updateStatsOnDelete(metadata);

            return true;
        } catch (error) {
            return false;
        }
    }

    async getMetadata(id: string): Promise<StorageMetadata> {
        const value = await this.config.dht.get(`metadata:${id}`);
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
        // Optional: Implement cleanup logic for orphaned chunks
    }

    private async storeChunk(chunk: ChunkInfo, options?: StorageOptions): Promise<ChunkInfo> {
        const chunkKey = `chunk:${chunk.checksum}`;
        const replicas = options?.replicas ?? this.config.minReplicas ?? 3;
        
        // Find suitable nodes for storage
        const nodes = await this.findStorageNodes(chunk.size, replicas);
        
        // Store chunk on each node
        const locations = await Promise.all(
            nodes.map(node => this.storeChunkOnNode(node, chunk))
        );

        return {
            ...chunk,
            location: locations[0], // Primary location
            replicas: locations.length
        };
    }

    private async retrieveChunk(chunk: ChunkInfo): Promise<Buffer> {
        const chunkKey = `chunk:${chunk.checksum}`;
        try {
            // Try primary location first
            return await this.retrieveChunkFromNode(chunk.location);
        } catch (error) {
            // If primary fails, try other replicas
            // Implementation depends on how replicas are tracked
            throw error;
        }
    }

    private async deleteChunk(chunk: ChunkInfo): Promise<void> {
        const chunkKey = `chunk:${chunk.checksum}`;
        await this.config.dht.delete(chunkKey);
    }

    private async storeMetadata(id: string, metadata: StorageMetadata): Promise<void> {
        await this.config.dht.put(
            `metadata:${id}`,
            JSON.stringify(metadata)
        );
    }

    private async deleteMetadata(id: string): Promise<void> {
        await this.config.dht.delete(`metadata:${id}`);
    }

    private generateId(data: Buffer): string {
        return createHash('sha256')
            .update(data)
            .update(Date.now().toString())
            .digest('hex');
    }

    private generateKeyId(): string {
        return createHash('sha256')
            .update(Date.now().toString())
            .update(Math.random().toString())
            .digest('hex');
    }

    private calculateChecksum(data: Buffer): string {
        return createHash('sha256').update(data).digest('hex');
    }

    private async findStorageNodes(size: number, count: number) {
        // Implementation would depend on DHT node discovery and selection
        // This is a placeholder
        return [];
    }

    private async storeChunkOnNode(node: any, chunk: ChunkInfo) {
        // Implementation would depend on node storage protocol
        // This is a placeholder
        return chunk.location;
    }

    private async retrieveChunkFromNode(location: any): Promise<Buffer> {
        // Implementation would depend on node storage protocol
        // This is a placeholder
        return Buffer.from([]);
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

    private async compress(data: Buffer, options: StorageOptions): Promise<Buffer> {
        // Compression implementation
        // This is a placeholder
        return data;
    }

    private async decompress(data: Buffer, info: any): Promise<Buffer> {
        // Decompression implementation
        // This is a placeholder
        return data;
    }
}

export function createNetworkStorage(config: NetworkStorageConfig): StorageProvider {
    return new NetworkStorageProvider(config);
}