import { PatternDetector } from '../../../src/core/ast-mechanical/PatternDetector';
import { ASTParser } from '../../../src/core/ast/parser';

describe('PatternDetector', () => {
  let patternDetector: PatternDetector;
  let astParser: ASTParser;

  beforeEach(() => {
    patternDetector = new PatternDetector();
    astParser = new ASTParser();
  });

  describe('React Hook Patterns', () => {
    it('should detect custom hook pattern', async () => {
      const code = `
        import { useState, useEffect } from 'react';

        export function useCounter(initialValue = 0) {
          const [count, setCount] = useState(initialValue);

          useEffect(() => {
            document.title = \`Count: \${count}\`;
          }, [count]);

          const increment = () => setCount(c => c + 1);
          const decrement = () => setCount(c => c - 1);

          return { count, increment, decrement };
        }
      `;

      const patterns = await patternDetector.detectPatterns(code);

      expect(patterns).toHaveLength(1);
      expect(patterns[0]).toHaveValidStructure(['name', 'type', 'confidence', 'description']);
      expect(patterns[0].name).toBe('Custom Hook Pattern');
      expect(patterns[0].type).toBe('good_pattern');
      expect(patterns[0].confidence).toBeGreaterThan(0.8);
    });

    it('should detect useState pattern', async () => {
      const code = `
        import React, { useState } from 'react';

        function Counter() {
          const [count, setCount] = useState(0);
          const [name, setName] = useState('');

          return (
            <div>
              <p>{count}</p>
              <input value={name} onChange={e => setName(e.target.value)} />
            </div>
          );
        }
      `;

      const patterns = await patternDetector.detectPatterns(code);

      const statePattern = patterns.find(p => p.name.includes('useState'));
      expect(statePattern).toBeDefined();
      expect(statePattern.type).toBe('good_pattern');
    });

    it('should detect useEffect cleanup pattern', async () => {
      const code = `
        import React, { useEffect, useState } from 'react';

        function Timer() {
          const [seconds, setSeconds] = useState(0);

          useEffect(() => {
            const interval = setInterval(() => {
              setSeconds(s => s + 1);
            }, 1000);

            return () => clearInterval(interval);
          }, []);

          return <div>Seconds: {seconds}</div>;
        }
      `;

      const patterns = await patternDetector.detectPatterns(code);

      const cleanupPattern = patterns.find(p => p.name.includes('Cleanup'));
      expect(cleanupPattern).toBeDefined();
      expect(cleanupPattern.type).toBe('good_pattern');
      expect(cleanupPattern.confidence).toBeGreaterThan(0.9);
    });

    it('should detect memory leak anti-pattern', async () => {
      const code = `
        import React, { useEffect, useState } from 'react';

        function BadTimer() {
          const [seconds, setSeconds] = useState(0);

          useEffect(() => {
            // Memory leak: no cleanup
            setInterval(() => {
              setSeconds(s => s + 1);
            }, 1000);
          }, []);

          return <div>Seconds: {seconds}</div>;
        }
      `;

      const patterns = await patternDetector.detectPatterns(code);

      const memoryLeakPattern = patterns.find(p => p.type === 'anti_pattern');
      expect(memoryLeakPattern).toBeDefined();
      expect(memoryLeakPattern.name).toContain('Memory Leak');
    });
  });

  describe('Component Architecture Patterns', () => {
    it('should detect compound component pattern', async () => {
      const code = `
        import React, { createContext, useContext } from 'react';

        const TabsContext = createContext();

        function Tabs({ children, defaultTab }) {
          const [activeTab, setActiveTab] = useState(defaultTab);

          return (
            <TabsContext.Provider value={{ activeTab, setActiveTab }}>
              <div className="tabs">{children}</div>
            </TabsContext.Provider>
          );
        }

        function TabList({ children }) {
          return <div className="tab-list">{children}</div>;
        }

        function Tab({ id, children }) {
          const { activeTab, setActiveTab } = useContext(TabsContext);
          return (
            <button
              className={activeTab === id ? 'active' : ''}
              onClick={() => setActiveTab(id)}
            >
              {children}
            </button>
          );
        }

        function TabPanel({ id, children }) {
          const { activeTab } = useContext(TabsContext);
          return activeTab === id ? <div>{children}</div> : null;
        }

        Tabs.List = TabList;
        Tabs.Tab = Tab;
        Tabs.Panel = TabPanel;
      `;

      const patterns = await patternDetector.detectPatterns(code);

      const compoundPattern = patterns.find(p => p.name.includes('Compound Component'));
      expect(compoundPattern).toBeDefined();
      expect(compoundPattern.type).toBe('good_pattern');
    });

    it('should detect render props pattern', async () => {
      const code = `
        import React, { useState } from 'react';

        function DataFetcher({ url, render }) {
          const [data, setData] = useState(null);
          const [loading, setLoading] = useState(false);
          const [error, setError] = useState(null);

          useEffect(() => {
            setLoading(true);
            fetch(url)
              .then(response => response.json())
              .then(setData)
              .catch(setError)
              .finally(() => setLoading(false));
          }, [url]);

          return render({ data, loading, error });
        }

        function App() {
          return (
            <DataFetcher
              url="/api/users"
              render={({ data, loading, error }) => {
                if (loading) return <div>Loading...</div>;
                if (error) return <div>Error: {error.message}</div>;
                return <ul>{data?.map(user => <li key={user.id}>{user.name}</li>)}</ul>;
              }}
            />
          );
        }
      `;

      const patterns = await patternDetector.detectPatterns(code);

      const renderPropsPattern = patterns.find(p => p.name.includes('Render Props'));
      expect(renderPropsPattern).toBeDefined();
      expect(renderPropsPattern.type).toBe('good_pattern');
    });

    it('should detect higher-order component pattern', async () => {
      const code = `
        import React from 'react';

        function withAuth(WrappedComponent) {
          return function AuthenticatedComponent(props) {
            const { user, isAuthenticated } = useAuth();

            if (!isAuthenticated) {
              return <LoginForm />;
            }

            return <WrappedComponent {...props} user={user} />;
          };
        }

        const ProtectedDashboard = withAuth(Dashboard);
        const ProtectedProfile = withAuth(Profile);
      `;

      const patterns = await patternDetector.detectPatterns(code);

      const hocPattern = patterns.find(p => p.name.includes('Higher-Order Component'));
      expect(hocPattern).toBeDefined();
      expect(hocPattern.type).toBe('good_pattern');
    });
  });

  describe('Anti-Patterns', () => {
    it('should detect god component anti-pattern', async () => {
      const code = `
        import React, { useState, useEffect } from 'react';

        function MassiveComponent() {
          // Too many state variables
          const [users, setUsers] = useState([]);
          const [posts, setPosts] = useState([]);
          const [comments, setComments] = useState([]);
          const [filters, setFilters] = useState({});
          const [sorting, setSorting] = useState('asc');
          const [pagination, setPagination] = useState({ page: 1 });
          const [modal, setModal] = useState(false);
          const [loading, setLoading] = useState(false);
          const [error, setError] = useState(null);

          // Too many effects
          useEffect(() => { /* fetch users */ }, []);
          useEffect(() => { /* fetch posts */ }, [users]);
          useEffect(() => { /* fetch comments */ }, [posts]);
          useEffect(() => { /* handle filters */ }, [filters]);
          useEffect(() => { /* handle sorting */ }, [sorting]);

          // Massive render with too much logic
          return (
            <div>
              {/* 100+ lines of JSX */}
              {users.length > 0 && (
                <div>
                  {users.filter(user => filters.name ? user.name.includes(filters.name) : true)
                       .sort((a, b) => sorting === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name))
                       .slice((pagination.page - 1) * 10, pagination.page * 10)
                       .map(user => (
                         <div key={user.id}>
                           {/* Nested complex rendering logic */}
                         </div>
                       ))}
                </div>
              )}
            </div>
          );
        }
      `;

      const patterns = await patternDetector.detectPatterns(code);

      const godComponentPattern = patterns.find(p => p.name.includes('God Component'));
      expect(godComponentPattern).toBeDefined();
      expect(godComponentPattern.type).toBe('anti_pattern');
      expect(godComponentPattern.severity).toBe('high');
    });

    it('should detect prop drilling anti-pattern', async () => {
      const code = `
        function App() {
          const [user, setUser] = useState(null);
          const [theme, setTheme] = useState('light');

          return (
            <Layout user={user} theme={theme}>
              <Header user={user} theme={theme} />
              <Main user={user} theme={theme} />
              <Footer user={user} theme={theme} />
            </Layout>
          );
        }

        function Layout({ user, theme, children }) {
          return (
            <div className={theme}>
              <Navigation user={user} theme={theme} />
              {children}
            </div>
          );
        }

        function Navigation({ user, theme }) {
          return (
            <nav className={theme}>
              <UserMenu user={user} theme={theme} />
            </nav>
          );
        }

        function UserMenu({ user, theme }) {
          return (
            <div className={theme}>
              {user ? user.name : 'Guest'}
            </div>
          );
        }
      `;

      const patterns = await patternDetector.detectPatterns(code);

      const propDrillingPattern = patterns.find(p => p.name.includes('Prop Drilling'));
      expect(propDrillingPattern).toBeDefined();
      expect(propDrillingPattern.type).toBe('anti_pattern');
    });

    it('should detect inefficient re-render pattern', async () => {
      const code = `
        function App() {
          const [count, setCount] = useState(0);

          return (
            <div>
              <ExpensiveComponent count={count} data={{ timestamp: Date.now() }} />
              <button onClick={() => setCount(c => c + 1)}>Increment</button>
            </div>
          );
        }

        function ExpensiveComponent({ count, data }) {
          // Expensive computation on every render
          const expensiveValue = useMemo(() => {
            return heavyComputation(count);
          }); // Missing dependency array

          return <div>{expensiveValue} - {data.timestamp}</div>;
        }
      `;

      const patterns = await patternDetector.detectPatterns(code);

      const inefficientRenderPattern = patterns.find(p => p.name.includes('Inefficient Render'));
      expect(inefficientRenderPattern).toBeDefined();
      expect(inefficientRenderPattern.type).toBe('anti_pattern');
    });
  });

  describe('Performance Patterns', () => {
    it('should detect memoization pattern', async () => {
      const code = `
        import React, { memo, useMemo, useCallback } from 'react';

        const ExpensiveComponent = memo(function ExpensiveComponent({ items, filter }) {
          const filteredItems = useMemo(() => {
            return items.filter(item => item.name.includes(filter));
          }, [items, filter]);

          const handleClick = useCallback((item) => {
            console.log('Clicked:', item.name);
          }, []);

          return (
            <div>
              {filteredItems.map(item => (
                <div key={item.id} onClick={() => handleClick(item)}>
                  {item.name}
                </div>
              ))}
            </div>
          );
        });
      `;

      const patterns = await patternDetector.detectPatterns(code);

      const memoizationPattern = patterns.find(p => p.name.includes('Memoization'));
      expect(memoizationPattern).toBeDefined();
      expect(memoizationPattern.type).toBe('good_pattern');
    });

    it('should detect lazy loading pattern', async () => {
      const code = `
        import React, { lazy, Suspense } from 'react';

        const LazyDashboard = lazy(() => import('./Dashboard'));
        const LazyProfile = lazy(() => import('./Profile'));

        function App() {
          return (
            <Router>
              <Routes>
                <Route
                  path="/dashboard"
                  element={
                    <Suspense fallback={<div>Loading Dashboard...</div>}>
                      <LazyDashboard />
                    </Suspense>
                  }
                />
                <Route
                  path="/profile"
                  element={
                    <Suspense fallback={<div>Loading Profile...</div>}>
                      <LazyProfile />
                    </Suspense>
                  }
                />
              </Routes>
            </Router>
          );
        }
      `;

      const patterns = await patternDetector.detectPatterns(code);

      const lazyLoadingPattern = patterns.find(p => p.name.includes('Lazy Loading'));
      expect(lazyLoadingPattern).toBeDefined();
      expect(lazyLoadingPattern.type).toBe('good_pattern');
    });
  });

  describe('Testing Patterns', () => {
    it('should detect error boundary pattern', async () => {
      const code = `
        import React from 'react';

        class ErrorBoundary extends React.Component {
          constructor(props) {
            super(props);
            this.state = { hasError: false, error: null, errorInfo: null };
          }

          static getDerivedStateFromError(error) {
            return { hasError: true };
          }

          componentDidCatch(error, errorInfo) {
            this.setState({
              error: error,
              errorInfo: errorInfo
            });
          }

          render() {
            if (this.state.hasError) {
              return (
                <div>
                  <h2>Something went wrong.</h2>
                  <details style={{ whiteSpace: 'pre-wrap' }}>
                    {this.state.error && this.state.error.toString()}
                  </details>
                </div>
              );
            }

            return this.props.children;
          }
        }
      `;

      const patterns = await patternDetector.detectPatterns(code);

      const errorBoundaryPattern = patterns.find(p => p.name.includes('Error Boundary'));
      expect(errorBoundaryPattern).toBeDefined();
      expect(errorBoundaryPattern.type).toBe('good_pattern');
    });
  });

  describe('pattern confidence', () => {
    it('should calculate confidence based on pattern completeness', async () => {
      const perfectCustomHook = `
        import { useState, useEffect, useCallback } from 'react';

        export function useCounter(initialValue = 0) {
          const [count, setCount] = useState(initialValue);

          const increment = useCallback(() => {
            setCount(c => c + 1);
          }, []);

          const decrement = useCallback(() => {
            setCount(c => c - 1);
          }, []);

          const reset = useCallback(() => {
            setCount(initialValue);
          }, [initialValue]);

          useEffect(() => {
            // Optional: persist to localStorage
            localStorage.setItem('counter', count.toString());
          }, [count]);

          return { count, increment, decrement, reset };
        }
      `;

      const patterns = await patternDetector.detectPatterns(perfectCustomHook);
      const customHookPattern = patterns.find(p => p.name.includes('Custom Hook'));

      expect(customHookPattern.confidence).toBeGreaterThan(0.95);
    });

    it('should lower confidence for incomplete patterns', async () => {
      const incompleteCustomHook = `
        import { useState } from 'react';

        function useCounter() {
          const [count, setCount] = useState(0);
          return count; // Should return an object with methods
        }
      `;

      const patterns = await patternDetector.detectPatterns(incompleteCustomHook);
      const customHookPattern = patterns.find(p => p.name.includes('Custom Hook'));

      if (customHookPattern) {
        expect(customHookPattern.confidence).toBeLessThan(0.7);
      }
    });
  });

  describe('error handling', () => {
    it('should handle malformed code gracefully', async () => {
      const malformedCode = `
        function broken() {
          const x =
          // Incomplete
      `;

      const patterns = await patternDetector.detectPatterns(malformedCode);
      expect(patterns).toEqual([]);
    });

    it('should handle empty code', async () => {
      const patterns = await patternDetector.detectPatterns('');
      expect(patterns).toEqual([]);
    });

    it('should handle non-React code', async () => {
      const nodeCode = `
        const express = require('express');
        const app = express();

        app.get('/', (req, res) => {
          res.send('Hello World');
        });
      `;

      const patterns = await patternDetector.detectPatterns(nodeCode);
      // Should not detect React patterns in Node.js code
      const reactPatterns = patterns.filter(p => p.name.includes('Hook') || p.name.includes('Component'));
      expect(reactPatterns).toHaveLength(0);
    });
  });

  describe('custom pattern definitions', () => {
    it('should detect user-defined patterns', async () => {
      const customPattern = {
        name: 'Data Fetching Hook',
        description: 'Custom hook that handles API calls with loading and error states',
        matcher: (code: string) => {
          return code.includes('useState') &&
                 code.includes('useEffect') &&
                 code.includes('fetch') &&
                 code.includes('loading') &&
                 code.includes('error');
        }
      };

      patternDetector.addCustomPattern(customPattern);

      const code = `
        function useApi(url) {
          const [data, setData] = useState(null);
          const [loading, setLoading] = useState(false);
          const [error, setError] = useState(null);

          useEffect(() => {
            setLoading(true);
            fetch(url)
              .then(response => response.json())
              .then(setData)
              .catch(setError)
              .finally(() => setLoading(false));
          }, [url]);

          return { data, loading, error };
        }
      `;

      const patterns = await patternDetector.detectPatterns(code);
      const customDetectedPattern = patterns.find(p => p.name === 'Data Fetching Hook');

      expect(customDetectedPattern).toBeDefined();
    });
  });
});