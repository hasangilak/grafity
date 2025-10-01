import { ConversationGraphBuilder, ConversationData, ConversationMessage } from '../builders/ConversationGraphBuilder';
import { ConversationNode, createConversationNode } from '../types/NodeTypes';
import { GraphStore } from '../GraphStore';
import { createBidirectionalEdge, EdgeRelationType } from '../types/EdgeTypes';
import { BranchStyleManager } from './BranchStyleManager';
import { BranchOperations } from './BranchOperations';

export interface ChatMessage {
  id?: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: string;
  metadata?: Record<string, any>;
}

export interface ConversationBranch {
  id: string;
  parentMessageId: string;
  branchPoint: string;
  messages: string[]; // Message IDs in this branch
  active: boolean;
}

export interface GraphContext {
  conversationId: string;
  currentNodeId: string;
  activeBranchId?: string;
  history: ConversationNode[];
  linkedCode: string[];
  linkedDocs: string[];
}

/**
 * Enhanced conversation graph with bidirectional connections and branching
 */
export class EnhancedConversationGraph extends ConversationGraphBuilder {
  private branches = new Map<string, ConversationBranch>();
  private activeBranchId: string | null = null;
  private updateCallbacks: Array<(update: any) => void> = [];
  public branchStyleManager: BranchStyleManager;
  public branchOperations: BranchOperations;

  constructor(store: GraphStore) {
    super(store);
    this.branchStyleManager = new BranchStyleManager();
    this.branchOperations = new BranchOperations(store);
  }

  /**
   * Implement abstract build method from GraphBuilder
   */
  async build(data: any): Promise<GraphStore> {
    if (data.messages) {
      await this.processConversation(data);
    }
    return this.store;
  }

  /**
   * Create a new conversation
   */
  async createConversation(data: {
    title: string;
    participants: string[];
    metadata?: Record<string, any>;
  }): Promise<ConversationNode> {
    const conversationId = this.generateNodeId(`conversation-${Date.now()}`);

    const conversation = createConversationNode({
      id: conversationId,
      label: data.title,
      description: `Conversation: ${data.title}`,
      metadata: {
        participants: data.participants,
        createdAt: new Date(),
        ...data.metadata
      },
      participants: data.participants,
      messages: [],
      startTime: new Date().toISOString(),
      endTime: new Date().toISOString()
    });

    this.store.addNode(conversation);

    // Create default branch
    const defaultBranch: ConversationBranch = {
      id: `${conversationId}-main`,
      parentMessageId: conversationId,
      branchPoint: conversationId,
      messages: [],
      active: true
    };

    this.branches.set(defaultBranch.id, defaultBranch);
    this.activeBranchId = defaultBranch.id;

    // Register branch style
    this.branchStyleManager.createBranchStyle(
      defaultBranch.id,
      'Main Branch',
      conversationId,
      true
    );

    return conversation;
  }

  /**
   * Add message to current active branch
   */
  addMessage(conversationId: string, message: ChatMessage): string {
    const messageId = message.id || this.generateNodeId(`message-${conversationId}-${Date.now()}`);

    const messageNode = createConversationNode({
      id: messageId,
      label: `Message from ${message.role}`,
      description: message.content.substring(0, 200),
      conversationType: 'message',
      metadata: {
        conversationId,
        role: message.role,
        timestamp: message.timestamp || new Date().toISOString(),
        contentLength: message.content.length,
        branchId: this.activeBranchId || undefined,
        content: message.content,
        ...message.metadata
      },
      participant: message.role,
      participants: [message.role],
      content: message.content,
      messages: [message as ConversationMessage],
      timestamp: new Date(message.timestamp || Date.now()),
      startTime: message.timestamp || new Date().toISOString(),
      endTime: message.timestamp || new Date().toISOString()
    });

    this.store.addNode(messageNode);

    // Connect to conversation
    this.store.addEdge({
      id: `${conversationId}-relates_to-${messageId}`,
      source: conversationId,
      target: messageId,
      type: 'relates_to',
      bidirectional: false,
      weight: 1,
      metadata: { relationship: 'contains' }
    });

    // Add to active branch
    if (this.activeBranchId) {
      const branch = this.branches.get(this.activeBranchId);
      if (branch) {
        branch.messages.push(messageId);

        // Connect to previous message in branch
        if (branch.messages.length > 1) {
          const prevMessageId = branch.messages[branch.messages.length - 2];

          // Create flow edge
          this.store.addEdge({
            id: `${prevMessageId}-follows-${messageId}`,
            source: prevMessageId,
            target: messageId,
            type: 'follows',
            bidirectional: false,
            weight: 1,
            metadata: { branchId: this.activeBranchId }
          });

          // If user -> assistant, create response edge
          const prevNode = this.store.getNode(prevMessageId) as ConversationNode;
          if (prevNode?.participant === 'user' && message.role === 'assistant') {
            this.store.addEdge({
              id: `${messageId}-responds-${prevMessageId}`,
              source: messageId,
              target: prevMessageId,
              type: 'responds',
              bidirectional: false,
              weight: 0.9,
              metadata: {}
            });
          }
        }
      }
    }

    // Notify subscribers
    this.notifyUpdate({
      type: 'message_added',
      messageId,
      branchId: this.activeBranchId
    });

    return messageId;
  }

  /**
   * Create a new branch from a message
   */
  createBranch(fromMessageId: string, message: ChatMessage, branchName?: string): string {
    const branchId = this.generateNodeId(`branch-${fromMessageId}-${Date.now()}`);
    const conversationId = this.getConversationId(fromMessageId);

    // Auto-generate branch name if not provided
    const generatedName = branchName || this.generateBranchName(message.content);

    // Create branch metadata
    const branch: ConversationBranch = {
      id: branchId,
      parentMessageId: fromMessageId,
      branchPoint: fromMessageId,
      messages: [],
      active: false
    };

    this.branches.set(branchId, branch);

    // Register branch style
    this.branchStyleManager.createBranchStyle(
      branchId,
      generatedName,
      fromMessageId,
      false
    );

    // Temporarily switch to new branch
    const previousBranch = this.activeBranchId;
    this.activeBranchId = branchId;

    // Add message to new branch
    const newMessageId = this.addMessage(conversationId, message);

    // Create branch edge
    this.store.addEdge({
      id: `${fromMessageId}-relates_to-${newMessageId}`,
      source: fromMessageId,
      target: newMessageId,
      type: 'relates_to',
      bidirectional: false,
      weight: 0.8,
      metadata: {
        relationship: 'branches',
        branchId,
        branchPoint: fromMessageId
      }
    });

    // Switch back to previous branch (or stay on new one)
    this.activeBranchId = previousBranch;

    // Notify subscribers
    this.notifyUpdate({
      type: 'branch_created',
      branchId,
      fromMessageId,
      newMessageId
    });

    return newMessageId;
  }

  /**
   * Switch to a different branch
   */
  switchBranch(branchId: string): void {
    if (this.branches.has(branchId)) {
      // Deactivate current branch
      if (this.activeBranchId) {
        const currentBranch = this.branches.get(this.activeBranchId);
        if (currentBranch) currentBranch.active = false;
      }

      // Activate new branch
      this.activeBranchId = branchId;
      const newBranch = this.branches.get(branchId);
      if (newBranch) newBranch.active = true;

      // Update branch styles
      this.branchStyleManager.setActiveBranch(branchId);

      this.notifyUpdate({
        type: 'branch_switched',
        branchId
      });
    }
  }

  /**
   * Create bidirectional link between messages
   */
  linkBidirectional(
    messageId1: string,
    messageId2: string,
    relationType: EdgeRelationType,
    metadata?: { topic?: string; strength?: number }
  ): void {
    const [forward, reverse] = createBidirectionalEdge(
      messageId1,
      messageId2,
      relationType,
      {
        weight: metadata?.strength || 0.7,
        metadata: {
          topic: metadata?.topic,
          createdAt: new Date()
        }
      }
    );

    this.store.addEdge(forward);
    this.store.addEdge(reverse);

    this.notifyUpdate({
      type: 'bidirectional_link_created',
      messageId1,
      messageId2,
      relationType
    });
  }

  /**
   * Link message to code file
   */
  linkToCode(messageId: string, codeFilePath: string): void {
    // Find code node by file path
    const codeNodes = this.store.getNodesByType('code');

    for (const node of codeNodes) {
      const codeNode = node as any;
      if (codeNode.filePath === codeFilePath || codeNode.metadata?.filePath === codeFilePath) {
        // Create bidirectional link
        const [forward, reverse] = createBidirectionalEdge(
          messageId,
          node.id,
          'references',
          { weight: 0.8 }
        );

        this.store.addEdge(forward);
        this.store.addEdge(reverse);

        this.notifyUpdate({
          type: 'code_linked',
          messageId,
          codeNodeId: node.id
        });

        return;
      }
    }

    // If code node doesn't exist, we could create it here
    console.warn(`Code node not found for: ${codeFilePath}`);
  }

  /**
   * Get conversation path from message to root
   */
  getConversationPath(messageId: string): ConversationNode[] {
    const path: ConversationNode[] = [];
    let currentId: string | undefined = messageId;

    while (currentId) {
      const node = this.store.getNode(currentId);
      if (node && node.type === 'conversation') {
        path.unshift(node as ConversationNode);
      }

      // Find parent (follows or responds edge)
      const incomingEdges = this.store.getAllEdges().filter((e: any) => e.target === currentId);
      const parentEdge = incomingEdges.find((e: any) =>
        e.type === 'follows' ||
        e.type === 'responds' ||
        e.type === 'responds_to' ||
        (e.type === 'relates_to' && e.metadata?.relationship === 'contains')
      );

      if (parentEdge) {
        currentId = parentEdge.source;
      } else {
        break;
      }
    }

    return path;
  }

  /**
   * Find related messages based on bidirectional connections
   */
  findRelatedMessages(messageId: string, maxDepth: number = 2): ConversationNode[] {
    const related = new Set<string>();
    const visited = new Set<string>();

    const traverse = (nodeId: string, depth: number) => {
      if (depth > maxDepth || visited.has(nodeId)) return;
      visited.add(nodeId);

      // Get bidirectional edges
      const edges = this.store.getAllEdges().filter(
        (e: any) => (e.source === nodeId || e.target === nodeId) && e.bidirectional
      );

      for (const edge of edges) {
        const relatedId = edge.source === nodeId ? edge.target : edge.source;
        const relatedNode = this.store.getNode(relatedId);

        if (relatedNode && relatedNode.type === 'conversation') {
          related.add(relatedId);
          traverse(relatedId, depth + 1);
        }
      }
    };

    traverse(messageId, 0);
    related.delete(messageId); // Remove self

    return Array.from(related)
      .map((id: string) => this.store.getNode(id))
      .filter((node: any) => node !== undefined) as ConversationNode[];
  }

  /**
   * Get linked code nodes
   */
  getLinkedCode(messageId: string): string[] {
    const edges = this.store.getAllEdges().filter(
      (e: any) => (e.source === messageId || e.target === messageId) &&
           e.type === 'references' &&
           e.bidirectional
    );

    const codeNodeIds = edges.map((e: any) =>
      e.source === messageId ? e.target : e.source
    );

    return codeNodeIds.filter((id: string) => {
      const node = this.store.getNode(id);
      return node?.type === 'code';
    });
  }

  /**
   * Get all branches for a conversation
   */
  getBranches(): ConversationBranch[] {
    return Array.from(this.branches.values());
  }

  /**
   * Get active branch
   */
  getActiveBranch(): ConversationBranch | null {
    return this.activeBranchId ? this.branches.get(this.activeBranchId) || null : null;
  }

  /**
   * Subscribe to graph updates
   */
  subscribeToUpdates(callback: (update: any) => void): { unsubscribe: () => void } {
    this.updateCallbacks.push(callback);

    return {
      unsubscribe: () => {
        const index = this.updateCallbacks.indexOf(callback);
        if (index > -1) {
          this.updateCallbacks.splice(index, 1);
        }
      }
    };
  }

  /**
   * Notify subscribers of updates
   */
  private notifyUpdate(update: any): void {
    for (const callback of this.updateCallbacks) {
      try {
        callback(update);
      } catch (error) {
        console.error('Error in update callback:', error);
      }
    }
  }

  /**
   * Get conversation ID from message ID
   */
  private getConversationId(messageId: string): string {
    const edges = this.store.getAllEdges();
    const containsEdge = edges.find(
      (e: any) => e.target === messageId && e.type === 'relates_to' && e.metadata?.relationship === 'contains'
    );

    if (containsEdge) {
      return containsEdge.source;
    }

    throw new Error(`Cannot find conversation for message: ${messageId}`);
  }

  /**
   * Build comprehensive context for a message
   */
  buildContext(messageId: string): GraphContext {
    const conversationId = this.getConversationId(messageId);
    const history = this.getConversationPath(messageId);
    const linkedCode = this.getLinkedCode(messageId);
    const linkedDocs = this.getLinkedDocs(messageId);

    return {
      conversationId,
      currentNodeId: messageId,
      activeBranchId: this.activeBranchId || undefined,
      history,
      linkedCode,
      linkedDocs
    };
  }

  /**
   * Get linked document nodes
   */
  private getLinkedDocs(messageId: string): string[] {
    const edges = this.store.getAllEdges().filter(
      (e: any) => (e.source === messageId || e.target === messageId) &&
           e.type === 'references' &&
           e.bidirectional
    );

    const docNodeIds = edges.map((e: any) =>
      e.source === messageId ? e.target : e.source
    );

    return docNodeIds.filter((id: string) => {
      const node = this.store.getNode(id);
      return node?.type === 'document';
    });
  }

  /**
   * Get message content by ID
   */
  getMessageContent(messageId: string): string {
    const node = this.store.getNode(messageId);
    return node?.metadata?.content || node?.description || '';
  }

  /**
   * Get message metadata by ID
   */
  getMessageMetadata(messageId: string): {
    role: 'user' | 'assistant' | 'system';
    timestamp: string;
    branch: { id: string; name: string; isActive: boolean };
    linkedCode: Array<{ nodeId: string; filePath: string; language: string }>;
    relatedMessages: ConversationNode[];
  } | null {
    const node = this.store.getNode(messageId);
    if (!node) return null;

    return {
      role: (node.metadata?.role as any) || 'user',
      timestamp: node.metadata?.timestamp || new Date().toISOString(),
      branch: this.getMessageBranch(messageId),
      linkedCode: this.getLinkedCodeWithDetails(messageId),
      relatedMessages: this.findRelatedMessages(messageId, 1)
    };
  }

  /**
   * Get linked code with full details
   */
  getLinkedCodeWithDetails(messageId: string): Array<{
    nodeId: string;
    filePath: string;
    language: string;
  }> {
    const codeNodeIds = this.getLinkedCode(messageId);
    return codeNodeIds.map(nodeId => {
      const node = this.store.getNode(nodeId);
      return {
        nodeId,
        filePath: node?.metadata?.filePath || nodeId,
        language: node?.metadata?.language || 'typescript'
      };
    });
  }

  /**
   * Get branch information for a message
   */
  private getMessageBranch(messageId: string): {
    id: string;
    name: string;
    isActive: boolean;
  } {
    for (const [branchId, branch] of this.branches) {
      if (branch.messages.includes(messageId)) {
        return {
          id: branchId,
          name: branchId.split('-').pop() || 'main',
          isActive: branch.active
        };
      }
    }
    return { id: 'main', name: 'main', isActive: true };
  }

  /**
   * Generate a branch name from message content
   */
  private generateBranchName(messageContent: string): string {
    // Extract first few meaningful words
    const words = messageContent
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 2)
      .slice(0, 3);

    if (words.length === 0) {
      return `Branch ${Date.now()}`;
    }

    // Capitalize first letter of each word
    const name = words
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');

    return name.length > 30 ? name.substring(0, 30) + '...' : name;
  }

  /**
   * Rename a branch
   */
  renameBranch(branchId: string, newName: string): void {
    const branch = this.branches.get(branchId);
    if (!branch) {
      throw new Error(`Branch not found: ${branchId}`);
    }

    const oldStyle = this.branchStyleManager.getBranchStyle(branchId);
    if (oldStyle) {
      const oldName = oldStyle.name;
      this.branchStyleManager.renameBranch(branchId, newName);
      this.branchOperations.renameBranch(branchId, newName, oldName);

      this.notifyUpdate({
        type: 'branch_renamed',
        branchId,
        oldName,
        newName
      });
    }
  }

  /**
   * Archive a branch
   */
  archiveBranch(branchId: string): void {
    if (branchId === this.activeBranchId) {
      throw new Error('Cannot archive the active branch');
    }

    this.branchOperations.archiveBranch(branchId);

    this.notifyUpdate({
      type: 'branch_archived',
      branchId
    });
  }

  /**
   * Get branch diff for comparison
   */
  getBranchDiff(branch1Id: string, branch2Id: string): {
    branch1: ConversationBranch | undefined;
    branch2: ConversationBranch | undefined;
    divergencePoint: string | null;
  } {
    const branch1 = this.branches.get(branch1Id);
    const branch2 = this.branches.get(branch2Id);

    if (!branch1 || !branch2) {
      return { branch1, branch2, divergencePoint: null };
    }

    // Find common ancestor (divergence point)
    const commonMessages = branch1.messages.filter(id =>
      branch2.messages.includes(id)
    );

    const divergencePoint = commonMessages.length > 0
      ? commonMessages[commonMessages.length - 1]
      : null;

    return { branch1, branch2, divergencePoint };
  }
}