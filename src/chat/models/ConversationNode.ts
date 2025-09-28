/**
 * Enhanced conversation node model for graph-based chat
 * Extends the existing ConversationNode from graph engine
 */

import { ConversationNode as BaseConversationNode } from '../../core/graph-engine/types/NodeTypes';
import { MessageNode, MessageBranch, ConversationThread, ConversationContext } from './MessageNode';

export interface ChatConversationMetadata {
  // Chat-specific metadata
  conversationType: 'linear' | 'branched' | 'merged';
  totalMessages: number;
  totalBranches: number;
  maxDepth: number;

  // Participants
  participants: Array<{
    id: string;
    role: 'user' | 'assistant' | 'system' | 'collaborator';
    joinedAt: Date;
    lastActive: Date;
    messageCount: number;
  }>;

  // AI session info
  aiModel?: string;
  aiConfiguration?: {
    temperature?: number;
    maxTokens?: number;
    systemPrompt?: string;
  };

  // Context and state
  activeContext?: ConversationContext;
  persistentContext?: {
    workingDirectory?: string;
    activeProject?: string;
    recentFiles?: string[];
    knowledgeBase?: string[];
  };

  // Performance metrics
  averageResponseTime?: number;
  totalTokensUsed?: number;
  errorCount?: number;
  satisfactionRating?: number;

  // Graph connections
  connectedConversations?: string[];
  referencedNodes?: string[];
  generatedNodes?: string[];

  // Topics and themes
  mainTopics?: Array<{
    topic: string;
    confidence: number;
    messageCount: number;
  }>;

  // State management
  isActive: boolean;
  isPinned: boolean;
  isArchived: boolean;
  isCollaborative: boolean;
}

export interface ChatConversationNode extends BaseConversationNode {
  conversationType: 'conversation';

  // Enhanced properties
  thread: ConversationThread;
  messages: Map<string, MessageNode>;
  branches: Map<string, MessageBranch>;

  // Chat metadata
  metadata: ChatConversationMetadata;

  // State
  currentContext: ConversationContext;
  activeMessageId?: string;
  activeBranchId: string;
}

export interface ConversationSummary {
  id: string;
  title: string;
  description: string;
  messageCount: number;
  branchCount: number;
  participants: string[];
  mainTopics: string[];
  startTime: Date;
  lastActivity: Date;
  status: 'active' | 'paused' | 'completed' | 'archived';
}

export interface ConversationStats {
  totalConversations: number;
  activeConversations: number;
  totalMessages: number;
  averageConversationLength: number;
  mostActiveTopics: Array<{ topic: string; count: number }>;
  participantStats: Array<{
    participant: string;
    conversationCount: number;
    messageCount: number;
    averageResponseTime?: number;
  }>;
}

/**
 * Create a new chat conversation node
 */
export function createChatConversationNode(params: {
  id: string;
  title?: string;
  participants?: string[];
  aiModel?: string;
  systemPrompt?: string;
  context?: ConversationContext;
}): ChatConversationNode {
  const now = new Date();
  const rootBranchId = `${params.id}-main`;

  const thread: ConversationThread = {
    id: params.id,
    rootMessageId: '',
    messageIds: [],
    branches: [],
    activeBranchId: rootBranchId,
    metadata: {
      totalMessages: 0,
      startTime: now,
      lastActivity: now,
      participants: params.participants || ['user', 'assistant'],
      topics: []
    }
  };

  const mainBranch: MessageBranch = {
    id: rootBranchId,
    messageIds: [],
    branchPoint: '',
    created: now,
    isActive: true,
    title: 'Main conversation',
    description: 'Primary conversation branch'
  };

  thread.branches.push(mainBranch);

  return {
    id: params.id,
    type: 'conversation',
    conversationType: 'conversation',
    label: params.title || `Chat ${params.id}`,
    description: 'Graph-based chat conversation',
    participants: params.participants || ['user', 'assistant'],
    startTime: now.toISOString(),
    endTime: now.toISOString(),
    messages: [],

    // Enhanced chat properties
    thread,
    messages: new Map(),
    branches: new Map([[rootBranchId, mainBranch]]),
    activeBranchId: rootBranchId,

    currentContext: params.context || {
      activeFiles: [],
      selectedNodes: [],
      breadcrumbs: []
    },

    metadata: {
      createdAt: now,
      updatedAt: now,
      conversationType: 'linear',
      totalMessages: 0,
      totalBranches: 1,
      maxDepth: 0,
      participants: [
        {
          id: 'user',
          role: 'user',
          joinedAt: now,
          lastActive: now,
          messageCount: 0
        },
        {
          id: 'assistant',
          role: 'assistant',
          joinedAt: now,
          lastActive: now,
          messageCount: 0
        }
      ],
      aiModel: params.aiModel,
      aiConfiguration: params.systemPrompt ? {
        systemPrompt: params.systemPrompt
      } : undefined,
      mainTopics: [],
      isActive: true,
      isPinned: false,
      isArchived: false,
      isCollaborative: false,
      referencedNodes: [],
      generatedNodes: []
    }
  };
}

/**
 * Conversation management utilities
 */
export class ConversationManager {
  private conversations: Map<string, ChatConversationNode> = new Map();

  addConversation(conversation: ChatConversationNode): void {
    this.conversations.set(conversation.id, conversation);
  }

  getConversation(id: string): ChatConversationNode | undefined {
    return this.conversations.get(id);
  }

  addMessageToConversation(
    conversationId: string,
    message: MessageNode,
    branchId?: string
  ): void {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) return;

    const targetBranchId = branchId || conversation.activeBranchId;
    const branch = conversation.branches.get(targetBranchId);
    if (!branch) return;

    // Add message to conversation
    conversation.messages.set(message.id, message);
    branch.messageIds.push(message.id);
    conversation.thread.messageIds.push(message.id);

    // Update parent-child relationships
    if (message.parentMessageId) {
      const parent = conversation.messages.get(message.parentMessageId);
      if (parent) {
        parent.childMessageIds.push(message.id);
      }
    }

    // Update metadata
    conversation.metadata.totalMessages = conversation.messages.size;
    conversation.metadata.updatedAt = new Date();
    conversation.thread.metadata.totalMessages = conversation.messages.size;
    conversation.thread.metadata.lastActivity = new Date();

    // Update participant stats
    const participant = conversation.metadata.participants.find(p => p.role === message.role);
    if (participant) {
      participant.messageCount++;
      participant.lastActive = new Date();
    }

    // Set active message
    conversation.activeMessageId = message.id;
  }

  createBranch(
    conversationId: string,
    branchPointMessageId: string,
    title?: string
  ): string | null {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) return null;

    const branchPoint = conversation.messages.get(branchPointMessageId);
    if (!branchPoint) return null;

    const branchId = `${conversationId}-branch-${Date.now()}`;
    const branch: MessageBranch = {
      id: branchId,
      messageIds: [],
      branchPoint: branchPointMessageId,
      created: new Date(),
      isActive: false,
      title: title || `Branch from message ${branchPoint.messageIndex}`,
      description: `Alternative conversation path`
    };

    conversation.branches.set(branchId, branch);
    conversation.thread.branches.push(branch);
    conversation.metadata.totalBranches = conversation.branches.size;

    // Update conversation type
    if (conversation.metadata.totalBranches > 1) {
      conversation.metadata.conversationType = 'branched';
    }

    return branchId;
  }

  switchToBranch(conversationId: string, branchId: string): boolean {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) return false;

    const branch = conversation.branches.get(branchId);
    if (!branch) return false;

    // Deactivate current branch
    const currentBranch = conversation.branches.get(conversation.activeBranchId);
    if (currentBranch) {
      currentBranch.isActive = false;
    }

    // Activate new branch
    branch.isActive = true;
    conversation.activeBranchId = branchId;
    conversation.thread.activeBranchId = branchId;

    // Update active message to last in branch
    if (branch.messageIds.length > 0) {
      conversation.activeMessageId = branch.messageIds[branch.messageIds.length - 1];
    }

    return true;
  }

  getConversationSummary(conversationId: string): ConversationSummary | null {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) return null;

    return {
      id: conversation.id,
      title: conversation.label,
      description: conversation.description || '',
      messageCount: conversation.metadata.totalMessages,
      branchCount: conversation.metadata.totalBranches,
      participants: conversation.metadata.participants.map(p => p.id),
      mainTopics: conversation.metadata.mainTopics?.map(t => t.topic) || [],
      startTime: conversation.metadata.createdAt || new Date(),
      lastActivity: conversation.metadata.updatedAt || new Date(),
      status: conversation.metadata.isActive ? 'active' :
               conversation.metadata.isArchived ? 'archived' : 'paused'
    };
  }

  getStats(): ConversationStats {
    const conversations = Array.from(this.conversations.values());
    const totalMessages = conversations.reduce((sum, conv) => sum + conv.metadata.totalMessages, 0);
    const activeCount = conversations.filter(conv => conv.metadata.isActive).length;

    // Collect topic frequencies
    const topicMap = new Map<string, number>();
    conversations.forEach(conv => {
      conv.metadata.mainTopics?.forEach(topic => {
        topicMap.set(topic.topic, (topicMap.get(topic.topic) || 0) + topic.messageCount);
      });
    });

    const mostActiveTopics = Array.from(topicMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([topic, count]) => ({ topic, count }));

    // Collect participant stats
    const participantMap = new Map<string, { convCount: number; msgCount: number }>();
    conversations.forEach(conv => {
      conv.metadata.participants.forEach(participant => {
        const stats = participantMap.get(participant.id) || { convCount: 0, msgCount: 0 };
        stats.convCount++;
        stats.msgCount += participant.messageCount;
        participantMap.set(participant.id, stats);
      });
    });

    const participantStats = Array.from(participantMap.entries())
      .map(([participant, stats]) => ({
        participant,
        conversationCount: stats.convCount,
        messageCount: stats.msgCount
      }));

    return {
      totalConversations: conversations.length,
      activeConversations: activeCount,
      totalMessages,
      averageConversationLength: conversations.length > 0 ? totalMessages / conversations.length : 0,
      mostActiveTopics,
      participantStats
    };
  }

  clear(): void {
    this.conversations.clear();
  }
}