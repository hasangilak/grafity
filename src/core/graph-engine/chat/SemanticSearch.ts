/**
 * Semantic Search Engine
 *
 * Provides full-text search capabilities for conversation messages with:
 * - TF-IDF relevance scoring
 * - Multi-field filtering (role, date, branch, code links)
 * - Topic extraction
 * - Context aggregation
 */

import { GraphStore } from '../GraphStore';
import { ConversationNode } from '../types/NodeTypes';

export interface SearchQuery {
  text: string;
  filters?: {
    messageRole?: 'user' | 'assistant' | 'system';
    dateRange?: [Date, Date];
    branchIds?: string[];
    hasCodeLinks?: boolean;
    topics?: string[];
  };
  limit?: number;
}

export interface SearchResult {
  message: ConversationNode;
  relevanceScore: number;      // 0-1
  matchedContent: string[];    // Highlighted snippets
  context: {
    conversationPath: string[];
    linkedCode: string[];
    relatedMessages: string[];
  };
}

export interface SearchIndex {
  messageId: string;
  content: string;
  role: string;
  timestamp: Date;
  branchId?: string;
  hasCodeLinks: boolean;
  topics: string[];
  termFrequency: Map<string, number>;
}

/**
 * Simple semantic search engine with TF-IDF scoring
 */
export class SemanticSearch {
  private store: GraphStore;
  private index: Map<string, SearchIndex> = new Map();
  private documentFrequency: Map<string, number> = new Map();
  private totalDocuments: number = 0;
  private stopWords: Set<string>;

  constructor(store: GraphStore) {
    this.store = store;
    this.stopWords = this.getStopWords();
  }

  /**
   * Search for messages matching the query
   */
  search(query: SearchQuery): SearchResult[] {
    const terms = this.tokenize(query.text);
    const results: SearchResult[] = [];

    // Search through index
    for (const [messageId, indexEntry] of this.index) {
      // Apply filters
      if (!this.matchesFilters(indexEntry, query.filters)) {
        continue;
      }

      // Calculate relevance score
      const score = this.calculateRelevance(terms, indexEntry);

      if (score > 0) {
        const message = this.store.getNode(messageId) as ConversationNode;
        if (message) {
          const matchedContent = this.extractMatchedSnippets(
            indexEntry.content,
            terms,
            3
          );

          results.push({
            message,
            relevanceScore: score,
            matchedContent,
            context: this.buildContext(messageId)
          });
        }
      }
    }

    // Sort by relevance
    results.sort((a, b) => b.relevanceScore - a.relevanceScore);

    // Apply limit
    return query.limit ? results.slice(0, query.limit) : results;
  }

  /**
   * Index a message for searching
   */
  indexMessage(message: ConversationNode): void {
    if (!message.content) return;

    const terms = this.tokenize(message.content);
    const termFrequency = this.calculateTermFrequency(terms);

    // Update document frequency
    const uniqueTerms = new Set(terms);
    for (const term of uniqueTerms) {
      this.documentFrequency.set(
        term,
        (this.documentFrequency.get(term) || 0) + 1
      );
    }

    const indexEntry: SearchIndex = {
      messageId: message.id,
      content: message.content,
      role: message.metadata?.role || 'unknown',
      timestamp: message.timestamp || new Date(),
      branchId: message.metadata?.branchId,
      hasCodeLinks: this.hasCodeLinks(message.id),
      topics: this.extractTopics(message.content),
      termFrequency
    };

    this.index.set(message.id, indexEntry);
    this.totalDocuments++;
  }

  /**
   * Reindex all messages
   */
  async reindexAll(): Promise<void> {
    this.index.clear();
    this.documentFrequency.clear();
    this.totalDocuments = 0;

    const nodes = this.store.getAllNodes();
    for (const node of nodes) {
      if (node.type === 'conversation' && (node as any).content) {
        this.indexMessage(node as ConversationNode);
      }
    }
  }

  /**
   * Get topics for a conversation
   */
  getTopics(conversationId: string): string[] {
    const topicCounts = new Map<string, number>();

    for (const indexEntry of this.index.values()) {
      // Check if message belongs to this conversation
      const message = this.store.getNode(indexEntry.messageId) as ConversationNode;
      if (message?.metadata?.conversationId === conversationId) {
        for (const topic of indexEntry.topics) {
          topicCounts.set(topic, (topicCounts.get(topic) || 0) + 1);
        }
      }
    }

    // Sort topics by frequency and return top 10
    return Array.from(topicCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([topic]) => topic);
  }

  /**
   * Get total indexed messages
   */
  getIndexSize(): number {
    return this.index.size;
  }

  /**
   * Clear the search index
   */
  clearIndex(): void {
    this.index.clear();
    this.documentFrequency.clear();
    this.totalDocuments = 0;
  }

  /**
   * Tokenize text into searchable terms
   */
  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(term => term.length > 2 && !this.stopWords.has(term));
  }

  /**
   * Calculate term frequency for a document
   */
  private calculateTermFrequency(terms: string[]): Map<string, number> {
    const tf = new Map<string, number>();

    for (const term of terms) {
      tf.set(term, (tf.get(term) || 0) + 1);
    }

    // Normalize by document length
    const docLength = terms.length;
    for (const [term, freq] of tf) {
      tf.set(term, freq / docLength);
    }

    return tf;
  }

  /**
   * Calculate TF-IDF relevance score
   */
  private calculateRelevance(
    queryTerms: string[],
    doc: SearchIndex
  ): number {
    let score = 0;

    for (const term of queryTerms) {
      const tf = doc.termFrequency.get(term) || 0;
      const df = this.documentFrequency.get(term) || 1;
      const idf = Math.log(this.totalDocuments / df);

      score += tf * idf;
    }

    // Normalize score to 0-1 range
    return Math.min(score / queryTerms.length, 1);
  }

  /**
   * Check if index entry matches filters
   */
  private matchesFilters(
    indexEntry: SearchIndex,
    filters?: SearchQuery['filters']
  ): boolean {
    if (!filters) return true;

    // Role filter
    if (filters.messageRole && indexEntry.role !== filters.messageRole) {
      return false;
    }

    // Date range filter
    if (filters.dateRange) {
      const [startDate, endDate] = filters.dateRange;
      const messageDate = indexEntry.timestamp;

      if (messageDate < startDate || messageDate > endDate) {
        return false;
      }
    }

    // Branch filter
    if (filters.branchIds && filters.branchIds.length > 0) {
      if (!indexEntry.branchId || !filters.branchIds.includes(indexEntry.branchId)) {
        return false;
      }
    }

    // Code links filter
    if (filters.hasCodeLinks !== undefined) {
      if (indexEntry.hasCodeLinks !== filters.hasCodeLinks) {
        return false;
      }
    }

    // Topics filter
    if (filters.topics && filters.topics.length > 0) {
      const hasMatchingTopic = filters.topics.some(topic =>
        indexEntry.topics.includes(topic)
      );
      if (!hasMatchingTopic) {
        return false;
      }
    }

    return true;
  }

  /**
   * Extract snippets containing matched terms
   */
  private extractMatchedSnippets(
    content: string,
    terms: string[],
    maxSnippets: number
  ): string[] {
    const snippets: string[] = [];
    const sentences = content.split(/[.!?]+/).filter(s => s.trim());

    for (const sentence of sentences) {
      const lowerSentence = sentence.toLowerCase();
      const hasMatch = terms.some(term => lowerSentence.includes(term));

      if (hasMatch) {
        const trimmed = sentence.trim();
        if (trimmed) {
          snippets.push(trimmed);

          if (snippets.length >= maxSnippets) {
            break;
          }
        }
      }
    }

    return snippets;
  }

  /**
   * Build context for a search result
   */
  private buildContext(messageId: string): {
    conversationPath: string[];
    linkedCode: string[];
    relatedMessages: string[];
  } {
    const conversationPath = this.getConversationPath(messageId);
    const linkedCode = this.getLinkedCodeFiles(messageId);
    const relatedMessages = this.getRelatedMessages(messageId);

    return { conversationPath, linkedCode, relatedMessages };
  }

  /**
   * Get conversation path for a message
   */
  private getConversationPath(messageId: string): string[] {
    const path: string[] = [];
    let currentId = messageId;

    // Traverse up to root
    for (let i = 0; i < 50; i++) {  // Max depth
      path.unshift(currentId);

      const edges = this.store.getAllEdges();
      const parentEdge = edges.find((e: any) =>
        e.target === currentId && (e.type === 'follows' || e.type === 'relates_to')
      );

      if (!parentEdge) break;
      currentId = (parentEdge as any).source;
    }

    return path;
  }

  /**
   * Get linked code files for a message
   */
  private getLinkedCodeFiles(messageId: string): string[] {
    const edges = this.store.getAllEdges();
    const codeEdges = edges.filter((e: any) =>
      e.source === messageId && e.type === 'references'
    );

    return codeEdges.map((edge: any) => {
      const node = this.store.getNode(edge.target);
      return (node as any)?.filePath || edge.target;
    });
  }

  /**
   * Get related messages
   */
  private getRelatedMessages(messageId: string): string[] {
    const edges = this.store.getAllEdges();
    const relatedEdges = edges.filter((e: any) =>
      (e.source === messageId || e.target === messageId) &&
      (e.type === 'discusses' || e.type === 'responds')
    );

    return relatedEdges.map((edge: any) =>
      edge.source === messageId ? edge.target : edge.source
    );
  }

  /**
   * Check if message has code links
   */
  private hasCodeLinks(messageId: string): boolean {
    const edges = this.store.getAllEdges();
    return edges.some((e: any) =>
      e.source === messageId && e.type === 'references'
    );
  }

  /**
   * Extract topics from message content
   */
  private extractTopics(content: string): string[] {
    const terms = this.tokenize(content);

    // Simple topic extraction: most frequent non-stop words
    const termCounts = new Map<string, number>();

    for (const term of terms) {
      if (term.length > 4) {  // Only longer terms
        termCounts.set(term, (termCounts.get(term) || 0) + 1);
      }
    }

    return Array.from(termCounts.entries())
      .filter(([_, count]) => count > 1)  // Appears more than once
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([term]) => term);
  }

  /**
   * Get common English stop words
   */
  private getStopWords(): Set<string> {
    return new Set([
      'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i',
      'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at',
      'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she',
      'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their',
      'what', 'so', 'up', 'out', 'if', 'about', 'who', 'get', 'which', 'go',
      'me', 'when', 'make', 'can', 'like', 'time', 'no', 'just', 'him', 'know',
      'take', 'people', 'into', 'year', 'your', 'good', 'some', 'could', 'them',
      'see', 'other', 'than', 'then', 'now', 'look', 'only', 'come', 'its', 'over',
      'think', 'also', 'back', 'after', 'use', 'two', 'how', 'our', 'work', 'first',
      'well', 'way', 'even', 'new', 'want', 'because', 'any', 'these', 'give', 'day',
      'most', 'us'
    ]);
  }
}
