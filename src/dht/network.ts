// src/dht/network.ts

import { EventEmitter } from 'events';
import { NetworkConfig, PeerInfo, RoutingTable, NetworkStats } from '../types/network';
import { DHTMessage, DHTProtocol, createDHTProtocol } from './protocol';
import { KBucket } from './kbucket'; // We'll implement this next

export class DHTNetwork extends EventEmitter {
    getNodeId(): string {
        throw new Error('Method not implemented.');
    }
    getRegion(): string {
        throw new Error('Method not implemented.');
    }
    private protocol: DHTProtocol;
    private routingTable: RoutingTable;
    private connected: boolean = false;
    private stats: NetworkStats;
    
    constructor(
        private readonly config: NetworkConfig,
        private readonly nodeId: string
    ) {
        super();
        this.routingTable = new KBucket(nodeId, config.dht?.kBucketSize || 20)
        this.protocol = createDHTProtocol();
        this.stats = this.initializeStats();
    }

    public getRoutingTable(): RoutingTable {
        return this.routingTable;
    }

    /**
     * Start the DHT network
     */
    public async start(): Promise<void> {
        if (this.connected) {
            throw new Error('DHT network already started');
        }

        try {
            // Initialize routing table with bootstrap peers
            for (const peer of this.config.bootstrapPeers) {
                await this.connectToPeer(peer);
            }

            // Start peer discovery
            if (this.config.discovery.bootstrap) {
                this.startDiscovery();
            }

            this.connected = true;
            this.emit('started');
        } catch (error) {
            this.emit('error', error);
            throw error;
        }
    }

    /**
     * Stop the DHT network
     */
    public async stop(): Promise<void> {
        if (!this.connected) {
            return;
        }

        try {
            // Disconnect from all peers
            const peers = await this.routingTable.getAllPeers();
            await Promise.all(peers.map(peer => this.disconnectFromPeer(peer.id)));

            this.connected = false;
            this.emit('stopped');
        } catch (error) {
            this.emit('error', error);
            throw error;
        }
    }

    /**
     * Store a value in the DHT
     */
    public async put(key: string, value: any): Promise<void> {
        if (!this.connected) {
            throw new Error('DHT network not started');
        }

        const message = this.protocol.createMessage('STORE', this.nodeId, {
            key,
            value
        });

        // Find closest peers to the key
        const peers = await this.findClosestPeers(key);
        
        // Store value on closest peers
        await Promise.all(
            peers.map(peer => this.sendMessage(message, peer))
        );
    }

    /**
     * Retrieve a value from the DHT
     */
    public async get(key: string): Promise<any> {
        if (!this.connected) {
            throw new Error('DHT network not started');
        }

        const message = this.protocol.createMessage('FIND_VALUE', this.nodeId, {
            key
        });

        // Find closest peers to the key
        const peers = await this.findClosestPeers(key);
        
        // Query peers for the value
        for (const peer of peers) {
            try {
                const response = await this.sendMessage(message, peer);
                if (response.payload.value) {
                    return response.payload.value;
                }
            } catch (error) {
                this.emit('error', error);
                continue;
            }
        }

        throw new Error(`Value not found for key: ${key}`);
    }

    /**
     * Delete a value from the DHT
     */
    public async delete(key: string): Promise<void> {
        if (!this.connected) {
            throw new Error('DHT network not started');
        }

        const message = this.protocol.createMessage('STORE', this.nodeId, {
            key,
            value: null  // null value indicates deletion
        });

        // Find peers that have this key
        const peers = await this.findClosestPeers(key);
        
        // Notify peers about deletion
        await Promise.all(
            peers.map(peer => this.sendMessage(message, peer))
        );

        // Update stats
        this.stats.dht.totalQueries++;
        this.emit('deleted', { key });
    }

    /**
     * Find the closest peers to a given key
     */
    private async findClosestPeers(key: string): Promise<PeerInfo[]> {
        const message = this.protocol.createMessage('FIND_NODE', this.nodeId, {
            key
        });

        const closestPeers = await this.routingTable.getClosestPeers(key);
        const results = new Set<PeerInfo>();

        for (const peer of closestPeers) {
            try {
                const response = await this.sendMessage(message, peer);
                if (response.payload.data?.peers) {
                    response.payload.data.peers.forEach((p: PeerInfo) => results.add(p));
                }
            } catch (error) {
                this.emit('error', error);
                continue;
            }
        }

        return this.protocol.sortByDistance(Array.from(results), key)
            .slice(0, this.config.dht?.kBucketSize || 20);
    }

    /**
     * Connect to a peer
     */
    async connect(endpoint: string): Promise<void> {
        try {
            // Implement connection logic
            await this.connectToPeer(endpoint);
            this.emit('connected', endpoint);
        } catch (error) {
            this.emit('error', error);
            throw error;
        }
    }

    public async connectToPeer(endpoint: string): Promise<void> {
        // Implementation
    }

    /**
     * Disconnect from a peer
     */
    private async disconnectFromPeer(peerId: string): Promise<void> {
        await this.routingTable.removePeer(peerId);
        this.emit('peer:disconnect', peerId);
    }

    /**
     * Send a message to a peer
     */
    private async sendMessage(message: DHTMessage, peer: PeerInfo): Promise<DHTMessage> {
        if (process.env.NODE_ENV === 'test' && (global as any).__mockPeerNetwork) {
            return (global as any).__mockPeerNetwork.sendMessage(message);
        }

        return new Promise((resolve) => {
            setTimeout(() => {
                resolve({
                    type: 'response',  // Use NetworkMessage type
                    dhtType: 'PING',   // Use DHT-specific type
                    protocol: 'dht',
                    version: '1.0.0',
                    payload: {
                        id: message.payload.id,
                        timestamp: Date.now(),
                        sender: peer.id,
                        receiver: this.nodeId,
                        data: null,
                        value: null
                    }
                });
            }, 100);
        });
    }

    /**
     * Start peer discovery process
     */
    private startDiscovery(): void {
        const interval = this.config.discovery.interval || 60000;
        
        setInterval(async () => {
            try {
                const peers = await this.routingTable.getAllPeers();
                for (const peer of peers) {
                    const message = this.protocol.createMessage('PING', this.nodeId, {
                        receiver: peer.id
                    });
                    
                    try {
                        await this.sendMessage(message, peer);
                        peer.metadata.lastSeen = Date.now();
                    } catch (error) {
                        await this.disconnectFromPeer(peer.id);
                    }
                }
            } catch (error) {
                this.emit('error', error);
            }
        }, interval);
    }

    /**
     * Initialize network statistics
     */
    private initializeStats(): NetworkStats {
        return {
            peers: {
                total: 0,
                connected: 0,
                disconnected: 0,
                byType: {
                    global: 0,
                    regional: 0,
                    local: 0
                }
            },
            protocols: {
                supported: ['dht/1.0.0'],
                active: {}
            },
            bandwidth: {
                in: 0,
                out: 0,
                rate: 0
            },
            dht: {
                tableSize: 0,
                totalQueries: 0,
                successfulQueries: 0
            },
            uptime: 0,
            lastUpdate: Date.now()
        };
    }

    /**
     * Get network statistics
     */
    public getStats(): NetworkStats {
        this.stats.lastUpdate = Date.now();
        this.stats.uptime = Date.now() - this.stats.lastUpdate;
        return this.stats;
    }
}