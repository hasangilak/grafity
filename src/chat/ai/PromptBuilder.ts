/**
 * Prompt builder for creating context-aware AI prompts
 */

import { ExtractedContext } from '../context/ContextExtractor';
import { ParsedMessage } from '../parsers/MessageParser';
import { MessageNode, ConversationContext } from '../models/MessageNode';
import { AnyGraphNode, CodeNode, DocumentNode, BusinessNode } from '../../core/graph-engine/types/NodeTypes';

export interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  template: string;
  requiredContext: string[];
  outputFormat: 'text' | 'json' | 'markdown' | 'code';
  examples?: PromptExample[];
}

export interface PromptExample {
  input: string;
  expectedOutput: string;
  context?: string;
}

export interface BuiltPrompt {
  prompt: string;
  metadata: {
    templateId: string;
    contextNodes: number;
    codeReferences: number;
    documentReferences: number;
    totalTokens?: number;
    buildTime: number;
  };
  systemPrompt?: string;
  userPrompt: string;
  contextSummary: string;
}

export interface PromptBuildOptions {
  includeCode?: boolean;
  includeDocuments?: boolean;
  includeBusiness?: boolean;
  maxContextLength?: number;
  prioritizeRecent?: boolean;
  includeConversationHistory?: boolean;
  technicalLevel?: 'beginner' | 'intermediate' | 'advanced';
  responseStyle?: 'concise' | 'detailed' | 'visual' | 'step-by-step';
  includeExamples?: boolean;
}

/**
 * Builds context-aware prompts for AI interactions
 */
export class PromptBuilder {
  private templates: Map<string, PromptTemplate>;
  private defaultOptions: Required<PromptBuildOptions>;

  constructor() {
    this.templates = new Map();
    this.defaultOptions = {
      includeCode: true,
      includeDocuments: true,
      includeBusiness: false,
      maxContextLength: 4000,
      prioritizeRecent: true,
      includeConversationHistory: true,
      technicalLevel: 'intermediate',
      responseStyle: 'detailed',
      includeExamples: false
    };

    this.initializeDefaultTemplates();
  }

  /**
   * Build a prompt for a parsed message with context
   */
  buildPrompt(
    parsedMessage: ParsedMessage,
    context: ExtractedContext,
    templateId: string = 'general_assistance',
    options: PromptBuildOptions = {}
  ): BuiltPrompt {
    const startTime = Date.now();
    const opts = { ...this.defaultOptions, ...options };

    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    // Build context summary
    const contextSummary = this.buildContextSummary(context, opts);

    // Build system prompt
    const systemPrompt = this.buildSystemPrompt(template, context, opts);

    // Build user prompt
    const userPrompt = this.buildUserPrompt(parsedMessage, template, context, opts);

    // Combine into final prompt
    const prompt = this.combinePromptParts(systemPrompt, userPrompt, contextSummary);

    return {
      prompt,
      systemPrompt,
      userPrompt,
      contextSummary,
      metadata: {
        templateId,
        contextNodes: context.relevantNodes.length,
        codeReferences: context.referencedFiles.length,
        documentReferences: context.relatedDocuments.length,
        totalTokens: this.estimateTokenCount(prompt),
        buildTime: Date.now() - startTime
      }
    };
  }

  /**
   * Build a prompt for code-specific questions
   */
  buildCodePrompt(
    message: string,
    codeContext: CodeNode[],
    intent: 'debug' | 'explain' | 'refactor' | 'optimize' | 'test',
    options: PromptBuildOptions = {}
  ): BuiltPrompt {
    const templateId = `code_${intent}`;
    const template = this.templates.get(templateId) || this.templates.get('code_general')!;

    const systemPrompt = this.buildCodeSystemPrompt(intent, options.technicalLevel || 'intermediate');
    const contextSummary = this.buildCodeContextSummary(codeContext);
    const userPrompt = this.buildCodeUserPrompt(message, codeContext, intent);

    const prompt = this.combinePromptParts(systemPrompt, userPrompt, contextSummary);

    return {
      prompt,
      systemPrompt,
      userPrompt,
      contextSummary,
      metadata: {
        templateId,
        contextNodes: codeContext.length,
        codeReferences: codeContext.length,
        documentReferences: 0,
        totalTokens: this.estimateTokenCount(prompt),
        buildTime: Date.now()
      }
    };
  }

  /**
   * Build a prompt for conversation continuation
   */
  buildContinuationPrompt(
    conversationHistory: MessageNode[],
    currentMessage: ParsedMessage,
    context: ExtractedContext,
    options: PromptBuildOptions = {}
  ): BuiltPrompt {
    const template = this.templates.get('conversation_continuation')!;
    const opts = { ...this.defaultOptions, ...options };

    const systemPrompt = this.buildContinuationSystemPrompt(opts);
    const conversationSummary = this.buildConversationSummary(conversationHistory);
    const contextSummary = this.buildContextSummary(context, opts);
    const userPrompt = this.buildContinuationUserPrompt(currentMessage, conversationSummary);

    const prompt = this.combinePromptParts(systemPrompt, userPrompt, contextSummary);

    return {
      prompt,
      systemPrompt,
      userPrompt,
      contextSummary: `${contextSummary}\n\n${conversationSummary}`,
      metadata: {
        templateId: 'conversation_continuation',
        contextNodes: context.relevantNodes.length,
        codeReferences: context.referencedFiles.length,
        documentReferences: context.relatedDocuments.length,
        totalTokens: this.estimateTokenCount(prompt),
        buildTime: Date.now()
      }
    };
  }

  /**
   * Register a custom prompt template
   */
  registerTemplate(template: PromptTemplate): void {
    this.templates.set(template.id, template);
  }

  /**
   * Get available templates
   */
  getTemplates(): PromptTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * Private helper methods
   */
  private initializeDefaultTemplates(): void {
    // General assistance template
    this.templates.set('general_assistance', {
      id: 'general_assistance',
      name: 'General Assistance',
      description: 'General purpose assistance with context awareness',
      template: `You are an AI assistant helping with software development tasks.
Use the provided context to give accurate, helpful responses.

Context: {context}
User Question: {message}

Please provide a helpful response based on the context and question.`,
      requiredContext: ['relevant_nodes'],
      outputFormat: 'markdown'
    });

    // Code assistance templates
    this.templates.set('code_debug', {
      id: 'code_debug',
      name: 'Code Debugging',
      description: 'Help debug code issues',
      template: `You are a senior software engineer helping debug code issues.

Code Context: {code_context}
Error/Issue: {message}

Please analyze the code and provide debugging suggestions.`,
      requiredContext: ['code_context'],
      outputFormat: 'markdown'
    });

    this.templates.set('code_explain', {
      id: 'code_explain',
      name: 'Code Explanation',
      description: 'Explain how code works',
      template: `You are a technical educator explaining code to developers.

Code to Explain: {code_context}
Specific Question: {message}

Please provide a clear explanation of how this code works.`,
      requiredContext: ['code_context'],
      outputFormat: 'markdown'
    });

    this.templates.set('code_refactor', {
      id: 'code_refactor',
      name: 'Code Refactoring',
      description: 'Suggest code improvements',
      template: `You are a senior developer providing refactoring suggestions.

Current Code: {code_context}
Refactoring Goal: {message}

Please suggest improvements and provide refactored code.`,
      requiredContext: ['code_context'],
      outputFormat: 'markdown'
    });

    // Documentation template
    this.templates.set('documentation_query', {
      id: 'documentation_query',
      name: 'Documentation Query',
      description: 'Answer questions based on documentation',
      template: `You are a technical documentation assistant.

Relevant Documentation: {document_context}
User Question: {message}

Please answer based on the provided documentation.`,
      requiredContext: ['document_context'],
      outputFormat: 'markdown'
    });

    // Conversation continuation template
    this.templates.set('conversation_continuation', {
      id: 'conversation_continuation',
      name: 'Conversation Continuation',
      description: 'Continue an ongoing conversation with context',
      template: `You are continuing an ongoing conversation. Use the conversation history and context to provide a relevant response.

Conversation Context: {conversation_history}
Current Context: {context}
Current Message: {message}

Please continue the conversation naturally.`,
      requiredContext: ['conversation_history', 'context'],
      outputFormat: 'markdown'
    });
  }

  private buildContextSummary(context: ExtractedContext, options: PromptBuildOptions): string {
    const parts: string[] = [];

    if (options.includeCode && context.referencedFiles.length > 0) {
      parts.push(this.buildCodeContextSummary(context.referencedFiles));
    }

    if (options.includeDocuments && context.relatedDocuments.length > 0) {
      parts.push(this.buildDocumentContextSummary(context.relatedDocuments));
    }

    if (options.includeBusiness && context.businessContext.length > 0) {
      parts.push(this.buildBusinessContextSummary(context.businessContext));
    }

    return parts.join('\n\n');
  }

  private buildCodeContextSummary(codeNodes: CodeNode[]): string {
    const summary: string[] = ['## Code Context'];

    for (const node of codeNodes.slice(0, 5)) { // Limit to top 5
      summary.push(`### ${node.label}`);
      summary.push(`File: ${node.filePath}`);
      if (node.snippet) {
        summary.push(`\`\`\`${node.language}\n${node.snippet}\n\`\`\``);
      }
      if (node.description) {
        summary.push(node.description);
      }
      summary.push('');
    }

    return summary.join('\n');
  }

  private buildDocumentContextSummary(documentNodes: DocumentNode[]): string {
    const summary: string[] = ['## Documentation Context'];

    for (const node of documentNodes.slice(0, 3)) { // Limit to top 3
      summary.push(`### ${node.label}`);
      if (node.filePath) {
        summary.push(`Source: ${node.filePath}`);
      }
      if (node.content) {
        const excerpt = node.content.substring(0, 300);
        summary.push(excerpt + (node.content.length > 300 ? '...' : ''));
      }
      summary.push('');
    }

    return summary.join('\n');
  }

  private buildBusinessContextSummary(businessNodes: BusinessNode[]): string {
    const summary: string[] = ['## Business Context'];

    for (const node of businessNodes.slice(0, 3)) {
      summary.push(`### ${node.label}`);
      summary.push(`Type: ${node.businessType}`);
      if (node.priority) {
        summary.push(`Priority: ${node.priority}`);
      }
      if (node.description) {
        summary.push(node.description);
      }
      summary.push('');
    }

    return summary.join('\n');
  }

  private buildSystemPrompt(
    template: PromptTemplate,
    context: ExtractedContext,
    options: PromptBuildOptions
  ): string {
    let systemPrompt = `You are Claude Code, an AI assistant specialized in software development.

Technical Level: ${options.technicalLevel}
Response Style: ${options.responseStyle}

Guidelines:
- Provide accurate, helpful responses based on the provided context
- Reference specific files, functions, or documentation when relevant
- ${options.responseStyle === 'concise' ? 'Keep responses brief and to the point' : 'Provide detailed explanations with examples'}
- ${options.responseStyle === 'step-by-step' ? 'Break down complex tasks into clear steps' : ''}
- Use markdown formatting for better readability
`;

    if (options.includeCode) {
      systemPrompt += `
- When discussing code, reference the specific files and functions mentioned in the context
- Provide code examples when helpful`;
    }

    if (options.includeDocuments) {
      systemPrompt += `
- Reference documentation when available to support your answers`;
    }

    return systemPrompt;
  }

  private buildUserPrompt(
    parsedMessage: ParsedMessage,
    template: PromptTemplate,
    context: ExtractedContext,
    options: PromptBuildOptions
  ): string {
    let userPrompt = `User Message: ${parsedMessage.content}`;

    // Add message analysis
    if (parsedMessage.isQuestion) {
      userPrompt += '\n\nThis appears to be a question.';
    }

    if (parsedMessage.hasErrorContent) {
      userPrompt += '\n\nThe message contains error content that may need debugging assistance.';
    }

    if (parsedMessage.intent.primary !== 'information') {
      userPrompt += `\n\nDetected intent: ${parsedMessage.intent.primary}`;
    }

    return userPrompt;
  }

  private buildCodeSystemPrompt(intent: string, technicalLevel: string): string {
    const intentDescriptions = {
      debug: 'helping debug code issues and find solutions',
      explain: 'explaining how code works in clear terms',
      refactor: 'suggesting code improvements and best practices',
      optimize: 'optimizing code for better performance',
      test: 'creating or improving test coverage'
    };

    return `You are a senior software engineer specializing in ${intentDescriptions[intent as keyof typeof intentDescriptions] || 'code assistance'}.

Technical Level: ${technicalLevel}

Please provide practical, actionable advice with code examples when appropriate.`;
  }

  private buildCodeUserPrompt(message: string, codeContext: CodeNode[], intent: string): string {
    let prompt = `Request: ${message}\n\nIntent: ${intent}`;

    if (codeContext.length > 0) {
      prompt += '\n\nRelevant Code Files:';
      for (const node of codeContext.slice(0, 3)) {
        prompt += `\n- ${node.filePath} (${node.codeType})`;
      }
    }

    return prompt;
  }

  private buildContinuationSystemPrompt(options: PromptBuildOptions): string {
    return `You are continuing an ongoing conversation. Use the conversation history to maintain context and provide relevant follow-up responses.

Response Style: ${options.responseStyle}
Technical Level: ${options.technicalLevel}

Maintain conversational flow while providing helpful information.`;
  }

  private buildConversationSummary(messages: MessageNode[]): string {
    const summary: string[] = ['## Conversation History'];

    // Get last 5 messages for context
    const recentMessages = messages.slice(-5);

    for (const message of recentMessages) {
      summary.push(`**${message.role}**: ${message.content.substring(0, 150)}${message.content.length > 150 ? '...' : ''}`);
    }

    return summary.join('\n');
  }

  private buildContinuationUserPrompt(message: ParsedMessage, conversationSummary: string): string {
    return `${conversationSummary}

**Current User Message**: ${message.content}`;
  }

  private combinePromptParts(systemPrompt: string, userPrompt: string, contextSummary: string): string {
    const parts: string[] = [];

    if (systemPrompt) {
      parts.push(`# System\n${systemPrompt}`);
    }

    if (contextSummary.trim()) {
      parts.push(`# Context\n${contextSummary}`);
    }

    if (userPrompt) {
      parts.push(`# User\n${userPrompt}`);
    }

    return parts.join('\n\n---\n\n');
  }

  private estimateTokenCount(text: string): number {
    // Rough estimation: ~4 characters per token
    return Math.ceil(text.length / 4);
  }
}