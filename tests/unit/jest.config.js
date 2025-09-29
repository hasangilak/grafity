module.exports = {
  displayName: 'Unit Tests',
  testEnvironment: 'node',
  roots: ['<rootDir>/../../src'],
  testMatch: [
    '**/tests/unit/**/*.test.{ts,tsx,js,jsx}',
    '**/__tests__/**/*.{ts,tsx,js,jsx}',
    '**/*.(test|spec).{ts,tsx,js,jsx}'
  ],
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
  },
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**',
    '!src/**/*.test.{ts,tsx}',
    '!src/**/*.spec.{ts,tsx}',
    '!src/test-*.ts',
    '!src/**/index.ts',
    '!src/types/**',
    '!src/**/*.stories.{ts,tsx}',
    '!src/client/**', // Exclude client-side code from server tests
  ],
  coverageDirectory: '<rootDir>/coverage',
  coverageReporters: [
    'text',
    'lcov',
    'html',
    'json-summary'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  setupFilesAfterEnv: ['<rootDir>/setup.ts'],
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/../../src/$1',
    '^@core/(.*)$': '<rootDir>/../../src/core/$1',
    '^@server/(.*)$': '<rootDir>/../../src/server/$1',
    '^@visual/(.*)$': '<rootDir>/../../src/visual/$1',
    '^@chat/(.*)$': '<rootDir>/../../src/chat/$1'
  },
  testTimeout: 10000,
  verbose: true,
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true
};