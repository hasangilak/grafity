# Grafity Testing Guide

This comprehensive guide covers all testing strategies, frameworks, and best practices used in Grafity.

## Table of Contents

- [Testing Strategy](#testing-strategy)
- [Unit Testing](#unit-testing)
- [Integration Testing](#integration-testing)
- [End-to-End Testing](#end-to-end-testing)
- [Performance Testing](#performance-testing)
- [Security Testing](#security-testing)
- [CI/CD Integration](#ci-cd-integration)
- [Test Data Management](#test-data-management)

## Testing Strategy

Grafity implements a multi-layered testing approach following the test pyramid:

```
                    /\
                   /  \
                  /E2E \
                 /Tests \
                /________\
               /          \
              /Integration \
             /    Tests     \
            /______________\
           /                \
          /   Unit Tests     \
         /                    \
        /____________________\
```

### Test Coverage Goals

- **Unit Tests**: 90%+ coverage for core business logic
- **Integration Tests**: 80%+ coverage for API endpoints
- **E2E Tests**: Critical user workflows and happy paths
- **Performance Tests**: Load, stress, and spike testing

## Unit Testing

### Framework: Jest

**Configuration:** `tests/unit/jest.config.js`

### Key Testing Areas

1. **Core Modules** (`src/core/`)
   - AST Parser
   - Graph Engine
   - Pattern Detector
   - Analysis Engine

2. **Services** (`src/services/`)
   - Project Service
   - Analysis Service
   - Pattern Service
   - User Service

3. **Utilities** (`src/utils/`)
   - Helper functions
   - Validation logic
   - Data transformations

### Running Unit Tests

```bash
# Run all unit tests
npm run test:unit

# Run with coverage
npm run test:coverage

# Run specific test file
npm run test:unit -- --testNamePattern="ASTParser"

# Watch mode for development
npm run test:watch
```

### Writing Unit Tests

**Example: Testing AST Parser**

```javascript
// tests/unit/core/ast-parser.test.ts
import { ASTParser } from '../../../src/core/ast-parser';

describe('ASTParser', () => {
  let parser: ASTParser;

  beforeEach(() => {
    parser = new ASTParser();
  });

  describe('parseReactComponent', () => {
    it('should parse functional component with hooks', async () => {
      const code = `
        import React, { useState } from 'react';

        export function Counter() {
          const [count, setCount] = useState(0);
          return <div>{count}</div>;
        }
      `;

      const result = await parser.parseCode(code, 'tsx');

      expect(result.components).toHaveLength(1);
      expect(result.components[0].name).toBe('Counter');
      expect(result.components[0].hooks).toContain('useState');
    });
  });
});
```

### Mocking Strategies

**Database Mocking:**
```javascript
// Mock Neo4j adapter
jest.mock('../../../src/adapters/neo4j-adapter', () => ({
  Neo4jAdapter: jest.fn().mockImplementation(() => ({
    createNode: jest.fn().mockResolvedValue('node-id'),
    createRelationship: jest.fn().mockResolvedValue('rel-id'),
    query: jest.fn().mockResolvedValue([])
  }))
}));
```

**Service Mocking:**
```javascript
// Mock external services
jest.mock('../../../src/services/external-api', () => ({
  fetchExternalData: jest.fn().mockResolvedValue({ data: 'mocked' })
}));
```

### Custom Matchers

```javascript
// tests/unit/setup.ts
expect.extend({
  toBeValidUUID(received: string) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return {
      pass: uuidRegex.test(received),
      message: () => `Expected ${received} to be a valid UUID`
    };
  }
});
```

## Integration Testing

### Framework: Jest with Test Containers

**Configuration:** `tests/integration/jest.config.js`

### Test Database Setup

Integration tests use containerized databases for isolation:

```javascript
// tests/integration/setup.ts
import { Neo4jContainer } from '@testcontainers/neo4j';
import { RedisContainer } from '@testcontainers/redis';

let neo4jContainer: Neo4jContainer;
let redisContainer: RedisContainer;

beforeAll(async () => {
  neo4jContainer = await new Neo4jContainer('neo4j:5-community')
    .withApocPlugin()
    .start();

  redisContainer = await new RedisContainer('redis:7-alpine')
    .start();
});
```

### API Endpoint Testing

```javascript
// tests/integration/api/projects.test.ts
import request from 'supertest';
import { app } from '../../../src/app';

describe('Projects API', () => {
  let authToken: string;

  beforeEach(async () => {
    // Setup test user and get auth token
    authToken = await getTestAuthToken();
  });

  it('should create a new project', async () => {
    const projectData = {
      name: 'Test Project',
      path: '/test/path',
      type: 'react'
    };

    const response = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${authToken}`)
      .send(projectData)
      .expect(201);

    expect(response.body).toHaveProperty('id');
    expect(response.body.name).toBe(projectData.name);
  });
});
```

### GraphQL Testing

```javascript
// tests/integration/graphql/queries.test.ts
import { createTestClient } from 'apollo-server-testing';
import { server } from '../../../src/graphql/server';

const { query } = createTestClient(server);

describe('GraphQL Queries', () => {
  it('should fetch project by ID', async () => {
    const GET_PROJECT = gql`
      query GetProject($id: ID!) {
        project(id: $id) {
          id
          name
          components {
            name
            type
          }
        }
      }
    `;

    const result = await query({
      query: GET_PROJECT,
      variables: { id: 'test-project-id' }
    });

    expect(result.errors).toBeUndefined();
    expect(result.data.project).toBeDefined();
  });
});
```

### Running Integration Tests

```bash
# Run all integration tests
npm run test:integration

# Run specific test suite
npm run test:integration -- --testNamePattern="Projects API"

# Run with verbose output
npm run test:integration -- --verbose
```

## End-to-End Testing

### Framework: Playwright

**Configuration:** `tests/e2e/playwright.config.ts`

### Test Scenarios

1. **User Workflows**
   - Project creation and management
   - Code analysis execution
   - Graph visualization interaction

2. **Authentication Flows**
   - User registration and login
   - Session management
   - Permission verification

3. **Data Operations**
   - File upload and processing
   - Export functionality
   - Real-time updates

### Test Structure

```javascript
// tests/e2e/workflows/project-analysis.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Project Analysis Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard');
  });

  test('should create project and run analysis', async ({ page }) => {
    // Create new project
    await page.click('[data-testid="create-project-button"]');
    await page.fill('[data-testid="project-name"]', 'E2E Test Project');
    await page.selectOption('[data-testid="project-type"]', 'react');
    await page.click('[data-testid="submit-button"]');

    // Verify project creation
    await expect(page.locator('[data-testid="success-message"]')).toBeVisible();

    // Navigate to analysis
    await page.click('[data-testid="analyze-button"]');
    await page.click('[data-testid="start-analysis"]');

    // Wait for analysis completion
    await expect(page.locator('[data-testid="analysis-complete"]')).toBeVisible();
  });
});
```

### Cross-Browser Testing

```javascript
// playwright.config.ts
export default defineConfig({
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'mobile-chrome', use: { ...devices['Pixel 5'] } },
  ]
});
```

### Running E2E Tests

```bash
# Run all E2E tests
npm run test:e2e

# Run specific browser
npm run test:e2e -- --project=chromium

# Run in headed mode (see browser)
npm run test:e2e -- --headed

# Generate HTML report
npm run test:e2e -- --reporter=html
```

## Performance Testing

### Framework: K6

**Configuration:** `tests/performance/k6/`

### Test Types

1. **Load Testing** (`load-test.js`)
   - Gradual user ramp-up
   - Normal expected load
   - Performance baseline

2. **Stress Testing** (`stress-test.js`)
   - Peak load simulation
   - System breaking point
   - Resource limits

3. **Spike Testing** (`spike-test.js`)
   - Sudden traffic spikes
   - Auto-scaling behavior
   - Recovery testing

### Load Test Configuration

```javascript
// tests/performance/k6/load-test.js
export const options = {
  stages: [
    { duration: '2m', target: 10 },   // Ramp up
    { duration: '5m', target: 10 },   // Stay at 10 users
    { duration: '2m', target: 25 },   // Ramp up
    { duration: '5m', target: 25 },   // Stay at 25 users
    { duration: '2m', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'], // 95% of requests under 2s
    http_req_failed: ['rate<0.05'],     // Error rate under 5%
  }
};
```

### Custom Metrics

```javascript
import { Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('errors');
const analysisTime = new Trend('analysis_duration');

export default function() {
  const analysisStart = Date.now();
  const response = http.post('/api/analysis', analysisPayload);
  const analysisEnd = Date.now();

  analysisTime.add(analysisEnd - analysisStart);
  errorRate.add(response.status !== 200);
}
```

### Running Performance Tests

```bash
# Run load test
k6 run tests/performance/k6/load-test.js

# Run with environment variables
BASE_URL=https://staging.grafity.com k6 run tests/performance/k6/load-test.js

# Generate detailed report
k6 run --out json=results.json tests/performance/k6/load-test.js
```

## Security Testing

### Automated Security Scanning

1. **SAST (Static Analysis)**
   - CodeQL for JavaScript/TypeScript
   - ESLint security rules
   - Semgrep security patterns

2. **Dependency Scanning**
   - npm audit for vulnerable packages
   - Snyk integration
   - FOSSA license compliance

3. **Container Scanning**
   - Trivy for container vulnerabilities
   - Docker security best practices
   - Base image security

### Security Test Cases

```javascript
// tests/security/auth.test.ts
describe('Authentication Security', () => {
  it('should prevent SQL injection in login', async () => {
    const maliciousInput = "admin'; DROP TABLE users; --";

    const response = await request(app)
      .post('/api/auth/login')
      .send({ username: maliciousInput, password: 'password' });

    expect(response.status).toBe(400);
    // Verify database integrity
  });

  it('should rate limit login attempts', async () => {
    const attempts = Array(10).fill().map(() =>
      request(app)
        .post('/api/auth/login')
        .send({ username: 'user', password: 'wrong' })
    );

    await Promise.all(attempts);

    const response = await request(app)
      .post('/api/auth/login')
      .send({ username: 'user', password: 'correct' });

    expect(response.status).toBe(429); // Too Many Requests
  });
});
```

## CI/CD Integration

### GitHub Actions Integration

**Test Workflow:**
```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Run unit tests
        run: npm run test:unit

      - name: Run integration tests
        run: npm run test:integration

      - name: Upload coverage
        uses: codecov/codecov-action@v3
```

### Test Reporting

**Coverage Reports:**
- Codecov integration for coverage tracking
- HTML reports generated locally
- Coverage gates in CI/CD pipeline

**Test Results:**
- JUnit XML format for CI integration
- HTML reports for detailed analysis
- Performance metrics tracking

## Test Data Management

### Test Data Strategy

1. **Fixtures**: Static test data files
2. **Factories**: Dynamic test data generation
3. **Seeding**: Database initialization for tests
4. **Cleanup**: Automated test data cleanup

### Example Test Data Factory

```javascript
// tests/fixtures/project-factory.ts
export class ProjectFactory {
  static createProject(overrides = {}) {
    return {
      name: `Test Project ${Date.now()}`,
      path: `/test/project/${Math.random()}`,
      type: 'react',
      components: [
        ComponentFactory.createComponent(),
        ComponentFactory.createComponent()
      ],
      ...overrides
    };
  }
}
```

### Database Seeding

```javascript
// tests/helpers/seed-data.ts
export async function seedTestData() {
  const projects = [
    ProjectFactory.createProject({ name: 'Sample React App' }),
    ProjectFactory.createProject({ name: 'Vue.js Project', type: 'vue' })
  ];

  for (const project of projects) {
    await projectService.create(project);
  }
}
```

## Best Practices

### Test Organization

1. **Descriptive Test Names**: Use clear, behavior-focused descriptions
2. **AAA Pattern**: Arrange, Act, Assert structure
3. **Test Independence**: Each test should be isolated and independent
4. **Data Cleanup**: Always clean up test data after tests

### Performance Considerations

1. **Parallel Execution**: Run tests in parallel where possible
2. **Test Databases**: Use separate test databases for isolation
3. **Selective Testing**: Use test patterns to run subset of tests
4. **Resource Management**: Clean up resources after tests

### Debugging Tests

```bash
# Debug specific test
npm run test:unit -- --testNamePattern="ASTParser" --verbose

# Debug with Node.js debugger
node --inspect-brk node_modules/.bin/jest --runInBand

# Debug E2E tests
npm run test:e2e -- --debug --headed
```

## Continuous Improvement

### Metrics to Track

1. **Test Coverage**: Maintain high coverage percentages
2. **Test Execution Time**: Optimize slow-running tests
3. **Flaky Tests**: Identify and fix unreliable tests
4. **Test Effectiveness**: Measure bug detection rate

### Regular Reviews

1. **Weekly**: Review test failures and coverage reports
2. **Monthly**: Analyze test performance and optimization opportunities
3. **Quarterly**: Review testing strategy and tools effectiveness

For additional testing resources, see:
- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Playwright Documentation](https://playwright.dev/docs/intro)
- [K6 Documentation](https://k6.io/docs/)
- [Testing Best Practices](../best-practices/testing.md)