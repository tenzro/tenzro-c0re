// src/dht/kbucket.ts

import { PeerInfo, RoutingTable } from '../types/network';
import { DHTProtocol, createDHTProtocol } from './protocol';

interface Bucket {
    peers: PeerInfo[];
    lastUpdated: number;
}

export class KBucket implements RoutingTable {
    private buckets: Bucket[];
    private protocol: DHTProtocol;
    
    constructor(
        private readonly nodeId: string,
        private readonly kSize: number = 20,
        private readonly numberOfBuckets: number = 256 // 256 bits
    ) {
        this.buckets = Array(256).fill(null).map(() => ({
            peers: [],
            lastUpdated: Date.now()
        }));
        this.protocol = createDHTProtocol();
        this.buckets = Array(this.numberOfBuckets).fill(null).map(() => ({
            peers: [],
            lastUpdated: Date.now()
        }));
    }

    private async addPeerToBucket(bucket: Bucket, peer: PeerInfo): Promise<void> {
        if (bucket.peers.length < this.kSize) {
            bucket.peers.push({
                ...peer,
                metadata: {
                    ...peer.metadata,
                    lastSeen: Date.now()
                }
            });
        } else {
            // Try to remove stale peer first
            const staleIndex = this.findStalePeer(bucket);
            if (staleIndex !== -1) {
                bucket.peers[staleIndex] = {
                    ...peer,
                    metadata: {
                        ...peer.metadata,
                        lastSeen: Date.now()
                    }
                };
            }
            // If no stale peer, peer is not added
        }
    }

    /**
     * Add a peer to the routing table
     */
    public async addPeer(peer: PeerInfo): Promise<void> {
        const bucketIndex = this.getBucketIndex(peer.id);
        const bucket = this.buckets[bucketIndex];

        // Check if peer already exists
        const existingPeerIndex = bucket.peers.findIndex(p => p.id === peer.id);
        if (existingPeerIndex !== -1) {
            // Update existing peer
            bucket.peers[existingPeerIndex] = {
                ...peer,
                metadata: {
                    ...peer.metadata,
                    lastSeen: Date.now()
                }
            };
        } else {
            // Add new peer to bucket
            await this.addPeerToBucket(bucket, peer);
        }

        bucket.lastUpdated = Date.now();
    }

    /**
     * Remove a peer from the routing table
     */
    public async removePeer(peerId: string): Promise<void> {
        const bucketIndex = this.getBucketIndex(peerId);
        const bucket = this.buckets[bucketIndex];

        const peerIndex = bucket.peers.findIndex(p => p.id === peerId);
        if (peerIndex !== -1) {
            bucket.peers.splice(peerIndex, 1);
            bucket.lastUpdated = Date.now();
        }
    }

    /**
     * Get a specific peer from the routing table
     */
    public async getPeer(peerId: string): Promise<PeerInfo | null> {
        const bucketIndex = this.getBucketIndex(peerId);
        const bucket = this.buckets[bucketIndex];

        return bucket.peers.find(p => p.id === peerId) || null;
    }

    /**
     * Get the closest peers to a given key
     */
    public async getClosestPeers(key: string, count: number = this.kSize): Promise<PeerInfo[]> {
        const allPeers = await this.getAllPeers();
        return this.protocol.sortByDistance(allPeers, key).slice(0, count);
    }

    /**
     * Get all peers from the routing table
     */
    async getAllPeers(): Promise<PeerInfo[]> {
        return this.buckets.reduce((peers, bucket) => {
            return peers.concat(bucket.peers);
        }, [] as PeerInfo[]);
    }

    /**
     * Get the current size of the routing table
     */
    public size(): number {
        return this.buckets.reduce((total, bucket) => {
            return total + bucket.peers.length;
        }, 0);
    }

    /**
     * Calculate the bucket index for a given peer ID
     */
    private getBucketIndex(peerId: string): number {
        const distance = this.protocol.distance(this.nodeId, peerId);
        
        // Find the index of the first set bit
        for (let i = 0; i < distance.length; i++) {
            if (distance[i] !== 0) {
                // Find the first set bit in this byte
                for (let j = 0; j < 8; j++) {
                    if ((distance[i] & (1 << (7 - j))) !== 0) {
                        return i * 8 + j;
                    }
                }
            }
        }
        
        return this.numberOfBuckets - 1;
    }

    /**
     * Find a stale peer in a bucket
     */
    private findStalePeer(bucket: Bucket): number {
        const now = Date.now();
        const STALE_THRESHOLD = 1 * 60 * 60 * 1000; // 1 hour

        return bucket.peers.findIndex(peer => {
            return (now - peer.metadata.lastSeen) > STALE_THRESHOLD;
        });
    }

    /**
     * Check if a peer is considered stale
     */
    private isPeerStale(peer: PeerInfo): boolean {
        const now = Date.now();
        const STALE_THRESHOLD = 1 * 60 * 60 * 1000; // 1 hour
        return (now - peer.metadata.lastSeen) > STALE_THRESHOLD;
    }

    /**
     * Get bucket statistics
     */
    public getBucketStats(): { bucketSize: number[]; totalPeers: number } {
        const bucketSize = this.buckets.map(bucket => bucket.peers.length);
        const totalPeers = bucketSize.reduce((sum, size) => sum + size, 0);
        
        return {
            bucketSize,
            totalPeers
        };
    }
}