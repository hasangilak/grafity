module.exports = {
  displayName: 'Integration Tests',
  testEnvironment: 'node',
  roots: ['<rootDir>'],
  testMatch: [
    '**/tests/integration/**/*.test.{ts,tsx,js,jsx}',
    '**/integration/**/*.test.{ts,tsx,js,jsx}'
  ],
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
  },
  setupFilesAfterEnv: ['<rootDir>/setup.ts'],
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/../../src/$1',
    '^@core/(.*)$': '<rootDir>/../../src/core/$1',
    '^@server/(.*)$': '<rootDir>/../../src/server/$1',
    '^@visual/(.*)$': '<rootDir>/../../src/visual/$1',
    '^@chat/(.*)$': '<rootDir>/../../src/chat/$1'
  },
  testTimeout: 30000,
  verbose: true,
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
  collectCoverageFrom: [
    'src/server/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**',
    '!src/**/*.test.{ts,tsx}',
    '!src/**/*.spec.{ts,tsx}'
  ],
  coverageDirectory: '<rootDir>/coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  // Run tests serially to avoid database conflicts
  maxWorkers: 1,
  // Longer timeout for integration tests
  slowTestThreshold: 10
};