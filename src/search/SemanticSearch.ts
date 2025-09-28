import { Node, Edge } from '../core/graph-engine/types/NodeTypes';

export interface SemanticSearchIndex {
  id: string;
  type: 'node' | 'edge' | 'document' | 'conversation';
  content: string;
  metadata: Record<string, any>;
  embedding?: number[];
  vector?: Float32Array;
  lastUpdated: Date;
}

export interface SearchQuery {
  text: string;
  type?: 'semantic' | 'keyword' | 'hybrid';
  filters?: SearchFilters;
  options?: SearchOptions;
}

export interface SearchFilters {
  nodeTypes?: string[];
  edgeTypes?: string[];
  dateRange?: {
    start: Date;
    end: Date;
  };
  tags?: string[];
  categories?: string[];
  complexity?: {
    min?: number;
    max?: number;
  };
  similarity?: {
    threshold: number;
    referenceId?: string;
  };
}

export interface SearchOptions {
  limit?: number;
  offset?: number;
  includeSnippets?: boolean;
  highlightMatches?: boolean;
  sortBy?: 'relevance' | 'date' | 'popularity' | 'similarity';
  sortOrder?: 'asc' | 'desc';
  fuzzyMatch?: boolean;
  expandQuery?: boolean;
  boostFields?: Record<string, number>;
}

export interface SearchResult {
  id: string;
  type: string;
  title: string;
  content: string;
  snippet?: string;
  score: number;
  similarity?: number;
  metadata: Record<string, any>;
  highlights?: Highlight[];
  relatedResults?: SearchResult[];
}

export interface Highlight {
  field: string;
  text: string;
  start: number;
  end: number;
}

export interface SearchResponse {
  query: SearchQuery;
  results: SearchResult[];
  total: number;
  took: number; // Time in milliseconds
  facets?: SearchFacets;
  suggestions?: string[];
  corrections?: string[];
}

export interface SearchFacets {
  nodeTypes: FacetBucket[];
  edgeTypes: FacetBucket[];
  categories: FacetBucket[];
  tags: FacetBucket[];
  dateRanges: FacetBucket[];
}

export interface FacetBucket {
  value: string;
  count: number;
  selected?: boolean;
}

export interface EmbeddingProvider {
  name: string;
  generateEmbedding(text: string): Promise<number[]>;
  generateEmbeddings(texts: string[]): Promise<number[][]>;
  dimensions: number;
}

export interface VectorStore {
  add(id: string, vector: number[], metadata?: Record<string, any>): Promise<void>;
  search(query: number[], k: number, filter?: Record<string, any>): Promise<VectorSearchResult[]>;
  update(id: string, vector: number[], metadata?: Record<string, any>): Promise<void>;
  delete(id: string): Promise<void>;
  clear(): Promise<void>;
  size(): Promise<number>;
}

export interface VectorSearchResult {
  id: string;
  similarity: number;
  metadata?: Record<string, any>;
}

export interface IndexingOptions {
  batchSize?: number;
  includeMetadata?: boolean;
  extractKeywords?: boolean;
  generateSummary?: boolean;
  updateExisting?: boolean;
}

export class SemanticSearchEngine {
  private searchIndex: Map<string, SemanticSearchIndex> = new Map();
  private invertedIndex: Map<string, Set<string>> = new Map(); // keyword -> document IDs
  private embeddingProvider: EmbeddingProvider;
  private vectorStore: VectorStore;
  private stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by']);

  constructor(embeddingProvider: EmbeddingProvider, vectorStore: VectorStore) {
    this.embeddingProvider = embeddingProvider;
    this.vectorStore = vectorStore;
  }

  /**
   * Index nodes and edges for search
   */
  async indexGraph(
    nodes: Node[],
    edges: Edge[],
    options: IndexingOptions = {}
  ): Promise<void> {
    const { batchSize = 100, includeMetadata = true } = options;

    // Index nodes
    for (let i = 0; i < nodes.length; i += batchSize) {
      const batch = nodes.slice(i, i + batchSize);
      await this.indexNodeBatch(batch, includeMetadata);
    }

    // Index edges
    for (let i = 0; i < edges.length; i += batchSize) {
      const batch = edges.slice(i, i + batchSize);
      await this.indexEdgeBatch(batch, includeMetadata);
    }
  }

  /**
   * Index a single document or content
   */
  async indexDocument(
    id: string,
    content: string,
    type: string = 'document',
    metadata: Record<string, any> = {}
  ): Promise<void> {
    const processedContent = this.preprocessText(content);

    // Generate embedding
    const embedding = await this.embeddingProvider.generateEmbedding(processedContent);

    // Create search index entry
    const indexEntry: SemanticSearchIndex = {
      id,
      type,
      content: processedContent,
      metadata,
      embedding,
      lastUpdated: new Date()
    };

    // Store in search index
    this.searchIndex.set(id, indexEntry);

    // Update inverted index for keyword search
    this.updateInvertedIndex(id, processedContent);

    // Store in vector store
    await this.vectorStore.add(id, embedding, {
      type,
      content: content.substring(0, 500), // Store snippet
      ...metadata
    });
  }

  /**
   * Perform semantic search
   */
  async search(query: SearchQuery): Promise<SearchResponse> {
    const startTime = Date.now();

    let results: SearchResult[] = [];

    switch (query.type) {
      case 'semantic':
        results = await this.performSemanticSearch(query);
        break;
      case 'keyword':
        results = await this.performKeywordSearch(query);
        break;
      case 'hybrid':
      default:
        results = await this.performHybridSearch(query);
        break;
    }

    // Apply filters
    if (query.filters) {
      results = this.applyFilters(results, query.filters);
    }

    // Sort results
    results = this.sortResults(results, query.options?.sortBy || 'relevance', query.options?.sortOrder || 'desc');

    // Apply pagination
    const { limit = 20, offset = 0 } = query.options || {};
    const paginatedResults = results.slice(offset, offset + limit);

    // Generate snippets and highlights
    if (query.options?.includeSnippets) {
      for (const result of paginatedResults) {
        result.snippet = this.generateSnippet(result.content, query.text);
      }
    }

    if (query.options?.highlightMatches) {
      for (const result of paginatedResults) {
        result.highlights = this.generateHighlights(result.content, query.text);
      }
    }

    // Generate facets
    const facets = this.generateFacets(results);

    // Generate suggestions and corrections
    const suggestions = await this.generateQuerySuggestions(query.text);
    const corrections = await this.generateQueryCorrections(query.text);

    const took = Date.now() - startTime;

    return {
      query,
      results: paginatedResults,
      total: results.length,
      took,
      facets,
      suggestions,
      corrections
    };
  }

  /**
   * Find similar items
   */
  async findSimilar(
    referenceId: string,
    limit: number = 10,
    threshold: number = 0.7
  ): Promise<SearchResult[]> {
    const referenceItem = this.searchIndex.get(referenceId);
    if (!referenceItem || !referenceItem.embedding) {
      return [];
    }

    // Perform vector similarity search
    const vectorResults = await this.vectorStore.search(
      referenceItem.embedding,
      limit + 1, // +1 to exclude the reference item itself
      { similarity_threshold: threshold }
    );

    // Convert to search results
    const results: SearchResult[] = [];

    for (const vectorResult of vectorResults) {
      if (vectorResult.id === referenceId) continue; // Skip self

      const indexEntry = this.searchIndex.get(vectorResult.id);
      if (indexEntry) {
        results.push({
          id: vectorResult.id,
          type: indexEntry.type,
          title: this.extractTitle(indexEntry.content),
          content: indexEntry.content,
          score: vectorResult.similarity,
          similarity: vectorResult.similarity,
          metadata: indexEntry.metadata
        });
      }
    }

    return results;
  }

  /**
   * Get search suggestions
   */
  async getSuggestions(partial: string, limit: number = 5): Promise<string[]> {
    const suggestions: string[] = [];

    // Simple prefix matching from indexed content
    const terms = new Set<string>();

    for (const [term] of this.invertedIndex.entries()) {
      if (term.toLowerCase().startsWith(partial.toLowerCase())) {
        terms.add(term);
      }
    }

    // Sort by frequency (number of documents containing the term)
    const sortedTerms = Array.from(terms)
      .map(term => ({
        term,
        frequency: this.invertedIndex.get(term)?.size || 0
      }))
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, limit)
      .map(item => item.term);

    suggestions.push(...sortedTerms);

    return suggestions;
  }

  /**
   * Update search index
   */
  async updateIndex(
    id: string,
    content: string,
    type: string = 'document',
    metadata: Record<string, any> = {}
  ): Promise<void> {
    // Remove from old index
    await this.removeFromIndex(id);

    // Add to new index
    await this.indexDocument(id, content, type, metadata);
  }

  /**
   * Remove from search index
   */
  async removeFromIndex(id: string): Promise<void> {
    // Remove from search index
    const indexEntry = this.searchIndex.get(id);
    if (indexEntry) {
      // Remove from inverted index
      const tokens = this.tokenize(indexEntry.content);
      for (const token of tokens) {
        const docSet = this.invertedIndex.get(token);
        if (docSet) {
          docSet.delete(id);
          if (docSet.size === 0) {
            this.invertedIndex.delete(token);
          }
        }
      }

      this.searchIndex.delete(id);
    }

    // Remove from vector store
    await this.vectorStore.delete(id);
  }

  /**
   * Get index statistics
   */
  async getIndexStats(): Promise<{
    totalDocuments: number;
    totalTerms: number;
    vectorStoreSize: number;
    lastUpdated: Date;
  }> {
    return {
      totalDocuments: this.searchIndex.size,
      totalTerms: this.invertedIndex.size,
      vectorStoreSize: await this.vectorStore.size(),
      lastUpdated: new Date()
    };
  }

  /**
   * Private methods
   */
  private async indexNodeBatch(nodes: Node[], includeMetadata: boolean): Promise<void> {
    const texts: string[] = [];
    const indexEntries: SemanticSearchIndex[] = [];

    for (const node of nodes) {
      const content = this.extractNodeContent(node);
      const processedContent = this.preprocessText(content);

      texts.push(processedContent);

      indexEntries.push({
        id: node.id,
        type: 'node',
        content: processedContent,
        metadata: {
          nodeType: node.type,
          ...(includeMetadata ? node.data : {})
        },
        lastUpdated: new Date()
      });
    }

    // Generate embeddings in batch
    const embeddings = await this.embeddingProvider.generateEmbeddings(texts);

    // Store in indices
    for (let i = 0; i < indexEntries.length; i++) {
      const entry = indexEntries[i];
      const embedding = embeddings[i];

      entry.embedding = embedding;
      this.searchIndex.set(entry.id, entry);
      this.updateInvertedIndex(entry.id, entry.content);

      await this.vectorStore.add(entry.id, embedding, {
        type: 'node',
        nodeType: nodes[i].type,
        content: entry.content.substring(0, 500)
      });
    }
  }

  private async indexEdgeBatch(edges: Edge[], includeMetadata: boolean): Promise<void> {
    const texts: string[] = [];
    const indexEntries: SemanticSearchIndex[] = [];

    for (const edge of edges) {
      const content = this.extractEdgeContent(edge);
      const processedContent = this.preprocessText(content);

      texts.push(processedContent);

      indexEntries.push({
        id: edge.id,
        type: 'edge',
        content: processedContent,
        metadata: {
          edgeType: edge.type,
          source: edge.source,
          target: edge.target,
          ...(includeMetadata ? edge.data : {})
        },
        lastUpdated: new Date()
      });
    }

    const embeddings = await this.embeddingProvider.generateEmbeddings(texts);

    for (let i = 0; i < indexEntries.length; i++) {
      const entry = indexEntries[i];
      const embedding = embeddings[i];

      entry.embedding = embedding;
      this.searchIndex.set(entry.id, entry);
      this.updateInvertedIndex(entry.id, entry.content);

      await this.vectorStore.add(entry.id, embedding, {
        type: 'edge',
        edgeType: edges[i].type,
        content: entry.content.substring(0, 500)
      });
    }
  }

  private extractNodeContent(node: Node): string {
    const parts: string[] = [];

    // Add node type
    parts.push(node.type);

    // Add node data content
    if (node.data) {
      if (typeof node.data === 'string') {
        parts.push(node.data);
      } else if (typeof node.data === 'object') {
        // Extract text content from data object
        const textContent = this.extractTextFromObject(node.data);
        parts.push(textContent);
      }
    }

    return parts.join(' ');
  }

  private extractEdgeContent(edge: Edge): string {
    const parts: string[] = [];

    parts.push(edge.type);
    parts.push(`from ${edge.source} to ${edge.target}`);

    if (edge.data) {
      const textContent = this.extractTextFromObject(edge.data);
      parts.push(textContent);
    }

    return parts.join(' ');
  }

  private extractTextFromObject(obj: any): string {
    const textParts: string[] = [];

    const extractText = (value: any, key?: string): void => {
      if (typeof value === 'string') {
        textParts.push(value);
      } else if (typeof value === 'number') {
        textParts.push(value.toString());
      } else if (Array.isArray(value)) {
        value.forEach(item => extractText(item));
      } else if (value && typeof value === 'object') {
        Object.entries(value).forEach(([k, v]) => extractText(v, k));
      }
    };

    extractText(obj);
    return textParts.join(' ');
  }

  private preprocessText(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ') // Remove punctuation
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }

  private tokenize(text: string): string[] {
    return text
      .split(/\s+/)
      .filter(token => token.length > 2 && !this.stopWords.has(token));
  }

  private updateInvertedIndex(docId: string, content: string): void {
    const tokens = this.tokenize(content);

    for (const token of tokens) {
      if (!this.invertedIndex.has(token)) {
        this.invertedIndex.set(token, new Set());
      }
      this.invertedIndex.get(token)!.add(docId);
    }
  }

  private async performSemanticSearch(query: SearchQuery): Promise<SearchResult[]> {
    // Generate embedding for query
    const queryEmbedding = await this.embeddingProvider.generateEmbedding(
      this.preprocessText(query.text)
    );

    // Search vector store
    const vectorResults = await this.vectorStore.search(
      queryEmbedding,
      query.options?.limit || 50
    );

    // Convert to search results
    const results: SearchResult[] = [];

    for (const vectorResult of vectorResults) {
      const indexEntry = this.searchIndex.get(vectorResult.id);
      if (indexEntry) {
        results.push({
          id: vectorResult.id,
          type: indexEntry.type,
          title: this.extractTitle(indexEntry.content),
          content: indexEntry.content,
          score: vectorResult.similarity,
          similarity: vectorResult.similarity,
          metadata: indexEntry.metadata
        });
      }
    }

    return results;
  }

  private async performKeywordSearch(query: SearchQuery): Promise<SearchResult[]> {
    const queryTokens = this.tokenize(query.text);
    const docScores = new Map<string, number>();

    // Calculate TF-IDF scores
    for (const token of queryTokens) {
      const docSet = this.invertedIndex.get(token);
      if (docSet) {
        const idf = Math.log(this.searchIndex.size / docSet.size);

        for (const docId of docSet) {
          const indexEntry = this.searchIndex.get(docId);
          if (indexEntry) {
            const tf = this.calculateTermFrequency(token, indexEntry.content);
            const score = tf * idf;

            docScores.set(docId, (docScores.get(docId) || 0) + score);
          }
        }
      }
    }

    // Convert to search results
    const results: SearchResult[] = [];

    for (const [docId, score] of docScores.entries()) {
      const indexEntry = this.searchIndex.get(docId);
      if (indexEntry) {
        results.push({
          id: docId,
          type: indexEntry.type,
          title: this.extractTitle(indexEntry.content),
          content: indexEntry.content,
          score,
          metadata: indexEntry.metadata
        });
      }
    }

    return results.sort((a, b) => b.score - a.score);
  }

  private async performHybridSearch(query: SearchQuery): Promise<SearchResult[]> {
    // Perform both semantic and keyword search
    const [semanticResults, keywordResults] = await Promise.all([
      this.performSemanticSearch({ ...query, type: 'semantic' }),
      this.performKeywordSearch({ ...query, type: 'keyword' })
    ]);

    // Combine and rerank results
    const combinedResults = new Map<string, SearchResult>();

    // Add semantic results with weight
    for (const result of semanticResults) {
      combinedResults.set(result.id, {
        ...result,
        score: result.score * 0.7 // Weight semantic results
      });
    }

    // Add keyword results with weight, combining scores if already present
    for (const result of keywordResults) {
      const existing = combinedResults.get(result.id);
      if (existing) {
        existing.score += result.score * 0.3; // Weight keyword results
      } else {
        combinedResults.set(result.id, {
          ...result,
          score: result.score * 0.3
        });
      }
    }

    return Array.from(combinedResults.values())
      .sort((a, b) => b.score - a.score);
  }

  private calculateTermFrequency(term: string, content: string): number {
    const tokens = this.tokenize(content);
    const termCount = tokens.filter(token => token === term).length;
    return termCount / tokens.length;
  }

  private applyFilters(results: SearchResult[], filters: SearchFilters): SearchResult[] {
    let filtered = results;

    if (filters.nodeTypes) {
      filtered = filtered.filter(r =>
        r.type === 'node' && filters.nodeTypes!.includes(r.metadata.nodeType)
      );
    }

    if (filters.edgeTypes) {
      filtered = filtered.filter(r =>
        r.type === 'edge' && filters.edgeTypes!.includes(r.metadata.edgeType)
      );
    }

    if (filters.dateRange) {
      filtered = filtered.filter(r => {
        const date = new Date(r.metadata.lastUpdated || 0);
        return date >= filters.dateRange!.start && date <= filters.dateRange!.end;
      });
    }

    if (filters.tags) {
      filtered = filtered.filter(r =>
        filters.tags!.some(tag => r.metadata.tags?.includes(tag))
      );
    }

    if (filters.similarity) {
      filtered = filtered.filter(r =>
        (r.similarity || r.score) >= filters.similarity!.threshold
      );
    }

    return filtered;
  }

  private sortResults(
    results: SearchResult[],
    sortBy: string,
    sortOrder: string
  ): SearchResult[] {
    const multiplier = sortOrder === 'desc' ? -1 : 1;

    return results.sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'relevance':
          comparison = a.score - b.score;
          break;
        case 'date':
          const dateA = new Date(a.metadata.lastUpdated || 0);
          const dateB = new Date(b.metadata.lastUpdated || 0);
          comparison = dateA.getTime() - dateB.getTime();
          break;
        case 'similarity':
          comparison = (a.similarity || 0) - (b.similarity || 0);
          break;
        default:
          comparison = a.score - b.score;
      }

      return comparison * multiplier;
    });
  }

  private generateSnippet(content: string, query: string, maxLength: number = 200): string {
    const queryTokens = this.tokenize(query);
    const sentences = content.split(/[.!?]+/);

    // Find sentence with most query terms
    let bestSentence = sentences[0] || '';
    let maxMatches = 0;

    for (const sentence of sentences) {
      const sentenceTokens = this.tokenize(sentence);
      const matches = queryTokens.filter(token =>
        sentenceTokens.includes(token)
      ).length;

      if (matches > maxMatches) {
        maxMatches = matches;
        bestSentence = sentence;
      }
    }

    return bestSentence.length > maxLength
      ? bestSentence.substring(0, maxLength) + '...'
      : bestSentence;
  }

  private generateHighlights(content: string, query: string): Highlight[] {
    const highlights: Highlight[] = [];
    const queryTokens = this.tokenize(query);

    for (const token of queryTokens) {
      const regex = new RegExp(`\\b${token}\\b`, 'gi');
      let match;

      while ((match = regex.exec(content)) !== null) {
        highlights.push({
          field: 'content',
          text: match[0],
          start: match.index,
          end: match.index + match[0].length
        });
      }
    }

    return highlights;
  }

  private generateFacets(results: SearchResult[]): SearchFacets {
    const nodeTypes = new Map<string, number>();
    const edgeTypes = new Map<string, number>();
    const categories = new Map<string, number>();
    const tags = new Map<string, number>();

    for (const result of results) {
      // Node types
      if (result.type === 'node' && result.metadata.nodeType) {
        nodeTypes.set(
          result.metadata.nodeType,
          (nodeTypes.get(result.metadata.nodeType) || 0) + 1
        );
      }

      // Edge types
      if (result.type === 'edge' && result.metadata.edgeType) {
        edgeTypes.set(
          result.metadata.edgeType,
          (edgeTypes.get(result.metadata.edgeType) || 0) + 1
        );
      }

      // Categories
      if (result.metadata.category) {
        categories.set(
          result.metadata.category,
          (categories.get(result.metadata.category) || 0) + 1
        );
      }

      // Tags
      if (result.metadata.tags) {
        for (const tag of result.metadata.tags) {
          tags.set(tag, (tags.get(tag) || 0) + 1);
        }
      }
    }

    const createFacetBuckets = (map: Map<string, number>): FacetBucket[] =>
      Array.from(map.entries())
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => b.count - a.count);

    return {
      nodeTypes: createFacetBuckets(nodeTypes),
      edgeTypes: createFacetBuckets(edgeTypes),
      categories: createFacetBuckets(categories),
      tags: createFacetBuckets(tags),
      dateRanges: [] // Could be implemented based on requirements
    };
  }

  private async generateQuerySuggestions(query: string): Promise<string[]> {
    // Simple query expansion based on indexed terms
    const suggestions: string[] = [];
    const queryTokens = this.tokenize(query);

    // Find related terms
    for (const token of queryTokens) {
      for (const [term] of this.invertedIndex.entries()) {
        if (term.includes(token) && term !== token) {
          suggestions.push(term);
        }
      }
    }

    return suggestions.slice(0, 5);
  }

  private async generateQueryCorrections(query: string): Promise<string[]> {
    // Simple spell correction could be implemented here
    // For now, return empty array
    return [];
  }

  private extractTitle(content: string): string {
    // Extract first meaningful phrase as title
    const sentences = content.split(/[.!?]+/);
    const firstSentence = sentences[0] || content;

    return firstSentence.length > 50
      ? firstSentence.substring(0, 50) + '...'
      : firstSentence;
  }
}

/**
 * Simple in-memory vector store implementation
 */
export class InMemoryVectorStore implements VectorStore {
  private vectors = new Map<string, { vector: number[]; metadata?: Record<string, any> }>();

  async add(id: string, vector: number[], metadata?: Record<string, any>): Promise<void> {
    this.vectors.set(id, { vector, metadata });
  }

  async search(query: number[], k: number, filter?: Record<string, any>): Promise<VectorSearchResult[]> {
    const results: VectorSearchResult[] = [];

    for (const [id, data] of this.vectors.entries()) {
      const similarity = this.cosineSimilarity(query, data.vector);

      if (!filter || this.matchesFilter(data.metadata, filter)) {
        results.push({
          id,
          similarity,
          metadata: data.metadata
        });
      }
    }

    return results
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, k);
  }

  async update(id: string, vector: number[], metadata?: Record<string, any>): Promise<void> {
    if (this.vectors.has(id)) {
      this.vectors.set(id, { vector, metadata });
    }
  }

  async delete(id: string): Promise<void> {
    this.vectors.delete(id);
  }

  async clear(): Promise<void> {
    this.vectors.clear();
  }

  async size(): Promise<number> {
    return this.vectors.size;
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
    return magnitude === 0 ? 0 : dotProduct / magnitude;
  }

  private matchesFilter(metadata: Record<string, any> | undefined, filter: Record<string, any>): boolean {
    if (!metadata) return false;

    for (const [key, value] of Object.entries(filter)) {
      if (metadata[key] !== value) {
        return false;
      }
    }

    return true;
  }
}

/**
 * OpenAI embedding provider
 */
export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  name = 'openai';
  dimensions = 1536; // text-embedding-ada-002 dimensions

  constructor(private apiKey: string) {}

  async generateEmbedding(text: string): Promise<number[]> {
    // Implementation would call OpenAI API
    // For now, return mock embedding
    return new Array(this.dimensions).fill(0).map(() => Math.random());
  }

  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    // Batch generation would be more efficient
    const embeddings: number[][] = [];

    for (const text of texts) {
      embeddings.push(await this.generateEmbedding(text));
    }

    return embeddings;
  }
}

// Factory functions
export function createSemanticSearchEngine(
  embeddingProvider?: EmbeddingProvider,
  vectorStore?: VectorStore
): SemanticSearchEngine {
  const defaultEmbeddingProvider = embeddingProvider || new OpenAIEmbeddingProvider('mock-api-key');
  const defaultVectorStore = vectorStore || new InMemoryVectorStore();

  return new SemanticSearchEngine(defaultEmbeddingProvider, defaultVectorStore);
}

export function createInMemoryVectorStore(): InMemoryVectorStore {
  return new InMemoryVectorStore();
}

export function createOpenAIEmbeddingProvider(apiKey: string): OpenAIEmbeddingProvider {
  return new OpenAIEmbeddingProvider(apiKey);
}