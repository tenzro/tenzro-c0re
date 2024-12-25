// src/registry/client.ts

import { EventEmitter } from 'events';
import { DHTNetwork } from '../dht/network';
import { C0reMetadata, ResourceType, MetadataUpdate } from '../types/metadata';
import { StorageManager } from '../storage/manager';
import { ValidationError } from '../types';

export interface RegistryConfig {
    network: DHTNetwork;
    storage: StorageManager;
    prefix?: string;
    validators?: {
        [key in ResourceType]?: (metadata: C0reMetadata) => boolean;
    };
}

export class RegistryClient extends EventEmitter {
    private readonly prefix: string;
    private readonly validators: Map<ResourceType, (metadata: C0reMetadata) => boolean>;
    
    constructor(private readonly config: RegistryConfig) {
        super();
        this.prefix = config.prefix || 'registry:';
        this.validators = new Map(Object.entries(config.validators || {}) as [ResourceType, (metadata: C0reMetadata) => boolean][]);
    }

    /**
     * Register a new dataset or model
     */
    async register(metadata: C0reMetadata): Promise<string> {
        // Validate metadata
        if (!this.validateMetadata(metadata)) {
            throw new ValidationError('Invalid metadata', {
                code: 'INVALID_METADATA',
                metadata
            });
        }

        // Generate registry key
        const registryKey = this.getRegistryKey(metadata);

        // Store in DHT
        await this.config.network.put(registryKey, JSON.stringify(metadata));

        // Store version info
        await this.updateVersionHistory(metadata);

        this.emit('registered', {
            type: metadata.type,
            id: metadata.id,
            version: metadata.version
        });

        return metadata.id;
    }

    /**
     * Get metadata for a registered resource
     */
    async get(id: string): Promise<C0reMetadata | null> {
        const key = `${this.prefix}${id}`;
        const value = await this.config.network.get(key);
        return value ? JSON.parse(value) : null;
    }

    /**
     * Update metadata for a registered resource
     */
    async update(update: MetadataUpdate): Promise<void> {
        // Get current metadata
        const current = await this.get(update.id);
        if (!current) {
            throw new ValidationError('Resource not found', {
                code: 'NOT_FOUND',
                id: update.id
            });
        }

        // Create updated metadata
        const updated: C0reMetadata = {
            ...current,
            ...update.fields,
            updatedAt: Date.now()
        };

        // Validate updated metadata
        if (!this.validateMetadata(updated)) {
            throw new ValidationError('Invalid update', {
                code: 'INVALID_UPDATE',
                update
            });
        }

        // Store updated metadata
        await this.config.network.put(
            this.getRegistryKey(updated),
            JSON.stringify(updated)
        );

        this.emit('updated', {
            type: updated.type,
            id: updated.id,
            version: updated.version
        });
    }

    /**
     * Find resources matching criteria
     */
    async find(criteria: {
        type?: ResourceType;
        tags?: string[];
        author?: string;
        after?: number;
        before?: number;
    }): Promise<C0reMetadata[]> {

        const routingTable = this.config.network.getRoutingTable();
        if (!routingTable) {
            throw new Error('Routing table not available');
        }

        // Get all peers
        const peers = await this.config.network.getRoutingTable().getAllPeers();
        
        // Query each peer for matching resources
        const results = new Map<string, C0reMetadata>();
        
        await Promise.all(peers.map(async (peer: { id: string; }) => {
            try {
                const peerResults = await this.queryPeer(peer.id, criteria);
                peerResults.forEach(metadata => {
                    results.set(metadata.id, metadata);
                });
            } catch (error) {
                // Continue with other peers
            }
        }));

        return Array.from(results.values());
    }

    /**
     * Get version history for a resource
     */
    async getVersionHistory(id: string): Promise<string[]> {
        const key = `${this.prefix}versions:${id}`;
        const value = await this.config.network.get(key);
        return value ? JSON.parse(value) : [];
    }

    private validateMetadata(metadata: C0reMetadata): boolean {
        // Basic validation
        if (!metadata.id || !metadata.type || !metadata.version) {
            return false;
        }

        // Check resource type validator
        const validator = this.validators.get(metadata.type);
        if (validator) {
            return validator(metadata);
        }

        return true;
    }

    private getRegistryKey(metadata: C0reMetadata): string {
        return `${this.prefix}${metadata.id}`;
    }

    private async updateVersionHistory(metadata: C0reMetadata): Promise<void> {
        const key = `${this.prefix}versions:${metadata.id}`;
        const versions = await this.getVersionHistory(metadata.id);
        versions.push(metadata.version);
        await this.config.network.put(key, JSON.stringify(versions));
    }

    private async queryPeer(peerId: string, criteria: {
        type?: ResourceType;
        tags?: string[];
        author?: string;
        after?: number;
        before?: number;
    }): Promise<C0reMetadata[]> {
        try {
            // Implement actual peer querying logic
            return [];
        } catch (error) {
            this.emit('error', {
                code: 'PEER_QUERY_FAILED',
                peerId,
                error
            });
            return [];
        }
    }
}