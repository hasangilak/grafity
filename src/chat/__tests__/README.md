# Chat System Testing Framework

This comprehensive testing framework provides thorough coverage for the Phase 5 Graph-Based AI Chat Interface implementation. The framework includes unit tests, integration tests, performance tests, and utilities to ensure the reliability and quality of the chat system.

## 🧪 Test Structure

### Core Components Tested

1. **Models** (`/models/`)
   - `MessageNode` - Message structure and relationships
   - `ChatGraphStructure` - Graph management and operations
   - `ConversationNode` - Conversation threading and branching

2. **Message Processing** (`/parsers/`)
   - `MessageParser` - Content analysis and entity extraction
   - `ContextExtractor` - Context building from graph nodes
   - `EntityExtractor` - Advanced entity recognition

3. **AI Integration** (`/ai/`)
   - `ResponseGenerator` - AI response orchestration
   - `ClaudeIntegration` - Claude Code CLI integration
   - `PromptBuilder` - Context-aware prompt construction

4. **Advanced Features** (`/realtime/`, `/analytics/`, `/merge/`)
   - `RealtimeChat` - WebSocket-based collaboration
   - `ChatAnalytics` - Conversation analysis and insights
   - `ConversationMerger` - Branch merging and conflict resolution

5. **Persistence & Search** (`/persistence/`, `/search/`)
   - `ConversationStorage` - Neo4j and local storage
   - `ConversationSearch` - Advanced search and indexing

### Test Categories

#### Unit Tests
- Individual component functionality
- Error handling and edge cases
- Data structure validation
- API contract verification

#### Integration Tests
- End-to-end conversation flows
- Component interaction testing
- Real-time collaboration scenarios
- Cross-system data consistency

#### Performance Tests
- Large-scale data processing
- Concurrent operation handling
- Memory and resource management
- Response time benchmarks

## 🚀 Running Tests

### Prerequisites
```bash
npm install --dev jest ts-jest @types/jest jest-extended fake-indexeddb
```

### Basic Test Commands
```bash
# Run all tests
npm run test:chat

# Run with coverage
npm run test:chat:coverage

# Run specific test suite
npm run test:chat -- --testNamePattern="MessageNode"

# Run in watch mode
npm run test:chat:watch

# Run only integration tests
npm run test:chat -- --testPathPattern="integration"
```

### Test Configuration
Tests are configured via `jest.config.js` with:
- TypeScript support via ts-jest
- Custom matchers for chat-specific validation
- Coverage thresholds (80% minimum, 90% for core models)
- Parallel test execution
- Comprehensive mocking setup

## 🛠 Test Utilities

### `ChatTestUtils` Class
Comprehensive utilities for creating test data:

```typescript
// Create mock messages and conversations
const message = ChatTestUtils.createMockMessage({
  content: 'Test message',
  role: 'user'
});

const conversation = ChatTestUtils.createMockConversation();

// Create message chains and branched conversations
const chain = ChatTestUtils.createMessageChain(5);
const { conversation, mainBranch, secondaryBranch } =
  ChatTestUtils.createBranchedConversation(5, 2, 3);

// Performance testing utilities
const { result, duration } = await ChatTestUtils.measureExecutionTime(() => {
  return performExpensiveOperation();
});

// Mock external services
const mockResponse = ChatTestUtils.createMockClaudeResponse('AI response', true);
const mockWS = ChatTestUtils.createMockWebSocket();
```

### Custom Jest Matchers
```typescript
// Validate message structure
expect(message).toBeValidChatMessage();
expect(message).toHaveValidMessageStructure();

// Validate conversation structure
expect(conversation).toBeValidConversation();
```

### Global Test Utilities
```typescript
// Flush all promises
await global.testUtils.flushPromises();

// Advance timers
await global.testUtils.advanceTimers(1000);

// Mock performance timing
const perfMock = global.testUtils.mockPerformanceNow();
perfMock.advance(100);
```

## 📊 Coverage Requirements

### Minimum Coverage Thresholds
- **Global**: 80% (branches, functions, lines, statements)
- **Models**: 90% (core data structures)
- **Parsers**: 85% (message processing)
- **AI Components**: 75% (external dependencies)

### Coverage Reports
- HTML report: `coverage/lcov-report/index.html`
- LCOV format: `coverage/lcov.info`
- JSON summary: `coverage/coverage-summary.json`
- Text summary: Console output

## 🔧 Mocking Strategy

### External Dependencies
- **WebSocket**: Mocked with controllable message simulation
- **Claude API**: Mocked responses with streaming support
- **Neo4j**: In-memory graph for tests
- **File System**: Temporary directories for storage tests
- **IndexedDB**: Fake implementation for browser storage
- **Performance**: Controllable timing for consistent tests

### Service Integration
- HTTP requests mocked with realistic responses
- WebSocket connections simulated with event triggering
- Database operations use test-specific schemas
- File operations use temporary directories

## 🧩 Test Patterns

### Async Testing
```typescript
test('should handle async operations', async () => {
  const result = await asyncOperation();
  expect(result).toBeDefined();
});
```

### Error Handling
```typescript
test('should handle errors gracefully', async () => {
  await expect(operationThatFails()).rejects.toThrow('Expected error');
});
```

### Performance Testing
```typescript
test('should complete within time limit', async () => {
  const { duration } = await ChatTestUtils.measureExecutionTime(() => {
    return expensiveOperation();
  });

  expect(duration).toBeLessThan(1000);
});
```

### Concurrent Operations
```typescript
test('should handle concurrent operations', async () => {
  const operations = Array.from({ length: 10 }, () => asyncOperation());
  const results = await Promise.all(operations);

  expect(results).toHaveLength(10);
});
```

## 📈 Test Reports

### HTML Report
Comprehensive visual report with:
- Test suite overview
- Coverage heat maps
- Failed test details
- Performance metrics

### Console Output
Real-time test progress with:
- Pass/fail indicators
- Coverage summaries
- Performance warnings
- Error details

### CI/CD Integration
Test results formatted for:
- GitHub Actions
- Jenkins pipelines
- Docker containers
- Azure DevOps

## 🐛 Debugging Tests

### Debug Configuration
```bash
# Run tests with debugging
npm run test:chat:debug

# Run specific test with debugging
npm run test:chat:debug -- --testNamePattern="specific test"
```

### Console Debugging
```typescript
// Use console.log in tests (mocked by default)
console.log('Debug info:', testData);

// Use console.error for important debugging
console.error('Critical debug info:', errorData);
```

### Snapshot Testing
```typescript
// Create snapshots for complex data structures
expect(conversationState).toMatchSnapshot();

// Update snapshots when structure changes
npm run test:chat -- --updateSnapshot
```

## 🔄 Continuous Integration

### Pre-commit Hooks
- Run tests on changed files
- Ensure coverage thresholds
- Validate test structure

### CI Pipeline
1. Install dependencies
2. Run linting
3. Execute test suite
4. Generate coverage reports
5. Upload artifacts
6. Notify on failures

### Quality Gates
- All tests must pass
- Coverage thresholds must be met
- No security vulnerabilities
- Performance benchmarks must pass

## 📚 Best Practices

### Test Writing
- Use descriptive test names
- Group related tests with `describe` blocks
- Test one thing per test case
- Use `beforeEach` for setup
- Clean up after tests

### Data Management
- Use test utilities for consistent data
- Avoid hardcoded values
- Create realistic test scenarios
- Test edge cases and error conditions

### Performance
- Keep tests fast (< 100ms for unit tests)
- Use mocks for external dependencies
- Avoid heavy computations in setup
- Batch similar operations

### Maintenance
- Update tests when APIs change
- Remove obsolete tests
- Refactor common patterns
- Document complex test logic

## 🎯 Test Scenarios Covered

### Happy Path
- ✅ Normal conversation flow
- ✅ Message parsing and analysis
- ✅ Context extraction and AI response
- ✅ Real-time collaboration
- ✅ Branch creation and merging
- ✅ Search and analytics

### Error Conditions
- ✅ Malformed input handling
- ✅ Network failure recovery
- ✅ Concurrent operation conflicts
- ✅ Resource exhaustion
- ✅ Invalid state transitions

### Edge Cases
- ✅ Empty conversations
- ✅ Very long content
- ✅ Special characters and emojis
- ✅ Circular references
- ✅ Rapid user interactions

### Performance Limits
- ✅ Large conversation graphs
- ✅ High-frequency message sending
- ✅ Complex search queries
- ✅ Memory usage optimization
- ✅ Concurrent user handling

This testing framework ensures the chat system is robust, performant, and ready for production use with comprehensive coverage of all components and scenarios.