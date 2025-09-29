import 'jest-extended';

// Global test setup for integration tests
beforeAll(async () => {
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'error';
  process.env.PORT = '0'; // Use random available port
  process.env.REDIS_URL = 'redis://localhost:6379/2'; // Different DB for integration tests
  process.env.NEO4J_URI = 'bolt://localhost:7687';
  process.env.NEO4J_USER = 'neo4j';
  process.env.NEO4J_PASSWORD = 'test';
  process.env.JWT_SECRET = 'integration-test-secret-key';
  process.env.JWT_EXPIRES_IN = '1h';

  // Disable external services for testing
  process.env.DISABLE_EXTERNAL_APIS = 'true';
});

// Global test teardown
afterAll(async () => {
  // Cleanup any persistent connections or resources
  await new Promise(resolve => setTimeout(resolve, 100)); // Allow cleanup
});

// Helper to wait for async operations
global.waitFor = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper to generate test data
global.generateTestUser = (overrides = {}) => ({
  id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  username: `testuser_${Math.random().toString(36).substr(2, 6)}`,
  email: `test_${Math.random().toString(36).substr(2, 6)}@example.com`,
  roles: ['user'],
  preferences: {},
  ...overrides
});

global.generateTestProject = (overrides = {}) => ({
  name: `Test Project ${Math.random().toString(36).substr(2, 6)}`,
  description: 'Integration test project',
  path: `/test/project/${Math.random().toString(36).substr(2, 6)}`,
  type: 'react',
  ...overrides
});

// Mock console methods but allow errors for debugging
const originalConsole = global.console;
beforeEach(() => {
  global.console = {
    ...originalConsole,
    log: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    // Keep error and trace for debugging test failures
    error: originalConsole.error,
    trace: originalConsole.trace
  };
});

afterEach(() => {
  global.console = originalConsole;
});

// Custom matchers for integration tests
expect.extend({
  toHaveHttpStatus(received: any, expected: number) {
    const pass = received.status === expected;

    if (pass) {
      return {
        message: () => `expected HTTP status not to be ${expected}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected HTTP status ${expected} but received ${received.status}`,
        pass: false,
      };
    }
  },

  toHaveAuthHeaders(received: any) {
    const hasAuth = received.headers && (
      received.headers.authorization ||
      received.headers.Authorization ||
      received.get('Authorization')
    );

    if (hasAuth) {
      return {
        message: () => `expected request not to have authorization headers`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected request to have authorization headers`,
        pass: false,
      };
    }
  },

  toBeValidApiResponse(received: any) {
    const isValid = received &&
                   typeof received === 'object' &&
                   received.hasOwnProperty('status') &&
                   (received.hasOwnProperty('data') || received.hasOwnProperty('error'));

    if (isValid) {
      return {
        message: () => `expected object not to be a valid API response`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected object to be a valid API response with status and data/error properties`,
        pass: false,
      };
    }
  }
});

// Extend Jest matchers type definitions
declare global {
  namespace jest {
    interface Matchers<R> {
      toHaveHttpStatus(expected: number): R;
      toHaveAuthHeaders(): R;
      toBeValidApiResponse(): R;
    }
  }

  function waitFor(ms: number): Promise<void>;
  function generateTestUser(overrides?: any): any;
  function generateTestProject(overrides?: any): any;
}