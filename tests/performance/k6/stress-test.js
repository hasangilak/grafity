import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const requestCount = new Counter('requests');
const analysisFailures = new Counter('analysis_failures');
const graphFailures = new Counter('graph_failures');
const memoryUsage = new Trend('memory_usage_mb');

// Stress test configuration - push the system to its limits
export const options = {
  stages: [
    { duration: '2m', target: 50 },    // Ramp up to 50 users
    { duration: '3m', target: 100 },   // Ramp up to 100 users
    { duration: '5m', target: 200 },   // Ramp up to 200 users
    { duration: '5m', target: 300 },   // Ramp up to 300 users (stress level)
    { duration: '10m', target: 300 },  // Maintain stress for 10 minutes
    { duration: '3m', target: 200 },   // Scale back to 200
    { duration: '3m', target: 100 },   // Scale back to 100
    { duration: '2m', target: 0 },     // Ramp down to 0
  ],
  thresholds: {
    http_req_duration: ['p(95)<5000'], // Allow higher latency under stress
    http_req_failed: ['rate<0.15'],     // Allow higher error rate under stress
    errors: ['rate<0.2'],               // Custom error rate threshold
    requests: ['count>10000'],          // Minimum request count
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:4000';

// Heavy test data for stress testing
const COMPLEX_CODE = `
import React, { useState, useEffect, useContext, useReducer, useMemo, useCallback, useRef } from 'react';
import { createContext } from 'react';

// Complex state management
const AppStateContext = createContext();

const initialState = {
  users: [],
  posts: [],
  comments: [],
  filters: {
    dateRange: null,
    categories: [],
    tags: [],
    searchTerm: ''
  },
  ui: {
    loading: false,
    errors: [],
    notifications: [],
    modals: {
      userProfile: false,
      createPost: false,
      confirmDelete: false
    },
    sidebar: {
      collapsed: false,
      activeTab: 'dashboard'
    }
  },
  cache: new Map(),
  subscriptions: new Set()
};

function appReducer(state, action) {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, ui: { ...state.ui, loading: action.payload } };
    case 'SET_USERS':
      return { ...state, users: action.payload };
    case 'ADD_USER':
      return { ...state, users: [...state.users, action.payload] };
    case 'UPDATE_USER':
      return {
        ...state,
        users: state.users.map(user =>
          user.id === action.payload.id ? { ...user, ...action.payload } : user
        )
      };
    case 'DELETE_USER':
      return { ...state, users: state.users.filter(user => user.id !== action.payload) };
    case 'SET_POSTS':
      return { ...state, posts: action.payload };
    case 'ADD_POST':
      return { ...state, posts: [action.payload, ...state.posts] };
    case 'UPDATE_POST':
      return {
        ...state,
        posts: state.posts.map(post =>
          post.id === action.payload.id ? { ...post, ...action.payload } : post
        )
      };
    case 'DELETE_POST':
      return { ...state, posts: state.posts.filter(post => post.id !== action.payload) };
    case 'SET_COMMENTS':
      return { ...state, comments: action.payload };
    case 'ADD_COMMENT':
      return { ...state, comments: [...state.comments, action.payload] };
    case 'UPDATE_FILTERS':
      return { ...state, filters: { ...state.filters, ...action.payload } };
    case 'TOGGLE_MODAL':
      return {
        ...state,
        ui: {
          ...state.ui,
          modals: { ...state.ui.modals, [action.payload]: !state.ui.modals[action.payload] }
        }
      };
    case 'ADD_ERROR':
      return { ...state, ui: { ...state.ui, errors: [...state.ui.errors, action.payload] } };
    case 'CLEAR_ERRORS':
      return { ...state, ui: { ...state.ui, errors: [] } };
    case 'ADD_NOTIFICATION':
      return { ...state, ui: { ...state.ui, notifications: [...state.ui.notifications, action.payload] } };
    case 'REMOVE_NOTIFICATION':
      return {
        ...state,
        ui: {
          ...state.ui,
          notifications: state.ui.notifications.filter(n => n.id !== action.payload)
        }
      };
    default:
      return state;
  }
}

// Complex hooks
function useApi(url, dependencies = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const abortControllerRef = useRef(null);

  const fetchData = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(url, {
        signal: abortControllerRef.current.signal,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': \`Bearer \${localStorage.getItem('token')}\`
        }
      });

      if (!response.ok) {
        throw new Error(\`HTTP error! status: \${response.status}\`);
      }

      const result = await response.json();
      setData(result);
    } catch (err) {
      if (err.name !== 'AbortError') {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    fetchData();
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchData, ...dependencies]);

  return { data, loading, error, refetch: fetchData };
}

function useLocalStorage(key, initialValue) {
  const [storedValue, setStoredValue] = useState(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(\`Error reading localStorage key "\${key}":\`, error);
      return initialValue;
    }
  });

  const setValue = useCallback((value) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.error(\`Error setting localStorage key "\${key}":\`, error);
    }
  }, [key, storedValue]);

  return [storedValue, setValue];
}

// Complex component with multiple responsibilities
export function ComplexDashboard() {
  const [state, dispatch] = useReducer(appReducer, initialState);
  const [settings, setSettings] = useLocalStorage('dashboardSettings', {});
  const [theme, setTheme] = useLocalStorage('theme', 'light');

  const { data: users, loading: usersLoading } = useApi('/api/users', []);
  const { data: posts, loading: postsLoading } = useApi('/api/posts', [state.filters]);
  const { data: analytics, loading: analyticsLoading } = useApi('/api/analytics', []);

  // Complex memoized values
  const filteredPosts = useMemo(() => {
    if (!posts) return [];

    return posts.filter(post => {
      const matchesSearch = !state.filters.searchTerm ||
        post.title.toLowerCase().includes(state.filters.searchTerm.toLowerCase()) ||
        post.content.toLowerCase().includes(state.filters.searchTerm.toLowerCase());

      const matchesCategory = !state.filters.categories.length ||
        state.filters.categories.includes(post.category);

      const matchesTags = !state.filters.tags.length ||
        state.filters.tags.some(tag => post.tags.includes(tag));

      const matchesDate = !state.filters.dateRange ||
        (new Date(post.createdAt) >= state.filters.dateRange.start &&
         new Date(post.createdAt) <= state.filters.dateRange.end);

      return matchesSearch && matchesCategory && matchesTags && matchesDate;
    }).sort((a, b) => {
      switch (settings.sortBy) {
        case 'date': return new Date(b.createdAt) - new Date(a.createdAt);
        case 'title': return a.title.localeCompare(b.title);
        case 'popularity': return b.likes - a.likes;
        default: return 0;
      }
    });
  }, [posts, state.filters, settings.sortBy]);

  // Complex event handlers
  const handleUserAction = useCallback((action, userId, data = {}) => {
    switch (action) {
      case 'edit':
        dispatch({ type: 'TOGGLE_MODAL', payload: 'userProfile' });
        break;
      case 'delete':
        if (window.confirm('Are you sure you want to delete this user?')) {
          dispatch({ type: 'DELETE_USER', payload: userId });
        }
        break;
      case 'update':
        dispatch({ type: 'UPDATE_USER', payload: { id: userId, ...data } });
        break;
    }
  }, []);

  // Multiple useEffect hooks
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.ctrlKey && e.key === 'k') {
        e.preventDefault();
        dispatch({ type: 'TOGGLE_MODAL', payload: 'search' });
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      // Auto-save draft
      if (state.ui.modals.createPost) {
        localStorage.setItem('postDraft', JSON.stringify(state.postDraft));
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [state.ui.modals.createPost, state.postDraft]);

  useEffect(() => {
    // WebSocket connection for real-time updates
    const ws = new WebSocket('ws://localhost:8080');

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      switch (data.type) {
        case 'USER_UPDATED':
          dispatch({ type: 'UPDATE_USER', payload: data.user });
          break;
        case 'POST_CREATED':
          dispatch({ type: 'ADD_POST', payload: data.post });
          break;
        case 'NOTIFICATION':
          dispatch({ type: 'ADD_NOTIFICATION', payload: data.notification });
          break;
      }
    };

    return () => ws.close();
  }, []);

  // Complex render logic
  if (usersLoading || postsLoading || analyticsLoading) {
    return (
      <div className="dashboard-loading">
        <div className="spinner" />
        <p>Loading dashboard data...</p>
      </div>
    );
  }

  return (
    <AppStateContext.Provider value={{ state, dispatch }}>
      <div className={\`dashboard dashboard--\${theme}\`}>
        {/* Navigation */}
        <nav className="dashboard-nav">
          <div className="nav-brand">
            <h1>Complex Dashboard</h1>
          </div>
          <div className="nav-actions">
            <button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>
              Toggle Theme
            </button>
            <button onClick={() => dispatch({ type: 'TOGGLE_MODAL', payload: 'createPost' })}>
              Create Post
            </button>
          </div>
        </nav>

        {/* Sidebar */}
        <aside className={\`sidebar \${state.ui.sidebar.collapsed ? 'collapsed' : ''}\`}>
          <div className="sidebar-content">
            <ul className="sidebar-nav">
              <li className={state.ui.sidebar.activeTab === 'dashboard' ? 'active' : ''}>
                <a href="#dashboard">Dashboard</a>
              </li>
              <li className={state.ui.sidebar.activeTab === 'posts' ? 'active' : ''}>
                <a href="#posts">Posts</a>
              </li>
              <li className={state.ui.sidebar.activeTab === 'users' ? 'active' : ''}>
                <a href="#users">Users</a>
              </li>
              <li className={state.ui.sidebar.activeTab === 'analytics' ? 'active' : ''}>
                <a href="#analytics">Analytics</a>
              </li>
            </ul>
          </div>
        </aside>

        {/* Main content */}
        <main className="dashboard-main">
          {/* Filters */}
          <div className="filters">
            <input
              type="text"
              placeholder="Search posts..."
              value={state.filters.searchTerm}
              onChange={(e) => dispatch({
                type: 'UPDATE_FILTERS',
                payload: { searchTerm: e.target.value }
              })}
            />
            {/* More complex filter controls would go here */}
          </div>

          {/* Content grid */}
          <div className="content-grid">
            <div className="posts-section">
              <h2>Posts ({filteredPosts.length})</h2>
              <div className="posts-grid">
                {filteredPosts.map(post => (
                  <article key={post.id} className="post-card">
                    <h3>{post.title}</h3>
                    <p>{post.excerpt}</p>
                    <div className="post-meta">
                      <span>{post.author}</span>
                      <span>{new Date(post.createdAt).toLocaleDateString()}</span>
                      <span>{post.likes} likes</span>
                    </div>
                  </article>
                ))}
              </div>
            </div>

            <div className="users-section">
              <h2>Users ({users?.length || 0})</h2>
              <div className="users-grid">
                {users?.map(user => (
                  <div key={user.id} className="user-card">
                    <img src={user.avatar} alt={user.name} />
                    <h4>{user.name}</h4>
                    <p>{user.email}</p>
                    <div className="user-actions">
                      <button onClick={() => handleUserAction('edit', user.id)}>
                        Edit
                      </button>
                      <button onClick={() => handleUserAction('delete', user.id)}>
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </main>

        {/* Modals */}
        {state.ui.modals.createPost && (
          <div className="modal-overlay">
            <div className="modal">
              <h2>Create New Post</h2>
              {/* Complex form would go here */}
              <button onClick={() => dispatch({ type: 'TOGGLE_MODAL', payload: 'createPost' })}>
                Close
              </button>
            </div>
          </div>
        )}

        {/* Notifications */}
        <div className="notifications">
          {state.ui.notifications.map(notification => (
            <div key={notification.id} className={\`notification notification--\${notification.type}\`}>
              <p>{notification.message}</p>
              <button onClick={() => dispatch({ type: 'REMOVE_NOTIFICATION', payload: notification.id })}>
                ×
              </button>
            </div>
          ))}
        </div>
      </div>
    </AppStateContext.Provider>
  );
}
`;

let authToken = '';

export function setup() {
  console.log('🔥 Starting stress test setup...');

  const loginResponse = http.post(`${BASE_URL}/api/auth/login`, {
    username: 'stress-test-user',
    password: 'stress-test-password',
  });

  if (loginResponse.status === 200) {
    authToken = JSON.parse(loginResponse.body).token;
    console.log('✅ Authentication successful for stress test');
  } else {
    console.error('❌ Authentication failed for stress test');
  }

  return { authToken };
}

export default function(data) {
  const { authToken } = data;
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${authToken}`,
  };

  requestCount.add(1);

  // Randomly select stress test scenarios
  const scenarios = [
    () => stressTestCodeAnalysis(headers),
    () => stressTestGraphGeneration(headers),
    () => stressTestBatchOperations(headers),
    () => stressTestConcurrentRequests(headers),
    () => stressTestLargePayloads(headers),
    () => stressTestMemoryIntensive(headers)
  ];

  const randomScenario = scenarios[Math.floor(Math.random() * scenarios.length)];
  randomScenario();

  // Vary think time to simulate real user behavior under stress
  sleep(Math.random() * 3);
}

function stressTestCodeAnalysis(headers) {
  // Analyze complex code multiple times
  for (let i = 0; i < 3; i++) {
    const analysisPayload = {
      code: COMPLEX_CODE,
      language: 'tsx',
      options: {
        includePatterns: true,
        includeMetrics: true,
        includeDependencies: true,
        includeComplexity: true,
        depth: 'deep'
      }
    };

    const response = http.post(
      `${BASE_URL}/api/analysis/code`,
      JSON.stringify(analysisPayload),
      { headers }
    );

    const success = check(response, {
      'stress analysis status is 200': (r) => r.status === 200,
      'stress analysis completes within time limit': (r) => r.timings.duration < 10000,
    });

    if (!success) {
      analysisFailures.add(1);
    }

    errorRate.add(response.status !== 200);
  }
}

function stressTestGraphGeneration(headers) {
  // Create project with many components
  const projectPayload = {
    name: `Stress Test Project ${Date.now()}`,
    path: `/stress/test/${Date.now()}`,
    type: 'react'
  };

  const projectResponse = http.post(
    `${BASE_URL}/api/projects`,
    JSON.stringify(projectPayload),
    { headers }
  );

  if (projectResponse.status === 201) {
    const projectId = JSON.parse(projectResponse.body).id;

    // Generate graph with high complexity
    const graphResponse = http.get(
      `${BASE_URL}/api/projects/${projectId}/graph?includeEdges=true&maxDepth=10`,
      { headers }
    );

    const success = check(graphResponse, {
      'stress graph generation status is 200': (r) => r.status === 200,
      'stress graph generation completes': (r) => r.timings.duration < 15000,
    });

    if (!success) {
      graphFailures.add(1);
    }

    // Generate different graph formats simultaneously
    const formats = ['json', 'cytoscape', 'd3'];
    formats.forEach(format => {
      http.get(`${BASE_URL}/api/projects/${projectId}/graph?format=${format}`, { headers });
    });

    // Cleanup
    http.del(`${BASE_URL}/api/projects/${projectId}`, { headers });
  }
}

function stressTestBatchOperations(headers) {
  // Create multiple analyses in batch
  const batchSize = 10;
  const files = [];

  for (let i = 0; i < batchSize; i++) {
    files.push({
      name: `Component${i}.tsx`,
      code: COMPLEX_CODE.replace('ComplexDashboard', `Component${i}`),
      language: 'tsx'
    });
  }

  const batchPayload = {
    files,
    options: {
      includePatterns: true,
      includeMetrics: true,
      includeDependencies: true
    }
  };

  const response = http.post(
    `${BASE_URL}/api/analysis/batch`,
    JSON.stringify(batchPayload),
    { headers, timeout: '30s' }
  );

  check(response, {
    'batch analysis status is 200': (r) => r.status === 200,
    'batch analysis handles all files': (r) => {
      if (r.status === 200) {
        const body = JSON.parse(r.body);
        return body.results && body.results.length === batchSize;
      }
      return false;
    },
    'batch analysis completes within time': (r) => r.timings.duration < 30000,
  });

  errorRate.add(response.status !== 200);
}

function stressTestConcurrentRequests(headers) {
  // Simulate concurrent requests from a single user
  const promises = [];

  // Health checks
  for (let i = 0; i < 5; i++) {
    promises.push(http.asyncRequest('GET', `${BASE_URL}/health`));
  }

  // Project listings
  for (let i = 0; i < 3; i++) {
    promises.push(http.asyncRequest('GET', `${BASE_URL}/api/projects?page=${i+1}&limit=10`, null, { headers }));
  }

  // Pattern detections
  for (let i = 0; i < 2; i++) {
    promises.push(http.asyncRequest('POST', `${BASE_URL}/api/patterns/detect`, JSON.stringify({
      code: COMPLEX_CODE,
      language: 'tsx'
    }), { headers }));
  }

  // Wait for all requests to complete
  const responses = Promise.all(promises);

  check(responses, {
    'concurrent requests all complete': (r) => r.length === 10,
  });
}

function stressTestLargePayloads(headers) {
  // Create very large code payload
  const largeCode = COMPLEX_CODE.repeat(10); // 10x larger

  const largePayload = {
    code: largeCode,
    language: 'tsx',
    options: {
      includePatterns: true,
      includeMetrics: true,
      includeDependencies: true,
      includeComplexity: true,
      depth: 'deep'
    }
  };

  const response = http.post(
    `${BASE_URL}/api/analysis/code`,
    JSON.stringify(largePayload),
    { headers, timeout: '60s' }
  );

  check(response, {
    'large payload analysis status is 200': (r) => r.status === 200,
    'large payload analysis completes': (r) => r.timings.duration < 60000,
    'large payload doesn\'t cause memory issues': (r) => r.status !== 413 && r.status !== 507,
  });

  errorRate.add(response.status !== 200);
}

function stressTestMemoryIntensive(headers) {
  // Multiple memory-intensive operations
  const operations = [
    // Complex pattern detection
    () => http.post(`${BASE_URL}/api/patterns/detect`, JSON.stringify({
      code: COMPLEX_CODE,
      language: 'tsx',
      projectId: null
    }), { headers }),

    // Large graph generation
    () => http.get(`${BASE_URL}/api/search?q=component&limit=100`, { headers }),

    // Complex search
    () => http.get(`${BASE_URL}/api/search?q=function&type=all&limit=100`, { headers }),
  ];

  // Run memory-intensive operations
  operations.forEach((operation, index) => {
    const response = operation();

    check(response, {
      [`memory intensive operation ${index} succeeds`]: (r) => r.status === 200,
      [`memory intensive operation ${index} completes`]: (r) => r.timings.duration < 10000,
    });

    errorRate.add(response.status !== 200);
  });

  // Simulate memory usage (this would be monitored externally)
  memoryUsage.add(Math.random() * 1000 + 500); // Simulated MB usage
}

export function teardown(data) {
  console.log('🔥 Stress test completed');
  console.log(`Total requests: ${requestCount.value}`);
  console.log(`Analysis failures: ${analysisFailures.value}`);
  console.log(`Graph failures: ${graphFailures.value}`);
  console.log(`Error rate: ${(errorRate.rate * 100).toFixed(2)}%`);
}