import { createHash } from "crypto";
import { NetworkMessage, PeerInfo } from "../types/network";

export type DHTMessageType = 
    | 'FIND_NODE'
    | 'FIND_VALUE'
    | 'STORE'
    | 'DELETE'
    | 'PING';

export interface DHTPayload {
    id: string;
    timestamp: number;
    sender: string;
    receiver?: string;
    key?: string;
    value?: any;
    data?: any;
}

export interface DHTMessage {
    type: 'query' | 'response' | 'update' | 'announce';  // NetworkMessage type
    dhtType: DHTMessageType;                             // DHT-specific type
    protocol: string;
    version: string;
    payload: DHTPayload;
}

export class DHTProtocol {
  private readonly HASH_ALGORITHM = "sha256";
  private readonly KEY_SIZE = 32; // 256 bits

  /**
   * Creates a DHT message with proper type mapping
   */
  public createMessage(
    dhtType: DHTMessageType,
    sender: string,
    options: {
        key?: string;
        value?: any;
        receiver?: string;
    } = {}
  ): DHTMessage {
        return {
            type: this.mapDHTTypeToMessageType(dhtType),
            dhtType,
            protocol: 'dht',
            version: '1.0.0',
            payload: {
                id: this.generateKey(Date.now().toString()),
                timestamp: Date.now(),
                sender,
                receiver: options.receiver,
                key: options.key,
                value: options.value,
                data: options.value
            }
        };
    }

  /**
   * Maps DHT message types to network message types
   */
  private mapDHTTypeToMessageType(dhtType: DHTMessageType): DHTMessage['type'] {
        switch (dhtType) {
            case 'FIND_NODE':
            case 'FIND_VALUE':
                return 'query';
            case 'STORE':
            case 'DELETE':
                return 'update';
            case 'PING':
                return 'query';
            default:
                return 'query';
        }
    }

  // Rest of the DHTProtocol implementation...
  // (Include all the existing methods from previous implementation)

  /**
   * Generates a DHT key for a given value
   */
  public generateKey(value: string | Buffer): string {
    const hash = createHash(this.HASH_ALGORITHM);
    hash.update(Buffer.isBuffer(value) ? value : Buffer.from(value));
    return hash.digest("hex");
  }

  /**
   * Validates a DHT message
   */
  public validateMessage(message: DHTMessage): boolean {
    if (
      !message.dhtType ||
      !message.payload.sender ||
      !message.protocol ||
      !message.version
    ) {
      return false;
    }

    // Validate key format if present
    if (message.payload.key && !/^[0-9a-f]{64}$/.test(message.payload.key)) {
      return false;
    }

    // Validate timestamp
    const now = Date.now();
    const messageTime = message.payload.timestamp;
    const MAX_TIME_DIFF = 5 * 60 * 1000; // 5 minutes

    if (Math.abs(now - messageTime) > MAX_TIME_DIFF) {
      return false;
    }

    return true;
  }

  /**
   * Calculates XOR distance between two keys
   */
  public distance(keyA: string, keyB: string): Buffer {
    const bufferA = Buffer.from(keyA, "hex");
    const bufferB = Buffer.from(keyB, "hex");

    const distance = Buffer.alloc(this.KEY_SIZE);
    for (let i = 0; i < this.KEY_SIZE; i++) {
      distance[i] = bufferA[i] ^ bufferB[i];
    }

    return distance;
  }

  /**
   * Compares two keys for equality
   */
  public keysEqual(keyA: string, keyB: string): boolean {
    return keyA === keyB;
  }

  /**
   * Determines if keyA is closer to target than keyB
   */
  public isCloser(keyA: string, keyB: string, target: string): boolean {
    const distanceA = this.distance(keyA, target);
    const distanceB = this.distance(keyB, target);
    return distanceA.compare(distanceB) < 0;
  }

  /**
   * Sorts peers by their distance to a target key
   */
  public sortByDistance(peers: PeerInfo[], targetKey: string): PeerInfo[] {
    return [...peers].sort((a, b) => {
      const distanceA = this.distance(a.id, targetKey);
      const distanceB = this.distance(b.id, targetKey);
      return distanceA.compare(distanceB);
    });
  }
}

export const createDHTProtocol = (): DHTProtocol => {
  return new DHTProtocol();
};
