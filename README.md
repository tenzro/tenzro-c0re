# Tenzro c0re

## Table of Contents
- [Overview](#overview)
- [System Architecture](#system-architecture)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
- [API Reference](#api-reference)
- [Development](#development)
- [Deployment](#deployment)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)

## Overview

Tenzro c0re is a distributed system that provides dataset and model management capabilities for the Tenzro Network. It enables decentralized storage, version control, and discovery of AI/ML assets across the network.

### Key Features
- Distributed Hash Table (DHT) based peer discovery
- Multi-strategy storage system
- Version control for datasets and models
- Advanced content discovery and search
- Regional optimization
- Automatic replication and redundancy

## System Architecture

### Component Structure
```
src/
├── dht/                 # DHT Network Implementation
│   ├── network.ts      # Network layer
│   ├── protocol.ts     # Protocol definitions
│   └── kbucket.ts      # K-bucket routing
├── storage/            # Storage System
│   ├── manager.ts      # Storage management
│   ├── local.ts        # Local storage provider
│   ├── network.ts      # Network storage provider
│   └── p2p.ts          # P2P storage provider
├── registry/           # Registry System
│   ├── client.ts       # Registry client
│   ├── version.ts      # Version control
│   └── validators.ts   # Metadata validation
├── discovery/          # Discovery System
│   └── content.ts      # Content discovery
├── search/             # Search System
│   ├── engine.ts       # Search engine
│   └── index.ts        # Search indexing
└── integration/        # Integration Layer
    ├── core.ts         # Core node implementation
    └── bridge.ts       # Network bridge
```

### Network Architecture
Tenzro c0re operates alongside the Tenzro network with three node types:
- Global Nodes: Network-wide coordination
- Regional Nodes: Regional management
- Local Nodes: Edge and individual computation and storage

## Installation

### Prerequisites
- Node.js 18+
- npm 8+
- Docker (optional)

### Local Installation
```bash
# Clone repository
git clone https://github.com/tenzro/tenzro-core.git
cd tenzro-core

# Install dependencies
npm install

# Build
npm run build
```

### Docker Installation
```bash
# Development
docker compose up tenzro-core

# Production
docker compose up tenzro-core-prod
```

## Configuration

### Core Configuration
```typescript
interface C0reConfig {
    networkConfig: {
        dht: {
            kBucketSize: number;
            numberOfBuckets: number;
            refreshInterval: number;
        };
        discovery: {
            enabled: boolean;
            interval: number;
        };
    };
    storage: {
        path: string;
        maxSize: number;
        chunkSize?: number;
        replicationFactor?: number;
    };
    discovery: {
        enabled: boolean;
        interval: number;
    };
}
```

### Environment Variables
```env
NODE_ENV=development
STORAGE_PATH=/data/storage
NETWORK_BOOTSTRAP=[bootstrap.tenzro.org]
DHT_BUCKET_SIZE=20
REPLICATION_FACTOR=3
DISCOVERY_INTERVAL=30000
```

## Usage

### Basic Usage
```typescript
import { C0reNode } from 'tenzro-core';

// Initialize node
const node = new C0reNode({
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
        maxSize: 1000000000
    }
});

// Start node
await node.start();

// Publish content
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

// Search content
const results = await node.searchContent('training data', {
    type: 'dataset',
    region: 'us-east'
});
```

### Advanced Usage

#### Version Control
```typescript
// Create new version
await node.createVersion(contentId, '2.0.0', newData, [
    'Updated training data',
    'Added validation set'
]);

// Get version history
const history = await node.versionControl.getVersionHistory(contentId);
```

#### Storage Management
```typescript
// Store with specific strategy
await node.storage.store({
    data: buffer,
    strategy: 'hybrid',
    options: {
        encryption: { enabled: true },
        compression: { enabled: true },
        replicas: 3
    }
});
```

#### Search Operations
```typescript
const results = await node.search.search({
    query: 'machine learning',
    filters: {
        type: 'dataset',
        region: 'us-east',
        minProviders: 2
    },
    sort: {
        field: 'created',
        order: 'desc'
    }
});
```

## API Reference

### Core APIs
- `node.start()`: Start the node
- `node.stop()`: Stop the node
- `node.publishContent()`: Publish content
- `node.retrieveContent()`: Retrieve content
- `node.searchContent()`: Search content
- `node.createVersion()`: Create content version

### Storage APIs
- `storage.store()`: Store data
- `storage.retrieve()`: Retrieve data
- `storage.delete()`: Delete data
- `storage.getMetadata()`: Get storage metadata

### Registry APIs
- `registry.register()`: Register content
- `registry.update()`: Update content
- `registry.get()`: Get content
- `registry.find()`: Find content

## Development

### Setup Development Environment
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run tests
npm run test

# Build
npm run build
```

### Code Style
- TypeScript strict mode
- ESLint configuration
- Prettier formatting

### Testing
```bash
# Unit tests
npm run test:unit

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e
```

## Deployment

### Docker Deployment
```bash
# Build images
docker compose build

# Development deployment
docker compose up tenzro-core

# Production deployment
docker compose up tenzro-core-prod
```

### Configuration Files
- `Dockerfile`: Multi-stage build file
- `docker-compose.yml`: Service definitions
- `.dockerignore`: Build exclusions

### Scaling
```bash
# Scale service
docker compose up --scale tenzro-core-prod=3
```

## Testing

### Running Tests
```bash
# All tests
npm test

# Specific tests
npm run test:unit
npm run test:integration
npm run test:e2e
```

### Test Coverage
```bash
npm run test:coverage
```

## Troubleshooting

### Common Issues
1. Network Connection Issues
   - Check bootstrap node connection
   - Verify network configuration
   - Check firewall settings

2. Storage Issues
   - Verify storage path permissions
   - Check available disk space
   - Verify chunk size configuration

3. Performance Issues
   - Check node resources
   - Verify network bandwidth
   - Monitor DHT table size

### Debug Logging
```typescript
// Enable debug logging
process.env.DEBUG = 'tenzro:*';
```