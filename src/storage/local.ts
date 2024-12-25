// src/storage/local.ts

import { promises as fs } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';
import { StorageProvider, StorageMetadata, StorageOptions, StorageStats, ChunkManager } from './types';
import { createChunkManager } from './chunk';

export interface LocalStorageConfig {
    path: string;
    maxSize?: number;
    chunkSize?: number;
}

export class LocalStorageProvider implements StorageProvider {
    private chunkManager: ChunkManager;
    private stats: StorageStats;

    constructor(private readonly config: LocalStorageConfig) {
        this.chunkManager = createChunkManager({ chunkSize: config.chunkSize });
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
        // Generate ID and create paths
        const id = this.generateId(data);
        const metadataPath = this.getMetadataPath(id);
        const chunksPath = this.getChunksPath(id);

        // Ensure directories exist
        await fs.mkdir(chunksPath, { recursive: true });

        // Split into chunks
        const chunkSize = options?.chunks?.size ?? this.config.chunkSize ?? 1024 * 1024; // 1MB default
        const chunks = await this.chunkManager.split(data, chunkSize);

        // Store chunks
        await Promise.all(chunks.map(async (chunk, index) => {
            const chunkPath = join(chunksPath, `${index}`);
            const offset = index * chunkSize;
            const chunkData = data.slice(offset, offset + chunk.size);
            await fs.writeFile(chunkPath, chunkData);
            
            // Update chunk location
            chunk.location = {
                ...chunk.location,
                nodeId: 'local',
                endpoint: chunkPath,
                protocol: 'file'
            };
        }));

        // Create metadata
        const metadata: StorageMetadata = {
            id,
            size: data.length,
            chunks,
            created: Date.now(),
            modified: Date.now(),
            checksum: this.calculateChecksum(data),
            storageType: 'local',
            replicas: 1
        };

        // Store metadata
        await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));

        // Update stats
        this.stats.files++;
        this.stats.chunks += chunks.length;
        this.stats.used += data.length;
        this.stats.operations.writes++;

        return metadata;
    }

    async retrieve(id: string): Promise<Buffer> {
        this.stats.operations.reads++;
        
        // Get metadata
        const metadata = await this.getMetadata(id);
        const chunks: Buffer[] = [];

        // Read all chunks
        for (const chunkInfo of metadata.chunks) {
            const chunkPath = chunkInfo.location.endpoint;
            if (!chunkPath) {
                throw new Error(`Missing chunk endpoint for file ${id}`);
            }
            const chunkData = await fs.readFile(chunkPath);
            chunks.push(chunkData);
        }

        // Combine chunks
        return this.chunkManager.combine(chunks, metadata.chunks);
    }

    async delete(id: string): Promise<boolean> {
        try {
            const metadata = await this.getMetadata(id);
            
            // Delete all chunks
            await Promise.all(metadata.chunks.map(chunk => {
                if (!chunk.location.endpoint) {
                    throw new Error(`Missing chunk endpoint for file ${id}`);
                }
                return fs.unlink(chunk.location.endpoint);
            }));

            // Delete metadata
            await fs.unlink(this.getMetadataPath(id));

            // Update stats
            this.stats.files--;
            this.stats.chunks -= metadata.chunks.length;
            this.stats.used -= metadata.size;
            this.stats.operations.deletes++;

            return true;
        } catch (error) {
            return false;
        }
    }

    async getMetadata(id: string): Promise<StorageMetadata> {
        const path = this.getMetadataPath(id);
        const data = await fs.readFile(path, 'utf8');
        return JSON.parse(data);
    }

    async updateMetadata(id: string, update: Partial<StorageMetadata>): Promise<void> {
        const metadata = await this.getMetadata(id);
        const updated = { ...metadata, ...update, modified: Date.now() };
        await fs.writeFile(
            this.getMetadataPath(id),
            JSON.stringify(updated, null, 2)
        );
    }

    async getStats(): Promise<StorageStats> {
        return { ...this.stats };
    }

    async validateChecksum(id: string): Promise<boolean> {
        const metadata = await this.getMetadata(id);
        const data = await this.retrieve(id);
        const checksum = this.calculateChecksum(data);
        return checksum === metadata.checksum;
    }

    async cleanup(): Promise<void> {
        // Optional: Implement cleanup logic
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

    private getMetadataPath(id: string): string {
        return join(this.config.path, 'metadata', id);
    }

    private getChunksPath(id: string): string {
        return join(this.config.path, 'chunks', id);
    }
}

export function createLocalStorage(config: LocalStorageConfig): StorageProvider {
    return new LocalStorageProvider(config);
}