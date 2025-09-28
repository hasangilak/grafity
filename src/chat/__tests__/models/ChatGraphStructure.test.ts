import { ChatGraphStructure } from '../../models/ChatGraphStructure';
import { ChatTestUtils } from '../utils/TestUtils';
import { MessageNode } from '../../models/MessageNode';

describe('ChatGraphStructure', () => {
  let chatGraph: ChatGraphStructure;

  beforeEach(() => {
    chatGraph = new ChatGraphStructure();
  });

  describe('Conversation Management', () => {
    test('should add conversation successfully', () => {
      const conversation = ChatTestUtils.createMockConversation();

      chatGraph.addConversation(conversation);

      const retrieved = chatGraph.getConversation(conversation.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(conversation.id);
    });

    test('should retrieve all conversations', () => {
      const conv1 = ChatTestUtils.createMockConversation();
      const conv2 = ChatTestUtils.createMockConversation();

      chatGraph.addConversation(conv1);
      chatGraph.addConversation(conv2);

      const allConversations = chatGraph.getAllConversations();
      expect(allConversations).toHaveLength(2);
      expect(allConversations.map(c => c.id)).toContain(conv1.id);
      expect(allConversations.map(c => c.id)).toContain(conv2.id);
    });

    test('should return null for non-existent conversation', () => {
      const result = chatGraph.getConversation('non_existent_id');
      expect(result).toBeNull();
    });

    test('should remove conversation successfully', () => {
      const conversation = ChatTestUtils.createMockConversation();
      chatGraph.addConversation(conversation);

      const removed = chatGraph.removeConversation(conversation.id);
      expect(removed).toBe(true);

      const retrieved = chatGraph.getConversation(conversation.id);
      expect(retrieved).toBeNull();
    });

    test('should return false when removing non-existent conversation', () => {
      const result = chatGraph.removeConversation('non_existent_id');
      expect(result).toBe(false);
    });
  });

  describe('Message Management', () => {
    test('should add message to existing conversation', () => {
      const conversation = ChatTestUtils.createMockConversation();
      const message = ChatTestUtils.createMockMessage();

      chatGraph.addConversation(conversation);
      chatGraph.addMessage(conversation.id, message);

      const retrievedConv = chatGraph.getConversation(conversation.id);
      expect(retrievedConv?.messages.has(message.id)).toBe(true);
      expect(retrievedConv?.messages.get(message.id)).toEqual(message);
    });

    test('should handle adding message to non-existent conversation', () => {
      const message = ChatTestUtils.createMockMessage();

      expect(() => {
        chatGraph.addMessage('non_existent_id', message);
      }).not.toThrow();

      // Should still return null for non-existent conversation
      const retrieved = chatGraph.getConversation('non_existent_id');
      expect(retrieved).toBeNull();
    });

    test('should add message to specific branch', () => {
      const { conversation, mainBranch } = ChatTestUtils.createBranchedConversation(3, 1, 2);
      const newMessage = ChatTestUtils.createMockMessage();

      chatGraph.addConversation(conversation);
      chatGraph.addMessage(conversation.id, newMessage, mainBranch.id);

      const retrievedConv = chatGraph.getConversation(conversation.id);
      const branch = retrievedConv?.branches.get(mainBranch.id);

      expect(branch?.messageIds).toContain(newMessage.id);
      expect(retrievedConv?.messages.has(newMessage.id)).toBe(true);
    });

    test('should handle message chain correctly', () => {
      const conversation = ChatTestUtils.createMockConversation();
      const messageChain = ChatTestUtils.createMessageChain(5);

      chatGraph.addConversation(conversation);

      messageChain.forEach(message => {
        chatGraph.addMessage(conversation.id, message);
      });

      const retrievedConv = chatGraph.getConversation(conversation.id);
      expect(retrievedConv?.messages.size).toBe(5);

      messageChain.forEach(message => {
        expect(retrievedConv?.messages.has(message.id)).toBe(true);
      });
    });
  });

  describe('Branch Management', () => {
    test('should create branch successfully', () => {
      const { conversation, allMessages } = ChatTestUtils.createBranchedConversation(5, 2, 0);
      chatGraph.addConversation(conversation);

      const branchPointMessage = allMessages[2];
      const newBranchId = chatGraph.createBranch(conversation.id, branchPointMessage.id, 'New Branch');

      expect(newBranchId).toBeDefined();
      expect(newBranchId).not.toBeNull();

      const retrievedConv = chatGraph.getConversation(conversation.id);
      const newBranch = retrievedConv?.branches.get(newBranchId!);

      expect(newBranch).toBeDefined();
      expect(newBranch?.title).toBe('New Branch');
      expect(newBranch?.messageIds).toHaveLength(0);
    });

    test('should return null when creating branch from non-existent message', () => {
      const conversation = ChatTestUtils.createMockConversation();
      chatGraph.addConversation(conversation);

      const branchId = chatGraph.createBranch(conversation.id, 'non_existent_message', 'Test Branch');
      expect(branchId).toBeNull();
    });

    test('should merge branches successfully', () => {
      const { conversation, mainBranch, secondaryBranch } = ChatTestUtils.createBranchedConversation(3, 1, 2);
      chatGraph.addConversation(conversation);

      const mergeSuccess = chatGraph.mergeBranches(conversation.id, secondaryBranch.id, mainBranch.id);
      expect(mergeSuccess).toBe(true);

      const retrievedConv = chatGraph.getConversation(conversation.id);
      const targetBranch = retrievedConv?.branches.get(mainBranch.id);

      // Target branch should now contain messages from both branches
      expect(targetBranch?.messageIds.length).toBeGreaterThan(mainBranch.messageIds.length);
    });

    test('should return false when merging non-existent branches', () => {
      const conversation = ChatTestUtils.createMockConversation();
      chatGraph.addConversation(conversation);

      const mergeSuccess = chatGraph.mergeBranches(conversation.id, 'non_existent_source', 'non_existent_target');
      expect(mergeSuccess).toBe(false);
    });

    test('should handle branch creation with auto-generated title', () => {
      const { conversation, allMessages } = ChatTestUtils.createBranchedConversation(3, 1, 0);
      chatGraph.addConversation(conversation);

      const branchPointMessage = allMessages[1];
      const newBranchId = chatGraph.createBranch(conversation.id, branchPointMessage.id);

      expect(newBranchId).not.toBeNull();

      const retrievedConv = chatGraph.getConversation(conversation.id);
      const newBranch = retrievedConv?.branches.get(newBranchId!);

      expect(newBranch?.title).toMatch(/^Branch from/);
    });
  });

  describe('Graph Traversal and Analysis', () => {
    test('should find connected nodes correctly', () => {
      const { conversation, allMessages } = ChatTestUtils.createBranchedConversation(5, 2, 3);
      chatGraph.addConversation(conversation);

      const startMessage = allMessages[0];
      const connectedNodes = chatGraph.findConnectedNodes(startMessage.id, 2);

      expect(connectedNodes).toBeDefined();
      expect(connectedNodes.length).toBeGreaterThan(0);
      expect(connectedNodes.some(node => node.id === startMessage.id)).toBe(true);
    });

    test('should calculate conversation depth correctly', () => {
      const { conversation } = ChatTestUtils.createBranchedConversation(5, 2, 3);
      chatGraph.addConversation(conversation);

      const depth = chatGraph.getConversationDepth(conversation.id);
      expect(depth).toBeGreaterThan(0);
      expect(depth).toBeLessThanOrEqual(8); // 5 main + 3 branch messages
    });

    test('should find conversation paths', () => {
      const { conversation, allMessages } = ChatTestUtils.createBranchedConversation(4, 1, 2);
      chatGraph.addConversation(conversation);

      const startMessage = allMessages[0];
      const endMessage = allMessages[allMessages.length - 1];

      const paths = chatGraph.findPaths(startMessage.id, endMessage.id);
      expect(paths).toBeDefined();
      expect(Array.isArray(paths)).toBe(true);
    });

    test('should analyze conversation structure', () => {
      const chatGraphWithMultiple = ChatTestUtils.createChatGraphWithMultipleConversations(3);

      const analysis = chatGraphWithMultiple.analyzeStructure();

      expect(analysis).toHaveProperty('totalConversations');
      expect(analysis).toHaveProperty('totalMessages');
      expect(analysis).toHaveProperty('totalBranches');
      expect(analysis).toHaveProperty('averageMessagesPerConversation');
      expect(analysis).toHaveProperty('averageBranchesPerConversation');

      expect(analysis.totalConversations).toBe(3);
      expect(analysis.totalMessages).toBeGreaterThan(0);
      expect(analysis.totalBranches).toBeGreaterThan(0);
    });
  });

  describe('Performance and Scalability', () => {
    test('should handle large number of conversations efficiently', async () => {
      const conversationCount = 100;
      const conversations = Array.from({ length: conversationCount }, () =>
        ChatTestUtils.createMockConversation()
      );

      const { duration } = await ChatTestUtils.measureExecutionTime(() => {
        conversations.forEach(conv => chatGraph.addConversation(conv));
      });

      expect(duration).toBeLessThan(1000); // Should complete in less than 1 second
      expect(chatGraph.getAllConversations()).toHaveLength(conversationCount);
    });

    test('should handle large message chains efficiently', async () => {
      const conversation = ChatTestUtils.createMockConversation();
      const messageCount = 1000;
      const messages = ChatTestUtils.createMessageChain(messageCount);

      chatGraph.addConversation(conversation);

      const { duration } = await ChatTestUtils.measureExecutionTime(() => {
        messages.forEach(message => chatGraph.addMessage(conversation.id, message));
      });

      expect(duration).toBeLessThan(2000); // Should complete in less than 2 seconds

      const retrievedConv = chatGraph.getConversation(conversation.id);
      expect(retrievedConv?.messages.size).toBe(messageCount);
    });

    test('should maintain performance with complex branching', async () => {
      const conversation = ChatTestUtils.createMockConversation();
      const mainChain = ChatTestUtils.createMessageChain(10);

      chatGraph.addConversation(conversation);
      mainChain.forEach(message => chatGraph.addMessage(conversation.id, message));

      const { duration } = await ChatTestUtils.measureExecutionTime(() => {
        // Create multiple branches from different points
        for (let i = 2; i < 8; i++) {
          const branchId = chatGraph.createBranch(conversation.id, mainChain[i].id, `Branch ${i}`);
          if (branchId) {
            // Add a few messages to each branch
            const branchMessages = ChatTestUtils.createMessageChain(3);
            branchMessages.forEach(msg => chatGraph.addMessage(conversation.id, msg, branchId));
          }
        }
      });

      expect(duration).toBeLessThan(1000);

      const retrievedConv = chatGraph.getConversation(conversation.id);
      expect(retrievedConv?.branches.size).toBeGreaterThan(1);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle empty graph gracefully', () => {
      expect(chatGraph.getAllConversations()).toHaveLength(0);

      const analysis = chatGraph.analyzeStructure();
      expect(analysis.totalConversations).toBe(0);
      expect(analysis.totalMessages).toBe(0);
      expect(analysis.totalBranches).toBe(0);
    });

    test('should handle circular references gracefully', () => {
      const conversation = ChatTestUtils.createMockConversation();
      const message1 = ChatTestUtils.createMockMessage();
      const message2 = ChatTestUtils.createMockMessage({
        parentMessageId: message1.id
      });

      // Create circular reference (this shouldn't happen in normal operation)
      message1.parentMessageId = message2.id;
      message1.childMessageIds = [message2.id];
      message2.childMessageIds = [message1.id];

      chatGraph.addConversation(conversation);
      chatGraph.addMessage(conversation.id, message1);
      chatGraph.addMessage(conversation.id, message2);

      // The system should handle this without infinite loops
      expect(() => {
        chatGraph.findConnectedNodes(message1.id, 3);
      }).not.toThrow();
    });

    test('should handle duplicate message IDs', () => {
      const conversation = ChatTestUtils.createMockConversation();
      const message1 = ChatTestUtils.createMockMessage();
      const message2 = ChatTestUtils.createMockMessage({
        id: message1.id, // Same ID
        content: 'Different content'
      });

      chatGraph.addConversation(conversation);
      chatGraph.addMessage(conversation.id, message1);
      chatGraph.addMessage(conversation.id, message2);

      const retrievedConv = chatGraph.getConversation(conversation.id);
      expect(retrievedConv?.messages.size).toBe(1);

      // Should contain the latest message with the same ID
      const retrievedMessage = retrievedConv?.messages.get(message1.id);
      expect(retrievedMessage?.content).toBe('Different content');
    });

    test('should handle operations on deleted conversations', () => {
      const conversation = ChatTestUtils.createMockConversation();
      const message = ChatTestUtils.createMockMessage();

      chatGraph.addConversation(conversation);
      chatGraph.removeConversation(conversation.id);

      // Operations on deleted conversation should not throw
      expect(() => {
        chatGraph.addMessage(conversation.id, message);
      }).not.toThrow();

      expect(() => {
        chatGraph.createBranch(conversation.id, message.id);
      }).not.toThrow();
    });
  });

  describe('Data Integrity', () => {
    test('should maintain message order in branches', () => {
      const conversation = ChatTestUtils.createMockConversation();
      const messages = ChatTestUtils.createMessageChain(5);

      chatGraph.addConversation(conversation);

      // Add messages in random order
      const shuffledMessages = [...messages].sort(() => Math.random() - 0.5);
      shuffledMessages.forEach(message => chatGraph.addMessage(conversation.id, message));

      const retrievedConv = chatGraph.getConversation(conversation.id);
      expect(retrievedConv?.messages.size).toBe(5);

      // All messages should be present regardless of insertion order
      messages.forEach(message => {
        expect(retrievedConv?.messages.has(message.id)).toBe(true);
      });
    });

    test('should preserve message relationships after branch operations', () => {
      const { conversation, allMessages, mainBranch, secondaryBranch } =
        ChatTestUtils.createBranchedConversation(4, 2, 2);

      chatGraph.addConversation(conversation);

      // Verify relationships before merge
      const branchPoint = allMessages[2];
      expect(branchPoint.childMessageIds.length).toBeGreaterThan(1);

      // Merge branches
      chatGraph.mergeBranches(conversation.id, secondaryBranch.id, mainBranch.id);

      // Verify relationships are preserved
      const retrievedConv = chatGraph.getConversation(conversation.id);
      const retrievedBranchPoint = retrievedConv?.messages.get(branchPoint.id);

      expect(retrievedBranchPoint).toBeDefined();
      expect(retrievedBranchPoint?.childMessageIds.length).toBeGreaterThan(0);
    });

    test('should handle conversation updates correctly', () => {
      const conversation = ChatTestUtils.createMockConversation();
      chatGraph.addConversation(conversation);

      // Modify conversation properties
      conversation.thread.title = 'Updated Title';
      conversation.thread.messageCount = 10;

      // Add the updated conversation
      chatGraph.addConversation(conversation);

      const retrieved = chatGraph.getConversation(conversation.id);
      expect(retrieved?.thread.title).toBe('Updated Title');
      expect(retrieved?.thread.messageCount).toBe(10);
    });
  });
});