/**
 * Context extractor for building rich conversation context from graph nodes
 */

import { GraphStore } from '../../core/graph-engine/GraphStore';
import { AnyGraphNode, CodeNode, DocumentNode, BusinessNode } from '../../core/graph-engine/types/NodeTypes';
import { GraphEdge } from '../../core/graph-engine/types/EdgeTypes';
import { ParsedMessage } from '../parsers/MessageParser';
import { MessageNode, ConversationContext } from '../models/MessageNode';

export interface ExtractedContext {
  // Core context
  relevantNodes: AnyGraphNode[];
  referencedFiles: CodeNode[];
  relatedDocuments: DocumentNode[];
  businessContext: BusinessNode[];

  // Connections
  nodeConnections: Map<string, AnyGraphNode[]>;
  contextGraph: ContextGraph;

  // Metadata
  contextScore: number;
  relevanceScores: Map<string, number>;
  extractionMetadata: {
    extractionMethod: string;
    processingTime: number;
    totalNodesEvaluated: number;
    filtersCriteria: string[];
  };

  // Enhanced context
  codeContext: CodeContext;
  documentContext: DocumentContext;
  conversationHistory: ConversationHistoryContext;
}

export interface ContextGraph {
  nodes: AnyGraphNode[];
  edges: GraphEdge[];
  centralNodes: string[];
  clusters: NodeCluster[];
  pathways: ContextPathway[];
}

export interface NodeCluster {
  id: string;
  nodes: string[];
  type: 'code' | 'business' | 'document' | 'mixed';
  strength: number;
  topic?: string;
}

export interface ContextPathway {
  id: string;
  nodeIds: string[];
  relationship: string;
  strength: number;
  description?: string;
}

export interface CodeContext {
  activeFiles: string[];
  recentModifications: Array<{
    fileId: string;
    timestamp: Date;
    changeType: 'modified' | 'created' | 'deleted';
  }>;
  dependencyGraph: Map<string, string[]>;
  functionCallChains: Array<{
    chain: string[];
    depth: number;
  }>;
  codePatterns: Array<{
    pattern: string;
    files: string[];
    confidence: number;
  }>;
}

export interface DocumentContext {
  relevantSections: Array<{
    documentId: string;
    sectionTitle: string;
    content: string;
    relevanceScore: number;
  }>;
  relatedSpecs: DocumentNode[];
  apiDocumentation: DocumentNode[];
  tutorials: DocumentNode[];
}

export interface ConversationHistoryContext {
  recentConversations: Array<{
    conversationId: string;
    similarity: number;
    sharedTopics: string[];
    timeAgo: number;
  }>;
  relatedQuestions: Array<{
    messageId: string;
    question: string;
    answer?: string;
    similarity: number;
  }>;
  userPatterns: {
    commonQuestionTypes: string[];
    preferredExplanationStyle: 'detailed' | 'concise' | 'visual';
    technicalLevel: 'beginner' | 'intermediate' | 'advanced';
  };
}

export interface ContextExtractionOptions {
  maxNodes?: number;
  includeHistorical?: boolean;
  contextDepth?: number;
  relevanceThreshold?: number;
  includeCode?: boolean;
  includeDocuments?: boolean;
  includeBusiness?: boolean;
  timeRangeHours?: number;
  userPreferences?: {
    technicalLevel?: 'beginner' | 'intermediate' | 'advanced';
    preferredDetails?: 'minimal' | 'standard' | 'comprehensive';
  };
}

/**
 * Main context extraction class
 */
export class ContextExtractor {
  private graphStore: GraphStore;
  private contextCache: Map<string, ExtractedContext>;
  private cacheExpiry: Map<string, number>;

  constructor(graphStore: GraphStore) {
    this.graphStore = graphStore;
    this.contextCache = new Map();
    this.cacheExpiry = new Map();
  }

  /**
   * Extract context for a parsed message
   */
  async extractContext(
    parsedMessage: ParsedMessage,
    currentContext?: ConversationContext,
    options: ContextExtractionOptions = {}
  ): Promise<ExtractedContext> {
    const startTime = Date.now();

    // Check cache
    const cacheKey = this.generateCacheKey(parsedMessage, options);
    const cached = this.getCachedContext(cacheKey);
    if (cached) return cached;

    // Set defaults
    const opts: Required<ContextExtractionOptions> = {
      maxNodes: 50,
      includeHistorical: true,
      contextDepth: 3,
      relevanceThreshold: 0.3,
      includeCode: true,
      includeDocuments: true,
      includeBusiness: true,
      timeRangeHours: 24,
      userPreferences: {
        technicalLevel: 'intermediate',
        preferredDetails: 'standard'
      },
      ...options
    };

    // Extract context
    const context = await this.performContextExtraction(parsedMessage, currentContext, opts);

    // Cache result
    this.cacheContext(cacheKey, context);

    // Add metadata
    context.extractionMetadata = {
      extractionMethod: 'multi-stage',
      processingTime: Date.now() - startTime,
      totalNodesEvaluated: this.graphStore.getAllNodes().length,
      filtersCriteria: this.generateFilterCriteria(opts)
    };

    return context;
  }

  /**
   * Extract context for a specific message node
   */
  async extractMessageContext(
    messageNode: MessageNode,
    conversationId: string,
    options: ContextExtractionOptions = {}
  ): Promise<ExtractedContext> {
    // First parse the message content if not already done
    const parsedMessage = messageNode.metadata.contentType ?
      this.reconstructParsedMessage(messageNode) :
      await import('../parsers/MessageParser').then(m =>
        m.MessageParser.parseMessage(messageNode.content, messageNode.role)
      );

    return this.extractContext(parsedMessage, messageNode.metadata.contextSnapshot, options);
  }

  /**
   * Main context extraction logic
   */
  private async performContextExtraction(
    parsedMessage: ParsedMessage,
    currentContext: ConversationContext | undefined,
    options: Required<ContextExtractionOptions>
  ): Promise<ExtractedContext> {

    // 1. Direct reference extraction
    const directReferences = await this.extractDirectReferences(parsedMessage);

    // 2. Semantic similarity search
    const semanticMatches = await this.findSemanticMatches(parsedMessage, options);

    // 3. Graph traversal for related nodes
    const relatedNodes = await this.findRelatedNodes(
      [...directReferences, ...semanticMatches],
      options.contextDepth
    );

    // 4. Combine and score all nodes
    const allNodes = [...directReferences, ...semanticMatches, ...relatedNodes];
    const scoredNodes = this.scoreNodeRelevance(allNodes, parsedMessage);

    // 5. Filter by relevance and limits
    const relevantNodes = this.filterRelevantNodes(scoredNodes, options);

    // 6. Extract specialized contexts
    const codeContext = await this.extractCodeContext(relevantNodes, currentContext);
    const documentContext = await this.extractDocumentContext(relevantNodes, parsedMessage);
    const conversationHistory = await this.extractConversationHistory(parsedMessage, options);

    // 7. Build context graph
    const contextGraph = this.buildContextGraph(relevantNodes);

    // 8. Categorize nodes
    const categorizedNodes = this.categorizeNodes(relevantNodes);

    return {
      relevantNodes,
      referencedFiles: categorizedNodes.codeNodes,
      relatedDocuments: categorizedNodes.documentNodes,
      businessContext: categorizedNodes.businessNodes,
      nodeConnections: this.buildNodeConnections(relevantNodes),
      contextGraph,
      contextScore: this.calculateContextScore(relevantNodes, parsedMessage),
      relevanceScores: scoredNodes,
      extractionMetadata: {
        extractionMethod: '',
        processingTime: 0,
        totalNodesEvaluated: 0,
        filtersCriteria: []
      },
      codeContext,
      documentContext,
      conversationHistory
    };
  }

  /**
   * Extract nodes directly referenced in the message
   */
  private async extractDirectReferences(parsedMessage: ParsedMessage): Promise<AnyGraphNode[]> {
    const references: AnyGraphNode[] = [];

    // Extract from file mentions
    for (const mention of parsedMessage.mentions) {
      if (mention.type === 'file') {
        const fileNodes = this.findNodesByFilePath(mention.text);
        references.push(...fileNodes);
      }

      if (mention.type === 'function' || mention.type === 'class') {
        const codeNodes = this.findNodesByName(mention.text, mention.type);
        references.push(...codeNodes);
      }
    }

    // Extract from inline code
    for (const code of parsedMessage.inlineCode) {
      if (code.type === 'function' || code.type === 'variable') {
        const codeNodes = this.findNodesByName(code.text, 'code');
        references.push(...codeNodes);
      }
    }

    // Extract from links
    for (const link of parsedMessage.links) {
      if (link.type === 'file') {
        const fileNodes = this.findNodesByFilePath(link.url);
        references.push(...fileNodes);
      }
    }

    return this.deduplicateNodes(references);
  }

  /**
   * Find nodes through semantic similarity
   */
  private async findSemanticMatches(
    parsedMessage: ParsedMessage,
    options: Required<ContextExtractionOptions>
  ): Promise<AnyGraphNode[]> {
    const matches: AnyGraphNode[] = [];
    const searchTerms = this.extractSearchTerms(parsedMessage);

    for (const term of searchTerms) {
      const termMatches = this.searchNodesByContent(term, options.relevanceThreshold);
      matches.push(...termMatches);
    }

    return this.deduplicateNodes(matches);
  }

  /**
   * Find related nodes through graph traversal
   */
  private async findRelatedNodes(
    seedNodes: AnyGraphNode[],
    depth: number
  ): Promise<AnyGraphNode[]> {
    const related: AnyGraphNode[] = [];
    const visited = new Set<string>();

    for (const seed of seedNodes) {
      const relatedToSeed = this.traverseFromNode(seed.id, depth, visited);
      related.push(...relatedToSeed);
    }

    return this.deduplicateNodes(related);
  }

  /**
   * Score node relevance to the message
   */
  private scoreNodeRelevance(
    nodes: AnyGraphNode[],
    parsedMessage: ParsedMessage
  ): Map<string, number> {
    const scores = new Map<string, number>();

    for (const node of nodes) {
      let score = 0;

      // Base score from node type
      score += this.getNodeTypeScore(node, parsedMessage);

      // Content similarity score
      score += this.calculateContentSimilarity(node, parsedMessage);

      // Recency score
      score += this.calculateRecencyScore(node);

      // Connection density score
      score += this.calculateConnectionScore(node);

      scores.set(node.id, Math.min(score, 1));
    }

    return scores;
  }

  /**
   * Filter nodes by relevance and options
   */
  private filterRelevantNodes(
    scoredNodes: Map<string, number>,
    options: Required<ContextExtractionOptions>
  ): AnyGraphNode[] {
    const filtered: AnyGraphNode[] = [];

    // Sort by score
    const sortedEntries = Array.from(scoredNodes.entries())
      .sort((a, b) => b[1] - a[1])
      .filter(([_, score]) => score >= options.relevanceThreshold)
      .slice(0, options.maxNodes);

    for (const [nodeId, _] of sortedEntries) {
      const node = this.graphStore.getNode(nodeId);
      if (node) {
        // Apply type filters
        if (!options.includeCode && node.type === 'code') continue;
        if (!options.includeDocuments && node.type === 'document') continue;
        if (!options.includeBusiness && node.type === 'business') continue;

        filtered.push(node);
      }
    }

    return filtered;
  }

  /**
   * Extract code-specific context
   */
  private async extractCodeContext(
    nodes: AnyGraphNode[],
    currentContext?: ConversationContext
  ): Promise<CodeContext> {
    const codeNodes = nodes.filter(n => n.type === 'code') as CodeNode[];

    const activeFiles = currentContext?.activeFiles || [];
    const recentModifications = this.getRecentFileModifications(codeNodes);
    const dependencyGraph = this.buildDependencyGraph(codeNodes);
    const functionCallChains = this.findFunctionCallChains(codeNodes);
    const codePatterns = this.detectCodePatterns(codeNodes);

    return {
      activeFiles,
      recentModifications,
      dependencyGraph,
      functionCallChains,
      codePatterns
    };
  }

  /**
   * Extract document-specific context
   */
  private async extractDocumentContext(
    nodes: AnyGraphNode[],
    parsedMessage: ParsedMessage
  ): Promise<DocumentContext> {
    const documentNodes = nodes.filter(n => n.type === 'document') as DocumentNode[];

    const relevantSections = this.findRelevantDocumentSections(documentNodes, parsedMessage);
    const relatedSpecs = documentNodes.filter(d => d.documentType === 'spec');
    const apiDocumentation = documentNodes.filter(d => d.documentType === 'api-doc');
    const tutorials = documentNodes.filter(d => d.content?.includes('tutorial') || d.content?.includes('guide'));

    return {
      relevantSections,
      relatedSpecs,
      apiDocumentation,
      tutorials
    };
  }

  /**
   * Extract conversation history context
   */
  private async extractConversationHistory(
    parsedMessage: ParsedMessage,
    options: Required<ContextExtractionOptions>
  ): Promise<ConversationHistoryContext> {
    if (!options.includeHistorical) {
      return {
        recentConversations: [],
        relatedQuestions: [],
        userPatterns: {
          commonQuestionTypes: [],
          preferredExplanationStyle: 'standard',
          technicalLevel: 'intermediate'
        }
      };
    }

    // This would integrate with conversation storage
    return {
      recentConversations: [],
      relatedQuestions: [],
      userPatterns: {
        commonQuestionTypes: ['how-to', 'debugging', 'explanation'],
        preferredExplanationStyle: options.userPreferences.preferredDetails === 'comprehensive' ? 'detailed' : 'concise',
        technicalLevel: options.userPreferences.technicalLevel
      }
    };
  }

  /**
   * Build context graph structure
   */
  private buildContextGraph(nodes: AnyGraphNode[]): ContextGraph {
    const nodeIds = new Set(nodes.map(n => n.id));
    const edges = this.graphStore.getAllEdges()
      .filter(edge =>
        nodeIds.has(edge.source) && nodeIds.has(edge.target)
      );

    const clusters = this.identifyNodeClusters(nodes, edges);
    const pathways = this.findContextPathways(nodes, edges);
    const centralNodes = this.findCentralNodes(nodes, edges);

    return {
      nodes,
      edges,
      centralNodes,
      clusters,
      pathways
    };
  }

  /**
   * Helper methods
   */
  private findNodesByFilePath(filePath: string): AnyGraphNode[] {
    return this.graphStore.getAllNodes()
      .filter(node => {
        if (node.type === 'code') {
          const codeNode = node as CodeNode;
          return codeNode.filePath === filePath ||
                 codeNode.filePath.endsWith(filePath) ||
                 filePath.includes(codeNode.filePath);
        }
        if (node.type === 'document') {
          const docNode = node as DocumentNode;
          return docNode.filePath === filePath ||
                 docNode.filePath?.endsWith(filePath) ||
                 filePath.includes(docNode.filePath || '');
        }
        return false;
      });
  }

  private findNodesByName(name: string, type: string): AnyGraphNode[] {
    return this.graphStore.getAllNodes()
      .filter(node =>
        node.label.toLowerCase().includes(name.toLowerCase()) ||
        node.description?.toLowerCase().includes(name.toLowerCase())
      );
  }

  private extractSearchTerms(parsedMessage: ParsedMessage): string[] {
    const terms: string[] = [];

    // Add entities
    terms.push(...parsedMessage.entities.map(e => e.text));

    // Add important words from content
    const words = parsedMessage.content
      .toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 3)
      .filter(word => !this.isStopWord(word));

    terms.push(...words.slice(0, 10)); // Limit to top 10 words

    return terms;
  }

  private isStopWord(word: string): boolean {
    const stopWords = ['the', 'and', 'or', 'but', 'for', 'with', 'this', 'that', 'have', 'has'];
    return stopWords.includes(word);
  }

  private searchNodesByContent(term: string, threshold: number): AnyGraphNode[] {
    return this.graphStore.getAllNodes()
      .filter(node => {
        const score = this.calculateTextSimilarity(
          term,
          `${node.label} ${node.description || ''}`
        );
        return score >= threshold;
      });
  }

  private calculateTextSimilarity(text1: string, text2: string): number {
    // Simple word overlap similarity
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));

    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);

    return union.size > 0 ? intersection.size / union.size : 0;
  }

  private traverseFromNode(nodeId: string, depth: number, visited: Set<string>): AnyGraphNode[] {
    if (depth <= 0 || visited.has(nodeId)) return [];

    visited.add(nodeId);
    const related: AnyGraphNode[] = [];

    // Get connected nodes
    const edges = this.graphStore.getAllEdges()
      .filter(edge => edge.source === nodeId || edge.target === nodeId);

    for (const edge of edges) {
      const connectedId = edge.source === nodeId ? edge.target : edge.source;
      const connectedNode = this.graphStore.getNode(connectedId);

      if (connectedNode) {
        related.push(connectedNode);
        // Recursive traversal
        const deeperNodes = this.traverseFromNode(connectedId, depth - 1, visited);
        related.push(...deeperNodes);
      }
    }

    return related;
  }

  private deduplicateNodes(nodes: AnyGraphNode[]): AnyGraphNode[] {
    const seen = new Set<string>();
    return nodes.filter(node => {
      if (seen.has(node.id)) return false;
      seen.add(node.id);
      return true;
    });
  }

  private getNodeTypeScore(node: AnyGraphNode, parsedMessage: ParsedMessage): number {
    if (parsedMessage.contentType === 'code' && node.type === 'code') return 0.3;
    if (parsedMessage.isQuestion && node.type === 'document') return 0.2;
    if (parsedMessage.hasErrorContent && node.type === 'code') return 0.4;
    return 0.1;
  }

  private calculateContentSimilarity(node: AnyGraphNode, parsedMessage: ParsedMessage): number {
    return this.calculateTextSimilarity(
      parsedMessage.content,
      `${node.label} ${node.description || ''}`
    ) * 0.5;
  }

  private calculateRecencyScore(node: AnyGraphNode): number {
    const updatedAt = node.metadata?.updatedAt;
    if (!updatedAt) return 0;

    const hoursAgo = (Date.now() - updatedAt.getTime()) / (1000 * 60 * 60);
    return Math.max(0, (24 - hoursAgo) / 24) * 0.2;
  }

  private calculateConnectionScore(node: AnyGraphNode): number {
    const connections = this.graphStore.getAllEdges()
      .filter(edge => edge.source === node.id || edge.target === node.id);

    return Math.min(connections.length / 10, 1) * 0.1;
  }

  // Placeholder implementations for complex methods
  private buildNodeConnections(nodes: AnyGraphNode[]): Map<string, AnyGraphNode[]> {
    return new Map();
  }

  private calculateContextScore(nodes: AnyGraphNode[], parsedMessage: ParsedMessage): number {
    return nodes.length > 0 ? 0.8 : 0.2;
  }

  private categorizeNodes(nodes: AnyGraphNode[]): {
    codeNodes: CodeNode[];
    documentNodes: DocumentNode[];
    businessNodes: BusinessNode[];
  } {
    return {
      codeNodes: nodes.filter(n => n.type === 'code') as CodeNode[],
      documentNodes: nodes.filter(n => n.type === 'document') as DocumentNode[],
      businessNodes: nodes.filter(n => n.type === 'business') as BusinessNode[]
    };
  }

  // Additional placeholder methods
  private getRecentFileModifications(nodes: CodeNode[]): any[] { return []; }
  private buildDependencyGraph(nodes: CodeNode[]): Map<string, string[]> { return new Map(); }
  private findFunctionCallChains(nodes: CodeNode[]): any[] { return []; }
  private detectCodePatterns(nodes: CodeNode[]): any[] { return []; }
  private findRelevantDocumentSections(nodes: DocumentNode[], message: ParsedMessage): any[] { return []; }
  private identifyNodeClusters(nodes: AnyGraphNode[], edges: GraphEdge[]): NodeCluster[] { return []; }
  private findContextPathways(nodes: AnyGraphNode[], edges: GraphEdge[]): ContextPathway[] { return []; }
  private findCentralNodes(nodes: AnyGraphNode[], edges: GraphEdge[]): string[] { return []; }

  private generateCacheKey(message: ParsedMessage, options: ContextExtractionOptions): string {
    return `${message.content.substring(0, 50)}-${JSON.stringify(options)}`;
  }

  private getCachedContext(key: string): ExtractedContext | null {
    const expiry = this.cacheExpiry.get(key);
    if (expiry && expiry > Date.now()) {
      return this.contextCache.get(key) || null;
    }
    return null;
  }

  private cacheContext(key: string, context: ExtractedContext): void {
    this.contextCache.set(key, context);
    this.cacheExpiry.set(key, Date.now() + 5 * 60 * 1000); // 5 minute cache
  }

  private generateFilterCriteria(options: Required<ContextExtractionOptions>): string[] {
    const criteria: string[] = [];
    if (!options.includeCode) criteria.push('exclude-code');
    if (!options.includeDocuments) criteria.push('exclude-documents');
    if (!options.includeBusiness) criteria.push('exclude-business');
    if (!options.includeHistorical) criteria.push('exclude-historical');
    return criteria;
  }

  private reconstructParsedMessage(messageNode: MessageNode): ParsedMessage {
    // Simplified reconstruction - in practice would restore full parsed data
    return {
      content: messageNode.content,
      contentType: messageNode.metadata.contentType || 'text',
      codeBlocks: [],
      inlineCode: [],
      links: [],
      mentions: [],
      entities: messageNode.metadata.entities || [],
      isQuestion: false,
      hasErrorContent: messageNode.metadata.contentType === 'error',
      hasCommandIntent: false,
      hasFileReference: false,
      sections: [],
      sentiment: 'neutral',
      intent: { primary: 'information', confidence: 0.5, keywords: [] },
      urgency: 'low',
      complexity: 0.5
    };
  }
}