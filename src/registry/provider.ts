// src/registry/provider.ts

import { EventEmitter } from 'events';
import { DHTNetwork } from '../dht/network';
import { StorageManager } from '../storage/manager';
import { C0reMetadata, ResourceType, VersionInfo } from '../types/metadata';
import { StorageError } from '../types';

export interface RegistryProviderConfig {
    network: DHTNetwork;
    storage: StorageManager;
    replicationFactor?: number;
    region?: string;
}

export class RegistryProvider extends EventEmitter {
    private readonly replicationFactor: number;
    
    constructor(private readonly config: RegistryProviderConfig) {
        super();
        this.replicationFactor = config.replicationFactor || 3;
    }

    /**
     * Store resource data and metadata
     */
    async store(
        data: Buffer,
        metadata: C0reMetadata,
        options?: {
            encryption?: boolean;
            compression?: boolean;
        }
    ): Promise<void> {
        try {
            // Store the actual data using storage manager
            const storageMetadata = await this.config.storage.store({
                data,
                strategy: 'hybrid',
                priority: 1,
                options: {
                    encryption: {
                        enabled: options?.encryption || false
                    },
                    compression: {
                        enabled: options?.compression || false
                    },
                    replicas: this.replicationFactor
                }
            });

            // Update metadata with storage info
            const updatedMetadata: C0reMetadata = {
                ...metadata,
                size: data.length,
                checksum: storageMetadata.checksum,
                resourceMetadata: {
                    ...metadata.resourceMetadata,
                    storage: {
                        id: storageMetadata.id,
                        type: 'hybrid',
                        replicas: storageMetadata.replicas,
                        encryption: options?.encryption || false,
                        compression: options?.compression || false
                    }
                }
            };

            // Store metadata in DHT
            await this.storeMetadata(updatedMetadata);

            this.emit('stored', {
                type: metadata.type,
                id: metadata.id,
                size: data.length
            });
        } catch (error) {
            throw new StorageError('Failed to store resource', {
                code: 'STORE_ERROR',
                details: error
            });
        }
    }

    /**
     * Retrieve resource data and metadata
     */
    async retrieve(id: string): Promise<{ data: Buffer; metadata: C0reMetadata }> {
        // Get metadata from DHT
        const metadata = await this.getMetadata(id);
        if (!metadata) {
            throw new StorageError('Resource not found', {
                code: 'NOT_FOUND',
                id
            });
        }

        // Get storage ID from metadata
        const storageId = metadata.resourceMetadata?.storage?.id;
        if (!storageId) {
            throw new StorageError('Storage information missing', {
                code: 'INVALID_METADATA',
                id
            });
        }

        // Retrieve data from storage
        const data = await this.config.storage.retrieve(storageId);

        return { data, metadata };
    }

    /**
     * Update resource version
     */
    async createVersion(
        id: string,
        data: Buffer,
        version: string,
        changes: string[]
    ): Promise<void> {
        // Get current metadata
        const current = await this.getMetadata(id);
        if (!current) {
            throw new StorageError('Resource not found', {
                code: 'NOT_FOUND',
                id
            });
        }

        // Create version info
        const versionInfo: VersionInfo = {
            version,
            timestamp: Date.now(),
            changes,
            parent: current.version
        };

        // Store new version
        await this.store(data, {
            ...current,
            version,
            updatedAt: Date.now()
        });

        // Update version history
        await this.updateVersionHistory(id, versionInfo);

        this.emit('version-created', {
            id,
            version,
            changes
        });
    }

    private async storeMetadata(metadata: C0reMetadata): Promise<void> {
        const key = `registry:${metadata.id}`;
        await this.config.network.put(key, JSON.stringify(metadata));
    }

    private async getMetadata(id: string): Promise<C0reMetadata | null> {
        const key = `registry:${id}`;
        const value = await this.config.network.get(key);
        return value ? JSON.parse(value) : null;
    }

    private async updateVersionHistory(id: string, version: VersionInfo): Promise<void> {
        const key = `registry:versions:${id}`;
        const history = await this.getVersionHistory(id);
        history.push(version);
        await this.config.network.put(key, JSON.stringify(history));
    }

    private async getVersionHistory(id: string): Promise<VersionInfo[]> {
        const key = `registry:versions:${id}`;
        const value = await this.config.network.get(key);
        return value ? JSON.parse(value) : [];
    }
}