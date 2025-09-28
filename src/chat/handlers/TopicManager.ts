/**
 * Topic manager for extracting, tracking and connecting conversation topics
 */

import { GraphStore } from '../../core/graph-engine/GraphStore';
import { createConversationNode, AnyGraphNode } from '../../core/graph-engine/types/NodeTypes';
import { GraphEdge } from '../../core/graph-engine/types/EdgeTypes';
import { MessageNode } from '../models/MessageNode';
import { ParsedMessage } from '../parsers/MessageParser';
import { ConversationTopic } from '../models/ChatGraphStructure';

export interface TopicExtraction {
  topic: ConversationTopic;
  confidence: number;
  evidence: string[];
  relatedNodes: string[];
}

export interface TopicCluster {
  id: string;
  centralTopic: string;
  relatedTopics: string[];
  conversations: string[];
  messages: string[];
  strength: number;
  category: 'technical' | 'business' | 'procedural' | 'problem-solving';
}

export interface TopicEvolution {
  topic: string;
  stages: Array<{
    period: string;
    messageCount: number;
    keyTerms: string[];
    sentiment: 'positive' | 'negative' | 'neutral';
  }>;
  trend: 'growing' | 'stable' | 'declining';
}

export interface TopicAnalysisResult {
  extractedTopics: TopicExtraction[];
  topicClusters: TopicCluster[];
  topicEvolutions: TopicEvolution[];
  recommendations: TopicRecommendation[];
}

export interface TopicRecommendation {
  type: 'merge' | 'split' | 'clarify' | 'expand';
  description: string;
  topicIds: string[];
  confidence: number;
}

/**
 * Manages topic extraction, clustering, and evolution tracking
 */
export class TopicManager {
  private graphStore: GraphStore;
  private topics: Map<string, ConversationTopic>;
  private topicClusters: Map<string, TopicCluster>;
  private messageTopics: Map<string, string[]>; // messageId -> topicIds

  constructor(graphStore: GraphStore) {
    this.graphStore = graphStore;
    this.topics = new Map();
    this.topicClusters = new Map();
    this.messageTopics = new Map();
  }

  /**
   * Process a message and extract topics
   */
  async processMessage(
    message: MessageNode,
    parsedMessage: ParsedMessage,
    conversationId: string,
    conversationHistory: MessageNode[] = []
  ): Promise<TopicExtractionResult> {
    const result: TopicExtractionResult = {
      extractedTopics: [],
      updatedTopics: [],
      newTopics: [],
      topicConnections: [],
      errors: []
    };

    try {
      // Extract topics from the message
      const extractedTopics = await this.extractTopicsFromMessage(message, parsedMessage);

      // Process each extracted topic
      for (const extraction of extractedTopics) {
        const topic = extraction.topic;

        // Check if topic already exists
        const existingTopic = this.findExistingTopic(topic.name, topic.keywords);

        if (existingTopic) {
          // Update existing topic
          this.updateTopic(existingTopic, message, conversationId);
          result.updatedTopics.push(existingTopic);
        } else {
          // Create new topic
          const newTopic = await this.createTopic(topic, message, conversationId);
          result.newTopics.push(newTopic);
        }

        result.extractedTopics.push(extraction);
      }

      // Connect topics to message
      const topicIds = [...result.updatedTopics, ...result.newTopics].map(t => t.id);
      this.messageTopics.set(message.id, topicIds);

      // Create topic connections
      result.topicConnections = await this.createTopicConnections(
        message,
        topicIds,
        conversationHistory
      );

      // Update topic clusters
      await this.updateTopicClusters(topicIds);

      return result;

    } catch (error) {
      result.errors.push(`Topic processing failed: ${error instanceof Error ? error.message : String(error)}`);
      return result;
    }
  }

  /**
   * Extract topics from a message
   */
  private async extractTopicsFromMessage(
    message: MessageNode,
    parsedMessage: ParsedMessage
  ): Promise<TopicExtraction[]> {
    const extractions: TopicExtraction[] = [];

    // Extract from entities
    for (const entity of parsedMessage.entities) {
      if (entity.confidence > 0.6) {
        const topicName = this.normalizeTopicName(entity.text);
        const extraction = await this.createTopicExtraction(
          topicName,
          entity.type === 'framework' ? 'technical' : 'business',
          [entity.text],
          entity.confidence,
          [entity.text]
        );
        extractions.push(extraction);
      }
    }

    // Extract from intent keywords
    if (parsedMessage.intent.keywords.length > 0) {
      const topicName = this.normalizeTopicName(parsedMessage.intent.keywords[0]);
      const extraction = await this.createTopicExtraction(
        topicName,
        this.categorizeByIntent(parsedMessage.intent.primary),
        parsedMessage.intent.keywords,
        parsedMessage.intent.confidence,
        parsedMessage.intent.keywords
      );
      extractions.push(extraction);
    }

    // Extract from code blocks (programming topics)
    for (const codeBlock of parsedMessage.codeBlocks) {
      if (codeBlock.language && codeBlock.language !== 'text') {
        const topicName = `${codeBlock.language} programming`;
        const keywords = [codeBlock.language, ...codeBlock.functions, ...codeBlock.classes];
        const extraction = await this.createTopicExtraction(
          topicName,
          'technical',
          keywords,
          0.8,
          [codeBlock.code.substring(0, 100)]
        );
        extractions.push(extraction);
      }
    }

    // Extract from error content
    if (parsedMessage.hasErrorContent) {
      const extraction = await this.createTopicExtraction(
        'error debugging',
        'problem-solving',
        ['error', 'debug', 'troubleshoot'],
        0.9,
        ['Error content detected in message']
      );
      extractions.push(extraction);
    }

    // Extract using NLP-like term extraction
    const nlpTopics = this.extractTopicsUsingNLP(parsedMessage.content);
    for (const nlpTopic of nlpTopics) {
      extractions.push(nlpTopic);
    }

    return this.deduplicateTopicExtractions(extractions);
  }

  /**
   * Extract topics using simple NLP techniques
   */
  private extractTopicsUsingNLP(content: string): TopicExtraction[] {
    const extractions: TopicExtraction[] = [];

    // Technical term patterns
    const techPatterns = {
      'react development': /react|jsx|component|hook|prop/gi,
      'database management': /database|sql|query|table|schema/gi,
      'api development': /api|endpoint|rest|graphql|http/gi,
      'testing': /test|testing|unit|integration|mock/gi,
      'deployment': /deploy|deployment|production|staging|ci\/cd/gi,
      'authentication': /auth|authentication|login|token|jwt/gi,
      'performance': /performance|optimization|slow|fast|cache/gi,
      'security': /security|vulnerability|encrypt|decrypt|secure/gi
    };

    for (const [topic, pattern] of Object.entries(techPatterns)) {
      const matches = content.match(pattern);
      if (matches && matches.length >= 2) {
        const confidence = Math.min(0.9, matches.length * 0.2);
        extractions.push({
          topic: {
            id: this.generateTopicId(topic),
            name: topic,
            description: `Discussion about ${topic}`,
            keywords: [...new Set(matches.map(m => m.toLowerCase()))],
            conversationIds: [],
            messageIds: [],
            confidence,
            category: 'technical'
          },
          confidence,
          evidence: matches.slice(0, 3),
          relatedNodes: []
        });
      }
    }

    // Business term patterns
    const businessPatterns = {
      'project management': /project|manage|deadline|milestone|sprint/gi,
      'requirements analysis': /requirement|spec|specification|feature|functionality/gi,
      'user experience': /user|ux|ui|interface|design|usability/gi,
      'business logic': /business|logic|rule|process|workflow/gi
    };

    for (const [topic, pattern] of Object.entries(businessPatterns)) {
      const matches = content.match(pattern);
      if (matches && matches.length >= 2) {
        const confidence = Math.min(0.8, matches.length * 0.15);
        extractions.push({
          topic: {
            id: this.generateTopicId(topic),
            name: topic,
            description: `Discussion about ${topic}`,
            keywords: [...new Set(matches.map(m => m.toLowerCase()))],
            conversationIds: [],
            messageIds: [],
            confidence,
            category: 'business'
          },
          confidence,
          evidence: matches.slice(0, 3),
          relatedNodes: []
        });
      }
    }

    return extractions;
  }

  /**
   * Create a topic extraction
   */
  private async createTopicExtraction(
    name: string,
    category: ConversationTopic['category'],
    keywords: string[],
    confidence: number,
    evidence: string[]
  ): Promise<TopicExtraction> {
    const topic: ConversationTopic = {
      id: this.generateTopicId(name),
      name,
      description: `Discussion topic: ${name}`,
      keywords: [...new Set(keywords.map(k => k.toLowerCase()))],
      conversationIds: [],
      messageIds: [],
      confidence,
      category
    };

    return {
      topic,
      confidence,
      evidence,
      relatedNodes: []
    };
  }

  /**
   * Find existing topic by name and keywords
   */
  private findExistingTopic(name: string, keywords: string[]): ConversationTopic | null {
    const normalizedName = this.normalizeTopicName(name);
    const normalizedKeywords = new Set(keywords.map(k => k.toLowerCase()));

    for (const topic of this.topics.values()) {
      // Check name similarity
      if (this.normalizeTopicName(topic.name) === normalizedName) {
        return topic;
      }

      // Check keyword overlap
      const topicKeywords = new Set(topic.keywords);
      const intersection = new Set([...normalizedKeywords].filter(x => topicKeywords.has(x)));
      const union = new Set([...normalizedKeywords, ...topicKeywords]);

      if (union.size > 0 && (intersection.size / union.size) > 0.6) {
        return topic;
      }
    }

    return null;
  }

  /**
   * Create a new topic
   */
  private async createTopic(
    topicData: ConversationTopic,
    message: MessageNode,
    conversationId: string
  ): Promise<ConversationTopic> {
    const topic: ConversationTopic = {
      ...topicData,
      conversationIds: [conversationId],
      messageIds: [message.id]
    };

    // Create topic node in graph
    const topicNode = createConversationNode({
      id: topic.id,
      label: `Topic: ${topic.name}`,
      description: topic.description,
      metadata: {
        isTopic: true,
        topic: topic.name,
        category: topic.category,
        keywords: topic.keywords,
        confidence: topic.confidence,
        conversationCount: 1,
        messageCount: 1
      },
      messages: [],
      participants: [],
      startTime: message.startTime,
      endTime: message.endTime
    });

    this.graphStore.addNode(topicNode);

    // Create edges
    this.createTopicEdges(topic, message, conversationId);

    this.topics.set(topic.id, topic);
    return topic;
  }

  /**
   * Update existing topic
   */
  private updateTopic(
    topic: ConversationTopic,
    message: MessageNode,
    conversationId: string
  ): void {
    // Add conversation and message
    if (!topic.conversationIds.includes(conversationId)) {
      topic.conversationIds.push(conversationId);
    }
    topic.messageIds.push(message.id);

    // Update topic node
    const topicNode = this.graphStore.getNode(topic.id);
    if (topicNode && topicNode.metadata) {
      topicNode.metadata.conversationCount = topic.conversationIds.length;
      topicNode.metadata.messageCount = topic.messageIds.length;
      topicNode.metadata.updatedAt = new Date();
    }

    // Create edges
    this.createTopicEdges(topic, message, conversationId);
  }

  /**
   * Create edges for topic connections
   */
  private createTopicEdges(
    topic: ConversationTopic,
    message: MessageNode,
    conversationId: string
  ): void {
    // Message mentions topic
    this.graphStore.addEdge({
      id: `${message.id}-mentions-${topic.id}`,
      source: message.id,
      target: topic.id,
      type: 'mentions',
      bidirectional: false,
      weight: topic.confidence
    });

    // Conversation discusses topic
    this.graphStore.addEdge({
      id: `${conversationId}-discusses-${topic.id}`,
      source: conversationId,
      target: topic.id,
      type: 'discusses',
      bidirectional: false,
      weight: topic.confidence * 0.8
    });
  }

  /**
   * Create connections between related topics
   */
  private async createTopicConnections(
    message: MessageNode,
    currentTopicIds: string[],
    conversationHistory: MessageNode[]
  ): Promise<Array<{ sourceId: string; targetId: string; strength: number }>> {
    const connections: Array<{ sourceId: string; targetId: string; strength: number }> = [];

    // Connect topics mentioned in the same message
    for (let i = 0; i < currentTopicIds.length; i++) {
      for (let j = i + 1; j < currentTopicIds.length; j++) {
        const connection = {
          sourceId: currentTopicIds[i],
          targetId: currentTopicIds[j],
          strength: 0.7
        };

        this.createTopicConnectionEdge(connection);
        connections.push(connection);
      }
    }

    // Connect with recent topics from conversation
    const recentMessages = conversationHistory.slice(-5);
    for (const recentMessage of recentMessages) {
      const recentTopicIds = this.messageTopics.get(recentMessage.id) || [];

      for (const currentId of currentTopicIds) {
        for (const recentId of recentTopicIds) {
          if (currentId !== recentId) {
            const connection = {
              sourceId: currentId,
              targetId: recentId,
              strength: 0.5
            };

            this.createTopicConnectionEdge(connection);
            connections.push(connection);
          }
        }
      }
    }

    return connections;
  }

  /**
   * Create edge between topics
   */
  private createTopicConnectionEdge(connection: { sourceId: string; targetId: string; strength: number }): void {
    const edgeId = `${connection.sourceId}-relates-${connection.targetId}`;

    // Check if edge already exists
    if (this.graphStore.getEdge(edgeId)) {
      return;
    }

    this.graphStore.addEdge({
      id: edgeId,
      source: connection.sourceId,
      target: connection.targetId,
      type: 'relates',
      bidirectional: true,
      weight: connection.strength
    });
  }

  /**
   * Update topic clusters
   */
  private async updateTopicClusters(topicIds: string[]): Promise<void> {
    // Simple clustering based on keyword overlap
    for (const topicId of topicIds) {
      const topic = this.topics.get(topicId);
      if (!topic) continue;

      // Find or create cluster
      let cluster = this.findTopicCluster(topic);
      if (!cluster) {
        cluster = this.createTopicCluster(topic);
      }

      // Update cluster
      this.updateTopicCluster(cluster, topic);
    }
  }

  /**
   * Find topic cluster for a topic
   */
  private findTopicCluster(topic: ConversationTopic): TopicCluster | null {
    for (const cluster of this.topicClusters.values()) {
      if (cluster.category === topic.category) {
        // Check keyword overlap
        const clusterKeywords = new Set(cluster.relatedTopics.flatMap(t =>
          this.topics.get(t)?.keywords || []
        ));
        const topicKeywords = new Set(topic.keywords);
        const intersection = new Set([...topicKeywords].filter(x => clusterKeywords.has(x)));

        if (intersection.size > 0) {
          return cluster;
        }
      }
    }
    return null;
  }

  /**
   * Create new topic cluster
   */
  private createTopicCluster(topic: ConversationTopic): TopicCluster {
    const cluster: TopicCluster = {
      id: `cluster-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      centralTopic: topic.name,
      relatedTopics: [topic.id],
      conversations: [...topic.conversationIds],
      messages: [...topic.messageIds],
      strength: topic.confidence,
      category: topic.category
    };

    this.topicClusters.set(cluster.id, cluster);
    return cluster;
  }

  /**
   * Update existing cluster
   */
  private updateTopicCluster(cluster: TopicCluster, topic: ConversationTopic): void {
    if (!cluster.relatedTopics.includes(topic.id)) {
      cluster.relatedTopics.push(topic.id);
    }

    // Add unique conversations and messages
    for (const convId of topic.conversationIds) {
      if (!cluster.conversations.includes(convId)) {
        cluster.conversations.push(convId);
      }
    }

    for (const msgId of topic.messageIds) {
      if (!cluster.messages.includes(msgId)) {
        cluster.messages.push(msgId);
      }
    }

    // Recalculate strength
    const totalTopics = cluster.relatedTopics.length;
    const totalConfidence = cluster.relatedTopics.reduce((sum, topicId) => {
      const t = this.topics.get(topicId);
      return sum + (t?.confidence || 0);
    }, 0);

    cluster.strength = totalTopics > 0 ? totalConfidence / totalTopics : 0;
  }

  /**
   * Analyze topics across conversations
   */
  async analyzeTopics(): Promise<TopicAnalysisResult> {
    const extractedTopics = Array.from(this.topics.values()).map(topic => ({
      topic,
      confidence: topic.confidence,
      evidence: topic.keywords,
      relatedNodes: []
    }));

    const topicClusters = Array.from(this.topicClusters.values());
    const topicEvolutions = this.analyzeTopicEvolutions();
    const recommendations = this.generateTopicRecommendations();

    return {
      extractedTopics,
      topicClusters,
      topicEvolutions,
      recommendations
    };
  }

  /**
   * Analyze how topics evolve over time
   */
  private analyzeTopicEvolutions(): TopicEvolution[] {
    const evolutions: TopicEvolution[] = [];

    for (const topic of this.topics.values()) {
      if (topic.messageIds.length < 3) continue; // Need minimum messages for evolution

      const evolution: TopicEvolution = {
        topic: topic.name,
        stages: [],
        trend: 'stable'
      };

      // Simple analysis - would be more sophisticated with actual timestamps
      const messageCount = topic.messageIds.length;
      evolution.stages.push({
        period: 'recent',
        messageCount,
        keyTerms: topic.keywords.slice(0, 5),
        sentiment: 'neutral' // Would analyze actual sentiment
      });

      // Determine trend
      if (messageCount > 10) evolution.trend = 'growing';
      else if (messageCount < 3) evolution.trend = 'declining';

      evolutions.push(evolution);
    }

    return evolutions;
  }

  /**
   * Generate recommendations for topic management
   */
  private generateTopicRecommendations(): TopicRecommendation[] {
    const recommendations: TopicRecommendation[] = [];

    // Find topics that might need merging
    const topics = Array.from(this.topics.values());
    for (let i = 0; i < topics.length; i++) {
      for (let j = i + 1; j < topics.length; j++) {
        const similarity = this.calculateTopicSimilarity(topics[i], topics[j]);
        if (similarity > 0.8) {
          recommendations.push({
            type: 'merge',
            description: `Consider merging similar topics: "${topics[i].name}" and "${topics[j].name}"`,
            topicIds: [topics[i].id, topics[j].id],
            confidence: similarity
          });
        }
      }
    }

    return recommendations;
  }

  /**
   * Helper methods
   */
  private calculateTopicSimilarity(topic1: ConversationTopic, topic2: ConversationTopic): number {
    const keywords1 = new Set(topic1.keywords);
    const keywords2 = new Set(topic2.keywords);

    const intersection = new Set([...keywords1].filter(x => keywords2.has(x)));
    const union = new Set([...keywords1, ...keywords2]);

    return union.size > 0 ? intersection.size / union.size : 0;
  }

  private normalizeTopicName(name: string): string {
    return name.toLowerCase().trim().replace(/\s+/g, ' ');
  }

  private generateTopicId(name: string): string {
    const normalized = name.toLowerCase().replace(/[^a-z0-9]/g, '-');
    return `topic-${normalized}-${Date.now()}`;
  }

  private categorizeByIntent(intent: string): ConversationTopic['category'] {
    const categories = {
      'question': 'technical',
      'error-report': 'problem-solving',
      'explanation': 'technical',
      'request': 'procedural'
    };
    return categories[intent as keyof typeof categories] || 'technical';
  }

  private deduplicateTopicExtractions(extractions: TopicExtraction[]): TopicExtraction[] {
    const seen = new Map<string, TopicExtraction>();

    for (const extraction of extractions) {
      const key = this.normalizeTopicName(extraction.topic.name);
      const existing = seen.get(key);

      if (!existing || extraction.confidence > existing.confidence) {
        seen.set(key, extraction);
      }
    }

    return Array.from(seen.values());
  }

  /**
   * Public query methods
   */
  getTopic(id: string): ConversationTopic | undefined {
    return this.topics.get(id);
  }

  getTopicsByConversation(conversationId: string): ConversationTopic[] {
    return Array.from(this.topics.values())
      .filter(topic => topic.conversationIds.includes(conversationId));
  }

  getTopicsByCategory(category: ConversationTopic['category']): ConversationTopic[] {
    return Array.from(this.topics.values())
      .filter(topic => topic.category === category);
  }

  getTopicCluster(id: string): TopicCluster | undefined {
    return this.topicClusters.get(id);
  }

  searchTopics(query: string): ConversationTopic[] {
    const lowerQuery = query.toLowerCase();
    return Array.from(this.topics.values())
      .filter(topic =>
        topic.name.toLowerCase().includes(lowerQuery) ||
        topic.keywords.some(keyword => keyword.includes(lowerQuery))
      )
      .sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Cleanup
   */
  clearTopics(): void {
    this.topics.clear();
    this.topicClusters.clear();
    this.messageTopics.clear();
  }

  removeTopicsForConversation(conversationId: string): void {
    for (const [id, topic] of this.topics.entries()) {
      topic.conversationIds = topic.conversationIds.filter(cid => cid !== conversationId);
      if (topic.conversationIds.length === 0) {
        this.topics.delete(id);
      }
    }
  }
}

/**
 * Type definitions for topic extraction results
 */
export interface TopicExtractionResult {
  extractedTopics: TopicExtraction[];
  updatedTopics: ConversationTopic[];
  newTopics: ConversationTopic[];
  topicConnections: Array<{ sourceId: string; targetId: string; strength: number }>;
  errors: string[];
}