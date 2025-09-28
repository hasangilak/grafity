import { MessageNode } from '../../models/MessageNode';
import { ChatTestUtils } from '../utils/TestUtils';

describe('MessageNode', () => {
  describe('Constructor and Basic Properties', () => {
    test('should create a valid message node with required properties', () => {
      const message = ChatTestUtils.createMockMessage();

      ChatTestUtils.assertMessageStructure(message);
      expect(message.conversationType).toBe('message');
      expect(message.childMessageIds).toEqual([]);
    });

    test('should create message with custom properties', () => {
      const customMessage = ChatTestUtils.createMockMessage({
        content: 'Custom test content',
        role: 'assistant',
        messageIndex: 5
      });

      expect(customMessage.content).toBe('Custom test content');
      expect(customMessage.role).toBe('assistant');
      expect(customMessage.messageIndex).toBe(5);
    });

    test('should generate unique IDs for different messages', () => {
      const message1 = ChatTestUtils.createMockMessage();
      const message2 = ChatTestUtils.createMockMessage();

      expect(message1.id).not.toBe(message2.id);
      expect(message1.id).toMatch(/^msg_\d+_[a-z0-9]+$/);
      expect(message2.id).toMatch(/^msg_\d+_[a-z0-9]+$/);
    });
  });

  describe('Message Relationships', () => {
    test('should handle parent-child relationships', () => {
      const parentMessage = ChatTestUtils.createMockMessage();
      const childMessage = ChatTestUtils.createMockMessage({
        parentMessageId: parentMessage.id
      });

      // Add child to parent's children list
      parentMessage.childMessageIds.push(childMessage.id);

      expect(childMessage.parentMessageId).toBe(parentMessage.id);
      expect(parentMessage.childMessageIds).toContain(childMessage.id);
    });

    test('should handle multiple children', () => {
      const parentMessage = ChatTestUtils.createMockMessage();
      const child1 = ChatTestUtils.createMockMessage({ parentMessageId: parentMessage.id });
      const child2 = ChatTestUtils.createMockMessage({ parentMessageId: parentMessage.id });

      parentMessage.childMessageIds.push(child1.id, child2.id);

      expect(parentMessage.childMessageIds).toHaveLength(2);
      expect(parentMessage.childMessageIds).toContain(child1.id);
      expect(parentMessage.childMessageIds).toContain(child2.id);
    });

    test('should create proper message chain', () => {
      const chain = ChatTestUtils.createMessageChain(5);

      expect(chain).toHaveLength(5);

      // Check first message
      expect(chain[0].parentMessageId).toBeUndefined();
      expect(chain[0].childMessageIds).toContain(chain[1].id);

      // Check middle messages
      for (let i = 1; i < chain.length - 1; i++) {
        expect(chain[i].parentMessageId).toBe(chain[i - 1].id);
        expect(chain[i].childMessageIds).toContain(chain[i + 1].id);
      }

      // Check last message
      const lastIndex = chain.length - 1;
      expect(chain[lastIndex].parentMessageId).toBe(chain[lastIndex - 1].id);
      expect(chain[lastIndex].childMessageIds).toHaveLength(0);
    });
  });

  describe('Message Roles', () => {
    test('should accept valid roles', () => {
      const userMessage = ChatTestUtils.createMockMessage({ role: 'user' });
      const assistantMessage = ChatTestUtils.createMockMessage({ role: 'assistant' });
      const systemMessage = ChatTestUtils.createMockMessage({ role: 'system' });

      expect(userMessage.role).toBe('user');
      expect(assistantMessage.role).toBe('assistant');
      expect(systemMessage.role).toBe('system');
    });

    test('should alternate roles in conversation chain', () => {
      const chain = ChatTestUtils.createMessageChain(6, 'user');

      expect(chain[0].role).toBe('user');
      expect(chain[1].role).toBe('assistant');
      expect(chain[2].role).toBe('user');
      expect(chain[3].role).toBe('assistant');
      expect(chain[4].role).toBe('user');
      expect(chain[5].role).toBe('assistant');
    });
  });

  describe('Message Metadata', () => {
    test('should have valid metadata structure', () => {
      const message = ChatTestUtils.createMockMessage();

      expect(message.metadata).toBeDefined();
      expect(message.metadata).toHaveProperty('participantId');
      expect(message.metadata).toHaveProperty('complexity');
      expect(message.metadata).toHaveProperty('extractedEntities');
      expect(message.metadata).toHaveProperty('codeBlocks');
      expect(message.metadata).toHaveProperty('documentReferences');
      expect(message.metadata).toHaveProperty('topicTags');

      expect(Array.isArray(message.metadata.extractedEntities)).toBe(true);
      expect(Array.isArray(message.metadata.codeBlocks)).toBe(true);
      expect(Array.isArray(message.metadata.documentReferences)).toBe(true);
      expect(Array.isArray(message.metadata.topicTags)).toBe(true);
    });

    test('should accept custom metadata', () => {
      const customMetadata = {
        participantId: 'custom_user',
        complexity: 0.8,
        extractedEntities: [{ type: 'person', value: 'John Doe', confidence: 0.9 }],
        codeBlocks: [{ language: 'typescript', content: 'console.log("test");' }],
        documentReferences: [{ type: 'file', path: '/test.md' }],
        topicTags: ['testing', 'typescript']
      };

      const message = ChatTestUtils.createMockMessage({
        metadata: customMetadata
      });

      expect(message.metadata.participantId).toBe('custom_user');
      expect(message.metadata.complexity).toBe(0.8);
      expect(message.metadata.extractedEntities).toHaveLength(1);
      expect(message.metadata.codeBlocks).toHaveLength(1);
      expect(message.metadata.documentReferences).toHaveLength(1);
      expect(message.metadata.topicTags).toContain('testing');
    });
  });

  describe('Timestamps', () => {
    test('should have valid timestamp', () => {
      const message = ChatTestUtils.createMockMessage();

      expect(message.timestamp).toBeInstanceOf(Date);
      expect(message.timestamp.getTime()).toBeLessThanOrEqual(Date.now());
    });

    test('should preserve custom timestamp', () => {
      const customDate = new Date('2023-01-01T10:00:00Z');
      const message = ChatTestUtils.createMockMessage({
        timestamp: customDate
      });

      expect(message.timestamp).toEqual(customDate);
    });

    test('should maintain chronological order in message chain', () => {
      const chain = ChatTestUtils.createMessageChain(3);

      // Manually set timestamps to ensure order
      chain[0].timestamp = new Date('2023-01-01T10:00:00Z');
      chain[1].timestamp = new Date('2023-01-01T10:05:00Z');
      chain[2].timestamp = new Date('2023-01-01T10:10:00Z');

      expect(chain[0].timestamp.getTime()).toBeLessThan(chain[1].timestamp.getTime());
      expect(chain[1].timestamp.getTime()).toBeLessThan(chain[2].timestamp.getTime());
    });
  });

  describe('Content Handling', () => {
    test('should handle empty content', () => {
      const message = ChatTestUtils.createMockMessage({ content: '' });
      expect(message.content).toBe('');
    });

    test('should handle long content', () => {
      const longContent = 'A'.repeat(10000);
      const message = ChatTestUtils.createMockMessage({ content: longContent });
      expect(message.content).toHaveLength(10000);
    });

    test('should handle multiline content', () => {
      const multilineContent = `Line 1
Line 2
Line 3`;
      const message = ChatTestUtils.createMockMessage({ content: multilineContent });
      expect(message.content.split('\n')).toHaveLength(3);
    });

    test('should handle content with special characters', () => {
      const specialContent = 'Test with émojis 🚀 and spëcial çharacters!';
      const message = ChatTestUtils.createMockMessage({ content: specialContent });
      expect(message.content).toBe(specialContent);
    });

    test('should handle code content', () => {
      const codeContent = ChatTestUtils.generateCodeContent('typescript');
      const message = ChatTestUtils.createMockMessage({ content: codeContent });
      expect(message.content).toContain('function');
      expect(message.content).toContain('interface');
    });
  });

  describe('Message Indexing', () => {
    test('should maintain correct message indices in chain', () => {
      const chain = ChatTestUtils.createMessageChain(5);

      chain.forEach((message, index) => {
        expect(message.messageIndex).toBe(index);
      });
    });

    test('should handle custom message indices', () => {
      const message = ChatTestUtils.createMockMessage({ messageIndex: 42 });
      expect(message.messageIndex).toBe(42);
    });
  });

  describe('Edge Cases', () => {
    test('should handle message with no parent but with children', () => {
      const rootMessage = ChatTestUtils.createMockMessage();
      const child1 = ChatTestUtils.createMockMessage();
      const child2 = ChatTestUtils.createMockMessage();

      rootMessage.childMessageIds.push(child1.id, child2.id);

      expect(rootMessage.parentMessageId).toBeUndefined();
      expect(rootMessage.childMessageIds).toHaveLength(2);
    });

    test('should handle message with parent but no children', () => {
      const parent = ChatTestUtils.createMockMessage();
      const leafMessage = ChatTestUtils.createMockMessage({
        parentMessageId: parent.id
      });

      expect(leafMessage.parentMessageId).toBe(parent.id);
      expect(leafMessage.childMessageIds).toHaveLength(0);
    });

    test('should handle duplicate child IDs gracefully', () => {
      const message = ChatTestUtils.createMockMessage();
      const childId = 'child_123';

      message.childMessageIds.push(childId, childId);

      expect(message.childMessageIds).toHaveLength(2);
      expect(message.childMessageIds.filter(id => id === childId)).toHaveLength(2);
    });
  });

  describe('Serialization', () => {
    test('should serialize and deserialize correctly', () => {
      const originalMessage = ChatTestUtils.createMockMessage({
        content: 'Test serialization',
        role: 'assistant',
        messageIndex: 3
      });

      const serialized = JSON.stringify(originalMessage);
      const deserialized = JSON.parse(serialized);

      expect(deserialized.id).toBe(originalMessage.id);
      expect(deserialized.content).toBe(originalMessage.content);
      expect(deserialized.role).toBe(originalMessage.role);
      expect(deserialized.messageIndex).toBe(originalMessage.messageIndex);
      expect(new Date(deserialized.timestamp)).toEqual(originalMessage.timestamp);
    });

    test('should handle serialization with complex metadata', () => {
      const complexMessage = ChatTestUtils.createMockMessage({
        metadata: {
          participantId: 'test_user',
          complexity: 0.75,
          extractedEntities: [
            { type: 'person', value: 'Alice', confidence: 0.9 },
            { type: 'location', value: 'New York', confidence: 0.8 }
          ],
          codeBlocks: [
            { language: 'python', content: 'print("hello")' }
          ],
          documentReferences: [
            { type: 'file', path: '/docs/readme.md' }
          ],
          topicTags: ['documentation', 'python']
        }
      });

      const serialized = JSON.stringify(complexMessage);
      const deserialized = JSON.parse(serialized);

      expect(deserialized.metadata.extractedEntities).toHaveLength(2);
      expect(deserialized.metadata.codeBlocks).toHaveLength(1);
      expect(deserialized.metadata.documentReferences).toHaveLength(1);
      expect(deserialized.metadata.topicTags).toContain('python');
    });
  });
});