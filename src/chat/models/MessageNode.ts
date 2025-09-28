/**
 * Message node model for graph-based chat interface
 */

import { ConversationNode, GraphNodeMetadata } from '../../core/graph-engine/types/NodeTypes';

export interface MessageMetadata extends GraphNodeMetadata {
  role: 'user' | 'assistant' | 'system';
  messageIndex: number;
  conversationId: string;
  parentMessageId?: string;
  childMessageIds?: string[];

  // AI-specific metadata
  model?: string;
  temperature?: number;
  promptTokens?: number;
  completionTokens?: number;

  // Content analysis
  contentType: 'text' | 'code' | 'mixed' | 'error';
  codeReferences?: string[];
  documentReferences?: string[];
  topics?: string[];
  entities?: ExtractedEntity[];

  // Interaction metadata
  responseTime?: number;
  editedAt?: Date;
  reactions?: MessageReaction[];

  // Graph relationships
  referencedNodes?: string[];
  generatedNodes?: string[];

  // Context
  contextSnapshot?: ConversationContext;
}

export interface ExtractedEntity {
  type: 'person' | 'file' | 'function' | 'class' | 'concept' | 'framework';
  text: string;
  confidence: number;
  startIndex: number;
  endIndex: number;
}

export interface MessageReaction {
  type: 'like' | 'dislike' | 'helpful' | 'incorrect' | 'unclear';
  userId?: string;
  timestamp: Date;
}

export interface ConversationContext {
  activeFiles?: string[];
  selectedNodes?: string[];
  currentView?: string;
  searchQuery?: string;
  filterState?: any;
  breadcrumbs?: string[];
}

export interface MessageNode extends ConversationNode {
  conversationType: 'message';

  // Enhanced message properties
  content: string;
  rawContent?: string;
  htmlContent?: string;

  // Message structure
  role: 'user' | 'assistant' | 'system';
  messageIndex: number;
  parentMessageId?: string;
  childMessageIds: string[];

  // Message metadata
  metadata: MessageMetadata;
}

export interface MessageBranch {
  id: string;
  messageIds: string[];
  branchPoint: string;
  created: Date;
  isActive: boolean;
  title?: string;
  description?: string;
}

export interface ConversationThread {
  id: string;
  rootMessageId: string;
  messageIds: string[];
  branches: MessageBranch[];
  activeBranchId: string;
  metadata: {
    totalMessages: number;
    startTime: Date;
    lastActivity: Date;
    participants: string[];
    topics: string[];
  };
}

/**
 * Message node creation helper
 */
export function createMessageNode(params: {
  id: string;
  content: string;
  role: 'user' | 'assistant' | 'system';
  conversationId: string;
  messageIndex: number;
  parentMessageId?: string;
  metadata?: Partial<MessageMetadata>;
}): MessageNode {
  const now = new Date();

  return {
    id: params.id,
    type: 'conversation',
    conversationType: 'message',
    label: `${params.role} message`,
    description: params.content.substring(0, 100) + (params.content.length > 100 ? '...' : ''),
    content: params.content,
    rawContent: params.content,
    role: params.role,
    messageIndex: params.messageIndex,
    parentMessageId: params.parentMessageId,
    childMessageIds: [],
    participants: [params.role],
    startTime: now.toISOString(),
    endTime: now.toISOString(),
    messages: [{
      id: params.id,
      role: params.role,
      content: params.content,
      timestamp: now.toISOString()
    }],
    metadata: {
      createdAt: now,
      updatedAt: now,
      role: params.role,
      messageIndex: params.messageIndex,
      conversationId: params.conversationId,
      contentType: detectContentType(params.content),
      childMessageIds: [],
      ...params.metadata
    }
  };
}

/**
 * Detect content type from message
 */
function detectContentType(content: string): 'text' | 'code' | 'mixed' | 'error' {
  const codeBlockRegex = /```[\s\S]*?```/g;
  const inlineCodeRegex = /`[^`]+`/g;
  const errorKeywords = ['error', 'exception', 'failed', 'stack trace'];

  const codeBlocks = content.match(codeBlockRegex);
  const inlineCode = content.match(inlineCodeRegex);
  const hasError = errorKeywords.some(keyword =>
    content.toLowerCase().includes(keyword.toLowerCase())
  );

  if (hasError) return 'error';
  if (codeBlocks && codeBlocks.length > 0) {
    const codeLength = codeBlocks.join('').length;
    const totalLength = content.length;
    return codeLength > totalLength * 0.3 ? 'code' : 'mixed';
  }
  if (inlineCode && inlineCode.length > 2) return 'mixed';

  return 'text';
}

/**
 * Message relationship helpers
 */
export function isUserMessage(message: MessageNode): boolean {
  return message.role === 'user';
}

export function isAssistantMessage(message: MessageNode): boolean {
  return message.role === 'assistant';
}

export function isSystemMessage(message: MessageNode): boolean {
  return message.role === 'system';
}

export function isRootMessage(message: MessageNode): boolean {
  return !message.parentMessageId;
}

export function isBranchPoint(message: MessageNode): boolean {
  return message.childMessageIds.length > 1;
}

export function getMessageDepth(message: MessageNode, messages: Map<string, MessageNode>): number {
  let depth = 0;
  let current = message;

  while (current.parentMessageId) {
    const parent = messages.get(current.parentMessageId);
    if (!parent) break;
    current = parent;
    depth++;
  }

  return depth;
}

export function getConversationPath(
  messageId: string,
  messages: Map<string, MessageNode>
): MessageNode[] {
  const path: MessageNode[] = [];
  let currentId: string | undefined = messageId;

  while (currentId) {
    const message = messages.get(currentId);
    if (!message) break;

    path.unshift(message);
    currentId = message.parentMessageId;
  }

  return path;
}

export function getBranchPaths(
  rootMessage: MessageNode,
  messages: Map<string, MessageNode>
): MessageNode[][] {
  const paths: MessageNode[][] = [];

  function exploreBranch(message: MessageNode, currentPath: MessageNode[]): void {
    const newPath = [...currentPath, message];

    if (message.childMessageIds.length === 0) {
      // Leaf node - complete path
      paths.push(newPath);
    } else {
      // Continue exploring each child branch
      for (const childId of message.childMessageIds) {
        const child = messages.get(childId);
        if (child) {
          exploreBranch(child, newPath);
        }
      }
    }
  }

  exploreBranch(rootMessage, []);
  return paths;
}