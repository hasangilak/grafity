module.exports = {
  // Test environment
  testEnvironment: 'node',

  // Test file patterns
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/__tests__/**/*.test.js'
  ],

  // File extensions to consider
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],

  // Transform TypeScript files
  transform: {
    '^.+\\.tsx?$': 'ts-jest'
  },

  // Module path mapping
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/../../$1',
    '^@chat/(.*)$': '<rootDir>/../$1'
  },

  // Setup files
  setupFilesAfterEnv: ['<rootDir>/setup.ts'],

  // Coverage configuration
  collectCoverage: true,
  collectCoverageFrom: [
    '../**/*.{ts,tsx}',
    '!../**/*.d.ts',
    '!../**/__tests__/**',
    '!../**/node_modules/**',
    '!../ui/**/*.tsx' // Exclude React components from backend coverage
  ],

  // Coverage thresholds
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    },
    './models/': {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90
    },
    './parsers/': {
      branches: 85,
      functions: 85,
      lines: 85,
      statements: 85
    },
    './ai/': {
      branches: 75,
      functions: 75,
      lines: 75,
      statements: 75
    }
  },

  // Coverage reporters
  coverageReporters: [
    'text',
    'text-summary',
    'html',
    'lcov',
    'json'
  ],

  // Coverage directory
  coverageDirectory: '<rootDir>/coverage',

  // Test timeout
  testTimeout: 30000,

  // Verbose output
  verbose: true,

  // Error handling
  errorOnDeprecated: true,

  // Clear mocks between tests
  clearMocks: true,

  // Restore mocks after each test
  restoreMocks: true,

  // Global setup and teardown
  globalSetup: '<rootDir>/globalSetup.js',
  globalTeardown: '<rootDir>/globalTeardown.js',

  // Test reporter
  reporters: [
    'default',
    [
      'jest-html-reporter',
      {
        pageTitle: 'Chat System Test Report',
        outputPath: '<rootDir>/coverage/test-report.html',
        includeFailureMsg: true,
        includeSuiteFailure: true
      }
    ]
  ],

  // Module directories
  moduleDirectories: ['node_modules', '<rootDir>'],

  // Test environment options
  testEnvironmentOptions: {
    node: {
      experimental: {
        wasm: true
      }
    }
  },

  // Watch mode configuration
  watchPlugins: [
    'jest-watch-typeahead/filename',
    'jest-watch-typeahead/testname'
  ],

  // Snapshot configuration
  snapshotFormat: {
    escapeString: true,
    printBasicPrototype: true
  },

  // Performance monitoring
  detectOpenHandles: true,
  detectLeaks: true,

  // Test categorization
  projects: [
    {
      displayName: 'Unit Tests',
      testMatch: [
        '<rootDir>/models/**/*.test.ts',
        '<rootDir>/parsers/**/*.test.ts',
        '<rootDir>/context/**/*.test.ts',
        '<rootDir>/ai/**/*.test.ts',
        '<rootDir>/handlers/**/*.test.ts',
        '<rootDir>/persistence/**/*.test.ts',
        '<rootDir>/search/**/*.test.ts',
        '<rootDir>/analytics/**/*.test.ts',
        '<rootDir>/merge/**/*.test.ts',
        '<rootDir>/realtime/**/*.test.ts'
      ]
    },
    {
      displayName: 'Integration Tests',
      testMatch: ['<rootDir>/integration/**/*.test.ts'],
      testTimeout: 60000 // Longer timeout for integration tests
    }
  ]
};