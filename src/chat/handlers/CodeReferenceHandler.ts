/**
 * Handler for creating and managing code references in chat conversations
 */

import { GraphStore } from '../../core/graph-engine/GraphStore';
import { CodeNode, createCodeNode, AnyGraphNode } from '../../core/graph-engine/types/NodeTypes';
import { GraphEdge } from '../../core/graph-engine/types/EdgeTypes';
import { MessageNode } from '../models/MessageNode';
import { ParsedMessage, CodeBlock, InlineCode } from '../parsers/MessageParser';
import { ConversationReference } from '../models/ChatGraphStructure';

export interface CodeReference {
  id: string;
  messageId: string;
  conversationId: string;

  // Reference details
  type: 'file' | 'function' | 'class' | 'variable' | 'snippet' | 'generated';
  name: string;
  filePath?: string;
  lineNumber?: number;
  language?: string;
  content?: string;

  // Context
  extractedText: string;
  contextBefore?: string;
  contextAfter?: string;

  // Metadata
  confidence: number;
  isGenerated: boolean;
  timestamp: Date;

  // Graph connections
  linkedNodeIds: string[];
  generatedNodeId?: string;
}

export interface CodeSnippetAnalysis {
  language: string;
  functions: string[];
  classes: string[];
  imports: string[];
  variables: string[];
  hasErrors: boolean;
  complexity: number;
  isExecutable: boolean;
}

export interface CodeLinkingResult {
  createdReferences: CodeReference[];
  linkedNodes: AnyGraphNode[];
  generatedNodes: CodeNode[];
  errors: string[];
}

/**
 * Manages code references and their relationships in the graph
 */
export class CodeReferenceHandler {
  private graphStore: GraphStore;
  private references: Map<string, CodeReference>;

  constructor(graphStore: GraphStore) {
    this.graphStore = graphStore;
    this.references = new Map();
  }

  /**
   * Process a message and create code references
   */
  async processMessage(
    message: MessageNode,
    parsedMessage: ParsedMessage,
    conversationId: string
  ): Promise<CodeLinkingResult> {
    const result: CodeLinkingResult = {
      createdReferences: [],
      linkedNodes: [],
      generatedNodes: [],
      errors: []
    };

    try {
      // Process code blocks
      for (const codeBlock of parsedMessage.codeBlocks) {
        const blockResult = await this.processCodeBlock(message, codeBlock, conversationId);
        result.createdReferences.push(...blockResult.createdReferences);
        result.linkedNodes.push(...blockResult.linkedNodes);
        result.generatedNodes.push(...blockResult.generatedNodes);
      }

      // Process inline code references
      for (const inlineCode of parsedMessage.inlineCode) {
        const inlineResult = await this.processInlineCode(message, inlineCode, conversationId);
        result.createdReferences.push(...inlineResult.createdReferences);
        result.linkedNodes.push(...inlineResult.linkedNodes);
      }

      // Process file mentions
      for (const mention of parsedMessage.mentions.filter(m => m.type === 'file')) {
        const fileResult = await this.processFileMention(message, mention, conversationId);
        result.createdReferences.push(...fileResult.createdReferences);
        result.linkedNodes.push(...fileResult.linkedNodes);
      }

      // Process function/class mentions
      for (const mention of parsedMessage.mentions.filter(m => m.type === 'function' || m.type === 'class')) {
        const codeResult = await this.processCodeMention(message, mention, conversationId);
        result.createdReferences.push(...codeResult.createdReferences);
        result.linkedNodes.push(...codeResult.linkedNodes);
      }

      return result;

    } catch (error) {
      result.errors.push(`Code reference processing failed: ${error instanceof Error ? error.message : String(error)}`);
      return result;
    }
  }

  /**
   * Process a code block and create appropriate references/nodes
   */
  private async processCodeBlock(
    message: MessageNode,
    codeBlock: CodeBlock,
    conversationId: string
  ): Promise<CodeLinkingResult> {
    const result: CodeLinkingResult = {
      createdReferences: [],
      linkedNodes: [],
      generatedNodes: [],
      errors: []
    };

    // Analyze the code block
    const analysis = this.analyzeCodeSnippet(codeBlock.code, codeBlock.language);

    // Create a reference for the code block
    const reference: CodeReference = {
      id: `code-ref-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      messageId: message.id,
      conversationId,
      type: 'snippet',
      name: `Code Block (${codeBlock.language || 'text'})`,
      language: codeBlock.language,
      content: codeBlock.code,
      extractedText: codeBlock.code.substring(0, 200),
      confidence: analysis.isExecutable ? 0.9 : 0.7,
      isGenerated: message.role === 'assistant',
      timestamp: new Date(),
      linkedNodeIds: []
    };

    // Try to link to existing code nodes
    const linkedNodes = await this.findMatchingCodeNodes(codeBlock.code, analysis);
    for (const node of linkedNodes) {
      reference.linkedNodeIds.push(node.id);
      this.createReferenceEdge(reference, node);
    }

    result.linkedNodes.push(...linkedNodes);

    // Create a new code node if this is significant generated code
    if (message.role === 'assistant' && analysis.isExecutable && codeBlock.code.length > 50) {
      const generatedNode = await this.createGeneratedCodeNode(codeBlock, analysis, message);
      reference.generatedNodeId = generatedNode.id;
      reference.linkedNodeIds.push(generatedNode.id);
      result.generatedNodes.push(generatedNode);
    }

    this.references.set(reference.id, reference);
    result.createdReferences.push(reference);

    return result;
  }

  /**
   * Process inline code and create references
   */
  private async processInlineCode(
    message: MessageNode,
    inlineCode: InlineCode,
    conversationId: string
  ): Promise<CodeLinkingResult> {
    const result: CodeLinkingResult = {
      createdReferences: [],
      linkedNodes: [],
      generatedNodes: [],
      errors: []
    };

    // Skip very short or generic inline code
    if (inlineCode.text.length < 3 || /^[a-z]+$/.test(inlineCode.text)) {
      return result;
    }

    const reference: CodeReference = {
      id: `inline-ref-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      messageId: message.id,
      conversationId,
      type: inlineCode.type === 'function' ? 'function' :
           inlineCode.type === 'variable' ? 'variable' : 'snippet',
      name: inlineCode.text,
      content: inlineCode.text,
      extractedText: inlineCode.text,
      confidence: this.calculateInlineCodeConfidence(inlineCode),
      isGenerated: false,
      timestamp: new Date(),
      linkedNodeIds: []
    };

    // Try to find matching code nodes
    const linkedNodes = await this.findCodeNodesByName(inlineCode.text);
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
   * Process file mentions
   */
  private async processFileMention(
    message: MessageNode,
    mention: any,
    conversationId: string
  ): Promise<CodeLinkingResult> {
    const result: CodeLinkingResult = {
      createdReferences: [],
      linkedNodes: [],
      generatedNodes: [],
      errors: []
    };

    const reference: CodeReference = {
      id: `file-ref-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      messageId: message.id,
      conversationId,
      type: 'file',
      name: mention.text,
      filePath: mention.text,
      extractedText: mention.text,
      confidence: mention.confidence || 0.8,
      isGenerated: false,
      timestamp: new Date(),
      linkedNodeIds: []
    };

    // Find nodes by file path
    const linkedNodes = await this.findCodeNodesByFilePath(mention.text);
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
   * Process function/class mentions
   */
  private async processCodeMention(
    message: MessageNode,
    mention: any,
    conversationId: string
  ): Promise<CodeLinkingResult> {
    const result: CodeLinkingResult = {
      createdReferences: [],
      linkedNodes: [],
      generatedNodes: [],
      errors: []
    };

    const reference: CodeReference = {
      id: `code-mention-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      messageId: message.id,
      conversationId,
      type: mention.type,
      name: mention.text,
      extractedText: mention.text,
      confidence: mention.confidence || 0.7,
      isGenerated: false,
      timestamp: new Date(),
      linkedNodeIds: []
    };

    // Find matching code nodes
    const linkedNodes = await this.findCodeNodesByName(mention.text);
    for (const node of linkedNodes) {
      if (this.isCodeTypeMatch(node, mention.type)) {
        reference.linkedNodeIds.push(node.id);
        this.createReferenceEdge(reference, node);
      }
    }

    result.linkedNodes.push(...linkedNodes);

    if (reference.linkedNodeIds.length > 0) {
      this.references.set(reference.id, reference);
      result.createdReferences.push(reference);
    }

    return result;
  }

  /**
   * Analyze code snippet for structure and complexity
   */
  private analyzeCodeSnippet(code: string, language?: string): CodeSnippetAnalysis {
    const analysis: CodeSnippetAnalysis = {
      language: language || 'text',
      functions: [],
      classes: [],
      imports: [],
      variables: [],
      hasErrors: false,
      complexity: 0,
      isExecutable: false
    };

    if (!language || language === 'text') {
      return analysis;
    }

    // Extract functions
    const functionRegex = /(?:function|def|func|const|let|var)\s+([a-zA-Z_][a-zA-Z0-9_]*)/g;
    let match;
    while ((match = functionRegex.exec(code)) !== null) {
      analysis.functions.push(match[1]);
    }

    // Extract classes
    const classRegex = /(?:class|interface|struct|type)\s+([a-zA-Z_][a-zA-Z0-9_]*)/g;
    while ((match = classRegex.exec(code)) !== null) {
      analysis.classes.push(match[1]);
    }

    // Extract imports (language-specific)
    if (language === 'javascript' || language === 'typescript') {
      const importRegex = /import.*?from\s+['"]([^'"]+)['"]/g;
      while ((match = importRegex.exec(code)) !== null) {
        analysis.imports.push(match[1]);
      }
    } else if (language === 'python') {
      const importRegex = /(?:from\s+(\S+)\s+import|import\s+(\S+))/g;
      while ((match = importRegex.exec(code)) !== null) {
        analysis.imports.push(match[1] || match[2]);
      }
    }

    // Check for errors
    analysis.hasErrors = /error|exception|traceback|stack trace/i.test(code);

    // Calculate complexity (simple metric)
    const lines = code.split('\n').length;
    const branches = (code.match(/if|else|for|while|switch|case/g) || []).length;
    analysis.complexity = Math.min((lines + branches * 2) / 20, 1);

    // Determine if executable
    analysis.isExecutable = this.isExecutableLanguage(language) &&
                           (analysis.functions.length > 0 ||
                            analysis.imports.length > 0 ||
                            code.includes('(') ||
                            code.includes('='));

    return analysis;
  }

  /**
   * Find existing code nodes that match the given code
   */
  private async findMatchingCodeNodes(code: string, analysis: CodeSnippetAnalysis): Promise<CodeNode[]> {
    const matches: CodeNode[] = [];
    const allNodes = this.graphStore.getAllNodes().filter(n => n.type === 'code') as CodeNode[];

    for (const node of allNodes) {
      let score = 0;

      // Check function matches
      for (const func of analysis.functions) {
        if (node.label.includes(func) || node.snippet?.includes(func)) {
          score += 0.3;
        }
      }

      // Check class matches
      for (const cls of analysis.classes) {
        if (node.label.includes(cls) || node.snippet?.includes(cls)) {
          score += 0.3;
        }
      }

      // Check language match
      if (node.language === analysis.language) {
        score += 0.2;
      }

      // Check content similarity
      if (node.snippet && analysis.isExecutable) {
        const similarity = this.calculateCodeSimilarity(code, node.snippet);
        score += similarity * 0.5;
      }

      if (score >= 0.4) {
        matches.push(node);
      }
    }

    return matches.sort((a, b) => {
      // Sort by relevance (simplified)
      const scoreA = this.calculateNodeRelevance(a, code);
      const scoreB = this.calculateNodeRelevance(b, code);
      return scoreB - scoreA;
    }).slice(0, 5); // Limit to top 5 matches
  }

  /**
   * Find code nodes by name/label
   */
  private async findCodeNodesByName(name: string): Promise<CodeNode[]> {
    const allNodes = this.graphStore.getAllNodes().filter(n => n.type === 'code') as CodeNode[];

    return allNodes.filter(node => {
      return node.label.toLowerCase().includes(name.toLowerCase()) ||
             node.description?.toLowerCase().includes(name.toLowerCase()) ||
             (node.snippet?.toLowerCase().includes(name.toLowerCase()));
    }).slice(0, 10);
  }

  /**
   * Find code nodes by file path
   */
  private async findCodeNodesByFilePath(filePath: string): Promise<CodeNode[]> {
    const allNodes = this.graphStore.getAllNodes().filter(n => n.type === 'code') as CodeNode[];

    return allNodes.filter(node => {
      return node.filePath === filePath ||
             node.filePath.endsWith(filePath) ||
             filePath.endsWith(node.filePath) ||
             node.filePath.includes(filePath);
    });
  }

  /**
   * Create a new code node from generated code
   */
  private async createGeneratedCodeNode(
    codeBlock: CodeBlock,
    analysis: CodeSnippetAnalysis,
    message: MessageNode
  ): Promise<CodeNode> {
    const fileName = this.generateFileName(analysis.language, analysis.functions, analysis.classes);

    const codeNode = createCodeNode({
      id: `generated-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      label: this.generateCodeLabel(analysis),
      description: `Generated code from conversation`,
      codeType: this.determineCodeType(analysis),
      filePath: `generated/${fileName}`,
      lineNumber: 1,
      language: analysis.language,
      snippet: codeBlock.code,
      complexity: analysis.complexity,
      metadata: {
        source: 'ai_generated',
        conversationId: message.metadata.conversationId,
        messageId: message.id,
        generatedAt: new Date(),
        isExecutable: analysis.isExecutable,
        functions: analysis.functions,
        classes: analysis.classes,
        imports: analysis.imports
      }
    });

    this.graphStore.addNode(codeNode);
    return codeNode;
  }

  /**
   * Create a reference edge between a reference and a node
   */
  private createReferenceEdge(reference: CodeReference, node: AnyGraphNode): void {
    const edge: GraphEdge = {
      id: `ref-${reference.id}-${node.id}`,
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
   * Helper methods
   */
  private calculateInlineCodeConfidence(inlineCode: InlineCode): number {
    let confidence = 0.5;

    // Boost confidence for specific patterns
    if (inlineCode.type === 'function' && inlineCode.text.includes('(')) confidence += 0.3;
    if (inlineCode.type === 'variable' && /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(inlineCode.text)) confidence += 0.2;
    if (inlineCode.text.includes('.')) confidence += 0.1; // Likely method/property access

    return Math.min(confidence, 1);
  }

  private isExecutableLanguage(language: string): boolean {
    const executableLanguages = [
      'javascript', 'typescript', 'python', 'java', 'cpp', 'c', 'csharp',
      'go', 'rust', 'php', 'ruby', 'swift', 'kotlin', 'scala'
    ];
    return executableLanguages.includes(language.toLowerCase());
  }

  private calculateCodeSimilarity(code1: string, code2: string): number {
    // Simple similarity based on common words/tokens
    const tokens1 = new Set(code1.toLowerCase().split(/\W+/).filter(t => t.length > 2));
    const tokens2 = new Set(code2.toLowerCase().split(/\W+/).filter(t => t.length > 2));

    const intersection = new Set([...tokens1].filter(x => tokens2.has(x)));
    const union = new Set([...tokens1, ...tokens2]);

    return union.size > 0 ? intersection.size / union.size : 0;
  }

  private calculateNodeRelevance(node: CodeNode, code: string): number {
    let relevance = 0;

    if (node.snippet) {
      relevance += this.calculateCodeSimilarity(code, node.snippet) * 0.6;
    }

    if (node.metadata?.updatedAt) {
      const hoursAgo = (Date.now() - node.metadata.updatedAt.getTime()) / (1000 * 60 * 60);
      relevance += Math.max(0, (24 - hoursAgo) / 24) * 0.2;
    }

    return relevance;
  }

  private isCodeTypeMatch(node: CodeNode, mentionType: string): boolean {
    if (mentionType === 'function') {
      return node.codeType === 'function' || node.label.includes('function') || node.snippet?.includes('function');
    }
    if (mentionType === 'class') {
      return node.codeType === 'class' || node.label.includes('class') || node.snippet?.includes('class');
    }
    return true;
  }

  private generateFileName(language: string, functions: string[], classes: string[]): string {
    const ext = this.getFileExtension(language);

    if (classes.length > 0) {
      return `${classes[0]}.${ext}`;
    }
    if (functions.length > 0) {
      return `${functions[0]}.${ext}`;
    }

    return `generated_${Date.now()}.${ext}`;
  }

  private generateCodeLabel(analysis: CodeSnippetAnalysis): string {
    if (analysis.classes.length > 0) {
      return `Class: ${analysis.classes[0]}`;
    }
    if (analysis.functions.length > 0) {
      return `Function: ${analysis.functions[0]}`;
    }

    return `${analysis.language} Code`;
  }

  private determineCodeType(analysis: CodeSnippetAnalysis): CodeNode['codeType'] {
    if (analysis.classes.length > 0) return 'class';
    if (analysis.functions.length > 0) return 'function';
    return 'file';
  }

  private getFileExtension(language: string): string {
    const extensions: Record<string, string> = {
      'javascript': 'js',
      'typescript': 'ts',
      'python': 'py',
      'java': 'java',
      'cpp': 'cpp',
      'c': 'c',
      'csharp': 'cs',
      'go': 'go',
      'rust': 'rs',
      'php': 'php',
      'ruby': 'rb',
      'swift': 'swift'
    };

    return extensions[language.toLowerCase()] || 'txt';
  }

  /**
   * Public query methods
   */
  getReference(id: string): CodeReference | undefined {
    return this.references.get(id);
  }

  getReferencesByMessage(messageId: string): CodeReference[] {
    return Array.from(this.references.values())
      .filter(ref => ref.messageId === messageId);
  }

  getReferencesByConversation(conversationId: string): CodeReference[] {
    return Array.from(this.references.values())
      .filter(ref => ref.conversationId === conversationId);
  }

  getReferencesToNode(nodeId: string): CodeReference[] {
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