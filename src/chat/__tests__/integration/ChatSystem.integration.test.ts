import { ChatGraphStructure } from '../../models/ChatGraphStructure';
import { MessageParser } from '../../parsers/MessageParser';
import { ContextExtractor } from '../../context/ContextExtractor';
import { ResponseGenerator } from '../../ai/ResponseGenerator';
import { ConversationStorage } from '../../persistence/ConversationStorage';
import { ConversationSearch } from '../../search/ConversationSearch';
import { ChatAnalytics } from '../../analytics/ChatAnalytics';
import { ConversationMerger } from '../../merge/ConversationMerger';
import { RealtimeChat } from '../../realtime/RealtimeChat';
import { ChatTestUtils } from '../utils/TestUtils';

// Mock external dependencies
jest.mock('../../ai/ClaudeIntegration', () => ({
  ClaudeIntegration: jest.fn().mockImplementation(() => ({
    sendMessage: jest.fn().mockResolvedValue('Mocked AI response'),
    sendStreamingMessage: jest.fn().mockImplementation(async (prompt, callbacks) => {
      const mockResponse = ChatTestUtils.createMockClaudeResponse('Mocked streaming response', true);
      for (const chunk of mockResponse.chunks || []) {
        callbacks.onChunk?.(chunk);
      }
      callbacks.onComplete?.(mockResponse.response);
    })
  }))
}));

jest.mock('ws', () => ({
  WebSocket: jest.fn()
}));

describe('Chat System Integration Tests', () => {
  let chatGraph: ChatGraphStructure;
  let messageParser: MessageParser;
  let contextExtractor: ContextExtractor;
  let responseGenerator: ResponseGenerator;
  let conversationStorage: ConversationStorage;
  let conversationSearch: ConversationSearch;
  let chatAnalytics: ChatAnalytics;
  let conversationMerger: ConversationMerger;

  beforeEach(() => {
    chatGraph = new ChatGraphStructure();
    messageParser = new MessageParser();
    contextExtractor = new ContextExtractor(chatGraph);
    responseGenerator = new ResponseGenerator(chatGraph, contextExtractor);
    conversationStorage = new ConversationStorage();
    conversationSearch = new ConversationSearch();
    chatAnalytics = new ChatAnalytics(chatGraph);
    conversationMerger = new ConversationMerger(chatGraph);
  });

  describe('End-to-End Chat Flow', () => {
    test('should handle complete conversation lifecycle', async () => {
      // 1. Create initial conversation and messages
      const conversation = ChatTestUtils.createMockConversation();
      const userMessage = ChatTestUtils.createMockMessage({
        content: 'How do I implement a binary search algorithm in TypeScript?',
        role: 'user'
      });

      chatGraph.addConversation(conversation);
      chatGraph.addMessage(conversation.id, userMessage);

      // 2. Parse user message
      const parsedMessage = await messageParser.parseMessage(userMessage);
      expect(parsedMessage.intent.type).toBe('question');
      expect(parsedMessage.intent.context).toBe('code_help');

      // 3. Extract context
      const extractedContext = await contextExtractor.extractContext(parsedMessage);
      expect(extractedContext).toBeDefined();
      expect(extractedContext.confidence).toBeGreaterThan(0);

      // 4. Generate AI response
      const generatedResponse = await responseGenerator.generateResponse(parsedMessage, extractedContext);
      expect(generatedResponse.response).toBeDefined();
      expect(generatedResponse.messageNode.role).toBe('assistant');

      // 5. Add AI response to conversation
      chatGraph.addMessage(conversation.id, generatedResponse.messageNode);

      // 6. Verify conversation state
      const retrievedConv = chatGraph.getConversation(conversation.id);
      expect(retrievedConv?.messages.size).toBe(2);

      // 7. Store conversation
      const storageResult = await conversationStorage.storeConversation(retrievedConv!, chatGraph);
      expect(storageResult.success).toBe(true);

      // 8. Search conversation
      const searchResult = await conversationSearch.search({
        query: 'binary search',
        contentTypes: ['message']
      });
      expect(searchResult.results.length).toBeGreaterThan(0);

      // 9. Analyze conversation
      const analytics = await chatAnalytics.analyzeConversation({
        conversationId: conversation.id,
        includeMetrics: true,
        includeInsights: true
      });
      expect(analytics.metrics?.totalMessages).toBe(2);
      expect(analytics.insights?.keyTopics).toContain('code_help');
    });

    test('should handle conversation branching and merging', async () => {
      // 1. Create conversation with initial chain
      const { conversation, mainBranch, allMessages } = ChatTestUtils.createBranchedConversation(5, 2, 0);
      chatGraph.addConversation(conversation);

      // 2. Create a new branch
      const branchPointMessage = allMessages[2];
      const newBranchId = chatGraph.createBranch(conversation.id, branchPointMessage.id, 'Alternative Solution');
      expect(newBranchId).not.toBeNull();

      // 3. Add messages to the new branch
      const branchMessages = ChatTestUtils.createMessageChain(3, 'user');
      branchMessages.forEach(message => {
        chatGraph.addMessage(conversation.id, message, newBranchId!);
      });

      // 4. Find merge candidates
      const mergeCandidates = await conversationMerger.findMergeCandidates(conversation.id);
      expect(mergeCandidates.length).toBeGreaterThan(0);

      const candidate = mergeCandidates[0];
      expect([candidate.sourceBranchId, candidate.targetBranchId]).toContain(newBranchId);

      // 5. Preview merge
      const mergePreview = await conversationMerger.previewMerge({
        conversationId: conversation.id,
        sourceBranchId: newBranchId!,
        targetBranchId: mainBranch.id,
        strategy: { type: 'chronological', options: {} },
        preserveHistory: true,
        requestedBy: 'test_user'
      });

      expect(mergePreview.previewMessages.length).toBeGreaterThan(allMessages.length);

      // 6. Perform merge
      const mergeResult = await conversationMerger.mergeBranches({
        conversationId: conversation.id,
        sourceBranchId: newBranchId!,
        targetBranchId: mainBranch.id,
        strategy: { type: 'chronological', options: {} },
        preserveHistory: true,
        requestedBy: 'test_user'
      });

      expect(mergeResult.success).toBe(true);
      expect(mergeResult.mergedMessages.length).toBeGreaterThan(allMessages.length);
    });

    test('should handle real-time collaboration', async () => {
      // 1. Set up real-time chat
      const mockWS = ChatTestUtils.createMockWebSocket();
      const { WebSocket } = require('ws');
      WebSocket.mockImplementation(() => mockWS.ws);

      const realtimeChat = new RealtimeChat('ws://localhost:8080', chatGraph);

      // 2. Connect participants
      const participant1 = {
        id: 'user1',
        name: 'Alice',
        role: 'participant' as const,
        status: 'online' as const,
        lastSeen: new Date()
      };

      const participant2 = {
        id: 'user2',
        name: 'Bob',
        role: 'participant' as const,
        status: 'online' as const,
        lastSeen: new Date()
      };

      await realtimeChat.connect(participant1);

      // Simulate participant 2 joining
      mockWS.triggerMessage({
        type: 'join',
        participantId: participant2.id,
        conversationId: '',
        data: participant2,
        timestamp: new Date()
      });

      // 3. Create and join conversation
      const conversation = ChatTestUtils.createMockConversation();
      chatGraph.addConversation(conversation);
      realtimeChat.joinConversation(conversation.id);

      // 4. Send messages in real-time
      const message1 = ChatTestUtils.createMockMessage({
        content: 'Hello from Alice',
        role: 'user'
      });

      realtimeChat.sendChatMessage(conversation.id, message1);

      // 5. Simulate receiving message from other participant
      const message2 = ChatTestUtils.createMockMessage({
        content: 'Hello from Bob',
        role: 'user'
      });

      mockWS.triggerMessage({
        type: 'message',
        participantId: participant2.id,
        conversationId: conversation.id,
        data: message2,
        timestamp: new Date()
      });

      // 6. Verify conversation state
      const retrievedConv = chatGraph.getConversation(conversation.id);
      expect(retrievedConv?.messages.size).toBe(2);

      const participants = realtimeChat.getParticipants(conversation.id);
      expect(participants.length).toBeGreaterThan(0);

      realtimeChat.disconnect();
    });
  });

  describe('Performance and Scalability Integration', () => {
    test('should handle large-scale conversation processing', async () => {
      const conversationCount = 10;
      const messagesPerConversation = 50;

      // Create multiple conversations with many messages
      const conversations = Array.from({ length: conversationCount }, () => {
        const conversation = ChatTestUtils.createMockConversation();
        const messages = ChatTestUtils.createMessageChain(messagesPerConversation);

        chatGraph.addConversation(conversation);
        messages.forEach(message => chatGraph.addMessage(conversation.id, message));

        return conversation;
      });

      // Measure analytics performance
      const { duration: analyticsTime } = await ChatTestUtils.measureExecutionTime(async () => {
        const allAnalytics = await Promise.all(
          conversations.map(conv =>
            chatAnalytics.analyzeConversation({
              conversationId: conv.id,
              includeMetrics: true,
              includeParticipants: true,
              includeTopics: true
            })
          )
        );

        expect(allAnalytics).toHaveLength(conversationCount);
      });

      expect(analyticsTime).toBeLessThan(5000); // Should complete in less than 5 seconds

      // Measure search performance
      const { duration: searchTime } = await ChatTestUtils.measureExecutionTime(async () => {
        await conversationSearch.indexConversations(conversations);

        const searchResult = await conversationSearch.search({
          query: 'test',
          contentTypes: ['message'],
          facets: {
            participants: true,
            contentTypes: true,
            topics: true
          }
        });

        expect(searchResult.results.length).toBeGreaterThan(0);
      });

      expect(searchTime).toBeLessThan(3000); // Should complete in less than 3 seconds
    });

    test('should maintain consistency across components', async () => {
      // Create a complex conversation scenario
      const { conversation, allMessages } = ChatTestUtils.createBranchedConversation(10, 5, 5);
      chatGraph.addConversation(conversation);

      // Process messages through the full pipeline
      const processedMessages = await Promise.all(
        allMessages.map(async message => {
          const parsed = await messageParser.parseMessage(message);
          const context = await contextExtractor.extractContext(parsed);
          return { message, parsed, context };
        })
      );

      // Verify consistency
      expect(processedMessages).toHaveLength(allMessages.length);

      processedMessages.forEach(({ message, parsed, context }) => {
        expect(parsed.contentType).toBeDefined();
        expect(context.confidence).toBeGreaterThan(0);
        expect(context.extractedAt).toBeInstanceOf(Date);
      });

      // Store and retrieve
      const storageResult = await conversationStorage.storeConversation(conversation, chatGraph);
      expect(storageResult.success).toBe(true);

      const retrievedConv = chatGraph.getConversation(conversation.id);
      expect(retrievedConv?.messages.size).toBe(allMessages.length);

      // Analyze for insights
      const analytics = await chatAnalytics.analyzeConversation({
        conversationId: conversation.id,
        includeMetrics: true,
        includeParticipants: true,
        includeTopics: true,
        includeInsights: true
      });

      expect(analytics.metrics?.totalMessages).toBe(allMessages.length);
      expect(analytics.participants?.length).toBeGreaterThan(0);
      expect(analytics.insights?.complexity).toBeDefined();
    });
  });

  describe('Error Recovery and Resilience', () => {
    test('should handle component failures gracefully', async () => {
      const conversation = ChatTestUtils.createMockConversation();
      const message = ChatTestUtils.createMockMessage({
        content: ChatTestUtils.createComplexMessageContent()
      });

      chatGraph.addConversation(conversation);
      chatGraph.addMessage(conversation.id, message);

      // Test parser resilience
      const malformedMessage = ChatTestUtils.createMockMessage({
        content: 'Malformed content with ```unclosed code block'
      });

      expect(async () => {
        await messageParser.parseMessage(malformedMessage);
      }).not.toThrow();

      // Test context extractor resilience
      const emptyParsed = ChatTestUtils.createMockParsedMessage({
        entities: [],
        codeBlocks: [],
        complexity: 0
      });

      expect(async () => {
        await contextExtractor.extractContext(emptyParsed);
      }).not.toThrow();

      // Test analytics resilience with empty conversation
      const emptyConversation = ChatTestUtils.createMockConversation();
      chatGraph.addConversation(emptyConversation);

      const emptyAnalytics = await chatAnalytics.analyzeConversation({
        conversationId: emptyConversation.id,
        includeMetrics: true
      });

      expect(emptyAnalytics.metrics?.totalMessages).toBe(0);
      expect(emptyAnalytics).toBeDefined();
    });

    test('should handle concurrent operations safely', async () => {
      const conversation = ChatTestUtils.createMockConversation();
      chatGraph.addConversation(conversation);

      // Simulate concurrent message additions
      const concurrentOperations = Array.from({ length: 20 }, async (_, i) => {
        const message = ChatTestUtils.createMockMessage({
          content: `Concurrent message ${i}`,
          messageIndex: i
        });

        chatGraph.addMessage(conversation.id, message);

        // Parse message concurrently
        const parsed = await messageParser.parseMessage(message);
        return parsed;
      });

      const results = await Promise.all(concurrentOperations);

      expect(results).toHaveLength(20);
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(result.contentType).toBeDefined();
      });

      const retrievedConv = chatGraph.getConversation(conversation.id);
      expect(retrievedConv?.messages.size).toBe(20);
    });
  });

  describe('Data Integrity and Consistency', () => {
    test('should maintain data integrity across operations', async () => {
      // Create a conversation with complex structure
      const { conversation, allMessages, mainBranch } = ChatTestUtils.createBranchedConversation(8, 3, 4);
      chatGraph.addConversation(conversation);

      // Record initial state
      const initialMessageCount = conversation.messages.size;
      const initialBranchCount = conversation.branches.size;

      // Perform various operations
      const newMessage = ChatTestUtils.createMockMessage();
      chatGraph.addMessage(conversation.id, newMessage, mainBranch.id);

      const newBranchId = chatGraph.createBranch(conversation.id, allMessages[5].id, 'Test Branch');
      expect(newBranchId).not.toBeNull();

      // Verify integrity
      const updatedConv = chatGraph.getConversation(conversation.id);
      expect(updatedConv?.messages.size).toBe(initialMessageCount + 1);
      expect(updatedConv?.branches.size).toBe(initialBranchCount + 1);

      // Verify message relationships are intact
      allMessages.forEach(message => {
        const retrievedMessage = updatedConv?.messages.get(message.id);
        expect(retrievedMessage).toBeDefined();
        expect(retrievedMessage?.parentMessageId).toBe(message.parentMessageId);
        expect(retrievedMessage?.childMessageIds).toEqual(message.childMessageIds);
      });

      // Verify branch structure
      const mainBranchUpdated = updatedConv?.branches.get(mainBranch.id);
      expect(mainBranchUpdated?.messageIds).toContain(newMessage.id);

      const newBranch = updatedConv?.branches.get(newBranchId!);
      expect(newBranch?.title).toBe('Test Branch');
    });

    test('should handle complex search and analytics scenarios', async () => {
      // Create multiple conversations with varied content
      const conversations = Array.from({ length: 5 }, (_, i) => {
        const conversation = ChatTestUtils.createMockConversation();
        conversation.thread.title = `Technical Discussion ${i + 1}`;

        const messages = [
          ChatTestUtils.createMockMessage({
            content: `Question about React hooks in project ${i + 1}`,
            role: 'user'
          }),
          ChatTestUtils.createMockMessage({
            content: ChatTestUtils.generateCodeContent('typescript'),
            role: 'assistant'
          }),
          ChatTestUtils.createMockMessage({
            content: 'Thank you, this helps with the implementation.',
            role: 'user'
          })
        ];

        chatGraph.addConversation(conversation);
        messages.forEach(message => chatGraph.addMessage(conversation.id, message));

        return conversation;
      });

      // Index conversations for search
      await conversationSearch.indexConversations(conversations);

      // Perform complex search
      const searchResult = await conversationSearch.search({
        query: 'React hooks typescript',
        contentTypes: ['message'],
        facets: {
          participants: true,
          contentTypes: true,
          topics: true,
          conversations: true
        },
        filters: {
          contentType: 'mixed'
        }
      });

      expect(searchResult.results.length).toBeGreaterThan(0);
      expect(searchResult.facets.contentTypes).toBeDefined();

      // Perform comprehensive analytics
      const globalAnalytics = await Promise.all(
        conversations.map(conv =>
          chatAnalytics.analyzeConversation({
            conversationId: conv.id,
            includeMetrics: true,
            includeParticipants: true,
            includeTopics: true,
            includeInsights: true
          })
        )
      );

      expect(globalAnalytics).toHaveLength(conversations.length);

      globalAnalytics.forEach(analytics => {
        expect(analytics.metrics?.totalMessages).toBeGreaterThan(0);
        expect(analytics.participants?.length).toBeGreaterThan(0);
        expect(analytics.insights?.summary).toBeDefined();
      });

      // Verify cross-conversation analytics
      const aggregateMetrics = globalAnalytics.reduce(
        (sum, analytics) => ({
          totalMessages: sum.totalMessages + (analytics.metrics?.totalMessages || 0),
          totalConversations: sum.totalConversations + 1
        }),
        { totalMessages: 0, totalConversations: 0 }
      );

      expect(aggregateMetrics.totalMessages).toBe(conversations.length * 3); // 3 messages per conversation
      expect(aggregateMetrics.totalConversations).toBe(conversations.length);
    });
  });
});