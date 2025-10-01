/**
 * Related Conversations Finder
 *
 * Finds similar conversations based on:
 * - Shared code file references (high weight)
 * - Common topics (medium weight)
 * - Similar message patterns (low weight)
 * - Participant overlap (low weight)
 */

import { GraphStore } from '../GraphStore';
import { ConversationNode } from '../types/NodeTypes';

export interface RelatedConversation {
  id: string;
  title: string;
  similarity: number;          // 0-1
  sharedTopics: string[];
  sharedCodeFiles: string[];
  messageCount: number;
  lastUpdated: Date;
}

export interface SimilarityOptions {
  minSimilarity?: number;      // Minimum similarity score (0-1)
  maxResults?: number;         // Maximum number of results
  includeArchived?: boolean;   // Include archived conversations
}

/**
 * Finds related conversations using multiple similarity metrics
 */
export class RelatedConversationsFinder {
  private store: GraphStore;

  // Weights for different similarity factors
  private readonly WEIGHT_CODE_FILES = 0.5;
  private readonly WEIGHT_TOPICS = 0.3;
  private readonly WEIGHT_PARTICIPANTS = 0.1;
  private readonly WEIGHT_PATTERNS = 0.1;

  constructor(store: GraphStore) {
    this.store = store;
  }

  /**
   * Find conversations related to the given conversation
   */
  findRelated(
    conversationId: string,
    options: SimilarityOptions = {}
  ): RelatedConversation[] {
    const {
      minSimilarity = 0.3,
      maxResults = 10,
      includeArchived = false
    } = options;

    const targetConv = this.getConversationData(conversationId);
    if (!targetConv) {
      return [];
    }

    const allConversations = this.getAllConversations();
    const relatedConversations: RelatedConversation[] = [];

    for (const conv of allConversations) {
      // Skip self and archived (if not included)
      if (conv.id === conversationId) continue;
      if (!includeArchived && conv.archived) continue;

      const similarity = this.calculateSimilarity(targetConv, conv);

      if (similarity >= minSimilarity) {
        const sharedTopics = this.getSharedTopics(targetConv, conv);
        const sharedCodeFiles = this.getSharedCodeFiles(targetConv, conv);

        relatedConversations.push({
          id: conv.id,
          title: conv.title,
          similarity,
          sharedTopics,
          sharedCodeFiles,
          messageCount: conv.messageCount,
          lastUpdated: conv.lastUpdated
        });
      }
    }

    // Sort by similarity (descending)
    relatedConversations.sort((a, b) => b.similarity - a.similarity);

    // Return top results
    return relatedConversations.slice(0, maxResults);
  }

  /**
   * Calculate overall similarity between two conversations
   */
  calculateSimilarity(conv1: ConversationData, conv2: ConversationData): number {
    const codeSimilarity = this.calculateCodeFileSimilarity(conv1, conv2);
    const topicSimilarity = this.calculateTopicSimilarity(conv1, conv2);
    const participantSimilarity = this.calculateParticipantSimilarity(conv1, conv2);
    const patternSimilarity = this.calculatePatternSimilarity(conv1, conv2);

    const weightedScore =
      codeSimilarity * this.WEIGHT_CODE_FILES +
      topicSimilarity * this.WEIGHT_TOPICS +
      participantSimilarity * this.WEIGHT_PARTICIPANTS +
      patternSimilarity * this.WEIGHT_PATTERNS;

    return Math.min(weightedScore, 1);
  }

  /**
   * Get shared topics between two conversations
   */
  getSharedTopics(conv1: ConversationData, conv2: ConversationData): string[] {
    const topics1 = new Set(conv1.topics);
    const topics2 = new Set(conv2.topics);

    return Array.from(topics1).filter(topic => topics2.has(topic));
  }

  /**
   * Get shared code files between two conversations
   */
  getSharedCodeFiles(conv1: ConversationData, conv2: ConversationData): string[] {
    const files1 = new Set(conv1.codeFiles);
    const files2 = new Set(conv2.codeFiles);

    return Array.from(files1).filter(file => files2.has(file));
  }

  /**
   * Calculate code file similarity (Jaccard index)
   */
  private calculateCodeFileSimilarity(conv1: ConversationData, conv2: ConversationData): number {
    const files1 = new Set(conv1.codeFiles);
    const files2 = new Set(conv2.codeFiles);

    if (files1.size === 0 && files2.size === 0) return 0;

    const intersection = new Set(
      Array.from(files1).filter(file => files2.has(file))
    );
    const union = new Set([...Array.from(files1), ...Array.from(files2)]);

    return intersection.size / union.size;
  }

  /**
   * Calculate topic similarity (Jaccard index)
   */
  private calculateTopicSimilarity(conv1: ConversationData, conv2: ConversationData): number {
    const topics1 = new Set(conv1.topics);
    const topics2 = new Set(conv2.topics);

    if (topics1.size === 0 && topics2.size === 0) return 0;

    const intersection = new Set(
      Array.from(topics1).filter(topic => topics2.has(topic))
    );
    const union = new Set([...Array.from(topics1), ...Array.from(topics2)]);

    return intersection.size / union.size;
  }

  /**
   * Calculate participant similarity
   */
  private calculateParticipantSimilarity(conv1: ConversationData, conv2: ConversationData): number {
    const participants1 = new Set(conv1.participants);
    const participants2 = new Set(conv2.participants);

    if (participants1.size === 0 && participants2.size === 0) return 0;

    const intersection = new Set(
      Array.from(participants1).filter(p => participants2.has(p))
    );
    const union = new Set([...Array.from(participants1), ...Array.from(participants2)]);

    return intersection.size / union.size;
  }

  /**
   * Calculate message pattern similarity (cosine similarity of message lengths)
   */
  private calculatePatternSimilarity(conv1: ConversationData, conv2: ConversationData): number {
    // Simple pattern: ratio of user to assistant messages
    const ratio1 = conv1.userMessageCount / (conv1.assistantMessageCount || 1);
    const ratio2 = conv2.userMessageCount / (conv2.assistantMessageCount || 1);

    // Normalize difference to 0-1 similarity score
    const difference = Math.abs(ratio1 - ratio2);
    const maxDifference = Math.max(ratio1, ratio2, 1);

    return 1 - (difference / maxDifference);
  }

  /**
   * Get conversation data for analysis
   */
  private getConversationData(conversationId: string): ConversationData | null {
    const node = this.store.getNode(conversationId);
    if (!node || node.type !== 'conversation') return null;

    const messages = this.getConversationMessages(conversationId);
    const codeFiles = this.getConversationCodeFiles(conversationId);
    const topics = this.extractConversationTopics(messages);
    const participants = this.getConversationParticipants(conversationId);

    let userMessageCount = 0;
    let assistantMessageCount = 0;

    for (const msg of messages) {
      const role = (msg as any).metadata?.role;
      if (role === 'user') userMessageCount++;
      if (role === 'assistant') assistantMessageCount++;
    }

    return {
      id: conversationId,
      title: node.label,
      messages,
      codeFiles,
      topics,
      participants,
      messageCount: messages.length,
      userMessageCount,
      assistantMessageCount,
      lastUpdated: this.getLastMessageDate(messages),
      archived: false  // TODO: Get from metadata
    };
  }

  /**
   * Get all messages in a conversation
   */
  private getConversationMessages(conversationId: string): ConversationNode[] {
    const edges = this.store.getAllEdges();
    const messageIds = edges
      .filter((e: any) =>
        e.source === conversationId &&
        e.type === 'relates_to' &&
        e.metadata?.relationship === 'contains'
      )
      .map((e: any) => e.target);

    return messageIds
      .map(id => this.store.getNode(id))
      .filter(node => node && node.type === 'conversation') as ConversationNode[];
  }

  /**
   * Get all code files referenced in a conversation
   */
  private getConversationCodeFiles(conversationId: string): string[] {
    const messages = this.getConversationMessages(conversationId);
    const codeFiles = new Set<string>();

    for (const message of messages) {
      const edges = this.store.getAllEdges();
      const codeEdges = edges.filter((e: any) =>
        e.source === message.id && e.type === 'references'
      );

      for (const edge of codeEdges) {
        const codeNode = this.store.getNode((edge as any).target);
        if (codeNode) {
          const filePath = (codeNode as any).filePath || (codeNode as any).id;
          codeFiles.add(filePath);
        }
      }
    }

    return Array.from(codeFiles);
  }

  /**
   * Extract topics from conversation messages
   */
  private extractConversationTopics(messages: ConversationNode[]): string[] {
    const topicCounts = new Map<string, number>();

    for (const message of messages) {
      const content = message.content || '';
      const words = content
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length > 4);  // Only longer words

      for (const word of words) {
        topicCounts.set(word, (topicCounts.get(word) || 0) + 1);
      }
    }

    // Return top 10 topics
    return Array.from(topicCounts.entries())
      .filter(([_, count]) => count > 2)  // Appears more than twice
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([topic]) => topic);
  }

  /**
   * Get conversation participants
   */
  private getConversationParticipants(conversationId: string): string[] {
    const node = this.store.getNode(conversationId) as ConversationNode;
    return node?.participants || [];
  }

  /**
   * Get date of last message
   */
  private getLastMessageDate(messages: ConversationNode[]): Date {
    if (messages.length === 0) return new Date();

    const dates = messages
      .map(msg => msg.timestamp)
      .filter(Boolean) as Date[];

    if (dates.length === 0) return new Date();

    return new Date(Math.max(...dates.map(d => d.getTime())));
  }

  /**
   * Get all conversations
   */
  private getAllConversations(): ConversationData[] {
    const nodes = this.store.getAllNodes();
    const conversations: ConversationData[] = [];

    for (const node of nodes) {
      if (node.type === 'conversation' && (node as ConversationNode).conversationType !== 'message') {
        const data = this.getConversationData(node.id);
        if (data) {
          conversations.push(data);
        }
      }
    }

    return conversations;
  }
}

/**
 * Internal conversation data structure
 */
interface ConversationData {
  id: string;
  title: string;
  messages: ConversationNode[];
  codeFiles: string[];
  topics: string[];
  participants: string[];
  messageCount: number;
  userMessageCount: number;
  assistantMessageCount: number;
  lastUpdated: Date;
  archived: boolean;
}
