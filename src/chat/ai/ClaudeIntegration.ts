/**
 * Enhanced Claude Code CLI integration for graph-based chat
 */

import { ClaudeCodeWrapper, ClaudeConfig, ClaudeResponse } from '../../integrations/claude-code/ClaudeCodeWrapper';
import { BuiltPrompt } from './PromptBuilder';
import { MessageNode } from '../models/MessageNode';
import { ExtractedContext } from '../context/ContextExtractor';

export interface ChatResponse {
  content: string;
  metadata: {
    model: string;
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
    responseTime: number;
    temperature?: number;
    finishReason?: string;
  };
  referencedNodes?: string[];
  generatedNodes?: string[];
  confidence?: number;
  suggestions?: string[];
}

export interface StreamingResponse {
  onChunk: (chunk: string) => void;
  onComplete: (response: ChatResponse) => void;
  onError: (error: Error) => void;
  cancel: () => void;
}

export interface ChatSession {
  id: string;
  conversationId: string;
  model: string;
  temperature: number;
  maxTokens: number;
  systemPrompt?: string;
  messageHistory: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: Date;
  }>;
  totalTokensUsed: number;
  createdAt: Date;
  lastActivity: Date;
}

export interface ClaudeIntegrationConfig extends ClaudeConfig {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  enableStreaming?: boolean;
  enableCache?: boolean;
  cacheExpiryMinutes?: number;
  enableContextOptimization?: boolean;
  maxContextLength?: number;
}

/**
 * Enhanced Claude Code integration with graph context awareness
 */
export class ClaudeIntegration {
  private claudeWrapper: ClaudeCodeWrapper;
  private sessions: Map<string, ChatSession>;
  private responseCache: Map<string, { response: ChatResponse; expiry: number }>;
  private config: Required<ClaudeIntegrationConfig>;

  constructor(config: ClaudeIntegrationConfig = {}) {
    this.config = {
      timeout: 30000,
      maxRetries: 3,
      outputFormat: 'text',
      maxTurns: 1,
      model: 'claude-3-5-sonnet-20241022',
      temperature: 0.7,
      maxTokens: 4000,
      enableStreaming: true,
      enableCache: true,
      cacheExpiryMinutes: 30,
      enableContextOptimization: true,
      maxContextLength: 8000,
      ...config
    };

    this.claudeWrapper = new ClaudeCodeWrapper(this.config);
    this.sessions = new Map();
    this.responseCache = new Map();
  }

  /**
   * Send a message with context and get response
   */
  async sendMessage(
    prompt: BuiltPrompt,
    conversationId?: string,
    sessionConfig?: Partial<ClaudeIntegrationConfig>
  ): Promise<ChatResponse> {
    const startTime = Date.now();

    // Check cache first
    if (this.config.enableCache) {
      const cached = this.getCachedResponse(prompt.prompt);
      if (cached) return cached;
    }

    // Get or create session
    const session = this.getOrCreateSession(conversationId, sessionConfig);

    try {
      // Optimize context if needed
      const optimizedPrompt = this.config.enableContextOptimization ?
        this.optimizePrompt(prompt) : prompt;

      // Prepare Claude command
      const input = this.prepareClaudeInput(optimizedPrompt, session);

      // Execute request
      const response = await this.claudeWrapper.execute(input);

      // Parse and enhance response
      const chatResponse = this.parseClaudeResponse(response, startTime, prompt);

      // Update session
      this.updateSession(session, optimizedPrompt.userPrompt, chatResponse.content);

      // Cache response
      if (this.config.enableCache) {
        this.cacheResponse(prompt.prompt, chatResponse);
      }

      return chatResponse;

    } catch (error) {
      throw new Error(`Claude integration error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Send streaming message
   */
  async sendStreamingMessage(
    prompt: BuiltPrompt,
    callbacks: StreamingResponse,
    conversationId?: string,
    sessionConfig?: Partial<ClaudeIntegrationConfig>
  ): Promise<void> {
    if (!this.config.enableStreaming) {
      // Fallback to regular message
      try {
        const response = await this.sendMessage(prompt, conversationId, sessionConfig);
        callbacks.onComplete(response);
      } catch (error) {
        callbacks.onError(error instanceof Error ? error : new Error(String(error)));
      }
      return;
    }

    const startTime = Date.now();
    const session = this.getOrCreateSession(conversationId, sessionConfig);

    try {
      // Optimize context if needed
      const optimizedPrompt = this.config.enableContextOptimization ?
        this.optimizePrompt(prompt) : prompt;

      // Prepare streaming input
      const input = this.prepareClaudeInput(optimizedPrompt, session);

      // Execute streaming request
      await this.executeStreamingRequest(input, callbacks, startTime, prompt, session, optimizedPrompt);

    } catch (error) {
      callbacks.onError(error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Create a new chat session
   */
  createSession(
    conversationId: string,
    config?: Partial<ClaudeIntegrationConfig>
  ): ChatSession {
    const sessionConfig = { ...this.config, ...config };

    const session: ChatSession = {
      id: `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      conversationId,
      model: sessionConfig.model,
      temperature: sessionConfig.temperature,
      maxTokens: sessionConfig.maxTokens,
      systemPrompt: undefined,
      messageHistory: [],
      totalTokensUsed: 0,
      createdAt: new Date(),
      lastActivity: new Date()
    };

    this.sessions.set(session.id, session);
    return session;
  }

  /**
   * Get session information
   */
  getSession(sessionId: string): ChatSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Update session system prompt
   */
  updateSessionPrompt(sessionId: string, systemPrompt: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.systemPrompt = systemPrompt;
      session.lastActivity = new Date();
    }
  }

  /**
   * Clear session history
   */
  clearSessionHistory(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.messageHistory = [];
      session.totalTokensUsed = 0;
      session.lastActivity = new Date();
    }
  }

  /**
   * Generate context-aware response with graph knowledge
   */
  async generateContextAwareResponse(
    message: string,
    context: ExtractedContext,
    conversationHistory?: MessageNode[],
    options?: {
      includeCodeSuggestions?: boolean;
      includeDocumentReferences?: boolean;
      responseStyle?: 'concise' | 'detailed' | 'step-by-step';
    }
  ): Promise<ChatResponse & { contextUsed: ExtractedContext }> {
    // This would integrate with PromptBuilder
    const promptBuilder = await import('./PromptBuilder').then(m => new m.PromptBuilder());

    // Parse message if needed
    const parsedMessage = await import('../parsers/MessageParser').then(m =>
      m.MessageParser.parseMessage(message, 'user')
    );

    // Build context-aware prompt
    const prompt = promptBuilder.buildPrompt(parsedMessage, context, 'general_assistance', {
      responseStyle: options?.responseStyle || 'detailed',
      includeCode: options?.includeCodeSuggestions !== false,
      includeDocuments: options?.includeDocumentReferences !== false
    });

    // Generate response
    const response = await this.sendMessage(prompt);

    return {
      ...response,
      contextUsed: context
    };
  }

  /**
   * Get conversation suggestions based on context
   */
  async getConversationSuggestions(
    context: ExtractedContext,
    lastMessage?: MessageNode
  ): Promise<string[]> {
    const suggestions: string[] = [];

    // Generate suggestions based on context
    if (context.referencedFiles.length > 0) {
      suggestions.push("Tell me more about the code structure");
      suggestions.push("How can I improve this code?");
      suggestions.push("Are there any potential issues here?");
    }

    if (context.relatedDocuments.length > 0) {
      suggestions.push("Show me related documentation");
      suggestions.push("What does the documentation say about this?");
    }

    if (lastMessage?.metadata.hasErrorContent) {
      suggestions.push("Help me debug this error");
      suggestions.push("What might be causing this issue?");
      suggestions.push("How can I fix this problem?");
    }

    return suggestions.slice(0, 5); // Limit to 5 suggestions
  }

  /**
   * Private helper methods
   */
  private getOrCreateSession(
    conversationId?: string,
    config?: Partial<ClaudeIntegrationConfig>
  ): ChatSession {
    if (!conversationId) {
      conversationId = `conv-${Date.now()}`;
    }

    // Find existing session for conversation
    const existingSession = Array.from(this.sessions.values())
      .find(session => session.conversationId === conversationId);

    if (existingSession) {
      existingSession.lastActivity = new Date();
      return existingSession;
    }

    // Create new session
    return this.createSession(conversationId, config);
  }

  private optimizePrompt(prompt: BuiltPrompt): BuiltPrompt {
    if (prompt.metadata.totalTokens && prompt.metadata.totalTokens <= this.config.maxContextLength) {
      return prompt; // No optimization needed
    }

    // Truncate context if too long
    const maxContextLength = this.config.maxContextLength - 1000; // Reserve space for user prompt
    let optimizedContext = prompt.contextSummary;

    if (optimizedContext.length > maxContextLength) {
      optimizedContext = optimizedContext.substring(0, maxContextLength) + '\n\n[Context truncated...]';
    }

    return {
      ...prompt,
      contextSummary: optimizedContext,
      prompt: prompt.prompt.replace(prompt.contextSummary, optimizedContext)
    };
  }

  private prepareClaudeInput(prompt: BuiltPrompt, session: ChatSession): string {
    let input = '';

    // Add system prompt if available
    if (prompt.systemPrompt) {
      input += `System: ${prompt.systemPrompt}\n\n`;
    }

    // Add conversation history (last 3 exchanges)
    const recentHistory = session.messageHistory.slice(-6); // Last 6 messages (3 exchanges)
    if (recentHistory.length > 0) {
      input += 'Previous conversation:\n';
      for (const msg of recentHistory) {
        input += `${msg.role}: ${msg.content}\n`;
      }
      input += '\n';
    }

    // Add context
    if (prompt.contextSummary.trim()) {
      input += `Context:\n${prompt.contextSummary}\n\n`;
    }

    // Add current user message
    input += `User: ${prompt.userPrompt}`;

    return input;
  }

  private parseClaudeResponse(
    response: string,
    startTime: number,
    prompt: BuiltPrompt
  ): ChatResponse {
    const responseTime = Date.now() - startTime;

    // Extract any node references from response
    const referencedNodes = this.extractNodeReferences(response);

    // Estimate token usage
    const promptTokens = prompt.metadata.totalTokens || 0;
    const completionTokens = Math.ceil(response.length / 4);

    return {
      content: response.trim(),
      metadata: {
        model: this.config.model,
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
        responseTime,
        temperature: this.config.temperature,
        finishReason: 'stop'
      },
      referencedNodes,
      confidence: this.calculateResponseConfidence(response),
      suggestions: []
    };
  }

  private async executeStreamingRequest(
    input: string,
    callbacks: StreamingResponse,
    startTime: number,
    prompt: BuiltPrompt,
    session: ChatSession,
    optimizedPrompt: BuiltPrompt
  ): Promise<void> {
    // Streaming implementation would use Claude's streaming API
    // For now, simulate streaming by chunking regular response
    try {
      const response = await this.claudeWrapper.execute(input);

      // Simulate streaming by sending chunks
      const chunks = this.chunkResponse(response);
      let fullContent = '';

      for (const chunk of chunks) {
        fullContent += chunk;
        callbacks.onChunk(chunk);

        // Small delay to simulate streaming
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      // Send final response
      const chatResponse = this.parseClaudeResponse(fullContent, startTime, prompt);
      this.updateSession(session, optimizedPrompt.userPrompt, chatResponse.content);

      callbacks.onComplete(chatResponse);

    } catch (error) {
      callbacks.onError(error instanceof Error ? error : new Error(String(error)));
    }
  }

  private chunkResponse(response: string): string[] {
    // Simple chunking by sentences
    const sentences = response.split(/[.!?]+/);
    return sentences.map(s => s.trim()).filter(s => s.length > 0);
  }

  private updateSession(session: ChatSession, userMessage: string, assistantResponse: string): void {
    session.messageHistory.push(
      {
        role: 'user',
        content: userMessage,
        timestamp: new Date()
      },
      {
        role: 'assistant',
        content: assistantResponse,
        timestamp: new Date()
      }
    );

    // Keep only last 20 messages
    if (session.messageHistory.length > 20) {
      session.messageHistory = session.messageHistory.slice(-20);
    }

    session.lastActivity = new Date();

    // Update token usage (rough estimate)
    session.totalTokensUsed += Math.ceil((userMessage.length + assistantResponse.length) / 4);
  }

  private extractNodeReferences(response: string): string[] {
    const references: string[] = [];

    // Look for file path patterns
    const filePattern = /[a-zA-Z0-9_\-/]+\.[a-zA-Z]{1,4}/g;
    const fileMatches = response.match(filePattern);
    if (fileMatches) {
      references.push(...fileMatches);
    }

    // Look for function/class mentions
    const codePattern = /`([a-zA-Z_][a-zA-Z0-9_]*)`/g;
    let match;
    while ((match = codePattern.exec(response)) !== null) {
      references.push(match[1]);
    }

    return [...new Set(references)]; // Remove duplicates
  }

  private calculateResponseConfidence(response: string): number {
    let confidence = 0.7; // Base confidence

    // Increase confidence for specific indicators
    if (response.includes('```')) confidence += 0.1; // Has code examples
    if (response.includes('http')) confidence += 0.05; // Has references
    if (response.length > 200) confidence += 0.1; // Detailed response
    if (response.includes('example') || response.includes('for instance')) confidence += 0.05;

    // Decrease confidence for uncertainty indicators
    if (response.includes('I think') || response.includes('maybe') || response.includes('possibly')) {
      confidence -= 0.1;
    }
    if (response.includes('not sure') || response.includes('unclear')) {
      confidence -= 0.2;
    }

    return Math.max(0.1, Math.min(1.0, confidence));
  }

  private getCachedResponse(prompt: string): ChatResponse | null {
    const cacheKey = this.generateCacheKey(prompt);
    const cached = this.responseCache.get(cacheKey);

    if (cached && cached.expiry > Date.now()) {
      return cached.response;
    }

    return null;
  }

  private cacheResponse(prompt: string, response: ChatResponse): void {
    const cacheKey = this.generateCacheKey(prompt);
    const expiry = Date.now() + (this.config.cacheExpiryMinutes * 60 * 1000);

    this.responseCache.set(cacheKey, { response, expiry });
  }

  private generateCacheKey(prompt: string): string {
    // Simple hash of prompt for caching
    let hash = 0;
    for (let i = 0; i < prompt.length; i++) {
      const char = prompt.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }

  /**
   * Cleanup methods
   */
  clearCache(): void {
    this.responseCache.clear();
  }

  clearOldSessions(olderThanHours: number = 24): void {
    const cutoff = Date.now() - (olderThanHours * 60 * 60 * 1000);

    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.lastActivity.getTime() < cutoff) {
        this.sessions.delete(sessionId);
      }
    }
  }

  getSessionStats(): {
    totalSessions: number;
    activeSessions: number;
    totalTokensUsed: number;
    averageSessionLength: number;
  } {
    const sessions = Array.from(this.sessions.values());
    const activeSessions = sessions.filter(s =>
      Date.now() - s.lastActivity.getTime() < 60 * 60 * 1000 // Active in last hour
    );

    const totalTokens = sessions.reduce((sum, s) => sum + s.totalTokensUsed, 0);
    const averageLength = sessions.length > 0 ?
      sessions.reduce((sum, s) => sum + s.messageHistory.length, 0) / sessions.length : 0;

    return {
      totalSessions: sessions.length,
      activeSessions: activeSessions.length,
      totalTokensUsed: totalTokens,
      averageSessionLength: averageLength
    };
  }
}