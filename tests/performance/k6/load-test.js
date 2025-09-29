import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const analysisTime = new Trend('analysis_duration');
const graphRenderTime = new Trend('graph_render_duration');

// Test configuration
export const options = {
  stages: [
    { duration: '1m', target: 10 },   // Ramp up to 10 users over 1 minute
    { duration: '3m', target: 10 },   // Stay at 10 users for 3 minutes
    { duration: '1m', target: 25 },   // Ramp up to 25 users over 1 minute
    { duration: '5m', target: 25 },   // Stay at 25 users for 5 minutes
    { duration: '1m', target: 50 },   // Ramp up to 50 users over 1 minute
    { duration: '3m', target: 50 },   // Stay at 50 users for 3 minutes
    { duration: '2m', target: 0 },    // Ramp down to 0 users over 2 minutes
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'], // 95% of requests must complete within 2s
    http_req_failed: ['rate<0.05'],     // Error rate must be less than 5%
    errors: ['rate<0.1'],               // Custom error rate less than 10%
    analysis_duration: ['p(95)<5000'],  // 95% of analyses complete within 5s
    graph_render_duration: ['p(95)<3000'], // 95% of graph renders within 3s
  },
};

// Base URL - can be overridden via environment variable
const BASE_URL = __ENV.BASE_URL || 'http://localhost:4000';

// Test data
const TEST_USER = {
  username: 'perf-test-user',
  password: 'perf-test-password',
  email: 'perf-test@example.com'
};

const SAMPLE_CODE = `
import React, { useState, useEffect } from 'react';

export function UserProfile({ userId }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        setLoading(true);
        const response = await fetch(\`/api/users/\${userId}\`);
        if (!response.ok) throw new Error('Failed to fetch user');
        const userData = await response.json();
        setUser(userData);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (userId) {
      fetchUser();
    }
  }, [userId]);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!user) return <div>User not found</div>;

  return (
    <div className="user-profile">
      <img src={user.avatar} alt={user.name} />
      <h1>{user.name}</h1>
      <p>{user.email}</p>
      <p>{user.bio}</p>
    </div>
  );
}
`;

let authToken = '';

export function setup() {
  // Authenticate and get token
  const loginResponse = http.post(`${BASE_URL}/api/auth/login`, {
    username: TEST_USER.username,
    password: TEST_USER.password,
  });

  if (loginResponse.status === 200) {
    const loginData = JSON.parse(loginResponse.body);
    authToken = loginData.token;
    console.log('Authentication successful');
  } else {
    console.error('Authentication failed:', loginResponse.status);
  }

  return { authToken };
}

export default function(data) {
  const { authToken } = data;
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${authToken}`,
  };

  // Test 1: Health Check
  testHealthCheck();

  // Test 2: Authentication endpoints
  testAuthentication();

  // Test 3: Project CRUD operations
  testProjectOperations(headers);

  // Test 4: Code analysis performance
  testCodeAnalysis(headers);

  // Test 5: Graph generation and retrieval
  testGraphOperations(headers);

  // Test 6: Search functionality
  testSearchOperations(headers);

  // Test 7: Pattern detection
  testPatternDetection(headers);

  sleep(1); // Think time between iterations
}

function testHealthCheck() {
  const response = http.get(`${BASE_URL}/health`);

  check(response, {
    'health check status is 200': (r) => r.status === 200,
    'health check response time < 100ms': (r) => r.timings.duration < 100,
    'health check has status field': (r) => JSON.parse(r.body).status === 'healthy',
  });

  errorRate.add(response.status !== 200);
}

function testAuthentication() {
  // Test login endpoint performance
  const loginResponse = http.post(`${BASE_URL}/api/auth/login`, {
    username: TEST_USER.username,
    password: TEST_USER.password,
  });

  check(loginResponse, {
    'login status is 200': (r) => r.status === 200,
    'login response time < 500ms': (r) => r.timings.duration < 500,
    'login returns token': (r) => JSON.parse(r.body).token !== undefined,
  });

  errorRate.add(loginResponse.status !== 200);
}

function testProjectOperations(headers) {
  // Create project
  const createProjectPayload = {
    name: `Perf Test Project ${Date.now()}`,
    description: 'Performance testing project',
    path: `/test/perf/${Date.now()}`,
    type: 'react'
  };

  const createResponse = http.post(
    `${BASE_URL}/api/projects`,
    JSON.stringify(createProjectPayload),
    { headers }
  );

  let projectId = '';
  const createSuccess = check(createResponse, {
    'create project status is 201': (r) => r.status === 201,
    'create project response time < 1s': (r) => r.timings.duration < 1000,
    'create project returns ID': (r) => {
      if (r.status === 201) {
        projectId = JSON.parse(r.body).id;
        return projectId !== undefined;
      }
      return false;
    },
  });

  errorRate.add(!createSuccess);

  if (projectId) {
    // Get project
    const getResponse = http.get(`${BASE_URL}/api/projects/${projectId}`, { headers });

    check(getResponse, {
      'get project status is 200': (r) => r.status === 200,
      'get project response time < 300ms': (r) => r.timings.duration < 300,
      'get project returns correct ID': (r) => JSON.parse(r.body).id === projectId,
    });

    // List projects
    const listResponse = http.get(`${BASE_URL}/api/projects?page=1&limit=10`, { headers });

    check(listResponse, {
      'list projects status is 200': (r) => r.status === 200,
      'list projects response time < 500ms': (r) => r.timings.duration < 500,
      'list projects returns array': (r) => Array.isArray(JSON.parse(r.body).projects),
    });

    // Update project
    const updatePayload = {
      name: `Updated ${createProjectPayload.name}`,
      description: 'Updated description'
    };

    const updateResponse = http.put(
      `${BASE_URL}/api/projects/${projectId}`,
      JSON.stringify(updatePayload),
      { headers }
    );

    check(updateResponse, {
      'update project status is 200': (r) => r.status === 200,
      'update project response time < 500ms': (r) => r.timings.duration < 500,
    });

    // Clean up - delete project
    const deleteResponse = http.del(`${BASE_URL}/api/projects/${projectId}`, { headers });
    check(deleteResponse, {
      'delete project status is 200': (r) => r.status === 200,
    });
  }
}

function testCodeAnalysis(headers) {
  const analysisPayload = {
    code: SAMPLE_CODE,
    language: 'tsx',
    options: {
      includePatterns: true,
      includeMetrics: true,
      includeDependencies: true
    }
  };

  const startTime = Date.now();
  const analysisResponse = http.post(
    `${BASE_URL}/api/analysis/code`,
    JSON.stringify(analysisPayload),
    { headers }
  );
  const endTime = Date.now();

  const analysisSuccess = check(analysisResponse, {
    'code analysis status is 200': (r) => r.status === 200,
    'code analysis response time < 3s': (r) => r.timings.duration < 3000,
    'code analysis returns components': (r) => {
      const body = JSON.parse(r.body);
      return body.components && Array.isArray(body.components);
    },
    'code analysis returns patterns': (r) => {
      const body = JSON.parse(r.body);
      return body.patterns && Array.isArray(body.patterns);
    },
    'code analysis returns metrics': (r) => {
      const body = JSON.parse(r.body);
      return body.metrics !== undefined;
    }
  });

  analysisTime.add(endTime - startTime);
  errorRate.add(!analysisSuccess);

  // Test batch analysis
  const batchPayload = {
    files: [
      { name: 'Component1.tsx', code: SAMPLE_CODE, language: 'tsx' },
      { name: 'Component2.tsx', code: SAMPLE_CODE.replace('UserProfile', 'UserSettings'), language: 'tsx' }
    ],
    options: {
      includePatterns: true,
      includeMetrics: true
    }
  };

  const batchResponse = http.post(
    `${BASE_URL}/api/analysis/batch`,
    JSON.stringify(batchPayload),
    { headers }
  );

  check(batchResponse, {
    'batch analysis status is 200': (r) => r.status === 200,
    'batch analysis response time < 5s': (r) => r.timings.duration < 5000,
    'batch analysis returns results for all files': (r) => {
      const body = JSON.parse(r.body);
      return body.results && body.results.length === 2;
    }
  });
}

function testGraphOperations(headers) {
  // First create a project for graph testing
  const projectPayload = {
    name: `Graph Test Project ${Date.now()}`,
    path: `/test/graph/${Date.now()}`,
    type: 'react'
  };

  const projectResponse = http.post(
    `${BASE_URL}/api/projects`,
    JSON.stringify(projectPayload),
    { headers }
  );

  if (projectResponse.status === 201) {
    const projectId = JSON.parse(projectResponse.body).id;

    // Test graph generation
    const startTime = Date.now();
    const graphResponse = http.get(`${BASE_URL}/api/projects/${projectId}/graph`, { headers });
    const endTime = Date.now();

    const graphSuccess = check(graphResponse, {
      'graph generation status is 200': (r) => r.status === 200,
      'graph generation response time < 2s': (r) => r.timings.duration < 2000,
      'graph contains nodes': (r) => {
        const body = JSON.parse(r.body);
        return body.nodes && Array.isArray(body.nodes);
      },
      'graph contains edges': (r) => {
        const body = JSON.parse(r.body);
        return body.edges && Array.isArray(body.edges);
      }
    });

    graphRenderTime.add(endTime - startTime);
    errorRate.add(!graphSuccess);

    // Test graph with different formats
    const formats = ['json', 'cytoscape', 'd3'];
    formats.forEach(format => {
      const formatResponse = http.get(
        `${BASE_URL}/api/projects/${projectId}/graph?format=${format}`,
        { headers }
      );

      check(formatResponse, {
        [`graph format ${format} status is 200`]: (r) => r.status === 200,
        [`graph format ${format} response time < 1s`]: (r) => r.timings.duration < 1000,
      });
    });

    // Test component tree
    const treeResponse = http.get(`${BASE_URL}/api/projects/${projectId}/components/tree`, { headers });
    check(treeResponse, {
      'component tree status is 200': (r) => r.status === 200,
      'component tree response time < 1s': (r) => r.timings.duration < 1000,
    });

    // Clean up
    http.del(`${BASE_URL}/api/projects/${projectId}`, { headers });
  }
}

function testSearchOperations(headers) {
  const searchQueries = ['component', 'hook', 'function', 'interface', 'type'];

  searchQueries.forEach(query => {
    const searchResponse = http.get(
      `${BASE_URL}/api/search?q=${encodeURIComponent(query)}&limit=20`,
      { headers }
    );

    check(searchResponse, {
      [`search for "${query}" status is 200`]: (r) => r.status === 200,
      [`search for "${query}" response time < 1s`]: (r) => r.timings.duration < 1000,
      [`search for "${query}" returns results`]: (r) => {
        const body = JSON.parse(r.body);
        return body.results && Array.isArray(body.results);
      }
    });

    errorRate.add(searchResponse.status !== 200);
  });

  // Test advanced search with filters
  const advancedSearchResponse = http.get(
    `${BASE_URL}/api/search?q=component&type=components&limit=10`,
    { headers }
  );

  check(advancedSearchResponse, {
    'advanced search status is 200': (r) => r.status === 200,
    'advanced search response time < 1s': (r) => r.timings.duration < 1000,
    'advanced search returns facets': (r) => {
      const body = JSON.parse(r.body);
      return body.facets !== undefined;
    }
  });
}

function testPatternDetection(headers) {
  const patternPayload = {
    code: SAMPLE_CODE,
    language: 'tsx',
    projectId: null // Optional
  };

  const patternResponse = http.post(
    `${BASE_URL}/api/patterns/detect`,
    JSON.stringify(patternPayload),
    { headers }
  );

  const patternSuccess = check(patternResponse, {
    'pattern detection status is 200': (r) => r.status === 200,
    'pattern detection response time < 2s': (r) => r.timings.duration < 2000,
    'pattern detection returns patterns': (r) => {
      const body = JSON.parse(r.body);
      return body.patterns && Array.isArray(body.patterns);
    }
  });

  errorRate.add(!patternSuccess);

  // Test pattern listing
  const listPatternsResponse = http.get(`${BASE_URL}/api/patterns?limit=50`, { headers });
  check(listPatternsResponse, {
    'list patterns status is 200': (r) => r.status === 200,
    'list patterns response time < 500ms': (r) => r.timings.duration < 500,
  });

  // Test pattern filtering
  const filterResponse = http.get(
    `${BASE_URL}/api/patterns?type=good_pattern&limit=20`,
    { headers }
  );
  check(filterResponse, {
    'filter patterns status is 200': (r) => r.status === 200,
    'filter patterns response time < 500ms': (r) => r.timings.duration < 500,
  });
}

export function teardown(data) {
  console.log('Performance test completed');
  console.log(`Total errors: ${errorRate.values.length}`);
}