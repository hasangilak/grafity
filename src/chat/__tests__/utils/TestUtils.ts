import { MessageNode, ChatConversationNode } from '../../models';
import { ChatGraphStructure } from '../../models/ChatGraphStructure';
import { MessageBranch, ConversationThread } from '../../models/ConversationNode';
import { ParsedMessage } from '../../parsers/MessageParser';
import { ExtractedContext } from '../../context/ContextExtractor';

export class ChatTestUtils {
  static createMockMessage(overrides: Partial<MessageNode> = {}): MessageNode {
    const defaultMessage: MessageNode = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      conversationType: 'message',
      content: 'Test message content',
      role: 'user',
      messageIndex: 0,
      parentMessageId: undefined,
      childMessageIds: [],
      timestamp: new Date(),
      metadata: {
        participantId: 'test_user',
        complexity: 0.5,
        extractedEntities: [],
        codeBlocks: [],
        documentReferences: [],
        topicTags: []
      },
      ...overrides
    };

    return defaultMessage;
  }

  static createMockConversation(overrides: Partial<ChatConversationNode> = {}): ChatConversationNode {
    const conversation: ChatConversationNode = {
      id: `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      conversationType: 'chat',
      thread: {
        id: `thread_${Date.now()}`,
        title: 'Test Conversation',
        participants: ['test_user', 'test_assistant'],
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
        messageCount: 0,
        tags: []
      },
      messages: new Map(),
      branches: new Map(),
      currentContext: {
        activeParticipants: ['test_user', 'test_assistant'],
        currentTopic: 'testing',
        recentMessages: [],
        extractedContext: {
          codeContext: [],
          documentContext: [],
          conversationContext: [],
          entityContext: [],
          confidence: 0.8,
          sourceNodes: [],
          extractedAt: new Date()
        }
      },
      timestamp: new Date(),
      metadata: {
        participantId: 'test_user',
        complexity: 0.5,
        extractedEntities: [],
        codeBlocks: [],
        documentReferences: [],
        topicTags: []
      },
      ...overrides
    };

    return conversation;
  }

  static createMockBranch(overrides: Partial<MessageBranch> = {}): MessageBranch {
    return {
      id: `branch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title: 'Test Branch',
      parentBranchId: undefined,
      messageIds: [],
      isActive: true,
      createdAt: new Date(),
      participants: ['test_user'],
      mergedInto: undefined,
      ...overrides
    };
  }

  static createMockParsedMessage(overrides: Partial<ParsedMessage> = {}): ParsedMessage {
    return {
      contentType: 'text',
      codeBlocks: [],
      entities: [],
      intent: {
        type: 'question',
        confidence: 0.8,
        context: 'general',
        suggestedActions: []
      },
      complexity: 0.5,
      ...overrides
    };
  }

  static createMockExtractedContext(overrides: Partial<ExtractedContext> = {}): ExtractedContext {
    return {
      codeContext: [],
      documentContext: [],
      conversationContext: [],
      entityContext: [],
      confidence: 0.8,
      sourceNodes: [],
      extractedAt: new Date(),
      ...overrides
    };
  }

  static createMessageChain(count: number, startingRole: 'user' | 'assistant' = 'user'): MessageNode[] {
    const messages: MessageNode[] = [];
    let currentRole = startingRole;

    for (let i = 0; i < count; i++) {
      const message = this.createMockMessage({
        role: currentRole,
        messageIndex: i,
        content: `Test message ${i + 1}`,
        parentMessageId: i > 0 ? messages[i - 1].id : undefined
      });

      if (i > 0) {
        messages[i - 1].childMessageIds.push(message.id);
      }

      messages.push(message);

      // Alternate between user and assistant
      currentRole = currentRole === 'user' ? 'assistant' : 'user';
    }

    return messages;
  }

  static createBranchedConversation(mainChainLength: number, branchPointIndex: number, branchLength: number): {
    conversation: ChatConversationNode;
    mainBranch: MessageBranch;
    secondaryBranch: MessageBranch;
    allMessages: MessageNode[];
  } {
    const conversation = this.createMockConversation();
    const mainMessages = this.createMessageChain(mainChainLength);
    const branchMessages = this.createMessageChain(branchLength, 'user');

    // Create main branch
    const mainBranch = this.createMockBranch({
      title: 'Main Branch',
      messageIds: mainMessages.map(m => m.id)
    });

    // Create secondary branch from branch point
    const branchPoint = mainMessages[branchPointIndex];
    branchMessages[0].parentMessageId = branchPoint.id;
    branchPoint.childMessageIds.push(branchMessages[0].id);

    const secondaryBranch = this.createMockBranch({
      title: 'Secondary Branch',
      parentBranchId: mainBranch.id,
      messageIds: branchMessages.map(m => m.id)
    });

    // Add all messages to conversation
    const allMessages = [...mainMessages, ...branchMessages];
    allMessages.forEach(message => {
      conversation.messages.set(message.id, message);
    });

    // Add branches to conversation
    conversation.branches.set(mainBranch.id, mainBranch);
    conversation.branches.set(secondaryBranch.id, secondaryBranch);

    return {
      conversation,
      mainBranch,
      secondaryBranch,
      allMessages
    };
  }

  static createChatGraphWithMultipleConversations(conversationCount: number): ChatGraphStructure {
    const chatGraph = new ChatGraphStructure();

    for (let i = 0; i < conversationCount; i++) {
      const { conversation } = this.createBranchedConversation(5, 2, 3);
      conversation.thread.title = `Test Conversation ${i + 1}`;
      chatGraph.addConversation(conversation);
    }

    return chatGraph;
  }

  static async waitForAsync(ms: number = 10): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  static createMockWebSocket(): {
    ws: any;
    mockSend: jest.Mock;
    mockClose: jest.Mock;
    mockOn: jest.Mock;
    triggerMessage: (data: any) => void;
    triggerClose: () => void;
    triggerError: (error: Error) => void;
  } {
    const mockSend = jest.fn();
    const mockClose = jest.fn();
    const mockOn = jest.fn();
    const eventHandlers: { [key: string]: Function } = {};

    mockOn.mockImplementation((event: string, handler: Function) => {
      eventHandlers[event] = handler;
    });

    const ws = {
      send: mockSend,
      close: mockClose,
      on: mockOn,
      ping: jest.fn(),
      readyState: 1 // WebSocket.OPEN
    };

    const triggerMessage = (data: any) => {
      if (eventHandlers.message) {
        eventHandlers.message(Buffer.from(JSON.stringify(data)));
      }
    };

    const triggerClose = () => {
      if (eventHandlers.close) {
        eventHandlers.close();
      }
    };

    const triggerError = (error: Error) => {
      if (eventHandlers.error) {
        eventHandlers.error(error);
      }
    };

    return {
      ws,
      mockSend,
      mockClose,
      mockOn,
      triggerMessage,
      triggerClose,
      triggerError
    };
  }

  static createMockClaudeResponse(content: string, streaming: boolean = false): {
    response: string;
    chunks?: string[];
  } {
    if (streaming) {
      // Split content into chunks for streaming simulation
      const chunkSize = Math.max(1, Math.floor(content.length / 5));
      const chunks: string[] = [];

      for (let i = 0; i < content.length; i += chunkSize) {
        chunks.push(content.substring(i, i + chunkSize));
      }

      return { response: content, chunks };
    }

    return { response: content };
  }

  static assertMessageStructure(message: MessageNode): void {
    expect(message).toHaveProperty('id');
    expect(message).toHaveProperty('conversationType', 'message');
    expect(message).toHaveProperty('content');
    expect(message).toHaveProperty('role');
    expect(message).toHaveProperty('messageIndex');
    expect(message).toHaveProperty('childMessageIds');
    expect(message).toHaveProperty('timestamp');
    expect(message).toHaveProperty('metadata');

    expect(typeof message.id).toBe('string');
    expect(typeof message.content).toBe('string');
    expect(['user', 'assistant', 'system']).toContain(message.role);
    expect(typeof message.messageIndex).toBe('number');
    expect(Array.isArray(message.childMessageIds)).toBe(true);
    expect(message.timestamp).toBeInstanceOf(Date);
  }

  static assertConversationStructure(conversation: ChatConversationNode): void {
    expect(conversation).toHaveProperty('id');
    expect(conversation).toHaveProperty('conversationType', 'chat');
    expect(conversation).toHaveProperty('thread');
    expect(conversation).toHaveProperty('messages');
    expect(conversation).toHaveProperty('branches');
    expect(conversation).toHaveProperty('currentContext');

    expect(typeof conversation.id).toBe('string');
    expect(conversation.messages).toBeInstanceOf(Map);
    expect(conversation.branches).toBeInstanceOf(Map);
  }

  static createPerformanceTestData(messageCount: number): {
    messages: MessageNode[];
    conversation: ChatConversationNode;
  } {
    const messages = this.createMessageChain(messageCount);
    const conversation = this.createMockConversation();

    messages.forEach(message => {
      conversation.messages.set(message.id, message);
    });

    const branch = this.createMockBranch({
      messageIds: messages.map(m => m.id)
    });

    conversation.branches.set(branch.id, branch);

    return { messages, conversation };
  }

  static measureExecutionTime<T>(fn: () => T | Promise<T>): Promise<{ result: T; duration: number }> {
    const start = performance.now();

    const result = fn();

    if (result instanceof Promise) {
      return result.then(resolvedResult => ({
        result: resolvedResult,
        duration: performance.now() - start
      }));
    } else {
      return Promise.resolve({
        result,
        duration: performance.now() - start
      });
    }
  }

  static generateRandomString(length: number): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  static generateCodeContent(language: string = 'typescript'): string {
    const codeExamples = {
      typescript: `
function calculateSum(a: number, b: number): number {
  return a + b;
}

interface User {
  id: string;
  name: string;
  email: string;
}

const user: User = {
  id: '1',
  name: 'Test User',
  email: 'test@example.com'
};
      `,
      javascript: `
function processData(data) {
  return data.map(item => ({
    ...item,
    processed: true,
    timestamp: new Date()
  }));
}

const results = processData([
  { id: 1, value: 'test' },
  { id: 2, value: 'data' }
]);
      `,
      python: `
def fibonacci(n):
    if n <= 1:
        return n
    return fibonacci(n-1) + fibonacci(n-2)

class DataProcessor:
    def __init__(self, data):
        self.data = data

    def process(self):
        return [item.upper() for item in self.data if isinstance(item, str)]
      `
    };

    return codeExamples[language] || codeExamples.typescript;
  }

  static createComplexMessageContent(): string {
    return `
Here's a complex message with multiple elements:

## Code Implementation

\`\`\`typescript
${this.generateCodeContent('typescript')}
\`\`\`

## Python Alternative

\`\`\`python
${this.generateCodeContent('python')}
\`\`\`

## Key Points

1. This implementation handles edge cases
2. It includes proper type definitions
3. Error handling is implemented
4. Performance is optimized

## Questions

- How should we handle null values?
- What about performance with large datasets?
- Should we add caching?

## References

- See documentation: [API Docs](https://example.com/docs)
- Related issue: #123
- Previous discussion in conversation conv_abc123

This is a complex message that should trigger multiple parsers and extractors.
    `;
  }
}