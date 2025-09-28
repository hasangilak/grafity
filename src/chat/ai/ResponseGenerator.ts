/**
 * AI response generator that creates context-aware responses and new graph nodes
 */

import { ClaudeIntegration, ChatResponse } from './ClaudeIntegration';
import { PromptBuilder, BuiltPrompt } from './PromptBuilder';
import { ExtractedContext } from '../context/ContextExtractor';
import { ParsedMessage } from '../parsers/MessageParser';
import { MessageNode, createMessageNode } from '../models/MessageNode';
import { AnyGraphNode, createCodeNode, createDocumentNode, createConversationNode } from '../../core/graph-engine/types/NodeTypes';
import { ChatGraphStructure, ConversationReference } from '../models/ChatGraphStructure';

export interface GeneratedResponse {
  messageNode: MessageNode;
  referencedNodes: string[];
  generatedNodes: AnyGraphNode[];
  suggestedActions: SuggestedAction[];
  followUpQuestions: string[];
  confidence: number;
  metadata: ResponseMetadata;
}

export interface SuggestedAction {
  id: string;
  type: 'create_file' | 'modify_code' | 'run_command' | 'open_file' | 'search' | 'explain_concept';
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  parameters?: Record<string, any>;
}

export interface ResponseMetadata {
  generationTime: number;
  tokensUsed: number;
  contextNodes: number;
  processingSteps: string[];
  qualityScore: number;
  hasCodeGeneration: boolean;
  hasFileReferences: boolean;
  responseType: 'explanation' | 'solution' | 'question' | 'error_help' | 'code_review';
}

export interface ResponseGenerationOptions {
  conversationId: string;
  includeCodeGeneration?: boolean;
  includeSuggestions?: boolean;
  generateFollowUps?: boolean;
  maxNewNodes?: number;
  responseStyle?: 'concise' | 'detailed' | 'step-by-step' | 'visual';
  technicalLevel?: 'beginner' | 'intermediate' | 'advanced';
  prioritizeContext?: 'code' | 'documents' | 'conversation' | 'balanced';
}

/**
 * Main response generator that orchestrates AI responses and graph updates
 */
export class ResponseGenerator {
  private claudeIntegration: ClaudeIntegration;
  private promptBuilder: PromptBuilder;
  private chatGraph: ChatGraphStructure;

  constructor(
    claudeIntegration: ClaudeIntegration,
    chatGraph: ChatGraphStructure
  ) {
    this.claudeIntegration = claudeIntegration;
    this.promptBuilder = new PromptBuilder();
    this.chatGraph = chatGraph;
  }

  /**
   * Generate a complete response with context awareness and graph updates
   */
  async generateResponse(
    userMessage: ParsedMessage,
    context: ExtractedContext,
    conversationHistory: MessageNode[],
    options: ResponseGenerationOptions
  ): Promise<GeneratedResponse> {
    const startTime = Date.now();
    const processingSteps: string[] = [];

    try {
      // Step 1: Determine response strategy
      processingSteps.push('Analyzing message intent and context');
      const responseStrategy = this.determineResponseStrategy(userMessage, context, options);

      // Step 2: Build appropriate prompt
      processingSteps.push('Building context-aware prompt');
      const prompt = this.buildPromptForStrategy(userMessage, context, conversationHistory, responseStrategy);

      // Step 3: Generate AI response
      processingSteps.push('Generating AI response');
      const aiResponse = await this.claudeIntegration.sendMessage(prompt, options.conversationId);

      // Step 4: Create message node
      processingSteps.push('Creating response message node');
      const messageNode = this.createResponseMessageNode(
        aiResponse,
        userMessage,
        options.conversationId,
        conversationHistory.length
      );

      // Step 5: Extract and create new nodes
      processingSteps.push('Extracting and creating new graph nodes');
      const generatedNodes = await this.extractAndCreateNodes(
        aiResponse,
        userMessage,
        context,
        options
      );

      // Step 6: Create references
      processingSteps.push('Creating graph references');
      const referencedNodes = this.createReferences(
        messageNode,
        context,
        aiResponse,
        options.conversationId
      );

      // Step 7: Generate suggestions and follow-ups
      processingSteps.push('Generating suggestions and follow-ups');
      const suggestedActions = options.includeSuggestions ?
        await this.generateSuggestions(userMessage, context, aiResponse) : [];

      const followUpQuestions = options.generateFollowUps ?
        await this.generateFollowUpQuestions(userMessage, aiResponse, context) : [];

      // Step 8: Add nodes to graph
      processingSteps.push('Adding nodes to graph');
      this.addNodesToGraph(messageNode, generatedNodes, referencedNodes);

      // Step 9: Calculate quality metrics
      const metadata = this.calculateResponseMetadata(
        aiResponse,
        context,
        generatedNodes,
        processingSteps,
        startTime
      );

      return {
        messageNode,
        referencedNodes,
        generatedNodes,
        suggestedActions,
        followUpQuestions,
        confidence: aiResponse.confidence || 0.8,
        metadata
      };

    } catch (error) {
      throw new Error(`Response generation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Generate a quick response for simple queries
   */
  async generateQuickResponse(
    message: string,
    context: ExtractedContext,
    conversationId: string
  ): Promise<MessageNode> {
    const parsedMessage = await import('../parsers/MessageParser').then(m =>
      m.MessageParser.parseMessage(message, 'user')
    );

    const prompt = this.promptBuilder.buildPrompt(
      parsedMessage,
      context,
      'general_assistance',
      { responseStyle: 'concise' }
    );

    const aiResponse = await this.claudeIntegration.sendMessage(prompt, conversationId);

    return this.createResponseMessageNode(aiResponse, parsedMessage, conversationId, 0);
  }

  /**
   * Generate response with streaming
   */
  async generateStreamingResponse(
    userMessage: ParsedMessage,
    context: ExtractedContext,
    conversationHistory: MessageNode[],
    options: ResponseGenerationOptions,
    onChunk: (chunk: string) => void,
    onComplete: (response: GeneratedResponse) => void,
    onError: (error: Error) => void
  ): Promise<void> {
    try {
      const responseStrategy = this.determineResponseStrategy(userMessage, context, options);
      const prompt = this.buildPromptForStrategy(userMessage, context, conversationHistory, responseStrategy);

      let fullContent = '';

      await this.claudeIntegration.sendStreamingMessage(
        prompt,
        {
          onChunk: (chunk: string) => {
            fullContent += chunk;
            onChunk(chunk);
          },
          onComplete: async (aiResponse: ChatResponse) => {
            try {
              // Create complete response after streaming
              const messageNode = this.createResponseMessageNode(
                aiResponse,
                userMessage,
                options.conversationId,
                conversationHistory.length
              );

              const generatedNodes = await this.extractAndCreateNodes(
                aiResponse,
                userMessage,
                context,
                options
              );

              const referencedNodes = this.createReferences(
                messageNode,
                context,
                aiResponse,
                options.conversationId
              );

              const suggestedActions = options.includeSuggestions ?
                await this.generateSuggestions(userMessage, context, aiResponse) : [];

              const followUpQuestions = options.generateFollowUps ?
                await this.generateFollowUpQuestions(userMessage, aiResponse, context) : [];

              this.addNodesToGraph(messageNode, generatedNodes, referencedNodes);

              const metadata = this.calculateResponseMetadata(
                aiResponse,
                context,
                generatedNodes,
                ['streaming_generation'],
                Date.now()
              );

              onComplete({
                messageNode,
                referencedNodes,
                generatedNodes,
                suggestedActions,
                followUpQuestions,
                confidence: aiResponse.confidence || 0.8,
                metadata
              });

            } catch (error) {
              onError(error instanceof Error ? error : new Error(String(error)));
            }
          },
          onError,
          cancel: () => {}
        },
        options.conversationId
      );

    } catch (error) {
      onError(error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Private helper methods
   */
  private determineResponseStrategy(
    message: ParsedMessage,
    context: ExtractedContext,
    options: ResponseGenerationOptions
  ): 'code_help' | 'explanation' | 'problem_solving' | 'general' {
    if (message.hasErrorContent || message.intent.primary === 'error-report') {
      return 'problem_solving';
    }

    if (message.contentType === 'code' || context.referencedFiles.length > 0) {
      return 'code_help';
    }

    if (message.isQuestion && context.relatedDocuments.length > 0) {
      return 'explanation';
    }

    return 'general';
  }

  private buildPromptForStrategy(
    message: ParsedMessage,
    context: ExtractedContext,
    history: MessageNode[],
    strategy: string
  ): BuiltPrompt {
    const templateMap = {
      'code_help': 'code_general',
      'explanation': 'documentation_query',
      'problem_solving': 'code_debug',
      'general': 'general_assistance'
    };

    const templateId = templateMap[strategy as keyof typeof templateMap] || 'general_assistance';

    if (history.length > 0) {
      return this.promptBuilder.buildContinuationPrompt(history, message, context);
    }

    return this.promptBuilder.buildPrompt(message, context, templateId);
  }

  private createResponseMessageNode(
    aiResponse: ChatResponse,
    userMessage: ParsedMessage,
    conversationId: string,
    messageIndex: number
  ): MessageNode {
    return createMessageNode({
      id: `response-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      content: aiResponse.content,
      role: 'assistant',
      conversationId,
      messageIndex: messageIndex + 1,
      metadata: {
        model: aiResponse.metadata.model,
        promptTokens: aiResponse.metadata.promptTokens,
        completionTokens: aiResponse.metadata.completionTokens,
        responseTime: aiResponse.metadata.responseTime,
        confidence: aiResponse.confidence,
        referencedNodes: aiResponse.referencedNodes,
        generatedNodes: aiResponse.generatedNodes
      }
    });
  }

  private async extractAndCreateNodes(
    aiResponse: ChatResponse,
    userMessage: ParsedMessage,
    context: ExtractedContext,
    options: ResponseGenerationOptions
  ): Promise<AnyGraphNode[]> {
    const generatedNodes: AnyGraphNode[] = [];

    if (!options.includeCodeGeneration) {
      return generatedNodes;
    }

    // Extract code blocks and create code nodes
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    let match;
    let codeBlockIndex = 0;

    while ((match = codeBlockRegex.exec(aiResponse.content)) !== null) {
      const language = match[1] || 'text';
      const code = match[2];

      if (language !== 'text' && code.trim().length > 10) {
        const codeNode = createCodeNode({
          id: `generated-code-${Date.now()}-${codeBlockIndex++}`,
          label: `Generated ${language} code`,
          description: `Code generated in response to: ${userMessage.content.substring(0, 100)}`,
          codeType: 'function', // Could be determined by analysis
          filePath: `generated/${language}_${Date.now()}.${this.getFileExtension(language)}`,
          lineNumber: 1,
          language,
          snippet: code,
          metadata: {
            source: 'ai_generated',
            originalQuery: userMessage.content,
            generatedAt: new Date(),
            confidence: aiResponse.confidence || 0.8
          }
        });

        generatedNodes.push(codeNode);
      }
    }

    // Extract documentation nodes if the response contains explanations
    if (aiResponse.content.length > 500 && userMessage.isQuestion) {
      const docNode = createDocumentNode({
        id: `generated-doc-${Date.now()}`,
        label: `AI Explanation: ${userMessage.intent.primary}`,
        description: 'AI-generated explanation document',
        documentType: 'comment',
        content: aiResponse.content,
        author: 'Claude AI',
        metadata: {
          source: 'ai_generated',
          originalQuery: userMessage.content,
          generatedAt: new Date(),
          responseType: userMessage.intent.primary
        }
      });

      generatedNodes.push(docNode);
    }

    return generatedNodes.slice(0, options.maxNewNodes || 5);
  }

  private createReferences(
    messageNode: MessageNode,
    context: ExtractedContext,
    aiResponse: ChatResponse,
    conversationId: string
  ): string[] {
    const referencedNodes: string[] = [];

    // Add direct context references
    for (const node of context.relevantNodes) {
      const reference: ConversationReference = {
        conversationId,
        messageId: messageNode.id,
        nodeId: node.id,
        nodeType: node.type === 'code' ? 'code' : node.type === 'document' ? 'document' : 'business',
        referenceType: 'context',
        confidence: context.relevanceScores.get(node.id) || 0.5
      };

      this.chatGraph.addReference(reference);
      referencedNodes.push(node.id);
    }

    // Add nodes mentioned in AI response
    if (aiResponse.referencedNodes) {
      for (const nodeRef of aiResponse.referencedNodes) {
        // Try to find actual node by reference
        const contextNode = context.relevantNodes.find(n =>
          n.label.includes(nodeRef) ||
          (n.type === 'code' && (n as any).filePath?.includes(nodeRef))
        );

        if (contextNode) {
          const reference: ConversationReference = {
            conversationId,
            messageId: messageNode.id,
            nodeId: contextNode.id,
            nodeType: contextNode.type === 'code' ? 'code' : contextNode.type === 'document' ? 'document' : 'business',
            referenceType: 'explicit',
            confidence: 0.8,
            extractedText: nodeRef
          };

          this.chatGraph.addReference(reference);
          referencedNodes.push(contextNode.id);
        }
      }
    }

    return [...new Set(referencedNodes)]; // Remove duplicates
  }

  private async generateSuggestions(
    userMessage: ParsedMessage,
    context: ExtractedContext,
    aiResponse: ChatResponse
  ): Promise<SuggestedAction[]> {
    const suggestions: SuggestedAction[] = [];

    // Code-based suggestions
    if (context.referencedFiles.length > 0) {
      suggestions.push({
        id: 'open-related-files',
        type: 'open_file',
        title: 'Open Related Files',
        description: 'Open the files mentioned in this conversation',
        priority: 'medium',
        parameters: {
          files: context.referencedFiles.map(f => f.filePath)
        }
      });

      if (userMessage.hasErrorContent) {
        suggestions.push({
          id: 'debug-code',
          type: 'modify_code',
          title: 'Debug Code',
          description: 'Apply suggested fixes to the code',
          priority: 'high'
        });
      }
    }

    // Documentation suggestions
    if (context.relatedDocuments.length > 0) {
      suggestions.push({
        id: 'read-docs',
        type: 'open_file',
        title: 'Read Related Documentation',
        description: 'Review documentation mentioned in the response',
        priority: 'low',
        parameters: {
          documents: context.relatedDocuments.map(d => d.filePath).filter(Boolean)
        }
      });
    }

    // Learning suggestions
    if (userMessage.isQuestion) {
      suggestions.push({
        id: 'explain-concept',
        type: 'explain_concept',
        title: 'Learn More',
        description: 'Get a deeper explanation of this concept',
        priority: 'low'
      });
    }

    return suggestions;
  }

  private async generateFollowUpQuestions(
    userMessage: ParsedMessage,
    aiResponse: ChatResponse,
    context: ExtractedContext
  ): Promise<string[]> {
    const followUps: string[] = [];

    // Question-based follow-ups
    if (userMessage.isQuestion) {
      followUps.push("Can you explain this in more detail?");
      followUps.push("Are there any best practices I should know?");
    }

    // Code-based follow-ups
    if (context.referencedFiles.length > 0) {
      followUps.push("How can I improve this code?");
      followUps.push("Are there any potential issues with this approach?");
      followUps.push("What tests should I write for this?");
    }

    // Error-based follow-ups
    if (userMessage.hasErrorContent) {
      followUps.push("How can I prevent this error in the future?");
      followUps.push("Are there similar issues I should watch for?");
    }

    return followUps.slice(0, 3); // Limit to 3 follow-ups
  }

  private addNodesToGraph(
    messageNode: MessageNode,
    generatedNodes: AnyGraphNode[],
    referencedNodes: string[]
  ): void {
    // Add message node
    this.chatGraph.addMessage(messageNode.metadata.conversationId, messageNode);

    // Add generated nodes
    for (const node of generatedNodes) {
      this.chatGraph.graphStore.addNode(node);
    }
  }

  private calculateResponseMetadata(
    aiResponse: ChatResponse,
    context: ExtractedContext,
    generatedNodes: AnyGraphNode[],
    processingSteps: string[],
    startTime: number
  ): ResponseMetadata {
    const hasCodeGeneration = generatedNodes.some(n => n.type === 'code');
    const hasFileReferences = context.referencedFiles.length > 0;

    let responseType: ResponseMetadata['responseType'] = 'explanation';
    if (hasCodeGeneration) responseType = 'solution';
    if (hasFileReferences && aiResponse.content.includes('error')) responseType = 'error_help';

    // Simple quality score based on multiple factors
    let qualityScore = 0.7;
    if (aiResponse.content.length > 200) qualityScore += 0.1;
    if (hasCodeGeneration) qualityScore += 0.1;
    if (context.relevantNodes.length > 0) qualityScore += 0.1;

    return {
      generationTime: Date.now() - startTime,
      tokensUsed: aiResponse.metadata.totalTokens || 0,
      contextNodes: context.relevantNodes.length,
      processingSteps,
      qualityScore: Math.min(qualityScore, 1.0),
      hasCodeGeneration,
      hasFileReferences,
      responseType
    };
  }

  private getFileExtension(language: string): string {
    const extensions: Record<string, string> = {
      'javascript': 'js',
      'typescript': 'ts',
      'python': 'py',
      'java': 'java',
      'cpp': 'cpp',
      'csharp': 'cs',
      'go': 'go',
      'rust': 'rs',
      'bash': 'sh',
      'sql': 'sql',
      'json': 'json',
      'yaml': 'yml',
      'markdown': 'md'
    };

    return extensions[language.toLowerCase()] || 'txt';
  }
}