# Tenzro C0re Integration Guide

This guide explains how to integrate Tenzro c0re into an existing infrastructure or applications.

## Table of Contents
1. Prerequisites
2. Basic Integration
3. Advanced Integration
4. Use Cases
5. Troubleshooting

## 1. Prerequisites

### System Requirements
- Node.js 18+
- TypeScript 4.5+
- 2GB RAM minimum
- 10GB storage minimum

### Network Requirements
- Open ports: 8080, 8081
- Network bandwidth: 10Mbps minimum
- Access to bootstrap nodes

### Dependencies
```json
{
    "dependencies": {
        "tenzro-core": "^0.1.0",
        "@types/node": "^18.0.0",
        "typescript": "^4.5.0"
    }
}
```

## 2. Basic Integration

### Installing Tenzro C0re
```bash
git clone https://github.com/tenzro/tenzro-core
```

### Basic Setup
```typescript
import { C0reNode } from 'tenzro-core';

const config = {
    networkConfig: {
        dht: {
            kBucketSize: 20,
            numberOfBuckets: 256,
            refreshInterval: 60000
        },
        discovery: {
            enabled: true,
            interval: 30000
        }
    },
    storage: {
        path: '/data/storage',
        maxSize: 1000000000  // 1GB
    }
};

const node = new C0reNode(config);
await node.start();
```

### Content Management
```typescript
// Publishing content
const contentId = await node.publishContent(
    'dataset',
    dataBuffer,
    {
        name: 'Training Dataset',
        version: '1.0.0',
        type: 'dataset',
        description: 'ML training data'
    }
);

// Retrieving content
const { data, metadata } = await node.retrieveContent(contentId);

// Searching content
const results = await node.searchContent('training data', {
    type: 'dataset',
    region: 'us-east'
});
```

## 3. Advanced Integration

### Storage Integration

#### Custom Storage Provider
```typescript
class CustomStorageProvider implements StorageProvider {
    async store(data: Buffer, options?: StorageOptions): Promise<StorageMetadata> {
        // Implementation
    }

    async retrieve(id: string): Promise<Buffer> {
        // Implementation
    }

    // ... other required methods
}

// Register custom provider
storageManager.registerProvider('custom', new CustomStorageProvider());
```

### Network Integration

#### Connecting to Existing Node
```typescript
await node.connect({
    localNode: {
        endpoint: 'localhost',
        port: 8080
    }
});
```

#### Custom Network Configuration
```typescript
const networkConfig = {
    bootstrap: ['node1.tenzro.net', 'node2.tenzro.net'],
    regions: ['us-east', 'eu-west'],
    timeout: 30000
};

await node.configure(networkConfig);
```

### Event Handling
```typescript
// Content events
node.on('content:published', (info) => {
    console.log(`Content published: ${info.contentId}`);
});

// Network events
node.on('peer:connect', (peer) => {
    console.log(`New peer connected: ${peer.id}`);
});

// Storage events
node.on('stored', (info) => {
    console.log(`Content stored: ${info.id}`);
});
```

## 4. Use Cases

### AI Model Distribution
```typescript
// Publishing model
const modelId = await node.publishContent(
    'model',
    modelBuffer,
    {
        name: 'BERT Base Model',
        version: '1.0.0',
        type: 'model',
        framework: 'pytorch',
        architecture: 'transformer'
    }
);

// Creating new version
await node.createVersion(
    modelId,
    '2.0.0',
    newModelBuffer,
    ['Updated weights', 'Improved accuracy']
);
```

### Dataset Management
```typescript
// Publishing dataset with chunks
const datasetId = await node.publishContent(
    'dataset',
    datasetBuffer,
    {
        name: 'Training Dataset',
        version: '1.0.0',
        type: 'dataset',
        format: 'parquet',
        size: datasetBuffer.length
    },
    {
        chunks: {
            size: 1024 * 1024,  // 1MB chunks
            parallel: 4
        }
    }
);
```

### Search Integration
```typescript
// Advanced search
const results = await node.searchContent('bert model', {
    type: 'model',
    filters: {
        tags: ['transformer', 'nlp'],
        size: {
            max: 1000000000  // 1GB
        },
        region: 'us-east',
        minProviders: 2
    },
    sort: {
        field: 'created',
        order: 'desc'
    },
    pagination: {
        offset: 0,
        limit: 10
    }
});
```

## 5. Troubleshooting

### Common Issues

#### Connection Issues
```typescript
try {
    await node.start();
} catch (error) {
    if (error.code === 'CONNECTION_FAILED') {
        // Check network configuration
        console.error('Connection failed:', error.details);
    }
}
```

#### Storage Issues
```typescript
try {
    await node.publishContent(type, data, metadata);
} catch (error) {
    if (error.code === 'STORAGE_FULL') {
        // Handle storage capacity issues
    } else if (error.code === 'CHUNK_ERROR') {
        // Handle chunking issues
    }
}
```

### Debug Mode
```typescript
// Enable debug logging
process.env.DEBUG = 'tenzro:*';

// Specific component debugging
process.env.DEBUG = 'tenzro:network,tenzro:storage';
```

### Health Checks
```typescript
const stats = await node.getStats();
console.log('Network health:', stats.network);
console.log('Storage health:', stats.storage);
console.log('DHT health:', stats.dht);
```

### Performance Optimization

#### Storage Optimization
```typescript
const storageConfig = {
    compression: {
        enabled: true,
        algorithm: 'gzip',
        level: 6
    },
    chunks: {
        size: 1024 * 1024,  // 1MB
        parallel: 4
    },
    cache: {
        enabled: true,
        size: 100  // MB
    }
};
```

#### Network Optimization
```typescript
const networkConfig = {
    maxConnections: 50,
    timeout: 30000,
    retries: 3,
    parallelRequests: 5
};
```

## Best Practices

1. Error Handling
```typescript
process.on('unhandledRejection', (error) => {
    console.error('Unhandled rejection:', error);
    // Handle or log error
});
```

2. Resource Management
```typescript
process.on('SIGTERM', async () => {
    await node.stop();
    process.exit(0);
});
```

3. Monitoring
```typescript
setInterval(async () => {
    const stats = await node.getStats();
    // Monitor system health
    if (stats.storage.used > stats.storage.available * 0.9) {
        // Alert on storage capacity
    }
}, 60000);
```