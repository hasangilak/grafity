import 'jest-extended';

// Global test setup
beforeAll(async () => {
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'error';
  process.env.REDIS_URL = 'redis://localhost:6379/1';
  process.env.NEO4J_URI = 'bolt://localhost:7687';
  process.env.NEO4J_USER = 'neo4j';
  process.env.NEO4J_PASSWORD = 'test';
  process.env.JWT_SECRET = 'test-secret-key';
});

// Global test teardown
afterAll(async () => {
  // Cleanup any persistent connections or resources
});

// Mock console methods to reduce noise in tests
const originalConsole = global.console;

beforeEach(() => {
  // Mock console methods but allow error logs for debugging
  global.console = {
    ...originalConsole,
    log: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    // Keep error for debugging test failures
    error: originalConsole.error
  };
});

afterEach(() => {
  // Restore console
  global.console = originalConsole;

  // Clear all mocks
  jest.clearAllMocks();
});

// Custom matchers for common test assertions
expect.extend({
  toBeValidUUID(received: string) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const pass = uuidRegex.test(received);

    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid UUID`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid UUID`,
        pass: false,
      };
    }
  },

  toBeValidTimestamp(received: any) {
    const pass = received instanceof Date && !isNaN(received.getTime());

    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid timestamp`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid timestamp`,
        pass: false,
      };
    }
  },

  toHaveValidStructure(received: any, expectedKeys: string[]) {
    const receivedKeys = Object.keys(received);
    const hasAllKeys = expectedKeys.every(key => receivedKeys.includes(key));

    if (hasAllKeys) {
      return {
        message: () => `expected object not to have all required keys: ${expectedKeys.join(', ')}`,
        pass: true,
      };
    } else {
      const missingKeys = expectedKeys.filter(key => !receivedKeys.includes(key));
      return {
        message: () => `expected object to have keys: ${expectedKeys.join(', ')}, missing: ${missingKeys.join(', ')}`,
        pass: false,
      };
    }
  }
});

// Extend Jest matchers type definitions
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidUUID(): R;
      toBeValidTimestamp(): R;
      toHaveValidStructure(expectedKeys: string[]): R;
    }
  }
}