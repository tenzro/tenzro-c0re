// src/registry/validators.ts

import { C0reMetadata } from '../types/metadata';

export class DatasetValidator {
    validate(metadata: C0reMetadata): boolean {
        // Ensure it's a dataset
        if (metadata.type !== 'dataset') {
            return false;
        }

        // Check required dataset fields
        if (!metadata.resourceMetadata?.dataset) {
            return false;
        }

        const dataset = metadata.resourceMetadata.dataset;

        // Validate dataset-specific fields
        if (dataset.recordCount !== undefined && dataset.recordCount < 0) {
            return false;
        }

        // Validate features if present
        if (dataset.features && !Array.isArray(dataset.features)) {
            return false;
        }

        // Validate data types if present
        if (dataset.dataTypes && typeof dataset.dataTypes !== 'object') {
            return false;
        }

        // Validate time range if present
        if (dataset.timeRange) {
            if (!dataset.timeRange.start || !dataset.timeRange.end) {
                return false;
            }
            if (dataset.timeRange.end < dataset.timeRange.start) {
                return false;
            }
        }

        return true;
    }
}

export class ModelValidator {
    validate(metadata: C0reMetadata): boolean {
        // Ensure it's a model
        if (metadata.type !== 'model') {
            return false;
        }

        // Check required model fields
        if (!metadata.resourceMetadata?.model) {
            return false;
        }

        const model = metadata.resourceMetadata.model;

        // Validate required model fields
        if (!model.framework || !model.architecture) {
            return false;
        }

        // Validate parameters
        if (model.parameters !== undefined && model.parameters < 0) {
            return false;
        }

        // Validate input/output shapes
        if (!Array.isArray(model.inputShape) || !Array.isArray(model.outputShape)) {
            return false;
        }

        // Validate accuracy if present
        if (model.accuracy !== undefined && (model.accuracy < 0 || model.accuracy > 1)) {
            return false;
        }

        // Validate training data references if present
        if (model.trainingData && !Array.isArray(model.trainingData)) {
            return false;
        }

        return true;
    }
}

export class CheckpointValidator {
    validate(metadata: C0reMetadata): boolean {
        // Ensure it's a checkpoint
        if (metadata.type !== 'checkpoint') {
            return false;
        }

        // Check required checkpoint fields
        if (!metadata.resourceMetadata?.checkpoint) {
            return false;
        }

        const checkpoint = metadata.resourceMetadata.checkpoint;

        // Validate required fields
        if (!checkpoint.modelId || checkpoint.epoch === undefined) {
            return false;
        }

        // Validate epoch
        if (checkpoint.epoch < 0) {
            return false;
        }

        // Validate metrics if present
        if (checkpoint.metrics && typeof checkpoint.metrics !== 'object') {
            return false;
        }

        return true;
    }
}