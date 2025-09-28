/**
 * Advanced search functionality for conversations and messages
 */

import { ChatConversationNode, ConversationSummary } from '../models/ConversationNode';
import { MessageNode } from '../models/MessageNode';
import { ConversationTopic } from '../models/ChatGraphStructure';
import { ConversationStorage } from '../persistence/ConversationStorage';
import { AnyGraphNode } from '../../core/graph-engine/types/NodeTypes';

export interface SearchQuery {
  // Text search
  text?: string;
  exactPhrase?: boolean;
  caseSensitive?: boolean;

  // Filters
  conversationIds?: string[];
  participantIds?: string[];
  messageRoles?: ('user' | 'assistant' | 'system')[];
  contentTypes?: ('text' | 'code' | 'mixed' | 'error')[];

  // Date range
  dateRange?: {
    start: Date;
    end: Date;
  };

  // Message properties
  hasCodeBlocks?: boolean;
  hasLinks?: boolean;
  hasErrors?: boolean;
  isQuestion?: boolean;

  // Graph relationships
  referencesCode?: boolean;
  referencesDocuments?: boolean;
  topicIds?: string[];

  // Sorting and pagination
  sortBy?: 'relevance' | 'date' | 'conversation' | 'participant';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;

  // Advanced options
  includeContext?: boolean;
  contextRadius?: number; // Messages before/after match
  highlightMatches?: boolean;
  groupByConversation?: boolean;
}

export interface SearchResult {
  // Core result data
  message: MessageNode;
  conversation: ConversationSummary;
  relevanceScore: number;

  // Match information
  matches: SearchMatch[];
  context?: {
    before: MessageNode[];
    after: MessageNode[];
  };

  // Highlighted content
  highlightedContent?: string;
  snippet?: string;
}

export interface SearchMatch {
  type: 'text' | 'code' | 'entity' | 'topic';
  text: string;
  startIndex: number;
  endIndex: number;
  field: 'content' | 'description' | 'label';
  confidence: number;
}

export interface SearchResponse {
  results: SearchResult[];
  total: number;
  facets: SearchFacets;
  suggestions: string[];
  executionTime: number;
  error?: string;
}

export interface SearchFacets {
  conversations: Array<{ id: string; title: string; count: number }>;
  participants: Array<{ id: string; name: string; count: number }>;
  contentTypes: Array<{ type: string; count: number }>;
  topics: Array<{ id: string; name: string; count: number }>;
  timeRanges: Array<{ range: string; count: number }>;
}

export interface SearchIndex {
  messageId: string;
  conversationId: string;
  content: string;
  contentType: string;
  role: string;
  timestamp: Date;
  tokens: string[];
  entities: string[];
  topics: string[];
  codeReferences: string[];
  documentReferences: string[];
}

/**
 * Advanced conversation and message search engine
 */
export class ConversationSearch {
  private storage: ConversationStorage;
  private searchIndex: Map<string, SearchIndex>;
  private topicIndex: Map<string, string[]>; // topic -> messageIds
  private entityIndex: Map<string, string[]>; // entity -> messageIds

  constructor(storage: ConversationStorage) {
    this.storage = storage;
    this.searchIndex = new Map();
    this.topicIndex = new Map();
    this.entityIndex = new Map();
  }

  /**
   * Perform advanced search
   */
  async search(query: SearchQuery): Promise<SearchResponse> {
    const startTime = Date.now();

    try {
      // Get candidate messages
      const candidates = await this.getCandidateMessages(query);

      // Score and rank results
      const scoredResults = await this.scoreAndRankResults(candidates, query);

      // Apply sorting and pagination
      const sortedResults = this.sortResults(scoredResults, query);
      const paginatedResults = this.paginateResults(sortedResults, query);

      // Add context if requested
      const resultsWithContext = query.includeContext ?
        await this.addContext(paginatedResults, query) : paginatedResults;

      // Add highlighting if requested
      const finalResults = query.highlightMatches ?
        this.addHighlighting(resultsWithContext, query) : resultsWithContext;

      // Generate facets
      const facets = this.generateFacets(candidates, query);

      // Generate search suggestions
      const suggestions = this.generateSuggestions(query, candidates);

      return {
        results: finalResults,
        total: scoredResults.length,
        facets,
        suggestions,
        executionTime: Date.now() - startTime
      };

    } catch (error) {
      return {
        results: [],
        total: 0,
        facets: this.getEmptyFacets(),
        suggestions: [],
        executionTime: Date.now() - startTime,
        error: `Search failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Index a message for searching
   */
  async indexMessage(
    message: MessageNode,
    conversation: ChatConversationNode,
    topics: ConversationTopic[] = [],
    referencedNodes: AnyGraphNode[] = []
  ): Promise<void> {
    const tokens = this.tokenizeContent(message.content);
    const entities = this.extractEntities(message.content);
    const codeReferences = this.extractCodeReferences(message.content);
    const documentReferences = this.extractDocumentReferences(message.content);

    const index: SearchIndex = {
      messageId: message.id,
      conversationId: conversation.id,
      content: message.content,
      contentType: message.metadata.contentType || 'text',
      role: message.role,
      timestamp: new Date(message.startTime),
      tokens,
      entities,
      topics: topics.map(t => t.id),
      codeReferences,
      documentReferences
    };

    this.searchIndex.set(message.id, index);

    // Update topic index
    for (const topic of topics) {
      const messageIds = this.topicIndex.get(topic.id) || [];
      messageIds.push(message.id);
      this.topicIndex.set(topic.id, messageIds);
    }

    // Update entity index
    for (const entity of entities) {
      const messageIds = this.entityIndex.get(entity) || [];
      messageIds.push(message.id);
      this.entityIndex.set(entity, messageIds);
    }
  }

  /**
   * Get candidate messages based on query
   */
  private async getCandidateMessages(query: SearchQuery): Promise<SearchIndex[]> {
    let candidates: SearchIndex[] = Array.from(this.searchIndex.values());

    // Apply basic filters first
    candidates = candidates.filter(index => {
      // Conversation filter
      if (query.conversationIds && !query.conversationIds.includes(index.conversationId)) {
        return false;
      }

      // Role filter
      if (query.messageRoles && !query.messageRoles.includes(index.role)) {
        return false;
      }

      // Content type filter
      if (query.contentTypes && !query.contentTypes.includes(index.contentType)) {
        return false;
      }

      // Date range filter
      if (query.dateRange) {
        if (index.timestamp < query.dateRange.start || index.timestamp > query.dateRange.end) {
          return false;
        }
      }

      // Topic filter
      if (query.topicIds && !query.topicIds.some(topicId => index.topics.includes(topicId))) {
        return false;
      }

      // Code/document reference filters
      if (query.referencesCode && index.codeReferences.length === 0) {
        return false;
      }

      if (query.referencesDocuments && index.documentReferences.length === 0) {
        return false;
      }

      return true;
    });

    // Text search
    if (query.text) {
      candidates = this.performTextSearch(candidates, query);
    }

    return candidates;
  }

  /**
   * Perform text search on candidates
   */
  private performTextSearch(candidates: SearchIndex[], query: SearchQuery): SearchIndex[] {
    if (!query.text) return candidates;

    const searchText = query.caseSensitive ? query.text : query.text.toLowerCase();
    const searchTokens = this.tokenizeContent(searchText);

    return candidates.filter(index => {
      const content = query.caseSensitive ? index.content : index.content.toLowerCase();

      if (query.exactPhrase) {
        return content.includes(searchText);
      } else {
        // Token-based search
        return searchTokens.some(token => {
          return index.tokens.some(indexToken =>
            query.caseSensitive ? indexToken === token : indexToken.toLowerCase() === token.toLowerCase()
          );
        });
      }
    });
  }

  /**
   * Score and rank search results
   */
  private async scoreAndRankResults(
    candidates: SearchIndex[],
    query: SearchQuery
  ): Promise<SearchResult[]> {
    const results: SearchResult[] = [];

    for (const candidate of candidates) {
      try {
        // Load full message and conversation data
        const { conversation, messages } = await this.storage.loadConversation(candidate.conversationId);
        if (!conversation) continue;

        const message = messages.find(m => m.id === candidate.messageId);
        if (!message) continue;

        const conversationSummary = this.createConversationSummary(conversation);

        // Calculate relevance score
        const relevanceScore = this.calculateRelevanceScore(candidate, message, query);

        // Find matches
        const matches = this.findMatches(candidate, message, query);

        // Generate snippet
        const snippet = this.generateSnippet(message.content, matches);

        const result: SearchResult = {
          message,
          conversation: conversationSummary,
          relevanceScore,
          matches,
          snippet
        };

        results.push(result);

      } catch (error) {
        // Skip problematic entries
        continue;
      }
    }

    return results;
  }

  /**
   * Calculate relevance score
   */
  private calculateRelevanceScore(
    index: SearchIndex,
    message: MessageNode,
    query: SearchQuery
  ): number {
    let score = 0;

    // Text relevance
    if (query.text) {
      const textScore = this.calculateTextRelevance(index.content, query.text, query.exactPhrase);
      score += textScore * 0.4;
    }

    // Recency score
    const ageHours = (Date.now() - index.timestamp.getTime()) / (1000 * 60 * 60);
    const recencyScore = Math.max(0, 1 - ageHours / (24 * 30)); // Decay over 30 days
    score += recencyScore * 0.2;

    // Content type relevance
    if (query.contentTypes) {
      score += query.contentTypes.includes(index.contentType) ? 0.1 : 0;
    }

    // Role relevance (assistant messages often more informative)
    if (index.role === 'assistant') score += 0.1;

    // Length penalty for very short or very long messages
    const contentLength = index.content.length;
    if (contentLength > 50 && contentLength < 1000) score += 0.1;

    // Topic relevance
    if (query.topicIds) {
      const topicMatches = query.topicIds.filter(id => index.topics.includes(id)).length;
      score += (topicMatches / query.topicIds.length) * 0.2;
    }

    return Math.min(score, 1.0);
  }

  /**
   * Calculate text relevance using TF-IDF-like scoring
   */
  private calculateTextRelevance(content: string, searchText: string, exactPhrase: boolean): number {
    const contentLower = content.toLowerCase();
    const searchLower = searchText.toLowerCase();

    if (exactPhrase) {
      // Exact phrase matching
      const matches = (contentLower.match(new RegExp(this.escapeRegex(searchLower), 'g')) || []).length;
      return Math.min(matches * 0.3, 1.0);
    } else {
      // Token-based scoring
      const searchTokens = this.tokenizeContent(searchLower);
      const contentTokens = this.tokenizeContent(contentLower);

      let score = 0;
      for (const token of searchTokens) {
        const tokenCount = contentTokens.filter(t => t === token).length;
        if (tokenCount > 0) {
          // TF score
          const tf = tokenCount / contentTokens.length;

          // Simple IDF approximation (would use corpus statistics in production)
          const idf = Math.log(1000 / (tokenCount + 1));

          score += tf * idf;
        }
      }

      return Math.min(score, 1.0);
    }
  }

  /**
   * Find matches in content
   */
  private findMatches(index: SearchIndex, message: MessageNode, query: SearchQuery): SearchMatch[] {
    const matches: SearchMatch[] = [];

    if (query.text) {
      const content = query.caseSensitive ? message.content : message.content.toLowerCase();
      const searchText = query.caseSensitive ? query.text : query.text.toLowerCase();

      if (query.exactPhrase) {
        const regex = new RegExp(this.escapeRegex(searchText), query.caseSensitive ? 'g' : 'gi');
        let match;
        while ((match = regex.exec(content)) !== null) {
          matches.push({
            type: 'text',
            text: match[0],
            startIndex: match.index,
            endIndex: match.index + match[0].length,
            field: 'content',
            confidence: 1.0
          });
        }
      } else {
        const searchTokens = this.tokenizeContent(searchText);
        const contentTokens = this.tokenizeContent(content);

        for (const token of searchTokens) {
          const regex = new RegExp(`\\b${this.escapeRegex(token)}\\b`, query.caseSensitive ? 'g' : 'gi');
          let match;
          while ((match = regex.exec(content)) !== null) {
            matches.push({
              type: 'text',
              text: match[0],
              startIndex: match.index,
              endIndex: match.index + match[0].length,
              field: 'content',
              confidence: 0.8
            });
          }
        }
      }
    }

    return matches;
  }

  /**
   * Sort results
   */
  private sortResults(results: SearchResult[], query: SearchQuery): SearchResult[] {
    const sortBy = query.sortBy || 'relevance';
    const sortOrder = query.sortOrder || 'desc';

    return results.sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'relevance':
          comparison = a.relevanceScore - b.relevanceScore;
          break;
        case 'date':
          comparison = new Date(a.message.startTime).getTime() - new Date(b.message.startTime).getTime();
          break;
        case 'conversation':
          comparison = a.conversation.title.localeCompare(b.conversation.title);
          break;
        case 'participant':
          comparison = a.message.role.localeCompare(b.message.role);
          break;
      }

      return sortOrder === 'desc' ? -comparison : comparison;
    });
  }

  /**
   * Paginate results
   */
  private paginateResults(results: SearchResult[], query: SearchQuery): SearchResult[] {
    let paginated = results;

    if (query.offset) {
      paginated = paginated.slice(query.offset);
    }

    if (query.limit) {
      paginated = paginated.slice(0, query.limit);
    }

    return paginated;
  }

  /**
   * Add context messages
   */
  private async addContext(results: SearchResult[], query: SearchQuery): Promise<SearchResult[]> {
    const contextRadius = query.contextRadius || 2;

    for (const result of results) {
      try {
        const { messages } = await this.storage.loadConversation(result.conversation.id);

        const messageIndex = messages.findIndex(m => m.id === result.message.id);
        if (messageIndex === -1) continue;

        const before = messages.slice(
          Math.max(0, messageIndex - contextRadius),
          messageIndex
        );

        const after = messages.slice(
          messageIndex + 1,
          Math.min(messages.length, messageIndex + 1 + contextRadius)
        );

        result.context = { before, after };

      } catch (error) {
        // Skip context for problematic entries
        continue;
      }
    }

    return results;
  }

  /**
   * Add highlighting to content
   */
  private addHighlighting(results: SearchResult[], query: SearchQuery): SearchResult[] {
    for (const result of results) {
      let highlighted = result.message.content;

      for (const match of result.matches) {
        const before = highlighted.substring(0, match.startIndex);
        const matchText = highlighted.substring(match.startIndex, match.endIndex);
        const after = highlighted.substring(match.endIndex);

        highlighted = before + `<mark class="search-highlight">${matchText}</mark>` + after;
      }

      result.highlightedContent = highlighted;
    }

    return results;
  }

  /**
   * Generate search facets
   */
  private generateFacets(candidates: SearchIndex[], query: SearchQuery): SearchFacets {
    const conversationCounts = new Map<string, number>();
    const participantCounts = new Map<string, number>();
    const contentTypeCounts = new Map<string, number>();
    const topicCounts = new Map<string, number>();

    for (const candidate of candidates) {
      // Conversation facets
      conversationCounts.set(
        candidate.conversationId,
        (conversationCounts.get(candidate.conversationId) || 0) + 1
      );

      // Participant facets
      participantCounts.set(
        candidate.role,
        (participantCounts.get(candidate.role) || 0) + 1
      );

      // Content type facets
      contentTypeCounts.set(
        candidate.contentType,
        (contentTypeCounts.get(candidate.contentType) || 0) + 1
      );

      // Topic facets
      for (const topicId of candidate.topics) {
        topicCounts.set(topicId, (topicCounts.get(topicId) || 0) + 1);
      }
    }

    return {
      conversations: Array.from(conversationCounts.entries())
        .map(([id, count]) => ({ id, title: id, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),

      participants: Array.from(participantCounts.entries())
        .map(([id, count]) => ({ id, name: id, count }))
        .sort((a, b) => b.count - a.count),

      contentTypes: Array.from(contentTypeCounts.entries())
        .map(([type, count]) => ({ type, count }))
        .sort((a, b) => b.count - a.count),

      topics: Array.from(topicCounts.entries())
        .map(([id, count]) => ({ id, name: id, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 20),

      timeRanges: [] // Would implement time range faceting
    };
  }

  /**
   * Generate search suggestions
   */
  private generateSuggestions(query: SearchQuery, candidates: SearchIndex[]): string[] {
    const suggestions: string[] = [];

    if (query.text && candidates.length === 0) {
      // Suggest related terms
      const tokens = this.tokenizeContent(query.text);
      const relatedTerms = this.findRelatedTerms(tokens);
      suggestions.push(...relatedTerms.slice(0, 3));
    }

    return suggestions;
  }

  /**
   * Helper methods
   */
  private tokenizeContent(content: string): string[] {
    return content
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(token => token.length > 2);
  }

  private extractEntities(content: string): string[] {
    // Simple entity extraction - would use NLP library in production
    const entities: string[] = [];

    // Extract capitalized words (potential entities)
    const capitalizedWords = content.match(/\b[A-Z][a-z]+\b/g) || [];
    entities.push(...capitalizedWords);

    // Extract code-like entities
    const codeEntities = content.match(/\b[a-zA-Z_][a-zA-Z0-9_]*\(/g) || [];
    entities.push(...codeEntities.map(e => e.slice(0, -1)));

    return [...new Set(entities)];
  }

  private extractCodeReferences(content: string): string[] {
    const references: string[] = [];

    // File paths
    const filePaths = content.match(/[a-zA-Z0-9_\-./]+\.[a-zA-Z]{1,4}/g) || [];
    references.push(...filePaths);

    // Function calls
    const functionCalls = content.match(/\b[a-zA-Z_][a-zA-Z0-9_]*\(/g) || [];
    references.push(...functionCalls.map(f => f.slice(0, -1)));

    return [...new Set(references)];
  }

  private extractDocumentReferences(content: string): string[] {
    const references: string[] = [];

    // Documentation files
    const docFiles = content.match(/[a-zA-Z0-9_\-./]+\.(md|txt|rst|adoc)/g) || [];
    references.push(...docFiles);

    // URLs
    const urls = content.match(/https?:\/\/[^\s]+/g) || [];
    references.push(...urls);

    return [...new Set(references)];
  }

  private generateSnippet(content: string, matches: SearchMatch[]): string {
    if (matches.length === 0) {
      return content.substring(0, 150) + (content.length > 150 ? '...' : '');
    }

    // Get snippet around first match
    const firstMatch = matches[0];
    const start = Math.max(0, firstMatch.startIndex - 50);
    const end = Math.min(content.length, firstMatch.endIndex + 50);

    let snippet = content.substring(start, end);

    if (start > 0) snippet = '...' + snippet;
    if (end < content.length) snippet = snippet + '...';

    return snippet;
  }

  private findRelatedTerms(tokens: string[]): string[] {
    // Simple related term finding - would use word embeddings in production
    const relatedTerms: string[] = [];

    for (const token of tokens) {
      // Find similar tokens in index
      for (const index of this.searchIndex.values()) {
        const similarTokens = index.tokens.filter(t =>
          t.includes(token) || token.includes(t)
        );
        relatedTerms.push(...similarTokens);
      }
    }

    return [...new Set(relatedTerms)].slice(0, 10);
  }

  private createConversationSummary(conversation: ChatConversationNode): ConversationSummary {
    return {
      id: conversation.id,
      title: conversation.label,
      description: conversation.description || '',
      messageCount: conversation.messages.size,
      branchCount: conversation.branches.size,
      participants: conversation.participants,
      mainTopics: conversation.metadata.mainTopics?.map(t => t.topic) || [],
      startTime: conversation.metadata.createdAt || new Date(),
      lastActivity: conversation.metadata.updatedAt || new Date(),
      status: conversation.metadata.isActive ? 'active' : 'completed'
    };
  }

  private escapeRegex(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private getEmptyFacets(): SearchFacets {
    return {
      conversations: [],
      participants: [],
      contentTypes: [],
      topics: [],
      timeRanges: []
    };
  }

  /**
   * Public maintenance methods
   */
  async rebuildIndex(): Promise<void> {
    this.searchIndex.clear();
    this.topicIndex.clear();
    this.entityIndex.clear();

    // Would rebuild index from storage in production
  }

  async removeFromIndex(messageId: string): Promise<void> {
    const index = this.searchIndex.get(messageId);
    if (index) {
      this.searchIndex.delete(messageId);

      // Clean up topic index
      for (const topicId of index.topics) {
        const messageIds = this.topicIndex.get(topicId) || [];
        const filtered = messageIds.filter(id => id !== messageId);
        if (filtered.length > 0) {
          this.topicIndex.set(topicId, filtered);
        } else {
          this.topicIndex.delete(topicId);
        }
      }

      // Clean up entity index
      for (const entity of index.entities) {
        const messageIds = this.entityIndex.get(entity) || [];
        const filtered = messageIds.filter(id => id !== messageId);
        if (filtered.length > 0) {
          this.entityIndex.set(entity, filtered);
        } else {
          this.entityIndex.delete(entity);
        }
      }
    }
  }

  getIndexStats(): {
    totalMessages: number;
    totalTopics: number;
    totalEntities: number;
    indexSize: number;
  } {
    return {
      totalMessages: this.searchIndex.size,
      totalTopics: this.topicIndex.size,
      totalEntities: this.entityIndex.size,
      indexSize: JSON.stringify(Array.from(this.searchIndex.values())).length
    };
  }
}