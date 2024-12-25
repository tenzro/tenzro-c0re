// src/search/engine.ts

import { DHTNetwork } from '../dht/network';
import { C0reMetadata } from '../types/metadata';
import { ContentInfo } from '../discovery/content';

export interface SearchOptions {
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

export interface SearchResult {
    contentInfo: ContentInfo;
    score: number;
    highlights?: {
        field: string;
        matches: string[];
    }[];
}

export class SearchEngine {
    private readonly indexPrefix = 'search:index:';
    private readonly cache: Map<string, Array<SearchResult>> = new Map();
    private readonly cacheTimeout = 5 * 60 * 1000; // 5 minutes

    constructor(private readonly network: DHTNetwork) {}

    async search(options: SearchOptions): Promise<SearchResult[]> {
        // Check cache first
        const cacheKey = this.generateCacheKey(options);
        const cached = this.getFromCache(cacheKey);
        if (cached) {
            return cached;
        }

        // Perform search
        const results = await this.performSearch(options);
        
        // Cache results
        this.cache.set(cacheKey, results);
        setTimeout(() => this.cache.delete(cacheKey), this.cacheTimeout);

        return results;
    }

    async indexContent(content: ContentInfo): Promise<void> {
        const indexes = [
            this.indexMetadata(content),
            this.indexTags(content),
            this.indexText(content),
            this.indexRegion(content)
        ];

        await Promise.all(indexes);
    }

    private async performSearch(options: SearchOptions): Promise<SearchResult[]> {
        // Get initial results based on type
        let results = await this.searchByType(options.type);

        // Apply text search if query provided
        if (options.query) {
            results = await this.applyTextSearch(results, options.query);
        }

        // Apply filters
        if (options.filters) {
            results = this.applyFilters(results, options.filters);
        }

        // Sort results
        if (options.sort) {
            results = this.sortResults(results, options.sort);
        }

        // Apply pagination
        if (options.pagination) {
            results = this.applyPagination(results, options.pagination);
        }

        return results;
    }

    private async searchByType(type?: string): Promise<SearchResult[]> {
        if (!type) {
            return this.getAllContent();
        }

        const key = `${this.indexPrefix}type:${type}`;
        const contentIds = await this.network.get(key);
        if (!contentIds) {
            return [];
        }

        return this.getContentByIds(JSON.parse(contentIds));
    }

    private async applyTextSearch(results: SearchResult[], query: string): Promise<SearchResult[]> {
        // Implement text search with scoring
        const searchTerms = query.toLowerCase().split(' ');
        
        return results.map(result => {
            const score = this.calculateSearchScore(result.contentInfo, searchTerms);
            const highlights = this.generateHighlights(result.contentInfo, searchTerms);
            
            return {
                ...result,
                score,
                highlights
            };
        }).filter(result => result.score > 0)
          .sort((a, b) => b.score - a.score);
    }

    private calculateSearchScore(content: ContentInfo, terms: string[]): number {
        let score = 0;
        const metadata = content.metadata;
        
        // Score different fields with different weights
        const weights = {
            name: 10,
            description: 5,
            tags: 3,
            author: 2
        };

        terms.forEach(term => {
            if (metadata.name.toLowerCase().includes(term)) {
                score += weights.name;
            }
            if (metadata.description.toLowerCase().includes(term)) {
                score += weights.description;
            }
            metadata.tags.forEach(tag => {
                if (tag.toLowerCase().includes(term)) {
                    score += weights.tags;
                }
            });
            if (metadata.author.toLowerCase().includes(term)) {
                score += weights.author;
            }
        });

        return score;
    }

    private generateHighlights(content: ContentInfo, terms: string[]): Array<{ field: string; matches: string[]; }> {
        const highlights: Array<{ field: string; matches: string[]; }> = [];
        const metadata = content.metadata;

        // Define type-safe field access
        const fields: Array<keyof C0reMetadata> = ['name', 'description', 'tags', 'author'];
        fields.forEach(field => {
            const value = metadata[field];
            if (value) {
                const matches = this.findMatches(
                    Array.isArray(value) ? value.join(' ') : String(value),
                    terms
                );
                if (matches.length > 0) {
                    highlights.push({ field, matches });
                }
            }
        });

        return highlights;
    }

    private findMatches(text: string | string[], terms: string[]): string[] {
        if (Array.isArray(text)) {
            text = text.join(' ');
        }
        
        const matches: string[] = [];
        const words = text.toLowerCase().split(/\s+/);
        
        terms.forEach(term => {
            words.forEach((word, index) => {
                if (word.includes(term)) {
                    const context = words.slice(Math.max(0, index - 2), index + 3).join(' ');
                    matches.push(context);
                }
            });
        });

        return matches;
    }

    private applyFilters(results: SearchResult[], filters?: SearchOptions['filters']): SearchResult[] {
        if (!filters) return results;

        return results.filter(result => {
            const content = result.contentInfo;
            
            if (filters.dateRange?.start && filters.dateRange?.end) {
                if (content.created < filters.dateRange.start || 
                    content.created > filters.dateRange.end) {
                    return false;
                }
            }

            // Check size constraints
            if (filters.size) {
                if (filters.size.min && content.stats.totalSize < filters.size.min) {
                    return false;
                }
                if (filters.size.max && content.stats.totalSize > filters.size.max) {
                    return false;
                }
            }

            // Check tags
            if (filters.tags && !filters.tags.every(tag => 
                content.metadata.tags.includes(tag))) {
                return false;
            }

            // Check author
            if (filters.author && content.metadata.author !== filters.author) {
                return false;
            }

            // Check region
            if (filters.region && !content.providers.some(p => 
                p.region === filters.region)) {
                return false;
            }

            // Check minimum providers
            if (filters.minProviders && 
                content.providers.length < filters.minProviders) {
                return false;
            }

            return true;
        });
    }

    private sortResults(results: SearchResult[], sort: SearchOptions['sort']): SearchResult[] {
        if (!sort) return results;

        return [...results].sort((a, b) => {
            const valueA = this.getFieldValue(a.contentInfo, sort.field);
            const valueB = this.getFieldValue(b.contentInfo, sort.field);
            
            if (valueA < valueB) return sort.order === 'asc' ? -1 : 1;
            if (valueA > valueB) return sort.order === 'asc' ? 1 : -1;
            return 0;
        });
    }

    private getFieldValue(content: ContentInfo, field: string): any {
        const fields = field.split('.');
        let value: any = content;
        
        for (const f of fields) {
            value = value[f];
            if (value === undefined) break;
        }
        
        return value;
    }

    private applyPagination(results: SearchResult[], pagination: NonNullable<SearchOptions['pagination']>): SearchResult[] {
        const start = pagination.offset;
        const end = start + pagination.limit;
        return results.slice(start, end);
    }

    private async getAllContent(): Promise<SearchResult[]> {
        // Implement retrieval of all content
        return [];
    }

    private async getContentByIds(ids: string[]): Promise<SearchResult[]> {
        // Implement content retrieval by IDs
        return [];
    }

    private generateCacheKey(options: SearchOptions): string {
        return JSON.stringify(options);
    }

    private getFromCache(key: string): SearchResult[] | null {
        return this.cache.get(key) || null;
    }

    private async indexMetadata(content: ContentInfo): Promise<void> {
        const metadata = content.metadata;
        const promises = Object.entries(metadata).map(([field, value]) => {
            const key = `${this.indexPrefix}${field}:${value}`;
            return this.network.put(key, content.contentId);
        });

        await Promise.all(promises);
    }

    private async indexTags(content: ContentInfo): Promise<void> {
        const promises = content.metadata.tags.map(tag => {
            const key = `${this.indexPrefix}tag:${tag}`;
            return this.network.put(key, content.contentId);
        });

        await Promise.all(promises);
    }

    private async indexText(content: ContentInfo): Promise<void> {
        // Implement text indexing for full-text search
    }

    private async indexRegion(content: ContentInfo): Promise<void> {
        const promises = content.providers.map(provider => {
            const key = `${this.indexPrefix}region:${provider.region}`;
            return this.network.put(key, content.contentId);
        });

        await Promise.all(promises);
    }
}