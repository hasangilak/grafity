/**
 * Handler for creating and managing document links in chat conversations
 */

import { GraphStore } from '../../core/graph-engine/GraphStore';
import { DocumentNode, createDocumentNode, AnyGraphNode } from '../../core/graph-engine/types/NodeTypes';
import { GraphEdge } from '../../core/graph-engine/types/EdgeTypes';
import { MessageNode } from '../models/MessageNode';
import { ParsedMessage, ExtractedLink } from '../parsers/MessageParser';
import { ConversationReference } from '../models/ChatGraphStructure';

export interface DocumentReference {
  id: string;
  messageId: string;
  conversationId: string;

  // Document details
  type: 'file' | 'section' | 'link' | 'mention' | 'generated';
  title: string;
  filePath?: string;
  url?: string;
  sectionTitle?: string;
  content?: string;

  // Context
  extractedText: string;
  contextBefore?: string;
  contextAfter?: string;
  quotedText?: string;

  // Metadata
  confidence: number;
  isGenerated: boolean;
  timestamp: Date;
  documentType?: 'markdown' | 'comment' | 'readme' | 'spec' | 'api-doc' | 'tutorial';

  // Graph connections
  linkedNodeIds: string[];
  generatedNodeId?: string;
}

export interface DocumentSection {
  title: string;
  content: string;
  startLine?: number;
  endLine?: number;
  level: number; // heading level
  anchor?: string;
}

export interface DocumentAnalysis {
  sections: DocumentSection[];
  links: string[];
  codeReferences: string[];
  topics: string[];
  documentType: 'markdown' | 'comment' | 'readme' | 'spec' | 'api-doc' | 'tutorial' | 'other';
  language?: string;
  hasCodeExamples: boolean;
  wordCount: number;
  readingTime: number; // in minutes
}

export interface DocumentLinkingResult {
  createdReferences: DocumentReference[];
  linkedNodes: AnyGraphNode[];
  generatedNodes: DocumentNode[];
  extractedSections: DocumentSection[];
  errors: string[];
}

/**
 * Manages document references and their relationships in the graph
 */
export class DocumentLinkHandler {
  private graphStore: GraphStore;
  private references: Map<string, DocumentReference>;

  constructor(graphStore: GraphStore) {
    this.graphStore = graphStore;
    this.references = new Map();
  }

  /**
   * Process a message and create document references
   */
  async processMessage(
    message: MessageNode,
    parsedMessage: ParsedMessage,
    conversationId: string
  ): Promise<DocumentLinkingResult> {
    const result: DocumentLinkingResult = {
      createdReferences: [],
      linkedNodes: [],
      generatedNodes: [],
      extractedSections: [],
      errors: []
    };

    try {
      // Process explicit links
      for (const link of parsedMessage.links) {
        const linkResult = await this.processDocumentLink(message, link, conversationId);
        result.createdReferences.push(...linkResult.createdReferences);
        result.linkedNodes.push(...linkResult.linkedNodes);
        result.generatedNodes.push(...linkResult.generatedNodes);
      }

      // Process file mentions
      for (const mention of parsedMessage.mentions.filter(m => this.isDocumentMention(m))) {
        const mentionResult = await this.processDocumentMention(message, mention, conversationId);
        result.createdReferences.push(...mentionResult.createdReferences);
        result.linkedNodes.push(...mentionResult.linkedNodes);
      }

      // Process quoted documentation
      const quotes = this.extractQuotedContent(parsedMessage.content);
      for (const quote of quotes) {
        const quoteResult = await this.processDocumentQuote(message, quote, conversationId);
        result.createdReferences.push(...quoteResult.createdReferences);
        result.linkedNodes.push(...quoteResult.linkedNodes);
      }

      // Generate documentation if the message contains explanatory content
      if (this.shouldGenerateDocumentation(message, parsedMessage)) {
        const docResult = await this.generateDocumentationFromMessage(message, parsedMessage, conversationId);
        result.generatedNodes.push(...docResult.generatedNodes);
        result.createdReferences.push(...docResult.createdReferences);
        result.extractedSections.push(...docResult.extractedSections);
      }

      return result;

    } catch (error) {
      result.errors.push(`Document linking failed: ${error instanceof Error ? error.message : String(error)}`);
      return result;
    }
  }

  /**
   * Process a document link
   */
  private async processDocumentLink(
    message: MessageNode,
    link: ExtractedLink,
    conversationId: string
  ): Promise<DocumentLinkingResult> {
    const result: DocumentLinkingResult = {
      createdReferences: [],
      linkedNodes: [],
      generatedNodes: [],
      extractedSections: [],
      errors: []
    };

    if (!this.isDocumentLink(link)) {
      return result;
    }

    const reference: DocumentReference = {
      id: `doc-link-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      messageId: message.id,
      conversationId,
      type: link.type === 'file' ? 'file' : 'link',
      title: link.text,
      filePath: link.type === 'file' ? link.url : undefined,
      url: link.type === 'http' ? link.url : undefined,
      extractedText: link.text,
      confidence: 0.8,
      isGenerated: false,
      timestamp: new Date(),
      linkedNodeIds: []
    };

    // Try to find existing document nodes
    const linkedNodes = await this.findMatchingDocumentNodes(link);
    for (const node of linkedNodes) {
      reference.linkedNodeIds.push(node.id);
      this.createReferenceEdge(reference, node);
    }

    result.linkedNodes.push(...linkedNodes);

    this.references.set(reference.id, reference);
    result.createdReferences.push(reference);

    return result;
  }

  /**
   * Process a document mention
   */
  private async processDocumentMention(
    message: MessageNode,
    mention: any,
    conversationId: string
  ): Promise<DocumentLinkingResult> {
    const result: DocumentLinkingResult = {
      createdReferences: [],
      linkedNodes: [],
      generatedNodes: [],
      extractedSections: [],
      errors: []
    };

    const reference: DocumentReference = {
      id: `doc-mention-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      messageId: message.id,
      conversationId,
      type: 'mention',
      title: mention.text,
      filePath: mention.text,
      extractedText: mention.text,
      confidence: mention.confidence || 0.7,
      isGenerated: false,
      timestamp: new Date(),
      linkedNodeIds: []
    };

    // Find matching document nodes
    const linkedNodes = await this.findDocumentNodesByPath(mention.text);
    for (const node of linkedNodes) {
      reference.linkedNodeIds.push(node.id);
      this.createReferenceEdge(reference, node);
    }

    result.linkedNodes.push(...linkedNodes);

    if (reference.linkedNodeIds.length > 0) {
      this.references.set(reference.id, reference);
      result.createdReferences.push(reference);
    }

    return result;
  }

  /**
   * Process quoted documentation content
   */
  private async processDocumentQuote(
    message: MessageNode,
    quote: { text: string; source?: string },
    conversationId: string
  ): Promise<DocumentLinkingResult> {
    const result: DocumentLinkingResult = {
      createdReferences: [],
      linkedNodes: [],
      generatedNodes: [],
      extractedSections: [],
      errors: []
    };

    const reference: DocumentReference = {
      id: `doc-quote-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      messageId: message.id,
      conversationId,
      type: 'section',
      title: `Quoted Documentation`,
      quotedText: quote.text,
      extractedText: quote.text.substring(0, 200),
      confidence: 0.6,
      isGenerated: false,
      timestamp: new Date(),
      linkedNodeIds: []
    };

    // Try to find the source document by content matching
    const linkedNodes = await this.findDocumentNodesByContent(quote.text);
    for (const node of linkedNodes) {
      reference.linkedNodeIds.push(node.id);
      this.createReferenceEdge(reference, node);
    }

    result.linkedNodes.push(...linkedNodes);

    if (reference.linkedNodeIds.length > 0) {
      this.references.set(reference.id, reference);
      result.createdReferences.push(reference);
    }

    return result;
  }

  /**
   * Generate documentation from message content
   */
  private async generateDocumentationFromMessage(
    message: MessageNode,
    parsedMessage: ParsedMessage,
    conversationId: string
  ): Promise<DocumentLinkingResult> {
    const result: DocumentLinkingResult = {
      createdReferences: [],
      linkedNodes: [],
      generatedNodes: [],
      extractedSections: [],
      errors: []
    };

    const analysis = this.analyzeDocumentContent(message.content);

    // Generate documentation node
    const docNode = createDocumentNode({
      id: `generated-doc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      label: this.generateDocumentTitle(message, parsedMessage),
      description: 'AI-generated documentation from conversation',
      documentType: this.determineDocumentType(parsedMessage, analysis),
      content: this.formatDocumentContent(message.content, analysis),
      author: message.role === 'assistant' ? 'Claude AI' : 'User',
      metadata: {
        source: 'conversation_generated',
        conversationId,
        messageId: message.id,
        generatedAt: new Date(),
        wordCount: analysis.wordCount,
        readingTime: analysis.readingTime,
        hasCodeExamples: analysis.hasCodeExamples,
        topics: analysis.topics
      }
    });

    this.graphStore.addNode(docNode);
    result.generatedNodes.push(docNode);

    // Create reference
    const reference: DocumentReference = {
      id: `doc-gen-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      messageId: message.id,
      conversationId,
      type: 'generated',
      title: docNode.label,
      content: docNode.content,
      documentType: docNode.documentType as DocumentReference['documentType'],
      extractedText: message.content.substring(0, 200),
      confidence: 0.8,
      isGenerated: true,
      timestamp: new Date(),
      linkedNodeIds: [docNode.id],
      generatedNodeId: docNode.id
    };

    this.references.set(reference.id, reference);
    result.createdReferences.push(reference);
    result.extractedSections.push(...analysis.sections);

    return result;
  }

  /**
   * Analysis and utility methods
   */
  private isDocumentMention(mention: any): boolean {
    const docExtensions = ['.md', '.txt', '.rst', '.adoc', '.doc', '.docx', '.pdf'];
    const docKeywords = ['readme', 'documentation', 'docs', 'guide', 'tutorial', 'spec', 'api'];

    return docExtensions.some(ext => mention.text.toLowerCase().endsWith(ext)) ||
           docKeywords.some(keyword => mention.text.toLowerCase().includes(keyword));
  }

  private isDocumentLink(link: ExtractedLink): boolean {
    if (link.type === 'file') {
      const docExtensions = ['.md', '.txt', '.rst', '.adoc'];
      return docExtensions.some(ext => link.url.toLowerCase().endsWith(ext));
    }

    if (link.type === 'http') {
      const docDomains = ['docs.', 'documentation.', 'wiki.', 'github.com'];
      return docDomains.some(domain => link.url.toLowerCase().includes(domain));
    }

    return false;
  }

  private extractQuotedContent(content: string): Array<{ text: string; source?: string }> {
    const quotes: Array<{ text: string; source?: string }> = [];

    // Extract blockquotes
    const blockquoteRegex = /^>\s*(.+)$/gm;
    let match;
    while ((match = blockquoteRegex.exec(content)) !== null) {
      quotes.push({ text: match[1] });
    }

    // Extract quoted strings that look like documentation
    const quotedRegex = /"([^"]{50,}?)"/g;
    while ((match = quotedRegex.exec(content)) !== null) {
      if (this.looksLikeDocumentation(match[1])) {
        quotes.push({ text: match[1] });
      }
    }

    return quotes;
  }

  private looksLikeDocumentation(text: string): boolean {
    const docIndicators = [
      'according to', 'documentation', 'spec', 'api', 'tutorial',
      'guide', 'manual', 'reference', 'readme'
    ];

    return docIndicators.some(indicator =>
      text.toLowerCase().includes(indicator)
    ) && text.length > 30;
  }

  private shouldGenerateDocumentation(message: MessageNode, parsedMessage: ParsedMessage): boolean {
    // Generate documentation for assistant responses that are explanatory
    if (message.role !== 'assistant') return false;

    const isExplanatory = parsedMessage.intent.primary === 'explanation' ||
                         parsedMessage.content.length > 300 ||
                         parsedMessage.sections.some(s => s.type === 'heading');

    const hasStructure = parsedMessage.sections.length > 2 ||
                        parsedMessage.codeBlocks.length > 0 ||
                        parsedMessage.content.includes('\n\n');

    return isExplanatory && hasStructure;
  }

  private analyzeDocumentContent(content: string): DocumentAnalysis {
    const analysis: DocumentAnalysis = {
      sections: [],
      links: [],
      codeReferences: [],
      topics: [],
      documentType: 'other',
      hasCodeExamples: false,
      wordCount: 0,
      readingTime: 0
    };

    // Extract sections (markdown-style headings)
    const headingRegex = /^(#{1,6})\s+(.+)$/gm;
    let match;
    while ((match = headingRegex.exec(content)) !== null) {
      analysis.sections.push({
        title: match[2],
        content: '', // Would be filled by extracting content between headings
        level: match[1].length,
        anchor: match[2].toLowerCase().replace(/\s+/g, '-')
      });
    }

    // Extract links
    const linkRegex = /https?:\/\/[^\s]+/g;
    while ((match = linkRegex.exec(content)) !== null) {
      analysis.links.push(match[0]);
    }

    // Extract code references
    const codeRegex = /`([^`]+)`/g;
    while ((match = codeRegex.exec(content)) !== null) {
      analysis.codeReferences.push(match[1]);
    }

    // Check for code examples
    analysis.hasCodeExamples = /```/.test(content) || analysis.codeReferences.length > 3;

    // Calculate word count and reading time
    analysis.wordCount = content.split(/\s+/).length;
    analysis.readingTime = Math.ceil(analysis.wordCount / 200); // 200 WPM average

    // Determine document type
    analysis.documentType = this.classifyDocumentType(content);

    // Extract topics (simple keyword extraction)
    analysis.topics = this.extractTopics(content);

    return analysis;
  }

  private classifyDocumentType(content: string): DocumentAnalysis['documentType'] {
    const lower = content.toLowerCase();

    if (lower.includes('readme') || lower.includes('getting started')) return 'readme';
    if (lower.includes('api') && (lower.includes('endpoint') || lower.includes('method'))) return 'api-doc';
    if (lower.includes('tutorial') || lower.includes('step by step')) return 'tutorial';
    if (lower.includes('spec') || lower.includes('specification')) return 'spec';
    if (content.includes('```') || content.includes('`')) return 'comment';

    return 'markdown';
  }

  private extractTopics(content: string): string[] {
    const topics: string[] = [];

    // Extract from headings
    const headingRegex = /^#+\s+(.+)$/gm;
    let match;
    while ((match = headingRegex.exec(content)) !== null) {
      const heading = match[1].toLowerCase();
      topics.push(heading);
    }

    // Extract technical terms
    const techTerms = [
      'api', 'database', 'server', 'client', 'frontend', 'backend',
      'authentication', 'authorization', 'deployment', 'testing',
      'configuration', 'installation', 'setup', 'development'
    ];

    for (const term of techTerms) {
      if (content.toLowerCase().includes(term)) {
        topics.push(term);
      }
    }

    return [...new Set(topics)].slice(0, 10);
  }

  private generateDocumentTitle(message: MessageNode, parsedMessage: ParsedMessage): string {
    // Try to extract a title from headings
    const headingMatch = message.content.match(/^#+\s+(.+)$/m);
    if (headingMatch) {
      return headingMatch[1];
    }

    // Generate based on intent and content
    if (parsedMessage.intent.primary === 'explanation') {
      return `Explanation: ${parsedMessage.intent.keywords.join(', ')}`;
    }

    // Use first sentence or fallback
    const firstSentence = message.content.split(/[.!?]/)[0];
    if (firstSentence.length > 10 && firstSentence.length < 80) {
      return firstSentence;
    }

    return `Documentation from Conversation`;
  }

  private determineDocumentType(
    parsedMessage: ParsedMessage,
    analysis: DocumentAnalysis
  ): DocumentNode['documentType'] {
    if (analysis.hasCodeExamples) return 'comment';
    if (parsedMessage.intent.primary === 'explanation') return 'markdown';
    return 'comment';
  }

  private formatDocumentContent(content: string, analysis: DocumentAnalysis): string {
    // Add metadata header
    let formatted = `<!-- Generated from conversation at ${new Date().toISOString()} -->\n\n`;

    // Add the original content
    formatted += content;

    // Add footer with metadata
    if (analysis.topics.length > 0) {
      formatted += `\n\n---\n\n**Topics:** ${analysis.topics.join(', ')}`;
    }

    if (analysis.wordCount > 0) {
      formatted += `\n**Word Count:** ${analysis.wordCount} (${analysis.readingTime} min read)`;
    }

    return formatted;
  }

  /**
   * Node finding methods
   */
  private async findMatchingDocumentNodes(link: ExtractedLink): Promise<DocumentNode[]> {
    const allNodes = this.graphStore.getAllNodes().filter(n => n.type === 'document') as DocumentNode[];

    return allNodes.filter(node => {
      if (link.type === 'file' && node.filePath) {
        return node.filePath === link.url ||
               node.filePath.endsWith(link.url) ||
               link.url.endsWith(node.filePath);
      }

      if (link.type === 'http' && node.content) {
        return node.content.includes(link.url) ||
               node.label.toLowerCase().includes(link.text.toLowerCase());
      }

      return false;
    }).slice(0, 5);
  }

  private async findDocumentNodesByPath(filePath: string): Promise<DocumentNode[]> {
    const allNodes = this.graphStore.getAllNodes().filter(n => n.type === 'document') as DocumentNode[];

    return allNodes.filter(node => {
      return node.filePath === filePath ||
             node.filePath?.endsWith(filePath) ||
             filePath.endsWith(node.filePath || '') ||
             node.label.toLowerCase().includes(filePath.toLowerCase());
    });
  }

  private async findDocumentNodesByContent(content: string): Promise<DocumentNode[]> {
    const allNodes = this.graphStore.getAllNodes().filter(n => n.type === 'document') as DocumentNode[];

    // Simple content matching
    return allNodes.filter(node => {
      if (!node.content) return false;

      // Look for similar content (simple string inclusion)
      const quoteLower = content.toLowerCase();
      const nodeLower = node.content.toLowerCase();

      return nodeLower.includes(quoteLower) ||
             this.calculateTextSimilarity(quoteLower, nodeLower) > 0.7;
    }).slice(0, 3);
  }

  private calculateTextSimilarity(text1: string, text2: string): number {
    const words1 = new Set(text1.split(/\s+/).filter(w => w.length > 3));
    const words2 = new Set(text2.split(/\s+/).filter(w => w.length > 3));

    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);

    return union.size > 0 ? intersection.size / union.size : 0;
  }

  /**
   * Edge creation
   */
  private createReferenceEdge(reference: DocumentReference, node: AnyGraphNode): void {
    const edge: GraphEdge = {
      id: `doc-ref-${reference.id}-${node.id}`,
      source: reference.messageId,
      target: node.id,
      type: 'references',
      bidirectional: false,
      weight: reference.confidence,
      metadata: {
        referenceId: reference.id,
        referenceType: reference.type,
        extractedText: reference.extractedText
      }
    };

    this.graphStore.addEdge(edge);
  }

  /**
   * Public query methods
   */
  getReference(id: string): DocumentReference | undefined {
    return this.references.get(id);
  }

  getReferencesByMessage(messageId: string): DocumentReference[] {
    return Array.from(this.references.values())
      .filter(ref => ref.messageId === messageId);
  }

  getReferencesByConversation(conversationId: string): DocumentReference[] {
    return Array.from(this.references.values())
      .filter(ref => ref.conversationId === conversationId);
  }

  getReferencesToNode(nodeId: string): DocumentReference[] {
    return Array.from(this.references.values())
      .filter(ref => ref.linkedNodeIds.includes(nodeId));
  }

  /**
   * Cleanup
   */
  clearReferences(): void {
    this.references.clear();
  }

  removeReferencesForConversation(conversationId: string): void {
    for (const [id, ref] of this.references.entries()) {
      if (ref.conversationId === conversationId) {
        this.references.delete(id);
      }
    }
  }
}