// src/search/index.ts

import { DHTNetwork } from '../dht/network';
import { ContentInfo } from '../discovery/content';
import { StorageError } from '../types';

export interface IndexEntry {
    key: string;
    value: string;
    score: number;
    timestamp: number;
}

export class SearchIndex {
    private readonly prefixes = {
        text: 'index:text:',
        tag: 'index:tag:',
        metadata: 'index:metadata:',
        region: 'index:region:'
    };

    constructor(private readonly network: DHTNetwork) {}

    async indexContent(content: ContentInfo): Promise<void> {
        try {
            await Promise.all([
                this.indexText(content),
                this.indexTags(content),
                this.indexMetadata(content),
                this.indexRegion(content)
            ]);
        } catch (error) {
            throw new StorageError('Failed to index content', {
                code: 'INDEX_ERROR',
                contentId: content.contentId,
                details: error
            });
        }
    }

    async search(query: string, options: any = {}): Promise<string[]> {
        const textResults = await this.searchText(query);
        const filterResults = await this.applyFilters(textResults, options);
        return this.rankResults(filterResults, query);
    }

    private async indexText(content: ContentInfo): Promise<void> {
        const text = this.extractText(content);
        const terms = this.tokenize(text);
        
        const entries = terms.map(term => ({
            key: `${this.prefixes.text}${term}`,
            value: content.contentId,
            score: this.calculateTermScore(term, content),
            timestamp: Date.now()
        }));

        await Promise.all(entries.map(entry => this.addToIndex(entry)));
    }

    private async indexTags(content: ContentInfo): Promise<void> {
        const entries = content.metadata.tags.map(tag => ({
            key: `${this.prefixes.tag}${tag.toLowerCase()}`,
            value: content.contentId,
            score: 1.0,
            timestamp: Date.now()
        }));

        await Promise.all(entries.map(entry => this.addToIndex(entry)));
    }

    private async indexMetadata(content: ContentInfo): Promise<void> {
        const metadata = content.metadata;
        const entries: IndexEntry[] = [];

        // Index various metadata fields
        Object.entries(metadata).forEach(([field, value]) => {
            if (typeof value === 'string') {
                entries.push({
                    key: `${this.prefixes.metadata}${field}:${value.toLowerCase()}`,
                    value: content.contentId,
                    score: this.getMetadataFieldWeight(field),
                    timestamp: Date.now()
                });
            }
        });

        await Promise.all(entries.map(entry => this.addToIndex(entry)));
    }

    private async indexRegion(content: ContentInfo): Promise<void> {
        const entries = content.providers.map(provider => ({
            key: `${this.prefixes.region}${provider.region}`,
            value: content.contentId,
            score: provider.availability,
            timestamp: Date.now()
        }));

        await Promise.all(entries.map(entry => this.addToIndex(entry)));
    }

    private async addToIndex(entry: IndexEntry): Promise<void> {
        try {
            const existing = await this.network.get(entry.key);
            let entries: IndexEntry[] = existing ? JSON.parse(existing) : [];

            // Update or add new entry
            const existingIndex = entries.findIndex(e => e.value === entry.value);
            if (existingIndex !== -1) {
                entries[existingIndex] = entry;
            } else {
                entries.push(entry);
            }

            // Sort by score and timestamp
            entries.sort((a, b) => b.score - a.score || b.timestamp - a.timestamp);

            // Keep only top N entries
            entries = entries.slice(0, 1000);

            await this.network.put(entry.key, JSON.stringify(entries));
        } catch (error) {
            throw new StorageError('Failed to add index entry', {
                code: 'INDEX_UPDATE_ERROR',
                entry: entry.key,
                details: error
            });
        }
    }

    private async searchText(query: string): Promise<Map<string, number>> {
        const terms = this.tokenize(query);
        const results = new Map<string, number>();

        await Promise.all(
            terms.map(async term => {
                const entries = await this.getIndexEntries(`${this.prefixes.text}${term}`);
                entries.forEach(entry => {
                    const currentScore = results.get(entry.value) || 0;
                    results.set(entry.value, currentScore + entry.score);
                });
            })
        );

        return results;
    }

    private async applyFilters(
        results: Map<string, number>,
        filters: any
    ): Promise<Map<string, number>> {
        if (!filters) return results;

        const filtered = new Map<string, number>();

        for (const [contentId, score] of results) {
            if (await this.matchesFilters(contentId, filters)) {
                filtered.set(contentId, score);
            }
        }

        return filtered;
    }

    private async matchesFilters(contentId: string, filters: any): Promise<boolean> {
        // Implement filter matching
        return true;
    }

    private rankResults(results: Map<string, number>, query: string): string[] {
        return Array.from(results.entries())
            .sort((a, b) => b[1] - a[1])
            .map(([contentId]) => contentId);
    }

    private extractText(content: ContentInfo): string {
        const metadata = content.metadata;
        return [
            metadata.name,
            metadata.description,
            ...metadata.tags,
            metadata.author,
            metadata.organization
        ].filter(Boolean).join(' ');
    }

    private tokenize(text: string): string[] {
        return text.toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .split(/\s+/)
            .filter(term => term.length >= 3);
    }

    private calculateTermScore(term: string, content: ContentInfo): number {
        const metadata = content.metadata;
        let score = 0;

        // Score based on field importance
        if (metadata.name.toLowerCase().includes(term)) score += 10;
        if (metadata.description.toLowerCase().includes(term)) score += 5;
        if (metadata.tags.some(tag => tag.toLowerCase().includes(term))) score += 3;
        if (metadata.author.toLowerCase().includes(term)) score += 2;

        return score;
    }

    private getMetadataFieldWeight(field: string): number {
        const weights: Record<string, number> = {
            name: 10,
            description: 5,
            author: 3,
            organization: 2,
            license: 1
        };

        return weights[field] || 1;
    }

    private async getIndexEntries(key: string): Promise<IndexEntry[]> {
        const data = await this.network.get(key);
        return data ? JSON.parse(data) : [];
    }
}