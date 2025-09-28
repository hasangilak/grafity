import { MessageParser } from '../../parsers/MessageParser';
import { ChatTestUtils } from '../utils/TestUtils';

describe('MessageParser', () => {
  let parser: MessageParser;

  beforeEach(() => {
    parser = new MessageParser();
  });

  describe('Content Type Detection', () => {
    test('should detect text content', async () => {
      const message = ChatTestUtils.createMockMessage({
        content: 'This is a simple text message without any special elements.'
      });

      const parsed = await parser.parseMessage(message);

      expect(parsed.contentType).toBe('text');
      expect(parsed.codeBlocks).toHaveLength(0);
      expect(parsed.complexity).toBeLessThan(0.5);
    });

    test('should detect code content', async () => {
      const codeContent = `
\`\`\`typescript
function greet(name: string): string {
  return \`Hello, \${name}!\`;
}
\`\`\`
      `;

      const message = ChatTestUtils.createMockMessage({ content: codeContent });
      const parsed = await parser.parseMessage(message);

      expect(parsed.contentType).toBe('code');
      expect(parsed.codeBlocks).toHaveLength(1);
      expect(parsed.codeBlocks[0].language).toBe('typescript');
      expect(parsed.codeBlocks[0].content).toContain('function greet');
    });

    test('should detect mixed content', async () => {
      const mixedContent = `
Here's the solution to your problem:

\`\`\`javascript
console.log('Hello, World!');
\`\`\`

This code will output a greeting message.
      `;

      const message = ChatTestUtils.createMockMessage({ content: mixedContent });
      const parsed = await parser.parseMessage(message);

      expect(parsed.contentType).toBe('mixed');
      expect(parsed.codeBlocks).toHaveLength(1);
      expect(parsed.complexity).toBeGreaterThan(0.5);
    });

    test('should detect error content', async () => {
      const errorContent = `
Error: Cannot read property 'length' of undefined
  at Object.validateInput (app.js:15:12)
  at processRequest (server.js:45:8)
  at Server.handleRequest (server.js:23:5)
      `;

      const message = ChatTestUtils.createMockMessage({ content: errorContent });
      const parsed = await parser.parseMessage(message);

      expect(parsed.contentType).toBe('error');
      expect(parsed.entities.some(entity => entity.type === 'error')).toBe(true);
    });
  });

  describe('Code Block Extraction', () => {
    test('should extract single code block', async () => {
      const content = `
\`\`\`python
def fibonacci(n):
    if n <= 1:
        return n
    return fibonacci(n-1) + fibonacci(n-2)
\`\`\`
      `;

      const message = ChatTestUtils.createMockMessage({ content });
      const parsed = await parser.parseMessage(message);

      expect(parsed.codeBlocks).toHaveLength(1);
      expect(parsed.codeBlocks[0].language).toBe('python');
      expect(parsed.codeBlocks[0].content).toContain('def fibonacci');
    });

    test('should extract multiple code blocks', async () => {
      const content = `
Here are two examples:

\`\`\`javascript
console.log('JavaScript');
\`\`\`

And in Python:

\`\`\`python
print('Python')
\`\`\`
      `;

      const message = ChatTestUtils.createMockMessage({ content });
      const parsed = await parser.parseMessage(message);

      expect(parsed.codeBlocks).toHaveLength(2);
      expect(parsed.codeBlocks[0].language).toBe('javascript');
      expect(parsed.codeBlocks[1].language).toBe('python');
    });

    test('should handle inline code', async () => {
      const content = 'Use the `console.log()` function to output messages.';

      const message = ChatTestUtils.createMockMessage({ content });
      const parsed = await parser.parseMessage(message);

      expect(parsed.codeBlocks).toHaveLength(1);
      expect(parsed.codeBlocks[0].language).toBe('inline');
      expect(parsed.codeBlocks[0].content).toBe('console.log()');
    });

    test('should handle code blocks without language specification', async () => {
      const content = `
\`\`\`
function test() {
  return 'no language specified';
}
\`\`\`
      `;

      const message = ChatTestUtils.createMockMessage({ content });
      const parsed = await parser.parseMessage(message);

      expect(parsed.codeBlocks).toHaveLength(1);
      expect(parsed.codeBlocks[0].language).toBe('text');
      expect(parsed.codeBlocks[0].content).toContain('function test');
    });
  });

  describe('Entity Extraction', () => {
    test('should extract file references', async () => {
      const content = 'Please check the file /src/components/Button.tsx for the implementation.';

      const message = ChatTestUtils.createMockMessage({ content });
      const parsed = await parser.parseMessage(message);

      const fileEntities = parsed.entities.filter(e => e.type === 'file');
      expect(fileEntities).toHaveLength(1);
      expect(fileEntities[0].value).toBe('/src/components/Button.tsx');
    });

    test('should extract URLs', async () => {
      const content = 'Check out this documentation: https://example.com/docs and http://test.org';

      const message = ChatTestUtils.createMockMessage({ content });
      const parsed = await parser.parseMessage(message);

      const urlEntities = parsed.entities.filter(e => e.type === 'url');
      expect(urlEntities).toHaveLength(2);
      expect(urlEntities.map(e => e.value)).toContain('https://example.com/docs');
      expect(urlEntities.map(e => e.value)).toContain('http://test.org');
    });

    test('should extract conversation references', async () => {
      const content = 'As discussed in conversation conv_abc123, we need to implement this feature.';

      const message = ChatTestUtils.createMockMessage({ content });
      const parsed = await parser.parseMessage(message);

      const convEntities = parsed.entities.filter(e => e.type === 'conversation');
      expect(convEntities).toHaveLength(1);
      expect(convEntities[0].value).toBe('conv_abc123');
    });

    test('should extract numbers and technical terms', async () => {
      const content = 'The function should handle arrays with up to 1000 elements using O(n) complexity.';

      const message = ChatTestUtils.createMockMessage({ content });
      const parsed = await parser.parseMessage(message);

      const numberEntities = parsed.entities.filter(e => e.type === 'number');
      const techEntities = parsed.entities.filter(e => e.type === 'technical_term');

      expect(numberEntities.length).toBeGreaterThan(0);
      expect(techEntities.length).toBeGreaterThan(0);
    });

    test('should extract error patterns', async () => {
      const content = 'I\'m getting a TypeError: Cannot read property \'map\' of undefined error.';

      const message = ChatTestUtils.createMockMessage({ content });
      const parsed = await parser.parseMessage(message);

      const errorEntities = parsed.entities.filter(e => e.type === 'error');
      expect(errorEntities).toHaveLength(1);
      expect(errorEntities[0].value).toContain('TypeError');
    });
  });

  describe('Intent Recognition', () => {
    test('should recognize question intent', async () => {
      const content = 'How do I implement a binary search algorithm in JavaScript?';

      const message = ChatTestUtils.createMockMessage({ content });
      const parsed = await parser.parseMessage(message);

      expect(parsed.intent.type).toBe('question');
      expect(parsed.intent.context).toBe('code_help');
      expect(parsed.intent.confidence).toBeGreaterThan(0.7);
    });

    test('should recognize request intent', async () => {
      const content = 'Can you please review my code and suggest improvements?';

      const message = ChatTestUtils.createMockMessage({ content });
      const parsed = await parser.parseMessage(message);

      expect(parsed.intent.type).toBe('request');
      expect(parsed.intent.context).toBe('code_review');
    });

    test('should recognize information sharing intent', async () => {
      const content = 'Here\'s the solution that worked for me:';

      const message = ChatTestUtils.createMockMessage({ content });
      const parsed = await parser.parseMessage(message);

      expect(parsed.intent.type).toBe('information');
      expect(parsed.intent.confidence).toBeGreaterThan(0.5);
    });

    test('should recognize error reporting intent', async () => {
      const content = 'I\'m getting this error and I don\'t know how to fix it.';

      const message = ChatTestUtils.createMockMessage({ content });
      const parsed = await parser.parseMessage(message);

      expect(parsed.intent.type).toBe('error_report');
      expect(parsed.intent.context).toBe('debugging');
    });

    test('should provide suggested actions', async () => {
      const content = 'How can I optimize this React component for better performance?';

      const message = ChatTestUtils.createMockMessage({ content });
      const parsed = await parser.parseMessage(message);

      expect(parsed.intent.suggestedActions).toBeDefined();
      expect(parsed.intent.suggestedActions.length).toBeGreaterThan(0);
      expect(parsed.intent.suggestedActions).toContain('code_analysis');
    });
  });

  describe('Complexity Analysis', () => {
    test('should calculate low complexity for simple text', async () => {
      const content = 'Hello, how are you?';

      const message = ChatTestUtils.createMockMessage({ content });
      const parsed = await parser.parseMessage(message);

      expect(parsed.complexity).toBeLessThan(0.3);
    });

    test('should calculate medium complexity for technical content', async () => {
      const content = 'I need to implement a REST API endpoint that handles user authentication.';

      const message = ChatTestUtils.createMockMessage({ content });
      const parsed = await parser.parseMessage(message);

      expect(parsed.complexity).toBeGreaterThan(0.3);
      expect(parsed.complexity).toBeLessThan(0.7);
    });

    test('should calculate high complexity for code and detailed technical content', async () => {
      const content = ChatTestUtils.createComplexMessageContent();

      const message = ChatTestUtils.createMockMessage({ content });
      const parsed = await parser.parseMessage(message);

      expect(parsed.complexity).toBeGreaterThan(0.7);
    });

    test('should consider code blocks in complexity calculation', async () => {
      const simpleText = 'This is simple text.';
      const textWithCode = `
This is text with code:
\`\`\`javascript
function complexFunction() {
  // Complex logic here
  return result;
}
\`\`\`
      `;

      const simpleMessage = ChatTestUtils.createMockMessage({ content: simpleText });
      const codeMessage = ChatTestUtils.createMockMessage({ content: textWithCode });

      const simpleParsed = await parser.parseMessage(simpleMessage);
      const codeParsed = await parser.parseMessage(codeMessage);

      expect(codeParsed.complexity).toBeGreaterThan(simpleParsed.complexity);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('should handle empty content', async () => {
      const message = ChatTestUtils.createMockMessage({ content: '' });
      const parsed = await parser.parseMessage(message);

      expect(parsed.contentType).toBe('text');
      expect(parsed.codeBlocks).toHaveLength(0);
      expect(parsed.entities).toHaveLength(0);
      expect(parsed.complexity).toBe(0);
    });

    test('should handle very long content', async () => {
      const longContent = 'A'.repeat(10000);
      const message = ChatTestUtils.createMockMessage({ content: longContent });
      const parsed = await parser.parseMessage(message);

      expect(parsed.contentType).toBe('text');
      expect(parsed.complexity).toBeGreaterThan(0);
    });

    test('should handle malformed code blocks', async () => {
      const malformedContent = `
\`\`\`javascript
function incomplete() {
  // Missing closing brace and backticks
      `;

      const message = ChatTestUtils.createMockMessage({ content: malformedContent });

      expect(async () => {
        await parser.parseMessage(message);
      }).not.toThrow();
    });

    test('should handle special characters and emojis', async () => {
      const specialContent = 'Here are some emojis: 🚀 🎉 🔥 and special chars: àáâãäå';

      const message = ChatTestUtils.createMockMessage({ content: specialContent });
      const parsed = await parser.parseMessage(message);

      expect(parsed.contentType).toBe('text');
      expect(parsed).toBeDefined();
    });

    test('should handle nested code structures', async () => {
      const nestedContent = `
\`\`\`markdown
# Documentation

Here's some code:

\`\`\`javascript
console.log('nested');
\`\`\`
\`\`\`
      `;

      const message = ChatTestUtils.createMockMessage({ content: nestedContent });
      const parsed = await parser.parseMessage(message);

      expect(parsed.codeBlocks.length).toBeGreaterThan(0);
    });
  });

  describe('Performance', () => {
    test('should parse simple messages quickly', async () => {
      const message = ChatTestUtils.createMockMessage({
        content: 'Simple test message'
      });

      const { duration } = await ChatTestUtils.measureExecutionTime(async () => {
        await parser.parseMessage(message);
      });

      expect(duration).toBeLessThan(100); // Should complete in less than 100ms
    });

    test('should parse complex messages efficiently', async () => {
      const message = ChatTestUtils.createMockMessage({
        content: ChatTestUtils.createComplexMessageContent()
      });

      const { duration } = await ChatTestUtils.measureExecutionTime(async () => {
        await parser.parseMessage(message);
      });

      expect(duration).toBeLessThan(500); // Should complete in less than 500ms
    });

    test('should handle batch parsing efficiently', async () => {
      const messages = Array.from({ length: 100 }, () =>
        ChatTestUtils.createMockMessage({
          content: ChatTestUtils.generateRandomString(100)
        })
      );

      const { duration } = await ChatTestUtils.measureExecutionTime(async () => {
        await Promise.all(messages.map(msg => parser.parseMessage(msg)));
      });

      expect(duration).toBeLessThan(2000); // Should complete in less than 2 seconds
    });
  });

  describe('Consistency and Reliability', () => {
    test('should produce consistent results for identical input', async () => {
      const content = 'Test message with code: `console.log("test")`';
      const message = ChatTestUtils.createMockMessage({ content });

      const result1 = await parser.parseMessage(message);
      const result2 = await parser.parseMessage(message);

      expect(result1.contentType).toBe(result2.contentType);
      expect(result1.codeBlocks.length).toBe(result2.codeBlocks.length);
      expect(result1.entities.length).toBe(result2.entities.length);
      expect(result1.complexity).toBe(result2.complexity);
    });

    test('should handle concurrent parsing', async () => {
      const messages = Array.from({ length: 10 }, (_, i) =>
        ChatTestUtils.createMockMessage({
          content: `Test message ${i}`
        })
      );

      const parsePromises = messages.map(msg => parser.parseMessage(msg));
      const results = await Promise.all(parsePromises);

      expect(results).toHaveLength(10);
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(result.contentType).toBeDefined();
      });
    });

    test('should maintain entity confidence scores', async () => {
      const message = ChatTestUtils.createMockMessage({
        content: 'Check the file /src/index.ts and visit https://example.com'
      });

      const parsed = await parser.parseMessage(message);

      parsed.entities.forEach(entity => {
        expect(entity.confidence).toBeGreaterThan(0);
        expect(entity.confidence).toBeLessThanOrEqual(1);
      });
    });
  });
});