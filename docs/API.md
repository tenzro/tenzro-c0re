# Tenzro C0re API Documentation

## Core Node API

### Initialization and Control
```typescript
class C0reNode {
    constructor(config: C0reConfig)
    async start(): Promise<void>
    async stop(): Promise<void>
    async getStats(): Promise<NetworkStats>
}
```

### Content Management
```typescript
interface ContentManagement {
    async publishContent(
        type: ResourceType,
        data: Buffer,
        metadata: C0reMetadata
    ): Promise<string>

    async retrieveContent(
        contentId: string
    ): Promise<{
        data: Buffer;
        metadata: C0reMetadata;
    }>

    async searchContent(
        query: string,
        options: SearchOptions
    ): Promise<SearchResult[]>

    async createVersion(
        contentId: string,
        version: string,
        data: Buffer,
        changes: string[]
    ): Promise<void>
}
```

## Storage API

### Storage Manager
```typescript
interface StorageManager {
    async store(request: StorageRequest): Promise<StorageMetadata>
    async retrieve(id: string, options?: { preferredProvider?: string }): Promise<Buffer>
    async delete(id: string): Promise<boolean>
    async getMetadata(id: string): Promise<StorageMetadata | null>
    async getStats(): Promise<Record<string, StorageStats>>
    getChunkManager(): ChunkManager
}
```

### Storage Request Options
```typescript
interface StorageRequest {
    data: Buffer;
    strategy?: StorageStrategy;  // 'local-only' | 'network-only' | 'p2p-only' | 'hybrid'
    priority?: number;
    options?: {
        encryption?: {
            enabled: boolean;
            algorithm?: string;
        };
        compression?: {
            enabled: boolean;
            algorithm?: string;
            level?: number;
        };
        chunks?: {
            size: number;
            parallel: number;
        };
        replicas?: number;
    };
}
```

## Discovery API

### Content Discovery
```typescript
interface ContentDiscovery {
    async publishContent(
        data: Buffer,
        metadata: C0reMetadata,
        options?: {
            replicas?: number;
            preferredRegions?: string[];
            encryption?: boolean;
        }
    ): Promise<ContentInfo>

    async findContent(query: SearchQuery): Promise<ContentInfo[]>
    async becomeProvider(contentId: string): Promise<void>
}
```

### Search Engine
```typescript
interface SearchEngine {
    async search(options: SearchOptions): Promise<SearchResult[]>
    async indexContent(content: ContentInfo): Promise<void>
}

interface SearchOptions {
    type?: 'dataset' | 'model';
    query: string;
    filters?: {
        tags?: string[];
        author?: string;
        dateRange?: {
            start: number;
            end: number;
        };
        size?: {
            min?: number;
            max?: number;
        };
        region?: string;
        minProviders?: number;
    };
    sort?: {
        field: string;
        order: 'asc' | 'desc';
    };
    pagination?: {
        offset: number;
        limit: number;
    };
}
```

## Registry API

### Registry Client
```typescript
interface RegistryClient {
    async register(metadata: C0reMetadata): Promise<string>
    async get(id: string): Promise<C0reMetadata | null>
    async update(update: MetadataUpdate): Promise<void>
    async find(criteria: {
        type?: ResourceType;
        tags?: string[];
        author?: string;
        after?: number;
        before?: number;
    }): Promise<C0reMetadata[]>
    async getVersionHistory(id: string): Promise<string[]>
}
```

### Version Control
```typescript
interface VersionControl {
    async createVersion(
        resourceId: string,
        newVersion: string,
        data: Buffer,
        changes: string[],
        metadata?: Partial<VersionMetadata>
    ): Promise<VersionInfo>

    async getVersionHistory(resourceId: string): Promise<VersionInfo[]>
    async compareVersions(
        resourceId: string,
        version1: string,
        version2: string
    ): Promise<VersionDiff>
}
```

## Network API

### DHT Network
```typescript
interface DHTNetwork {
    async start(): Promise<void>
    async stop(): Promise<void>
    async put(key: string, value: any): Promise<void>
    async get(key: string): Promise<any>
    async connect(endpoint: string): Promise<void>
    getRoutingTable(): RoutingTable
}
```

### Network Bridge
```typescript
interface NetworkBridge {
    async connect(options: {
        localNode?: {
            endpoint: string;
            port: number;
        };
        bootstrap?: {
            endpoint: string;
            region: string;
        };
    }): Promise<void>
    
    async disconnect(): Promise<void>
}
```

## Events

The system emits various events that can be listened to:

### Core Events
- 'started': Node has started
- 'stopped': Node has stopped
- 'error': Error occurred
- 'content:published': Content was published
- 'content:retrieved': Content was retrieved

### Network Events
- 'peer:connect': New peer connected
- 'peer:disconnect': Peer disconnected
- 'message:received': Network message received
- 'message:sent': Network message sent

### Storage Events
- 'stored': Content stored
- 'retrieved': Content retrieved
- 'deleted': Content deleted
- 'replicated': Content replicated

### Example Event Usage
```typescript
node.on('content:published', (info) => {
    console.log(`Content published: ${info.contentId}`);
});

node.on('error', (error) => {
    console.error('Error occurred:', error);
});
```

## Error Handling

The system throws typed errors for different scenarios:

```typescript
class StorageError extends Error {
    code: string;
    details?: any;
}

class NetworkError extends Error {
    code: string;
    details?: any;
}

class ValidationError extends Error {
    code: string;
    details?: any;
}
```

Common error codes:
- 'STORE_ERROR': Storage operation failed
- 'RETRIEVE_ERROR': Retrieval operation failed
- 'NETWORK_ERROR': Network operation failed
- 'VALIDATION_ERROR': Data validation failed
- 'NOT_FOUND': Resource not found
- 'INVALID_METADATA': Invalid metadata provided

## Rate Limits and Quotas

Default limits that can be configured:
- Maximum chunk size: 1MB
- Maximum content size: 1GB
- Maximum replicas: 5
- Maximum peers per bucket: 20
- Request timeout: 30 seconds

## Best Practices

1. Error Handling
```typescript
try {
    await node.publishContent(type, data, metadata);
} catch (error) {
    if (error instanceof StorageError) {
        // Handle storage error
    } else if (error instanceof NetworkError) {
        // Handle network error
    }
}
```

2. Event Management
```typescript
// Clean up event listeners
const handler = (info) => {
    console.log(info);
};
node.on('content:published', handler);
// Later...
node.off('content:published', handler);
```

3. Resource Cleanup
```typescript
// Proper shutdown
process.on('SIGTERM', async () => {
    await node.stop();
    process.exit(0);
});
```