// src/types/metadata.ts

export type ResourceType = 'dataset' | 'model' | 'checkpoint';

export interface C0reMetadata {
    // Unique identifier for the resource
    id: string;
    
    // Resource type
    type: ResourceType;
    
    // Basic information
    name: string;
    version: string;
    description: string;
    
    // Categorization
    tags: string[];
    
    // Technical details
    size: number;
    checksum: string;
    format: string;
    compression?: string;
    
    // Temporal information
    createdAt: number;
    updatedAt: number;
    
    // Authorship
    author: string;
    organization?: string;
    
    // Legal
    license: string;
    rightsHolder?: string;
    
    // Additional metadata
    schema?: {
        type: string;
        properties: Record<string, unknown>;
    };
    
    // Resource-specific metadata
    resourceMetadata?: {
        // For datasets
        dataset?: {
            recordCount?: number;
            features?: string[];
            dataTypes?: Record<string, string>;
            timeRange?: {
                start: number;
                end: number;
            };
        };
        
        // For models
        model?: {
            framework: string;
            architecture: string;
            parameters: number;
            inputShape: number[];
            outputShape: number[];
            accuracy?: number;
            trainingData?: string[];  // References to dataset IDs
        };
        
        // For checkpoints
        checkpoint?: {
            modelId: string;
            epoch: number;
            metrics: Record<string, number>;
        };

        storage?: {
            id: string;
            type: string;
            replicas: number;
            encryption: boolean;
            compression: boolean;
        };
    };
}

export interface VersionInfo {
    version: string;
    timestamp: number;
    changes: string[];
    parent?: string;  // Previous version ID
    dependencies?: Array<{
        id: string;
        version: string;
        type: ResourceType;
    }>;
}

export interface MetadataUpdate {
    id: string;
    fields: Partial<C0reMetadata>;
    timestamp: number;
    signature: string;
}

export type MetadataValidationResult = {
    valid: boolean;
    errors?: string[];
};

export interface MetadataValidator {
    validate(metadata: C0reMetadata): MetadataValidationResult;
    validateUpdate(update: MetadataUpdate): MetadataValidationResult;
}