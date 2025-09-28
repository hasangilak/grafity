/**
 * Core node types for the Grafity graph engine
 */

export interface GraphNodeMetadata {
  createdAt?: Date;
  updatedAt?: Date;
  confidence?: number;
  source?: string;
  tags?: string[];
  [key: string]: any;
}

export interface GraphNode {
  id: string;
  type: 'code' | 'business' | 'document' | 'conversation' | 'unknown';
  label: string;
  description?: string;
  metadata: GraphNodeMetadata;
}

export interface CodeNode extends GraphNode {
  type: 'code';
  codeType: 'component' | 'function' | 'class' | 'interface' | 'type' | 'variable' | 'file';
  filePath: string;
  lineNumber?: number;
  language: string;
  snippet?: string;
  complexity?: number;
  props?: Array<{
    name: string;
    type: string;
    required: boolean;
  }>;
  hooks?: Array<{
    name: string;
    type: string;
  }>;
}

export interface BusinessNode extends GraphNode {
  type: 'business';
  businessType: 'feature' | 'story' | 'requirement' | 'goal' | 'metric';
  priority?: 'high' | 'medium' | 'low';
  status?: 'planned' | 'in-progress' | 'completed';
  owner?: string;
  value?: number;
  effort?: number;
}

export interface DocumentNode extends GraphNode {
  type: 'document';
  documentType?: 'markdown' | 'comment' | 'readme' | 'spec' | 'api-doc';
  filePath?: string;
  section?: string;
  sections?: any[];
  content?: string;
  author?: string;
}

export interface ConversationNode extends GraphNode {
  type: 'conversation';
  conversationType?: 'message' | 'question' | 'answer' | 'decision' | 'insight';
  participant?: string;
  participants?: string[];
  timestamp?: Date;
  startTime?: string;
  endTime?: string;
  content?: string;
  messages?: any[];
  context?: string;
}

export type AnyGraphNode = CodeNode | BusinessNode | DocumentNode | ConversationNode | GraphNode;

/**
 * Node creation helpers
 */
export function createCodeNode(params: Omit<CodeNode, 'type'>): CodeNode {
  return {
    ...params,
    type: 'code',
    metadata: {
      createdAt: new Date(),
      updatedAt: new Date(),
      ...params.metadata
    }
  };
}

export function createBusinessNode(params: Omit<BusinessNode, 'type'>): BusinessNode {
  return {
    ...params,
    type: 'business',
    metadata: {
      createdAt: new Date(),
      updatedAt: new Date(),
      ...params.metadata
    }
  };
}

export function createDocumentNode(params: Omit<DocumentNode, 'type'>): DocumentNode {
  return {
    ...params,
    type: 'document',
    metadata: {
      createdAt: new Date(),
      updatedAt: new Date(),
      ...params.metadata
    }
  };
}

export function createConversationNode(params: Omit<ConversationNode, 'type'>): ConversationNode {
  return {
    ...params,
    type: 'conversation',
    metadata: {
      createdAt: new Date(),
      updatedAt: new Date(),
      ...params.metadata
    }
  };
}

/**
 * Type guards
 */
export function isCodeNode(node: AnyGraphNode): node is CodeNode {
  return node.type === 'code';
}

export function isBusinessNode(node: AnyGraphNode): node is BusinessNode {
  return node.type === 'business';
}

export function isDocumentNode(node: AnyGraphNode): node is DocumentNode {
  return node.type === 'document';
}

export function isConversationNode(node: AnyGraphNode): node is ConversationNode {
  return node.type === 'conversation';
}