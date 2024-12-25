// src/integration/core.ts

import { EventEmitter } from 'events';
import { TenzroNetworkBridge } from './bridge';
import { ContentDiscovery } from '../discovery/content';
import { SearchEngine } from '../search/engine';
import { VersionControl } from '../registry/version';
import { DHTNetwork } from '../dht/network';
import { StorageManager } from '../storage/manager';
import { C0reMetadata, ResourceType } from '../types/metadata';
import { NetworkConfig, NetworkStats } from '../types/network';
import { ComponentRefs, CoreComponents } from '../types/core';

export interface C0reConfig {
    networkConfig: NetworkConfig;
    storage: {
        path: string;
        maxSize: number;
    };
    discovery: {
        enabled: boolean;
        interval: number;
    };
}

export class C0reNode extends EventEmitter {
    private components: ComponentRefs;
    private isRunning: boolean = false;

    constructor(private readonly config: C0reConfig) {
        super();
        this.components = {
            bridge: undefined,
            network: undefined,
            storage: undefined,
            discovery: undefined,
            search: undefined,
            versionControl: undefined
        };
        this.initializeComponents();
    }

    async start(): Promise<void> {
        if (this.isRunning || !this.components.bridge) {
            return;
        }

        try {
            // Start network bridge
            await this.components.bridge.connect({
                localNode: {
                    endpoint: 'localhost',
                    port: 8080
                }
            });

            // Initialize other components
            await this.initializeStorage();
            await this.initializeDiscovery();
            
            this.isRunning = true;
            this.emit('started');

            // Start periodic tasks
            this.startPeriodicTasks();
        } catch (error) {
            this.emit('error', error);
            throw error;
        }
    }

    async stop(): Promise<void> {
        if (!this.isRunning || !this.components.bridge) {
            return;
        }

        try {
            await this.components.bridge.disconnect();
            this.isRunning = false;
            this.emit('stopped');
        } catch (error) {
            this.emit('error', error);
            throw error;
        }
    }

    async publishContent(
        type: ResourceType,
        data: Buffer,
        metadata: C0reMetadata
    ): Promise<string> {
        this.ensureRunning();
        const { discovery, search } = this.getComponents();
        const contentInfo = await discovery.publishContent(data, metadata);
        await search.indexContent(contentInfo);
        return contentInfo.contentId;
    }

    async retrieveContent(contentId: string): Promise<{
        data: Buffer;
        metadata: C0reMetadata;
    }> {
        this.ensureRunning();
        const { discovery } = this.getComponents();
        throw new Error('Not implemented');
    }

    async searchContent(query: string, options: any = {}): Promise<any[]> {
        this.ensureRunning();
        const { search } = this.getComponents();
        return search.search({
            query,
            ...options
        });
    }

    async createVersion(
        contentId: string,
        version: string,
        data: Buffer,
        changes: string[]
    ): Promise<void> {
        this.ensureRunning();
        const { versionControl } = this.getComponents();
        await versionControl.createVersion(
            contentId,
            version,
            data,
            changes
        );
    }

    async getStats(): Promise<NetworkStats> {
        this.ensureRunning();
        const { network } = this.getComponents();
        return network.getStats();
    }

    private initializeComponents(): void {
        this.components.bridge = new TenzroNetworkBridge(this.config.networkConfig);
        this.components.network = new DHTNetwork(this.config.networkConfig, '');
        this.components.storage = new StorageManager({
            local: {
                enabled: true,
                path: this.config.storage.path,
                maxSize: this.config.storage.maxSize
            },
            defaultChunkSize: 1024 * 1024 // 1MB default chunk size
        });

        this.components.search = new SearchEngine(this.components.network);
        this.components.versionControl = new VersionControl(
            this.components.network,
            this.components.storage
        );
        this.components.search = new SearchEngine(this.components.network);
        this.components.versionControl = new VersionControl(
            this.components.network,
            this.components.storage
        );
    }

    private getComponents(): CoreComponents {
        if (!this.components.bridge || !this.components.network || 
            !this.components.storage || !this.components.discovery || 
            !this.components.search || !this.components.versionControl) {
            throw new Error('Components not properly initialized');
        }
        return this.components as CoreComponents;
    }

    private async initializeStorage(): Promise<void> {
        const { storage } = this.getComponents();
        // Add storage initialization logic here
    }

    private async initializeDiscovery(): Promise<void> {
        const { discovery } = this.getComponents();
        // Add discovery initialization logic here
    }

    private startPeriodicTasks(): void {
        if (this.config.discovery.enabled) {
            setInterval(() => {
                this.performDiscovery().catch(error => {
                    this.emit('error', error);
                });
            }, this.config.discovery.interval);
        }
    }

    private async performDiscovery(): Promise<void> {
        const { discovery } = this.getComponents();
        // Add discovery performance logic here
    }

    private ensureRunning(): void {
        if (!this.isRunning) {
            throw new Error('C0re node is not running');
        }
    }
}