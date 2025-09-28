/**
 * Jest configuration for visual components testing
 */

module.exports = {
  displayName: 'Visual Components Tests',
  testMatch: ['**/__tests__/**/*.test.{ts,tsx}'],
  testEnvironment: 'jsdom',

  // Setup files
  setupFilesAfterEnv: ['<rootDir>/src/visual/__tests__/setupTests.ts'],

  // Module name mapping for TypeScript paths
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@visual/(.*)$': '<rootDir>/src/visual/$1',
    '^@core/(.*)$': '<rootDir>/src/core/$1'
  },

  // Transform configuration
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
    '^.+\\.jsx?$': 'babel-jest'
  },

  // File extensions to consider
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],

  // Coverage configuration
  collectCoverageFrom: [
    'src/visual/**/*.{ts,tsx}',
    '!src/visual/**/*.d.ts',
    '!src/visual/**/__tests__/**',
    '!src/visual/**/*.test.{ts,tsx}',
    '!src/visual/**/*.stories.{ts,tsx}'
  ],

  coverageReporters: ['text', 'lcov', 'html'],
  coverageDirectory: 'coverage/visual',

  // Coverage thresholds
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    },
    './src/visual/components/': {
      branches: 85,
      functions: 85,
      lines: 85,
      statements: 85
    },
    './src/visual/renderers/': {
      branches: 75,
      functions: 75,
      lines: 75,
      statements: 75
    }
  },

  // Test timeout
  testTimeout: 10000,

  // Ignore patterns
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/build/'
  ],

  // Mock configuration
  clearMocks: true,
  restoreMocks: true,

  // Performance testing configuration
  globals: {
    'ts-jest': {
      tsconfig: {
        jsx: 'react-jsx'
      }
    }
  },

  // Custom test environment options
  testEnvironmentOptions: {
    url: 'http://localhost:3000'
  },

  // Verbose output for debugging
  verbose: true,

  // Error handling
  errorOnDeprecated: true,

  // Custom reporters
  reporters: [
    'default',
    [
      'jest-html-reporters',
      {
        publicPath: './coverage/visual/html-report',
        filename: 'visual-test-report.html',
        expand: true,
        hideIcon: false,
        pageTitle: 'Grafity Visual Components Test Report'
      }
    ]
  ]
};