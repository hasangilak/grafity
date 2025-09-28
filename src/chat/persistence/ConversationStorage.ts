/**
 * Conversation storage for persisting chat data to Neo4j and local storage
 */

import { Neo4jGraphStore } from '../../core/graph-engine/persistence/Neo4jGraphStore';
import { ChatConversationNode, ConversationSummary } from '../models/ConversationNode';
import { MessageNode } from '../models/MessageNode';
import { ConversationTopic, ChatGraphStructure } from '../models/ChatGraphStructure';
import { AnyGraphNode } from '../../core/graph-engine/types/NodeTypes';
import { GraphEdge } from '../../core/graph-engine/types/EdgeTypes';

export interface ConversationStorageConfig {
  neo4jUrl?: string;
  neo4jUser?: string;
  neo4jPassword?: string;
  enableLocalStorage?: boolean;
  enableCompression?: boolean;
  maxLocalStorageSize?: number; // in MB
  backupInterval?: number; // in minutes
}

export interface StorageResult {
  success: boolean;
  conversationId?: string;
  error?: string;
  metadata?: {
    nodesStored: number;
    edgesStored: number;
    messagesStored: number;
    storageTime: number;
  };
}

export interface ConversationQuery {
  conversationIds?: string[];
  participantIds?: string[];
  topicIds?: string[];
  dateRange?: {
    start: Date;
    end: Date;
  };
  messageCount?: {
    min?: number;
    max?: number;
  };
  hasCodeReferences?: boolean;
  hasDocumentReferences?: boolean;
  isActive?: boolean;
  searchQuery?: string;
  limit?: number;
  offset?: number;
}

export interface ConversationBackup {
  id: string;
  timestamp: Date;
  conversations: ChatConversationNode[];
  messages: MessageNode[];
  topics: ConversationTopic[];
  nodes: AnyGraphNode[];
  edges: GraphEdge[];
  metadata: {
    totalSize: number;
    compressionRatio?: number;
    version: string;
  };
}

/**
 * Main conversation storage manager
 */
export class ConversationStorage {
  private neo4jStore?: Neo4jGraphStore;
  private config: Required<ConversationStorageConfig>;
  private compressionEnabled: boolean;
  private backupTimer?: NodeJS.Timeout;

  constructor(config: ConversationStorageConfig = {}) {
    this.config = {
      neo4jUrl: 'bolt://localhost:7687',
      neo4jUser: 'neo4j',
      neo4jPassword: 'password',
      enableLocalStorage: true,
      enableCompression: true,
      maxLocalStorageSize: 100, // 100MB
      backupInterval: 30, // 30 minutes
      ...config
    };

    this.compressionEnabled = this.config.enableCompression;

    this.initializeStorage();
  }

  /**
   * Initialize storage connections
   */
  private async initializeStorage(): Promise<void> {
    try {
      // Initialize Neo4j if credentials provided
      if (this.config.neo4jUrl && this.config.neo4jUser && this.config.neo4jPassword) {
        this.neo4jStore = new Neo4jGraphStore({
          url: this.config.neo4jUrl,
          user: this.config.neo4jUser,
          password: this.config.neo4jPassword
        });

        await this.neo4jStore.connect();
      }

      // Setup automatic backups
      if (this.config.backupInterval > 0) {
        this.backupTimer = setInterval(
          () => this.createAutomaticBackup(),
          this.config.backupInterval * 60 * 1000
        );
      }

    } catch (error) {
      console.warn('Storage initialization failed:', error);
    }
  }

  /**
   * Store a complete conversation
   */
  async storeConversation(
    conversation: ChatConversationNode,
    chatGraph: ChatGraphStructure
  ): Promise<StorageResult> {
    const startTime = Date.now();

    try {
      let nodesStored = 0;
      let edgesStored = 0;
      let messagesStored = 0;

      // Store to Neo4j if available
      if (this.neo4jStore) {
        const neo4jResult = await this.storeToNeo4j(conversation, chatGraph);
        nodesStored += neo4jResult.nodesStored;
        edgesStored += neo4jResult.edgesStored;
        messagesStored += neo4jResult.messagesStored;
      }

      // Store to local storage if enabled
      if (this.config.enableLocalStorage) {
        await this.storeToLocalStorage(conversation, chatGraph);
      }

      return {
        success: true,
        conversationId: conversation.id,
        metadata: {
          nodesStored,
          edgesStored,
          messagesStored,
          storageTime: Date.now() - startTime
        }
      };

    } catch (error) {
      return {
        success: false,
        error: `Storage failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Store conversation to Neo4j
   */
  private async storeToNeo4j(
    conversation: ChatConversationNode,
    chatGraph: ChatGraphStructure
  ): Promise<{ nodesStored: number; edgesStored: number; messagesStored: number }> {
    if (!this.neo4jStore) {
      throw new Error('Neo4j store not initialized');
    }

    let nodesStored = 0;
    let edgesStored = 0;
    let messagesStored = 0;

    // Store conversation node
    await this.neo4jStore.storeNode({
      ...conversation,
      labels: ['Conversation', 'Chat'],
      properties: {
        ...conversation.metadata,
        totalMessages: conversation.messages.size,
        totalBranches: conversation.branches.size,
        participants: conversation.participants,
        startTime: conversation.startTime,
        endTime: conversation.endTime
      }
    });
    nodesStored++;

    // Store message nodes
    for (const message of conversation.messages.values()) {
      await this.neo4jStore.storeNode({
        ...message,
        labels: ['Message', 'ConversationNode'],
        properties: {
          ...message.metadata,
          content: message.content,
          role: message.role,
          messageIndex: message.messageIndex,
          parentMessageId: message.parentMessageId,
          conversationId: conversation.id
        }
      });
      nodesStored++;
      messagesStored++;

      // Store message relationships
      if (message.parentMessageId) {
        await this.neo4jStore.storeEdge({
          id: `${message.parentMessageId}-follows-${message.id}`,
          source: message.parentMessageId,
          target: message.id,
          type: 'FOLLOWS',
          properties: {
            messageIndex: message.messageIndex,
            timeDelta: this.calculateTimeDelta(message.parentMessageId, message.id, conversation)
          }
        });
        edgesStored++;
      }

      // Message belongs to conversation
      await this.neo4jStore.storeEdge({
        id: `${conversation.id}-contains-${message.id}`,
        source: conversation.id,
        target: message.id,
        type: 'CONTAINS',
        properties: {
          messageIndex: message.messageIndex,
          role: message.role
        }
      });
      edgesStored++;
    }

    // Store topics and references if available
    const references = chatGraph.getReferencesByConversation(conversation.id);
    for (const ref of references) {
      await this.neo4jStore.storeEdge({
        id: `${ref.conversationId}-references-${ref.nodeId}`,
        source: ref.conversationId,
        target: ref.nodeId,
        type: 'REFERENCES',
        properties: {
          referenceType: ref.referenceType,
          confidence: ref.confidence,
          messageId: ref.messageId
        }
      });
      edgesStored++;
    }

    return { nodesStored, edgesStored, messagesStored };
  }

  /**
   * Store conversation to local storage
   */
  private async storeToLocalStorage(
    conversation: ChatConversationNode,
    chatGraph: ChatGraphStructure
  ): Promise<void> {
    try {
      const storageKey = `conversation_${conversation.id}`;
      const data = {
        conversation: this.serializeConversation(conversation),
        messages: Array.from(conversation.messages.values()).map(m => this.serializeMessage(m)),
        branches: Array.from(conversation.branches.values()),
        references: chatGraph.getReferencesByConversation(conversation.id),
        timestamp: new Date().toISOString(),
        version: '1.0'
      };

      const serialized = JSON.stringify(data);
      const compressed = this.compressionEnabled ? this.compress(serialized) : serialized;

      // Check storage size
      const currentSize = this.getLocalStorageSize();
      const newDataSize = new Blob([compressed]).size / (1024 * 1024); // Convert to MB

      if (currentSize + newDataSize > this.config.maxLocalStorageSize) {
        await this.cleanupOldConversations();
      }

      localStorage.setItem(storageKey, compressed);

      // Update storage index
      this.updateStorageIndex(conversation.id, {
        size: newDataSize,
        timestamp: new Date(),
        messageCount: conversation.messages.size
      });

    } catch (error) {
      throw new Error(`Local storage failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Load conversation by ID
   */
  async loadConversation(conversationId: string): Promise<{
    conversation: ChatConversationNode | null;
    messages: MessageNode[];
    error?: string;
  }> {
    try {
      // Try Neo4j first
      if (this.neo4jStore) {
        const neo4jResult = await this.loadFromNeo4j(conversationId);
        if (neo4jResult.conversation) {
          return neo4jResult;
        }
      }

      // Fallback to local storage
      if (this.config.enableLocalStorage) {
        return await this.loadFromLocalStorage(conversationId);
      }

      return {
        conversation: null,
        messages: [],
        error: 'No storage backend available'
      };

    } catch (error) {
      return {
        conversation: null,
        messages: [],
        error: `Load failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Load from Neo4j
   */
  private async loadFromNeo4j(conversationId: string): Promise<{
    conversation: ChatConversationNode | null;
    messages: MessageNode[];
    error?: string;
  }> {
    if (!this.neo4jStore) {
      return { conversation: null, messages: [] };
    }

    try {
      // Load conversation node
      const conversationData = await this.neo4jStore.getNode(conversationId);
      if (!conversationData) {
        return { conversation: null, messages: [] };
      }

      // Load messages
      const query = `
        MATCH (c:Conversation {id: $conversationId})-[:CONTAINS]->(m:Message)
        RETURN m
        ORDER BY m.messageIndex
      `;

      const result = await this.neo4jStore.executeQuery(query, { conversationId });
      const messages = result.records.map(record =>
        this.deserializeMessage(record.get('m').properties)
      );

      const conversation = this.deserializeConversation(conversationData.properties, messages);

      return { conversation, messages };

    } catch (error) {
      return {
        conversation: null,
        messages: [],
        error: `Neo4j load failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Load from local storage
   */
  private async loadFromLocalStorage(conversationId: string): Promise<{
    conversation: ChatConversationNode | null;
    messages: MessageNode[];
    error?: string;
  }> {
    try {
      const storageKey = `conversation_${conversationId}`;
      const compressed = localStorage.getItem(storageKey);

      if (!compressed) {
        return { conversation: null, messages: [] };
      }

      const serialized = this.compressionEnabled ? this.decompress(compressed) : compressed;
      const data = JSON.parse(serialized);

      const messages = data.messages.map((m: any) => this.deserializeMessage(m));
      const conversation = this.deserializeConversation(data.conversation, messages);

      return { conversation, messages };

    } catch (error) {
      return {
        conversation: null,
        messages: [],
        error: `Local storage load failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Query conversations
   */
  async queryConversations(query: ConversationQuery): Promise<{
    conversations: ConversationSummary[];
    total: number;
    error?: string;
  }> {
    try {
      // Try Neo4j first for complex queries
      if (this.neo4jStore && this.hasComplexQuery(query)) {
        return await this.queryNeo4j(query);
      }

      // Use local storage for simple queries
      return await this.queryLocalStorage(query);

    } catch (error) {
      return {
        conversations: [],
        total: 0,
        error: `Query failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Query Neo4j
   */
  private async queryNeo4j(query: ConversationQuery): Promise<{
    conversations: ConversationSummary[];
    total: number;
  }> {
    if (!this.neo4jStore) {
      return { conversations: [], total: 0 };
    }

    let cypher = 'MATCH (c:Conversation)';
    const params: any = {};

    // Add filters
    const conditions: string[] = [];

    if (query.conversationIds && query.conversationIds.length > 0) {
      conditions.push('c.id IN $conversationIds');
      params.conversationIds = query.conversationIds;
    }

    if (query.participantIds && query.participantIds.length > 0) {
      conditions.push('ANY(p IN c.participants WHERE p IN $participantIds)');
      params.participantIds = query.participantIds;
    }

    if (query.dateRange) {
      conditions.push('c.createdAt >= $startDate AND c.createdAt <= $endDate');
      params.startDate = query.dateRange.start.toISOString();
      params.endDate = query.dateRange.end.toISOString();
    }

    if (query.messageCount) {
      if (query.messageCount.min !== undefined) {
        conditions.push('c.totalMessages >= $minMessages');
        params.minMessages = query.messageCount.min;
      }
      if (query.messageCount.max !== undefined) {
        conditions.push('c.totalMessages <= $maxMessages');
        params.maxMessages = query.messageCount.max;
      }
    }

    if (query.isActive !== undefined) {
      conditions.push('c.isActive = $isActive');
      params.isActive = query.isActive;
    }

    if (conditions.length > 0) {
      cypher += ' WHERE ' + conditions.join(' AND ');
    }

    cypher += ' RETURN c ORDER BY c.updatedAt DESC';

    if (query.limit) {
      cypher += ` LIMIT ${query.limit}`;
    }

    if (query.offset) {
      cypher += ` SKIP ${query.offset}`;
    }

    const result = await this.neo4jStore.executeQuery(cypher, params);
    const conversations = result.records.map(record =>
      this.createConversationSummary(record.get('c').properties)
    );

    return { conversations, total: conversations.length };
  }

  /**
   * Query local storage
   */
  private async queryLocalStorage(query: ConversationQuery): Promise<{
    conversations: ConversationSummary[];
    total: number;
  }> {
    const index = this.getStorageIndex();
    let conversations: ConversationSummary[] = [];

    for (const [conversationId, indexData] of Object.entries(index)) {
      try {
        const { conversation } = await this.loadFromLocalStorage(conversationId);
        if (conversation && this.matchesQuery(conversation, query)) {
          conversations.push(this.createConversationSummaryFromNode(conversation));
        }
      } catch (error) {
        // Skip corrupted entries
        continue;
      }
    }

    // Apply sorting and pagination
    conversations.sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime());

    const total = conversations.length;
    if (query.offset) {
      conversations = conversations.slice(query.offset);
    }
    if (query.limit) {
      conversations = conversations.slice(0, query.limit);
    }

    return { conversations, total };
  }

  /**
   * Create backup
   */
  async createBackup(): Promise<ConversationBackup> {
    const timestamp = new Date();
    const conversations: ChatConversationNode[] = [];
    const messages: MessageNode[] = [];
    const topics: ConversationTopic[] = [];
    const nodes: AnyGraphNode[] = [];
    const edges: GraphEdge[] = [];

    // Collect all data
    if (this.config.enableLocalStorage) {
      const index = this.getStorageIndex();
      for (const conversationId of Object.keys(index)) {
        const { conversation, messages: convMessages } = await this.loadFromLocalStorage(conversationId);
        if (conversation) {
          conversations.push(conversation);
          messages.push(...convMessages);
        }
      }
    }

    const backup: ConversationBackup = {
      id: `backup-${timestamp.getTime()}`,
      timestamp,
      conversations,
      messages,
      topics,
      nodes,
      edges,
      metadata: {
        totalSize: 0,
        version: '1.0'
      }
    };

    // Calculate size and potentially compress
    const serialized = JSON.stringify(backup);
    backup.metadata.totalSize = new Blob([serialized]).size;

    if (this.compressionEnabled) {
      const compressed = this.compress(serialized);
      backup.metadata.compressionRatio = serialized.length / compressed.length;
    }

    return backup;
  }

  /**
   * Helper methods
   */
  private serializeConversation(conversation: ChatConversationNode): any {
    return {
      id: conversation.id,
      type: conversation.type,
      conversationType: conversation.conversationType,
      label: conversation.label,
      description: conversation.description,
      participants: conversation.participants,
      startTime: conversation.startTime,
      endTime: conversation.endTime,
      activeBranchId: conversation.activeBranchId,
      activeMessageId: conversation.activeMessageId,
      currentContext: conversation.currentContext,
      metadata: conversation.metadata
    };
  }

  private serializeMessage(message: MessageNode): any {
    return {
      id: message.id,
      type: message.type,
      conversationType: message.conversationType,
      label: message.label,
      description: message.description,
      content: message.content,
      rawContent: message.rawContent,
      htmlContent: message.htmlContent,
      role: message.role,
      messageIndex: message.messageIndex,
      parentMessageId: message.parentMessageId,
      childMessageIds: message.childMessageIds,
      participants: message.participants,
      startTime: message.startTime,
      endTime: message.endTime,
      messages: message.messages,
      metadata: message.metadata
    };
  }

  private deserializeConversation(data: any, messages: MessageNode[]): ChatConversationNode {
    const messageMap = new Map(messages.map(m => [m.id, m]));
    const branchMap = new Map(); // Would be populated from stored branch data

    return {
      ...data,
      messages: messageMap,
      branches: branchMap,
      thread: {
        id: data.id,
        rootMessageId: messages.find(m => !m.parentMessageId)?.id || '',
        messageIds: messages.map(m => m.id),
        branches: [],
        activeBranchId: data.activeBranchId,
        metadata: {
          totalMessages: messages.length,
          startTime: new Date(data.startTime),
          lastActivity: new Date(data.endTime),
          participants: data.participants,
          topics: []
        }
      }
    } as ChatConversationNode;
  }

  private deserializeMessage(data: any): MessageNode {
    return {
      ...data,
      metadata: {
        ...data.metadata,
        createdAt: new Date(data.metadata.createdAt),
        updatedAt: new Date(data.metadata.updatedAt)
      }
    } as MessageNode;
  }

  private createConversationSummary(data: any): ConversationSummary {
    return {
      id: data.id,
      title: data.label,
      description: data.description || '',
      messageCount: data.totalMessages || 0,
      branchCount: data.totalBranches || 0,
      participants: data.participants || [],
      mainTopics: data.mainTopics?.map((t: any) => t.topic) || [],
      startTime: new Date(data.createdAt),
      lastActivity: new Date(data.updatedAt),
      status: data.isActive ? 'active' : 'completed'
    };
  }

  private createConversationSummaryFromNode(conversation: ChatConversationNode): ConversationSummary {
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

  private calculateTimeDelta(parentId: string, messageId: string, conversation: ChatConversationNode): number {
    const parent = conversation.messages.get(parentId);
    const message = conversation.messages.get(messageId);

    if (parent && message) {
      return new Date(message.startTime).getTime() - new Date(parent.startTime).getTime();
    }

    return 0;
  }

  private hasComplexQuery(query: ConversationQuery): boolean {
    return !!(query.topicIds || query.hasCodeReferences || query.hasDocumentReferences || query.searchQuery);
  }

  private matchesQuery(conversation: ChatConversationNode, query: ConversationQuery): boolean {
    if (query.conversationIds && !query.conversationIds.includes(conversation.id)) return false;
    if (query.participantIds && !query.participantIds.some(p => conversation.participants.includes(p))) return false;
    if (query.isActive !== undefined && conversation.metadata.isActive !== query.isActive) return false;

    if (query.messageCount) {
      const count = conversation.messages.size;
      if (query.messageCount.min !== undefined && count < query.messageCount.min) return false;
      if (query.messageCount.max !== undefined && count > query.messageCount.max) return false;
    }

    if (query.dateRange) {
      const created = conversation.metadata.createdAt;
      if (created) {
        if (created < query.dateRange.start || created > query.dateRange.end) return false;
      }
    }

    return true;
  }

  private compress(data: string): string {
    // Simple compression - in production use proper compression library
    return btoa(data);
  }

  private decompress(data: string): string {
    return atob(data);
  }

  private getLocalStorageSize(): number {
    let size = 0;
    for (let key in localStorage) {
      if (localStorage.hasOwnProperty(key) && key.startsWith('conversation_')) {
        size += localStorage[key].length;
      }
    }
    return size / (1024 * 1024); // Convert to MB
  }

  private getStorageIndex(): Record<string, any> {
    const index = localStorage.getItem('conversation_index');
    return index ? JSON.parse(index) : {};
  }

  private updateStorageIndex(conversationId: string, data: any): void {
    const index = this.getStorageIndex();
    index[conversationId] = data;
    localStorage.setItem('conversation_index', JSON.stringify(index));
  }

  private async cleanupOldConversations(): Promise<void> {
    const index = this.getStorageIndex();
    const entries = Object.entries(index).sort((a, b) =>
      new Date(a[1].timestamp).getTime() - new Date(b[1].timestamp).getTime()
    );

    // Remove oldest 25% of conversations
    const toRemove = entries.slice(0, Math.floor(entries.length * 0.25));

    for (const [conversationId] of toRemove) {
      localStorage.removeItem(`conversation_${conversationId}`);
      delete index[conversationId];
    }

    localStorage.setItem('conversation_index', JSON.stringify(index));
  }

  private async createAutomaticBackup(): Promise<void> {
    try {
      const backup = await this.createBackup();
      localStorage.setItem(`backup_${backup.id}`, JSON.stringify(backup));

      // Keep only last 5 backups
      const backupKeys = Object.keys(localStorage)
        .filter(key => key.startsWith('backup_'))
        .sort()
        .slice(0, -5);

      for (const key of backupKeys) {
        localStorage.removeItem(key);
      }
    } catch (error) {
      console.warn('Automatic backup failed:', error);
    }
  }

  /**
   * Cleanup
   */
  async disconnect(): Promise<void> {
    if (this.backupTimer) {
      clearInterval(this.backupTimer);
    }

    if (this.neo4jStore) {
      await this.neo4jStore.disconnect();
    }
  }

  async clearAllData(): Promise<void> {
    // Clear Neo4j
    if (this.neo4jStore) {
      await this.neo4jStore.executeQuery('MATCH (n) DETACH DELETE n');
    }

    // Clear local storage
    const keysToRemove = Object.keys(localStorage)
      .filter(key => key.startsWith('conversation_') || key.startsWith('backup_'));

    for (const key of keysToRemove) {
      localStorage.removeItem(key);
    }

    localStorage.removeItem('conversation_index');
  }
}