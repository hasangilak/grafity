/**
 * Chat graph structure for managing conversation trees and relationships
 */

import { GraphStore } from '../../core/graph-engine/GraphStore';
import { GraphEdge } from '../../core/graph-engine/types/EdgeTypes';
import { AnyGraphNode } from '../../core/graph-engine/types/NodeTypes';
import { ChatConversationNode } from './ConversationNode';
import { MessageNode, MessageBranch, getBranchPaths, getConversationPath } from './MessageNode';

export interface ChatGraphNode extends AnyGraphNode {
  chatType?: 'conversation' | 'message' | 'topic' | 'reference';
}

export interface ConversationReference {
  conversationId: string;
  messageId?: string;
  nodeId: string;
  nodeType: 'code' | 'document' | 'business';
  referenceType: 'mention' | 'explicit' | 'generated' | 'context';
  confidence: number;
  extractedText?: string;
  context?: string;
}

export interface ConversationTopic {
  id: string;
  name: string;
  description?: string;
  keywords: string[];
  conversationIds: string[];
  messageIds: string[];
  confidence: number;
  category: 'technical' | 'business' | 'procedural' | 'problem-solving';
}

export interface ChatGraphMetrics {
  totalConversations: number;
  totalMessages: number;
  totalTopics: number;
  totalReferences: number;
  averageConversationDepth: number;
  averageBranchingFactor: number;
  connectivityDensity: number;
  topicDistribution: Map<string, number>;
  referenceTypes: Map<string, number>;
}

/**
 * Specialized graph for managing chat conversations and their relationships
 */
export class ChatGraphStructure {
  private graphStore: GraphStore;
  private conversations: Map<string, ChatConversationNode>;
  private topics: Map<string, ConversationTopic>;
  private references: Map<string, ConversationReference>;

  constructor(graphStore?: GraphStore) {
    this.graphStore = graphStore || new GraphStore();
    this.conversations = new Map();
    this.topics = new Map();
    this.references = new Map();
  }

  /**
   * Conversation management
   */
  addConversation(conversation: ChatConversationNode): void {
    this.conversations.set(conversation.id, conversation);
    this.graphStore.addNode(conversation);
  }

  getConversation(id: string): ChatConversationNode | undefined {
    return this.conversations.get(id);
  }

  addMessage(conversationId: string, message: MessageNode, branchId?: string): void {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) return;

    // Add message to graph
    this.graphStore.addNode(message);

    // Update conversation structure
    const targetBranchId = branchId || conversation.activeBranchId;
    const branch = conversation.branches.get(targetBranchId);
    if (!branch) return;

    conversation.messages.set(message.id, message);
    branch.messageIds.push(message.id);

    // Create edges
    this.createMessageEdges(conversation, message);

    // Update conversation metadata
    this.updateConversationMetadata(conversation);
  }

  /**
   * Create edges for message relationships
   */
  private createMessageEdges(conversation: ChatConversationNode, message: MessageNode): void {
    // Message belongs to conversation
    this.graphStore.addEdge({
      id: `${conversation.id}-contains-${message.id}`,
      source: conversation.id,
      target: message.id,
      type: 'contains',
      bidirectional: false,
      weight: 1,
      metadata: {
        messageIndex: message.messageIndex,
        branch: conversation.activeBranchId
      }
    });

    // Message follows previous message
    if (message.parentMessageId) {
      this.graphStore.addEdge({
        id: `${message.parentMessageId}-follows-${message.id}`,
        source: message.parentMessageId,
        target: message.id,
        type: 'follows',
        bidirectional: false,
        weight: 1,
        metadata: {
          timeDelta: this.calculateTimeDelta(message.parentMessageId, message.id)
        }
      });

      // Create response relationship for user-assistant pairs
      const parent = conversation.messages.get(message.parentMessageId);
      if (parent) {
        if (parent.role === 'user' && message.role === 'assistant') {
          this.graphStore.addEdge({
            id: `${message.id}-responds-${parent.id}`,
            source: message.id,
            target: parent.id,
            type: 'responds',
            bidirectional: false,
            weight: 0.9
          });
        }
      }
    }
  }

  /**
   * Branch management
   */
  createBranch(
    conversationId: string,
    branchPointMessageId: string,
    title?: string
  ): string | null {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) return null;

    const branchId = `${conversationId}-branch-${Date.now()}`;
    const branch: MessageBranch = {
      id: branchId,
      messageIds: [],
      branchPoint: branchPointMessageId,
      created: new Date(),
      isActive: false,
      title: title || `Branch ${conversation.branches.size + 1}`,
      description: `Alternative conversation path`
    };

    conversation.branches.set(branchId, branch);

    // Create branch edge
    this.graphStore.addEdge({
      id: `${branchPointMessageId}-branches-${branchId}`,
      source: branchPointMessageId,
      target: branchId,
      type: 'branches',
      bidirectional: false,
      weight: 1,
      metadata: {
        branchTitle: branch.title,
        created: branch.created
      }
    });

    this.updateConversationMetadata(conversation);
    return branchId;
  }

  mergeBranches(
    conversationId: string,
    sourceBranchId: string,
    targetBranchId: string,
    mergeStrategy: 'sequential' | 'interleaved' | 'cherry-pick' = 'sequential'
  ): boolean {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) return false;

    const sourceBranch = conversation.branches.get(sourceBranchId);
    const targetBranch = conversation.branches.get(targetBranchId);
    if (!sourceBranch || !targetBranch) return false;

    switch (mergeStrategy) {
      case 'sequential':
        // Append source messages to target branch
        targetBranch.messageIds.push(...sourceBranch.messageIds);
        break;

      case 'interleaved':
        // Interleave messages by timestamp
        const sourceMessages = sourceBranch.messageIds.map(id => conversation.messages.get(id)!);
        const targetMessages = targetBranch.messageIds.map(id => conversation.messages.get(id)!);
        const merged = [...sourceMessages, ...targetMessages]
          .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
        targetBranch.messageIds = merged.map(m => m.id);
        break;

      case 'cherry-pick':
        // Custom merge logic would be handled by UI selection
        break;
    }

    // Create merge edge
    this.graphStore.addEdge({
      id: `${sourceBranchId}-merges-${targetBranchId}`,
      source: sourceBranchId,
      target: targetBranchId,
      type: 'merges',
      bidirectional: false,
      weight: 1,
      metadata: {
        strategy: mergeStrategy,
        mergedAt: new Date()
      }
    });

    // Remove source branch
    conversation.branches.delete(sourceBranchId);
    this.updateConversationMetadata(conversation);

    return true;
  }

  /**
   * Topic management
   */
  addTopic(topic: ConversationTopic): void {
    this.topics.set(topic.id, topic);

    // Create topic node
    const topicNode: ChatGraphNode = {
      id: topic.id,
      type: 'conversation',
      chatType: 'topic',
      label: topic.name,
      description: topic.description,
      metadata: {
        createdAt: new Date(),
        keywords: topic.keywords,
        category: topic.category,
        confidence: topic.confidence,
        conversationCount: topic.conversationIds.length,
        messageCount: topic.messageIds.length
      }
    };

    this.graphStore.addNode(topicNode);

    // Connect to conversations and messages
    for (const convId of topic.conversationIds) {
      this.graphStore.addEdge({
        id: `${convId}-discusses-${topic.id}`,
        source: convId,
        target: topic.id,
        type: 'discusses',
        bidirectional: false,
        weight: topic.confidence
      });
    }

    for (const msgId of topic.messageIds) {
      this.graphStore.addEdge({
        id: `${msgId}-mentions-${topic.id}`,
        source: msgId,
        target: topic.id,
        type: 'mentions',
        bidirectional: false,
        weight: topic.confidence * 0.8
      });
    }
  }

  getTopicsByConversation(conversationId: string): ConversationTopic[] {
    return Array.from(this.topics.values())
      .filter(topic => topic.conversationIds.includes(conversationId));
  }

  /**
   * Reference management
   */
  addReference(reference: ConversationReference): void {
    this.references.set(`${reference.conversationId}-${reference.nodeId}`, reference);

    // Create reference edge
    const edgeId = `${reference.conversationId}-references-${reference.nodeId}`;

    this.graphStore.addEdge({
      id: edgeId,
      source: reference.conversationId,
      target: reference.nodeId,
      type: 'references',
      bidirectional: false,
      weight: reference.confidence,
      metadata: {
        referenceType: reference.referenceType,
        extractedText: reference.extractedText,
        context: reference.context,
        messageId: reference.messageId
      }
    });

    // If message-specific, also create message-to-node edge
    if (reference.messageId) {
      this.graphStore.addEdge({
        id: `${reference.messageId}-cites-${reference.nodeId}`,
        source: reference.messageId,
        target: reference.nodeId,
        type: 'cites',
        bidirectional: false,
        weight: reference.confidence,
        metadata: {
          referenceType: reference.referenceType,
          extractedText: reference.extractedText
        }
      });
    }
  }

  getReferencesByConversation(conversationId: string): ConversationReference[] {
    return Array.from(this.references.values())
      .filter(ref => ref.conversationId === conversationId);
  }

  getReferencesByNode(nodeId: string): ConversationReference[] {
    return Array.from(this.references.values())
      .filter(ref => ref.nodeId === nodeId);
  }

  /**
   * Graph analysis
   */
  getConversationPaths(conversationId: string): MessageNode[][] {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) return [];

    // Find root messages (no parent)
    const rootMessages = Array.from(conversation.messages.values())
      .filter(msg => !msg.parentMessageId);

    const allPaths: MessageNode[][] = [];
    for (const root of rootMessages) {
      const paths = getBranchPaths(root, conversation.messages);
      allPaths.push(...paths);
    }

    return allPaths;
  }

  getMessageContext(conversationId: string, messageId: string): {
    path: MessageNode[];
    siblings: MessageNode[];
    children: MessageNode[];
    referencedNodes: AnyGraphNode[];
  } {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      return { path: [], siblings: [], children: [], referencedNodes: [] };
    }

    const message = conversation.messages.get(messageId);
    if (!message) {
      return { path: [], siblings: [], children: [], referencedNodes: [] };
    }

    // Get conversation path to this message
    const path = getConversationPath(messageId, conversation.messages);

    // Get siblings (messages with same parent)
    const siblings = Array.from(conversation.messages.values())
      .filter(msg => msg.parentMessageId === message.parentMessageId && msg.id !== message.id);

    // Get children
    const children = message.childMessageIds
      .map(id => conversation.messages.get(id))
      .filter(msg => msg !== undefined) as MessageNode[];

    // Get referenced nodes
    const referencedNodes: AnyGraphNode[] = [];
    const references = this.getReferencesByConversation(conversationId);
    for (const ref of references) {
      if (ref.messageId === messageId) {
        const node = this.graphStore.getNode(ref.nodeId);
        if (node) referencedNodes.push(node);
      }
    }

    return { path, siblings, children, referencedNodes };
  }

  /**
   * Analytics and metrics
   */
  getMetrics(): ChatGraphMetrics {
    const conversations = Array.from(this.conversations.values());
    const totalMessages = conversations.reduce((sum, conv) => sum + conv.messages.size, 0);

    // Calculate average depth
    let totalDepth = 0;
    let pathCount = 0;
    for (const conv of conversations) {
      const paths = this.getConversationPaths(conv.id);
      for (const path of paths) {
        totalDepth += path.length;
        pathCount++;
      }
    }

    // Calculate branching factor
    let totalBranches = 0;
    let branchPoints = 0;
    for (const conv of conversations) {
      for (const message of conv.messages.values()) {
        if (message.childMessageIds.length > 1) {
          totalBranches += message.childMessageIds.length;
          branchPoints++;
        }
      }
    }

    // Topic distribution
    const topicDistribution = new Map<string, number>();
    for (const topic of this.topics.values()) {
      topicDistribution.set(topic.category,
        (topicDistribution.get(topic.category) || 0) + topic.messageIds.length);
    }

    // Reference types
    const referenceTypes = new Map<string, number>();
    for (const ref of this.references.values()) {
      referenceTypes.set(ref.referenceType,
        (referenceTypes.get(ref.referenceType) || 0) + 1);
    }

    return {
      totalConversations: conversations.length,
      totalMessages,
      totalTopics: this.topics.size,
      totalReferences: this.references.size,
      averageConversationDepth: pathCount > 0 ? totalDepth / pathCount : 0,
      averageBranchingFactor: branchPoints > 0 ? totalBranches / branchPoints : 1,
      connectivityDensity: this.calculateConnectivityDensity(),
      topicDistribution,
      referenceTypes
    };
  }

  /**
   * Search functionality
   */
  searchConversations(query: string, filters?: {
    participantId?: string;
    topic?: string;
    dateRange?: { start: Date; end: Date };
    hasReferences?: boolean;
  }): ChatConversationNode[] {
    const results: ChatConversationNode[] = [];
    const queryLower = query.toLowerCase();

    for (const conversation of this.conversations.values()) {
      // Apply filters
      if (filters?.participantId) {
        const hasParticipant = conversation.metadata.participants
          .some(p => p.id === filters.participantId);
        if (!hasParticipant) continue;
      }

      if (filters?.topic) {
        const hasTopicMatch = conversation.metadata.mainTopics?.some(t =>
          t.topic.toLowerCase().includes(filters.topic!.toLowerCase()));
        if (!hasTopicMatch) continue;
      }

      if (filters?.dateRange) {
        const createdAt = conversation.metadata.createdAt;
        if (!createdAt || createdAt < filters.dateRange.start || createdAt > filters.dateRange.end) {
          continue;
        }
      }

      if (filters?.hasReferences) {
        const hasRefs = this.getReferencesByConversation(conversation.id).length > 0;
        if (!hasRefs) continue;
      }

      // Text search
      if (query) {
        const titleMatch = conversation.label.toLowerCase().includes(queryLower);
        const descMatch = conversation.description?.toLowerCase().includes(queryLower);

        const messageMatch = Array.from(conversation.messages.values())
          .some(msg => msg.content.toLowerCase().includes(queryLower));

        if (titleMatch || descMatch || messageMatch) {
          results.push(conversation);
        }
      } else {
        // No query, include if passes filters
        results.push(conversation);
      }
    }

    return results;
  }

  /**
   * Helper methods
   */
  private updateConversationMetadata(conversation: ChatConversationNode): void {
    conversation.metadata.totalMessages = conversation.messages.size;
    conversation.metadata.totalBranches = conversation.branches.size;
    conversation.metadata.updatedAt = new Date();

    // Calculate max depth
    const paths = this.getConversationPaths(conversation.id);
    conversation.metadata.maxDepth = Math.max(...paths.map(path => path.length), 0);

    // Update conversation type
    if (conversation.metadata.totalBranches > 1) {
      conversation.metadata.conversationType = 'branched';
    }
  }

  private calculateTimeDelta(messageId1: string, messageId2: string): number {
    // Implementation would calculate time difference between messages
    return 0; // Placeholder
  }

  private calculateConnectivityDensity(): number {
    const nodes = this.graphStore.getAllNodes().length;
    const edges = this.graphStore.getAllEdges().length;

    if (nodes <= 1) return 0;

    const maxPossibleEdges = nodes * (nodes - 1);
    return edges / maxPossibleEdges;
  }

  /**
   * Export functionality
   */
  exportConversation(conversationId: string): any {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) return null;

    const references = this.getReferencesByConversation(conversationId);
    const topics = this.getTopicsByConversation(conversationId);
    const paths = this.getConversationPaths(conversationId);

    return {
      conversation,
      messages: Array.from(conversation.messages.values()),
      branches: Array.from(conversation.branches.values()),
      references,
      topics,
      paths,
      exportedAt: new Date()
    };
  }

  clear(): void {
    this.conversations.clear();
    this.topics.clear();
    this.references.clear();
    // Note: We don't clear graphStore as it might contain other data
  }
}