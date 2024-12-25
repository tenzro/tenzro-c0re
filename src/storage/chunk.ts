// src/storage/chunk.ts

import { createHash } from 'crypto';
import { ChunkInfo, ChunkManager } from './types';
import { StorageError } from '@/types';

export class DefaultChunkManager implements ChunkManager {
    constructor(private readonly defaultChunkSize: number = 1024 * 1024) {}

    /**
     * Split data into chunks
     */
    async split(data: Buffer, chunkSize: number = this.defaultChunkSize): Promise<ChunkInfo[]> {
        const chunks: ChunkInfo[] = [];
        let index = 0;
        let offset = 0;

        while (offset < data.length) {
            const size = Math.min(chunkSize, data.length - offset);
            const chunk = data.slice(offset, offset + size);
            const checksum = this.calculateChecksum(chunk);

            chunks.push({
                index,
                size,
                checksum,
                location: {
                    nodeId: '', // To be filled by storage provider
                    type: 'source',
                    storageType: 'local',
                    protocol: 'file',
                    endpoint: '',
                    region: '',
                    availability: 1,
                    lastSeen: Date.now(),
                    health: 1,
                    capacity: 0,
                    used: 0,
                    latency: 0,
                    bandwidth: 0
                },
                replicas: 0
            });

            offset += size;
            index++;
        }

        return chunks;
    }

    /**
     * Combine chunks back into original data
     */
    async combine(chunks: Buffer[], info: ChunkInfo[]): Promise<Buffer> {
        // Validate input
        if (chunks.length !== info.length) {
            throw new Error('Chunks and chunk info length mismatch');
        }

        // Sort chunks by index
        const sortedPairs = info.map((info, i) => ({info, data: chunks[i]}))
            .sort((a, b) => a.info.index - b.info.index);

        // Validate each chunk
        for (const {data, info} of sortedPairs) {
            const valid = await this.validate(data, info);
            if (!valid) {
                throw new StorageError('Chunk validation failed', {
                    code: 'CHUNK_VALIDATION_ERROR',
                    details: { chunkIndex: info.index }
                });
            }
        }

        // Combine chunks
        const totalSize = sortedPairs.reduce((sum, {info}) => sum + info.size, 0);
        const result = Buffer.allocUnsafe(totalSize);
        let offset = 0;

        for (const {data} of sortedPairs) {
            data.copy(result, offset);
            offset += data.length;
        }

        return result;
    }

    /**
     * Validate a chunk against its metadata
     */
    async validate(chunk: Buffer, info: ChunkInfo): Promise<boolean> {
        if (chunk.length !== info.size) {
            return false;
        }

        const checksum = this.calculateChecksum(chunk);
        return checksum === info.checksum;
    }

    /**
     * Calculate checksum for a chunk
     */
    private calculateChecksum(data: Buffer): string {
        return createHash('sha256').update(data).digest('hex');
    }
}

export function createChunkManager(options?: { chunkSize?: number }): ChunkManager {
    return new DefaultChunkManager(options?.chunkSize);
}