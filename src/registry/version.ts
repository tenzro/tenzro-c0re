// src/registry/version.ts

import { EventEmitter } from 'events';
import { DHTNetwork } from '../dht/network';
import { C0reMetadata, ResourceType, VersionInfo } from '../types/metadata';
import { StorageManager } from '../storage/manager';
import { ValidationError } from '../types';
import { StorageRequest } from '../types/storage';

export interface VersionDiff {
    added: string[];
    modified: string[];
    deleted: string[];
    size: {
        before: number;
        after: number;
        diff: number;
    };
}

export interface VersionGraph {
    nodes: {
        [version: string]: {
            info: VersionInfo;
            metadata: C0reMetadata;
        };
    };
    edges: {
        [version: string]: string[];  // parent -> children
    };
}

export interface VersionMetadata {
    dependencies?: Array<{
        id: string;
        version: string;
        type: ResourceType;
    }>;
}

export class VersionControl extends EventEmitter {
    constructor(
        private readonly network: DHTNetwork,
        private readonly storage: StorageManager
    ) {
        super();
    }

    async createVersion(
        resourceId: string,
        newVersion: string,
        data: Buffer,
        changes: string[],
        metadata?: Partial<VersionMetadata>
    ): Promise<VersionInfo> {
        // Get current version info
        const currentVersion = await this.getCurrentVersion(resourceId);
        const graph = await this.getVersionGraph(resourceId);

        // Validate version string
        if (!this.isValidVersion(newVersion)) {
            throw new ValidationError('Invalid version string', {
                code: 'INVALID_VERSION',
                version: newVersion
            });
        }

        // Check version doesn't already exist
        if (graph.nodes[newVersion]) {
            throw new ValidationError('Version already exists', {
                code: 'VERSION_EXISTS',
                version: newVersion
            });
        }

        // Create version info
        const versionInfo: VersionInfo = {
            version: newVersion,
            timestamp: Date.now(),
            changes,
            parent: currentVersion?.version,
            dependencies: await this.resolveDependencies(metadata)
        };

        // Store new version data
        const storageRequest: StorageRequest = {
            data,
            strategy: 'hybrid',
            priority: 1,
            options: {
                encryption: {
                    enabled: false
                },
                compression: {
                    enabled: true,
                    algorithm: 'gzip',
                    level: 6
                },
                chunks: {
                    size: 1024 * 1024, // 1MB chunks
                    parallel: 4
                }
            },
            id: '',
            type: 'store',
            resourceId: ''
        };

        const storageMetadata = await this.storage.store(storageRequest);

        // Update version graph
        await this.updateVersionGraph(resourceId, versionInfo, graph);

        // Update resource metadata if provided
        if (metadata) {
            await this.updateResourceMetadata(resourceId, metadata);
        }

        this.emit('version:created', {
            resourceId,
            version: newVersion,
            changes
        });

        return versionInfo;
    }

    async getVersionHistory(resourceId: string): Promise<VersionInfo[]> {
        const graph = await this.getVersionGraph(resourceId);
        return Object.values(graph.nodes)
            .map(node => node.info)
            .sort((a, b) => b.timestamp - a.timestamp);
    }

    async compareVersions(
        resourceId: string,
        version1: string,
        version2: string
    ): Promise<VersionDiff> {
        const [v1Data, v2Data] = await Promise.all([
            this.getVersionData(resourceId, version1),
            this.getVersionData(resourceId, version2)
        ]);

        return this.calculateDiff(v1Data, v2Data);
    }

    async switchVersion(
        resourceId: string,
        targetVersion: string
    ): Promise<{ metadata: C0reMetadata; data: Buffer }> {
        const graph = await this.getVersionGraph(resourceId);
        const versionNode = graph.nodes[targetVersion];

        if (!versionNode) {
            throw new ValidationError('Version not found', {
                code: 'VERSION_NOT_FOUND',
                version: targetVersion
            });
        }

        const data = await this.getVersionData(resourceId, targetVersion);
        if (!data) {
            throw new ValidationError('Version data not found', {
                code: 'VERSION_DATA_NOT_FOUND',
                version: targetVersion
            });
        }

        return {
            metadata: versionNode.metadata,
            data
        };
    }

    private async getCurrentVersion(resourceId: string): Promise<VersionInfo | null> {
        const history = await this.getVersionHistory(resourceId);
        return history[0] || null;
    }

    private async getVersionGraph(resourceId: string): Promise<VersionGraph> {
        const value = await this.network.get(`versions:${resourceId}`);
        if (!value) {
            return { nodes: {}, edges: {} };
        }
        return JSON.parse(value);
    }

    private async updateVersionGraph(
        resourceId: string,
        versionInfo: VersionInfo,
        graph: VersionGraph
    ): Promise<void> {
        const metadata = await this.getResourceMetadata(resourceId);
        if (!metadata) {
            throw new ValidationError('Resource metadata not found', {
                code: 'METADATA_NOT_FOUND',
                resourceId
            });
        }

        // Add node
        graph.nodes[versionInfo.version] = {
            info: versionInfo,
            metadata
        };

        // Update edges
        if (versionInfo.parent) {
            if (!graph.edges[versionInfo.parent]) {
                graph.edges[versionInfo.parent] = [];
            }
            graph.edges[versionInfo.parent].push(versionInfo.version);
        }

        // Store updated graph
        await this.network.put(`versions:${resourceId}`, JSON.stringify(graph));
    }

    private async getVersionData(resourceId: string, version: string): Promise<Buffer> {
        const key = `${resourceId}:${version}`;
        return this.storage.retrieve(key);
    }

    private async getResourceMetadata(resourceId: string): Promise<C0reMetadata> {
        const value = await this.network.get(`metadata:${resourceId}`);
        if (!value) {
            throw new ValidationError('Resource metadata not found', {
                code: 'METADATA_NOT_FOUND',
                resourceId
            });
        }
        return JSON.parse(value);
    }

    private async updateResourceMetadata(
        resourceId: string,
        update: Partial<VersionMetadata>
    ): Promise<void> {
        const current = await this.getResourceMetadata(resourceId);
        const updated = {
            ...current,
            ...update,
            updatedAt: Date.now()
        };
        await this.network.put(`metadata:${resourceId}`, JSON.stringify(updated));
    }

    private async resolveDependencies(
        metadata?: Partial<VersionMetadata>
    ): Promise<VersionInfo['dependencies']> {
        if (!metadata?.dependencies?.length) {
            return [];
        }

        return Promise.all(
            metadata.dependencies.map(async (dep) => {
                const version = await this.getCurrentVersion(dep.id);
                return {
                    id: dep.id,
                    version: version?.version || 'latest',
                    type: dep.type
                };
            })
        );
    }

    private isValidVersion(version: string): boolean {
        const semverRegex = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;
        return semverRegex.test(version);
    }

    private calculateDiff(v1Data: Buffer, v2Data: Buffer): VersionDiff {
        // This is a simple implementation - could be enhanced with actual diff algorithm
        return {
            added: [],
            modified: [],
            deleted: [],
            size: {
                before: v1Data.length,
                after: v2Data.length,
                diff: v2Data.length - v1Data.length
            }
        };
    }
}