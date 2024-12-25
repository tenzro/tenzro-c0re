// src/storage/manager.ts

import { EventEmitter } from 'events';
import { StorageProvider, StorageMetadata, StorageStats, } from './types';
import { createLocalStorage } from './local';
import { createNetworkStorage } from './network';
import { createP2PStorage } from './p2p';
import { ChunkManager, StorageError } from '@/types';
import { DefaultChunkManager } from './chunk';
import { StorageOptions } from './types';

export interface StorageConfig {
    // Add storage configuration interface
}

export interface StorageManager {
    getChunkManager(): ChunkManager;
}

export interface StorageManagerConfig {
    defaultChunkSize: number;
    local?: {
        enabled: boolean;
        path: string;
        maxSize?: number;
    };
    network?: {
        enabled: boolean;
        dht: any;  // DHT instance
        maxChunkSize?: number;
    };
    p2p?: {
        enabled: boolean;
        dht: any;  // DHT instance
        nodeId: string;
        maxChunkSize?: number;
    };
    defaultStrategy?: StorageStrategy;
    replicationFactor?: number;
    region?: string;
}

export type StorageStrategy = 'local-only' | 'network-only' | 'p2p-only' | 'hybrid';

export interface StorageRequest {
    data: Buffer;
    options?: StorageOptions;
    strategy?: StorageStrategy;
    priority?: number;
}

export class StorageManager extends EventEmitter {
    private providers: Map<string, StorageProvider> = new Map();
    private metadataCache: Map<string, StorageMetadata> = new Map();
    private chunkManager: ChunkManager;

    constructor(private readonly config: StorageManagerConfig) {
        super();
        // Initialize ChunkManager properly
        this.chunkManager = new DefaultChunkManager(this.config.defaultChunkSize || 1024 * 1024);
        this.initializeProviders();
    }

    getChunkManager(): ChunkManager {
        return this.chunkManager;
    }

    /**
     * Store data using the specified strategy
     */
    async store(request: StorageRequest): Promise<StorageMetadata> {
        const strategy = request.strategy || this.config.defaultStrategy || 'hybrid';
        const providers = this.getProvidersForStrategy(strategy);

        if (providers.length === 0) {
            throw new StorageError('No storage providers available for strategy', {
                code: 'NO_PROVIDERS',
                strategy
            });
        }

        try {
            // Store with primary provider
            const primaryMetadata = await providers[0].store(request.data, request.options);
            this.metadataCache.set(primaryMetadata.id, primaryMetadata);

            // Handle replication if needed
            if (providers.length > 1 && request.options?.replicas !== 0) {
                await this.handleReplication(primaryMetadata, providers.slice(1), request.options);
            }

            // Emit storage event
            this.emit('stored', {
                id: primaryMetadata.id,
                size: primaryMetadata.size,
                replicas: providers.length,
                strategy
            });

            return primaryMetadata;
        } catch (error) {
            throw new StorageError('Failed to store data', {
                code: 'STORE_ERROR',
                strategy,
                details: error
            });
        }
    }

    /**
     * Retrieve data by ID
     */
    async retrieve(id: string, options?: { preferredProvider?: string }): Promise<Buffer> {
        // Check cache for metadata
        let metadata = this.metadataCache.get(id);
        
        // If not in cache, try to get from any provider
        if (!metadata) {
            metadata = (await this.findMetadata(id)) || undefined;
            if (metadata) {
                this.metadataCache.set(id, metadata);
            }
        }

        if (!metadata) {
            throw new StorageError('Data not found', {
                code: 'NOT_FOUND',
                id
            });
        }

        // Get available providers for this data
        const providers = this.getProvidersForMetadata(metadata);
        
        if (providers.length === 0) {
            throw new StorageError('No providers available for retrieval', {
                code: 'NO_PROVIDERS',
                id
            });
        }

        // Try preferred provider first if specified
        if (options?.preferredProvider) {
            const preferred = this.providers.get(options.preferredProvider);
            if (preferred) {
                try {
                    return await preferred.retrieve(id);
                } catch (error) {
                    // Continue with other providers
                }
            }
        }

        // Try each provider until successful
        let lastError;
        for (const provider of providers) {
            try {
                const data = await provider.retrieve(id);
                
                // Verify checksum
                if (!await provider.validateChecksum(id)) {
                    throw new Error('Checksum validation failed');
                }

                this.emit('retrieved', {
                    id,
                    size: metadata.size,
                    provider: provider
                });

                return data;
            } catch (error) {
                lastError = error;
                continue;
            }
        }

        throw new StorageError('Failed to retrieve data from any provider', {
            code: 'RETRIEVE_ERROR',
            id,
            details: lastError
        });
    }

    /**
     * Delete data by ID
     */
    async delete(id: string): Promise<boolean> {
        const metadata = await this.findMetadata(id);
        if (!metadata) {
            return false;
        }

        const providers = this.getProvidersForMetadata(metadata);
        const results = await Promise.all(
            providers.map(provider => provider.delete(id))
        );

        const success = results.some(result => result);
        if (success) {
            this.metadataCache.delete(id);
            this.emit('deleted', { id });
        }

        return success;
    }

    /**
     * Get metadata for stored data
     */
    async getMetadata(id: string): Promise<StorageMetadata | null> {
        // Check cache first
        const cached = this.metadataCache.get(id);
        if (cached) {
            return cached;
        }

        // Try to find in providers
        const metadata = await this.findMetadata(id);
        if (metadata) {
            this.metadataCache.set(id, metadata);
        }

        return metadata;
    }

    /**
     * Get storage statistics
     */
    async getStats(): Promise<Record<string, StorageStats>> {
        const stats: Record<string, StorageStats> = {};
        
        for (const [name, provider] of this.providers) {
            stats[name] = await provider.getStats();
        }

        return stats;
    }

    /**
     * Initialize storage providers based on configuration
     */
    private initializeProviders() {
        if (this.config.local?.enabled) {
            this.providers.set('local', createLocalStorage({
                path: this.config.local.path,
                maxSize: this.config.local.maxSize
            }));
        }

        if (this.config.network?.enabled) {
            this.providers.set('network', createNetworkStorage({
                dht: this.config.network.dht,
                maxChunkSize: this.config.network.maxChunkSize
            }));
        }

        if (this.config.p2p?.enabled) {
            this.providers.set('p2p', createP2PStorage({
                dht: this.config.p2p.dht,
                nodeId: this.config.p2p.nodeId,
                maxChunkSize: this.config.p2p.maxChunkSize,
                region: this.config.region
            }));
        }
    }

    /**
     * Get relevant providers for a storage strategy
     */
    private getProvidersForStrategy(strategy: StorageStrategy): StorageProvider[] {
        switch (strategy) {
            case 'local-only':
                return this.providers.has('local') ? [this.providers.get('local')!] : [];
            case 'network-only':
                return this.providers.has('network') ? [this.providers.get('network')!] : [];
            case 'p2p-only':
                return this.providers.has('p2p') ? [this.providers.get('p2p')!] : [];
            case 'hybrid':
                return Array.from(this.providers.values());
            default:
                return [];
        }
    }

    /**
     * Get providers that can handle the given metadata
     */
    private getProvidersForMetadata(metadata: StorageMetadata): StorageProvider[] {
        return Array.from(this.providers.values()).filter(provider =>
            metadata.chunks.some(chunk => 
                chunk.location.storageType === provider.constructor.name.toLowerCase()
            )
        );
    }

    /**
     * Handle data replication across providers
     */
    private async handleReplication(
        metadata: StorageMetadata,
        providers: StorageProvider[],
        options?: StorageOptions
    ): Promise<void> {
        const replicationFactor = options?.replicas ?? this.config.replicationFactor ?? 1;
        const replicationPromises = providers
            .slice(0, replicationFactor - 1)
            .map(provider => this.replicateToProvider(metadata, provider, options));

        await Promise.allSettled(replicationPromises);
    }

    /**
     * Replicate data to a specific provider
     */
    private async replicateToProvider(
        metadata: StorageMetadata,
        provider: StorageProvider,
        options?: StorageOptions
    ): Promise<void> {
        try {
            // Get data from original source
            const data = await this.retrieve(metadata.id);
            
            // Store in new provider
            await provider.store(data, {
                ...options,
                replicas: 1  // Don't trigger further replication
            });

            this.emit('replicated', {
                id: metadata.id,
                provider: provider
            });
        } catch (error) {
            this.emit('replication-failed', {
                id: metadata.id,
                provider: provider,
                error
            });
        }
    }

    /**
     * Find metadata across all providers
     */
    private async findMetadata(id: string): Promise<StorageMetadata | null> {
        for (const provider of this.providers.values()) {
            try {
                const metadata = await provider.getMetadata(id);
                if (metadata) {
                    return metadata;
                }
            } catch {
                continue;
            }
        }
        return null;
    }

    /**
     * Clean up resources
     */
    async cleanup(): Promise<void> {
        await Promise.all(
            Array.from(this.providers.values()).map(provider => 
                provider.cleanup()
            )
        );
        this.metadataCache.clear();
    }
}

export function createStorageManager(config: StorageManagerConfig): StorageManager {
    return new StorageManager(config);
}