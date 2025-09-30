import { GraphBuilder } from './GraphBuilder';
import { ConversationNode } from '../types/NodeTypes';
import { EdgeRelationType } from '../types/EdgeTypes';

export interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface ConversationData {
  id: string;
  title?: string;
  participants?: string[];
  messages: ConversationMessage[];
  metadata?: Record<string, any>;
}

export interface ParsedConversation {
  conversation: ConversationNode;
  codeReferences: string[];
  documentReferences: string[];
  topics: string[];
}

/**
 * Builds graph from conversation history (chat logs, Claude conversations, etc.)
 */
export class ConversationGraphBuilder extends GraphBuilder {
  private conversationCache = new Map<string, ConversationNode>();

  /**
   * Implement abstract build method from GraphBuilder
   */
  async build(data: any): Promise<any> {
    if (data.messages) {
      return await this.processConversation(data);
    }
    return this.store;
  }

  /**
   * Process conversation data
   */
  async processConversation(data: ConversationData): Promise<ParsedConversation> {
    const parsed = this.parseConversation(data);
    const { conversation, codeReferences, documentReferences, topics } = parsed;

    // Add conversation node to graph
    this.store.addNode(conversation);
    this.conversationCache.set(conversation.id, conversation);

    // Create message nodes
    for (const message of data.messages) {
      const messageNode = this.createMessageNode(conversation, message);
      this.store.addNode(messageNode);

      // Connect message to conversation
      this.store.addEdge({
        id: `${conversation.id}-relates_to-${messageNode.id}`,
        source: conversation.id,
        target: messageNode.id,
        type: 'relates_to',
        bidirectional: false,
        weight: 1,
        metadata: { relationship: 'contains' }
      });
    }

    // Create code reference edges
    for (const ref of codeReferences) {
      this.createCodeReference(conversation, ref);
    }

    // Create document reference edges
    for (const ref of documentReferences) {
      this.createDocumentReference(conversation, ref);
    }

    // Create topic nodes and edges
    for (const topic of topics) {
      this.createTopicNode(conversation, topic);
    }

    // Build conversation flow
    this.buildConversationFlow(conversation, data.messages);

    return parsed;
  }

  /**
   * Parse conversation to extract references and topics
   */
  private parseConversation(data: ConversationData): ParsedConversation {
    const nodeId = this.generateNodeId(`conversation-${data.id}`);

    const conversation: ConversationNode = {
      id: nodeId,
      type: 'conversation',
      label: data.title || `Conversation ${data.id}`,
      description: this.generateConversationSummary(data.messages),
      metadata: {
        conversationId: data.id,
        messageCount: data.messages.length,
        participants: data.participants || ['user', 'assistant'],
        startTime: data.messages[0]?.timestamp,
        endTime: data.messages[data.messages.length - 1]?.timestamp,
        ...data.metadata
      },
      messages: data.messages,
      participants: data.participants || ['user', 'assistant'],
      startTime: data.messages[0]?.timestamp || new Date().toISOString(),
      endTime: data.messages[data.messages.length - 1]?.timestamp || new Date().toISOString()
    };

    // Extract references from all messages
    const allContent = data.messages.map(m => m.content).join('\n');
    const codeReferences = this.extractCodeReferences(allContent);
    const documentReferences = this.extractDocumentReferences(allContent);
    const topics = this.extractTopics(data.messages);

    return {
      conversation,
      codeReferences,
      documentReferences,
      topics
    };
  }

  /**
   * Create a message node
   */
  private createMessageNode(
    conversation: ConversationNode,
    message: ConversationMessage
  ): ConversationNode {
    const nodeId = this.generateNodeId(`message-${message.id}`);

    return {
      id: nodeId,
      type: 'conversation',
      label: `Message from ${message.role}`,
      description: message.content.substring(0, 200),
      metadata: {
        conversationId: conversation.id,
        messageId: message.id,
        role: message.role,
        timestamp: message.timestamp,
        contentLength: message.content.length,
        ...message.metadata
      },
      messages: [message],
      participants: [message.role],
      startTime: message.timestamp,
      endTime: message.timestamp
    };
  }

  /**
   * Extract code references from content
   */
  private extractCodeReferences(content: string): string[] {
    const references: string[] = [];

    // Look for file paths
    const fileRegex = /(?:^|\s|["`'])([a-zA-Z0-9_\-/]+\.(ts|tsx|js|jsx|py|java|cpp|h|cs))(?:\s|["`']|$)/gm;
    let match;
    while ((match = fileRegex.exec(content)) !== null) {
      references.push(match[1]);
    }

    // Look for function/class names in code blocks
    const codeBlockRegex = /```[\w]*\n([\s\S]*?)```/g;
    while ((match = codeBlockRegex.exec(content)) !== null) {
      const code = match[1];

      // Extract function names
      const funcRegex = /(?:function|def|func)\s+([a-zA-Z_][a-zA-Z0-9_]*)/g;
      let funcMatch;
      while ((funcMatch = funcRegex.exec(code)) !== null) {
        references.push(funcMatch[1]);
      }

      // Extract class names
      const classRegex = /(?:class|interface|struct)\s+([a-zA-Z_][a-zA-Z0-9_]*)/g;
      let classMatch;
      while ((classMatch = classRegex.exec(code)) !== null) {
        references.push(classMatch[1]);
      }
    }

    // Look for inline code references
    const inlineCodeRegex = /`([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*)`/g;
    while ((match = inlineCodeRegex.exec(content)) !== null) {
      references.push(match[1]);
    }

    return [...new Set(references)];
  }

  /**
   * Extract document references
   */
  private extractDocumentReferences(content: string): string[] {
    const references: string[] = [];

    // Look for markdown links
    const linkRegex = /\[([^\]]+)\]\(([^)]+\.(?:md|txt|rst|adoc))\)/g;
    let match;
    while ((match = linkRegex.exec(content)) !== null) {
      references.push(match[2]);
    }

    // Look for documentation file mentions
    const docRegex = /(?:^|\s)([a-zA-Z0-9_\-/]+\.(?:md|markdown|txt|rst|adoc))(?:\s|$)/gm;
    while ((match = docRegex.exec(content)) !== null) {
      references.push(match[1]);
    }

    return [...new Set(references)];
  }

  /**
   * Extract topics from conversation
   */
  private extractTopics(messages: ConversationMessage[]): string[] {
    const topics = new Set<string>();

    // Extract topics based on key phrases and questions
    for (const message of messages) {
      const content = message.content.toLowerCase();

      // Extract from questions
      if (content.includes('?')) {
        const questions = content.split('?').filter(q => q.trim().length > 10);
        for (const question of questions) {
          const topic = this.extractTopicFromQuestion(question);
          if (topic) topics.add(topic);
        }
      }

      // Extract from statements about specific topics
      const topicPhrases = [
        'about', 'regarding', 'concerning', 'related to',
        'implement', 'create', 'build', 'fix', 'debug',
        'optimize', 'refactor', 'test', 'deploy'
      ];

      for (const phrase of topicPhrases) {
        const regex = new RegExp(`${phrase}\\s+([a-z]+(?:\\s+[a-z]+){0,2})`, 'gi');
        let match;
        while ((match = regex.exec(content)) !== null) {
          const topic = match[1].trim();
          if (topic.length > 3) {
            topics.add(topic);
          }
        }
      }
    }

    // Limit to most relevant topics
    return Array.from(topics).slice(0, 10);
  }

  /**
   * Extract topic from a question
   */
  private extractTopicFromQuestion(question: string): string | null {
    const cleaned = question
      .replace(/^(what|how|why|when|where|who|which)\s+/i, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (cleaned.length > 5 && cleaned.length < 50) {
      // Extract the main subject
      const words = cleaned.split(' ');
      if (words.length <= 5) {
        return cleaned;
      } else {
        return words.slice(0, 5).join(' ');
      }
    }

    return null;
  }

  /**
   * Generate conversation summary
   */
  private generateConversationSummary(messages: ConversationMessage[]): string {
    if (messages.length === 0) return 'Empty conversation';

    // Get first user message and first assistant response
    const firstUser = messages.find(m => m.role === 'user');
    const firstAssistant = messages.find(m => m.role === 'assistant');

    let summary = '';

    if (firstUser) {
      summary += firstUser.content.substring(0, 100);
      if (firstUser.content.length > 100) summary += '...';
    }

    if (firstAssistant && summary.length < 150) {
      summary += ' | Response: ' + firstAssistant.content.substring(0, 100);
      if (firstAssistant.content.length > 100) summary += '...';
    }

    return summary || 'Conversation with no clear summary';
  }

  /**
   * Build conversation flow graph
   */
  private buildConversationFlow(
    conversation: ConversationNode,
    messages: ConversationMessage[]
  ): void {
    for (let i = 0; i < messages.length - 1; i++) {
      const currentId = this.generateNodeId(`message-${messages[i].id}`);
      const nextId = this.generateNodeId(`message-${messages[i + 1].id}`);

      // Create flow edge between consecutive messages
      this.store.addEdge({
        id: `${currentId}-flow-${nextId}`,
        source: currentId,
        target: nextId,
        type: 'follows',
        bidirectional: false,
        weight: 1,
        metadata: {
          order: i,
          timeDelta: this.calculateTimeDelta(
            messages[i].timestamp,
            messages[i + 1].timestamp
          )
        }
      });

      // Create response edges between user and assistant
      if (messages[i].role === 'user' && messages[i + 1].role === 'assistant') {
        this.store.addEdge({
          id: `${currentId}-responds-${nextId}`,
          source: nextId,
          target: currentId,
          type: 'responds',
          bidirectional: false,
          weight: 0.9,
          metadata: {}
        });
      }
    }
  }

  /**
   * Calculate time delta between timestamps
   */
  private calculateTimeDelta(timestamp1: string, timestamp2: string): number {
    const time1 = new Date(timestamp1).getTime();
    const time2 = new Date(timestamp2).getTime();
    return Math.abs(time2 - time1);
  }

  /**
   * Create code reference edge
   */
  private createCodeReference(conversation: ConversationNode, reference: string): void {
    const codeNodes = this.store.getNodesByType('code');

    for (const node of codeNodes) {
      const codeNode = node as any;
      if (
        codeNode.label === reference ||
        codeNode.label.includes(reference) ||
        (codeNode.metadata?.filePath &&
          codeNode.metadata.filePath.includes(reference))
      ) {
        this.store.addEdge({
          id: `${conversation.id}-references-${node.id}`,
          source: conversation.id,
          target: node.id,
          type: 'references',
          bidirectional: false,
          weight: 0.7,
          metadata: {}
        });
      }
    }
  }

  /**
   * Create document reference edge
   */
  private createDocumentReference(conversation: ConversationNode, reference: string): void {
    const documentNodes = this.store.getNodesByType('document');

    for (const node of documentNodes) {
      const docNode = node as any;
      if (
        docNode.label === reference ||
        (docNode.metadata?.filePath &&
          docNode.metadata.filePath.includes(reference))
      ) {
        this.store.addEdge({
          id: `${conversation.id}-references-${node.id}`,
          source: conversation.id,
          target: node.id,
          type: 'references',
          bidirectional: false,
          weight: 0.7,
          metadata: {}
        });
      }
    }
  }

  /**
   * Create topic node
   */
  private createTopicNode(conversation: ConversationNode, topic: string): void {
    const topicId = this.generateNodeId(`topic-${topic}`);

    // Check if topic node exists
    let topicNode = this.store.getNode(topicId);

    if (!topicNode) {
      // Create new topic node
      topicNode = {
        id: topicId,
        type: 'conversation',
        label: `Topic: ${topic}`,
        description: `Discussion topic: ${topic}`,
        metadata: {
          isTopic: true,
          topic,
          conversationCount: 1
        },
        messages: [],
        participants: [],
        startTime: conversation.startTime,
        endTime: conversation.endTime
      } as ConversationNode;

      this.store.addNode(topicNode);
    } else {
      // Update topic node metadata
      if (topicNode.metadata) {
        topicNode.metadata.conversationCount =
          (topicNode.metadata.conversationCount || 0) + 1;
      }
    }

    // Connect conversation to topic
    this.store.addEdge({
      id: `${conversation.id}-discusses-${topicId}`,
      source: conversation.id,
      target: topicId,
      type: 'discusses',
      bidirectional: false,
      weight: 0.6,
      metadata: {}
    });
  }

  /**
   * Process multiple conversations and connect related ones
   */
  async processConversations(conversations: ConversationData[]): Promise<void> {
    // Process each conversation
    for (const conv of conversations) {
      await this.processConversation(conv);
    }

    // Connect related conversations
    this.connectRelatedConversations();
  }

  /**
   * Connect conversations that discuss similar topics
   */
  private connectRelatedConversations(): void {
    const conversations = Array.from(this.conversationCache.values());

    for (let i = 0; i < conversations.length; i++) {
      for (let j = i + 1; j < conversations.length; j++) {
        const similarity = this.calculateConversationSimilarity(
          conversations[i],
          conversations[j]
        );

        if (similarity > 0.3) {
          this.store.addEdge({
            id: `${conversations[i].id}-related-${conversations[j].id}`,
            source: conversations[i].id,
            target: conversations[j].id,
            type: 'related',
            bidirectional: true,
            weight: similarity,
            metadata: {}
          });
        }
      }
    }
  }

  /**
   * Calculate similarity between conversations
   */
  private calculateConversationSimilarity(
    conv1: ConversationNode,
    conv2: ConversationNode
  ): number {
    const content1 = (conv1.messages || []).map(m => m.content).join(' ').toLowerCase();
    const content2 = (conv2.messages || []).map(m => m.content).join(' ').toLowerCase();

    // Extract key terms
    const terms1 = this.extractKeyTerms(content1);
    const terms2 = this.extractKeyTerms(content2);

    // Calculate Jaccard similarity
    const intersection = terms1.filter(t => terms2.includes(t));
    const union = [...new Set([...terms1, ...terms2])];

    if (union.length === 0) return 0;

    // Check for shared code references
    const refs1 = this.extractCodeReferences(content1);
    const refs2 = this.extractCodeReferences(content2);
    const sharedRefs = refs1.filter(r => refs2.includes(r));

    const textSimilarity = intersection.length / union.length;
    const refSimilarity = sharedRefs.length > 0 ? 0.2 : 0;

    return Math.min(textSimilarity + refSimilarity, 1);
  }

  /**
   * Extract key terms from content
   */
  private extractKeyTerms(content: string): string[] {
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at',
      'to', 'for', 'of', 'with', 'by', 'as', 'is', 'was', 'are',
      'were', 'been', 'be', 'have', 'has', 'had', 'do', 'does'
    ]);

    const terms = content
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(term => term.length > 3 && !stopWords.has(term));

    // Count frequency and return top terms
    const frequency = new Map<string, number>();
    for (const term of terms) {
      frequency.set(term, (frequency.get(term) || 0) + 1);
    }

    return Array.from(frequency.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([term]) => term);
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.conversationCache.clear();
  }
}