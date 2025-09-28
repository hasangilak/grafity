// Global test setup for chat system tests

// Extend Jest matchers
import 'jest-extended';

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  // Uncomment to silence console.log in tests
  // log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Mock timers by default
jest.useFakeTimers();

// Global test utilities
global.testUtils = {
  // Utility to flush all promises
  flushPromises: () => new Promise(setImmediate),

  // Utility to advance timers
  advanceTimers: (ms: number) => {
    jest.advanceTimersByTime(ms);
    return global.testUtils.flushPromises();
  },

  // Mock performance.now for consistent timing tests
  mockPerformanceNow: () => {
    const originalNow = performance.now;
    let currentTime = 0;

    performance.now = jest.fn(() => currentTime);

    return {
      advance: (ms: number) => {
        currentTime += ms;
      },
      restore: () => {
        performance.now = originalNow;
      }
    };
  }
};

// Mock WebSocket globally
global.WebSocket = class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState = MockWebSocket.CONNECTING;
  onopen?: (event: Event) => void;
  onclose?: (event: CloseEvent) => void;
  onmessage?: (event: MessageEvent) => void;
  onerror?: (event: Event) => void;

  constructor(public url: string) {
    // Simulate async connection
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN;
      this.onopen?.(new Event('open'));
    }, 0);
  }

  send(data: string): void {
    if (this.readyState !== MockWebSocket.OPEN) {
      throw new Error('WebSocket is not open');
    }
    // Mock implementation - tests can override this
  }

  close(): void {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.(new CloseEvent('close'));
  }
} as any;

// Mock localStorage for browser-like storage tests
Object.defineProperty(global, 'localStorage', {
  value: {
    store: {} as { [key: string]: string },
    getItem(key: string) {
      return this.store[key] || null;
    },
    setItem(key: string, value: string) {
      this.store[key] = value;
    },
    removeItem(key: string) {
      delete this.store[key];
    },
    clear() {
      this.store = {};
    },
    get length() {
      return Object.keys(this.store).length;
    },
    key(index: number) {
      const keys = Object.keys(this.store);
      return keys[index] || null;
    }
  },
  writable: true
});

// Mock IndexedDB for advanced storage tests
const FDBFactory = require('fake-indexeddb/lib/FDBFactory');
const FDBKeyRange = require('fake-indexeddb/lib/FDBKeyRange');

global.indexedDB = new FDBFactory();
global.IDBKeyRange = FDBKeyRange;

// Mock crypto for ID generation
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: () => {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
    },
    getRandomValues: (array: Uint8Array) => {
      for (let i = 0; i < array.length; i++) {
        array[i] = Math.floor(Math.random() * 256);
      }
      return array;
    }
  }
});

// Mock TextEncoder/TextDecoder for browser compatibility
global.TextEncoder = require('util').TextEncoder;
global.TextDecoder = require('util').TextDecoder;

// Set up test environment variables
process.env.NODE_ENV = 'test';
process.env.CHAT_SYSTEM_LOG_LEVEL = 'error'; // Reduce logging in tests

// Global error handling
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Clean up after each test
afterEach(() => {
  // Clear all timers
  jest.clearAllTimers();

  // Clear localStorage
  localStorage.clear();

  // Reset modules to ensure clean state
  jest.resetModules();

  // Clear all mocks
  jest.clearAllMocks();
});

// Reset timers after all tests
afterAll(() => {
  jest.useRealTimers();
});

// Add custom matchers
expect.extend({
  toBeValidChatMessage(received) {
    const pass = received &&
      typeof received.id === 'string' &&
      typeof received.content === 'string' &&
      ['user', 'assistant', 'system'].includes(received.role) &&
      received.timestamp instanceof Date &&
      Array.isArray(received.childMessageIds);

    return {
      message: () => `expected ${received} to be a valid chat message`,
      pass
    };
  },

  toBeValidConversation(received) {
    const pass = received &&
      typeof received.id === 'string' &&
      received.messages instanceof Map &&
      received.branches instanceof Map &&
      received.thread &&
      typeof received.thread.title === 'string';

    return {
      message: () => `expected ${received} to be a valid conversation`,
      pass
    };
  },

  toHaveValidMessageStructure(received) {
    const requiredFields = ['id', 'content', 'role', 'messageIndex', 'timestamp', 'metadata'];
    const hasAllFields = requiredFields.every(field => received.hasOwnProperty(field));

    const pass = hasAllFields &&
      typeof received.id === 'string' &&
      typeof received.content === 'string' &&
      ['user', 'assistant', 'system'].includes(received.role) &&
      typeof received.messageIndex === 'number' &&
      received.timestamp instanceof Date &&
      typeof received.metadata === 'object';

    return {
      message: () => `expected message to have valid structure`,
      pass
    };
  }
});

// Extend global types for TypeScript
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidChatMessage(): R;
      toBeValidConversation(): R;
      toHaveValidMessageStructure(): R;
    }
  }

  var testUtils: {
    flushPromises: () => Promise<void>;
    advanceTimers: (ms: number) => Promise<void>;
    mockPerformanceNow: () => {
      advance: (ms: number) => void;
      restore: () => void;
    };
  };
}