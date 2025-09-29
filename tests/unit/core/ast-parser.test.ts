import { ASTParser } from '../../../src/core/ast/parser';

describe('ASTParser', () => {
  let parser: ASTParser;

  beforeEach(() => {
    parser = new ASTParser();
  });

  describe('parseCode', () => {
    it('should parse basic TypeScript function', async () => {
      const code = `
        function greet(name: string): string {
          return \`Hello, \${name}!\`;
        }
      `;

      const result = await parser.parseCode(code, 'typescript');

      expect(result).toBeDefined();
      expect(result.sourceFile).toBeDefined();
      expect(result.sourceFile.getFullText()).toContain('function greet');
    });

    it('should parse React functional component', async () => {
      const code = `
        import React from 'react';

        interface Props {
          title: string;
          count: number;
        }

        export function Counter({ title, count }: Props) {
          return (
            <div>
              <h1>{title}</h1>
              <p>Count: {count}</p>
            </div>
          );
        }
      `;

      const result = await parser.parseCode(code, 'tsx');

      expect(result).toBeDefined();
      expect(result.sourceFile).toBeDefined();
      expect(result.sourceFile.getFullText()).toContain('export function Counter');
      expect(result.sourceFile.getFullText()).toContain('interface Props');
    });

    it('should parse React component with hooks', async () => {
      const code = `
        import React, { useState, useEffect } from 'react';

        export function useCounter(initialValue = 0) {
          const [count, setCount] = useState(initialValue);

          useEffect(() => {
            document.title = \`Count: \${count}\`;
          }, [count]);

          const increment = () => setCount(c => c + 1);
          const decrement = () => setCount(c => c - 1);

          return { count, increment, decrement };
        }

        export function CounterComponent() {
          const { count, increment, decrement } = useCounter();

          return (
            <div>
              <button onClick={decrement}>-</button>
              <span>{count}</span>
              <button onClick={increment}>+</button>
            </div>
          );
        }
      `;

      const result = await parser.parseCode(code, 'tsx');

      expect(result).toBeDefined();
      expect(result.sourceFile.getFullText()).toContain('useState');
      expect(result.sourceFile.getFullText()).toContain('useEffect');
      expect(result.sourceFile.getFullText()).toContain('useCounter');
    });

    it('should handle invalid TypeScript code gracefully', async () => {
      const invalidCode = `
        function broken() {
          const x =
          // Missing semicolon and incomplete statement
        }
      `;

      await expect(parser.parseCode(invalidCode, 'typescript')).rejects.toThrow();
    });

    it('should parse class components', async () => {
      const code = `
        import React, { Component } from 'react';

        interface State {
          count: number;
        }

        interface Props {
          initialCount?: number;
        }

        export class ClassCounter extends Component<Props, State> {
          constructor(props: Props) {
            super(props);
            this.state = {
              count: props.initialCount || 0
            };
          }

          increment = () => {
            this.setState(prevState => ({
              count: prevState.count + 1
            }));
          }

          render() {
            return (
              <div>
                <p>Count: {this.state.count}</p>
                <button onClick={this.increment}>Increment</button>
              </div>
            );
          }
        }
      `;

      const result = await parser.parseCode(code, 'tsx');

      expect(result).toBeDefined();
      expect(result.sourceFile.getFullText()).toContain('class ClassCounter');
      expect(result.sourceFile.getFullText()).toContain('extends Component');
      expect(result.sourceFile.getFullText()).toContain('constructor');
    });

    it('should handle different language types', async () => {
      const jsCode = `
        function add(a, b) {
          return a + b;
        }
      `;

      const result = await parser.parseCode(jsCode, 'javascript');

      expect(result).toBeDefined();
      expect(result.sourceFile.getFullText()).toContain('function add');
    });

    it('should parse complex TypeScript features', async () => {
      const code = `
        // Generics and advanced types
        interface Repository<T> {
          find<K extends keyof T>(criteria: Partial<Pick<T, K>>): Promise<T[]>;
          save(entity: T): Promise<T>;
        }

        type User = {
          id: string;
          name: string;
          email: string;
        };

        class UserRepository implements Repository<User> {
          async find<K extends keyof User>(criteria: Partial<Pick<User, K>>): Promise<User[]> {
            // Implementation
            return [];
          }

          async save(user: User): Promise<User> {
            // Implementation
            return user;
          }
        }

        // Conditional types and mapped types
        type PartialExcept<T, K extends keyof T> = Partial<T> & Pick<T, K>;
        type UserUpdate = PartialExcept<User, 'id'>;
      `;

      const result = await parser.parseCode(code, 'typescript');

      expect(result).toBeDefined();
      expect(result.sourceFile.getFullText()).toContain('interface Repository');
      expect(result.sourceFile.getFullText()).toContain('extends keyof');
      expect(result.sourceFile.getFullText()).toContain('PartialExcept');
    });

    it('should parse JSX with complex patterns', async () => {
      const code = `
        import React, { memo, useMemo, useCallback } from 'react';

        interface ListProps<T> {
          items: T[];
          renderItem: (item: T, index: number) => React.ReactNode;
          keyExtractor: (item: T) => string;
          filter?: (item: T) => boolean;
        }

        function VirtualizedList<T>({
          items,
          renderItem,
          keyExtractor,
          filter
        }: ListProps<T>) {
          const filteredItems = useMemo(() => {
            return filter ? items.filter(filter) : items;
          }, [items, filter]);

          const handleItemClick = useCallback((item: T) => {
            console.log('Clicked item:', item);
          }, []);

          return (
            <div className="virtualized-list">
              {filteredItems.map((item, index) => (
                <div
                  key={keyExtractor(item)}
                  onClick={() => handleItemClick(item)}
                  className="list-item"
                >
                  {renderItem(item, index)}
                </div>
              ))}
            </div>
          );
        }

        export default memo(VirtualizedList) as <T>(props: ListProps<T>) => JSX.Element;
      `;

      const result = await parser.parseCode(code, 'tsx');

      expect(result).toBeDefined();
      expect(result.sourceFile.getFullText()).toContain('VirtualizedList');
      expect(result.sourceFile.getFullText()).toContain('useMemo');
      expect(result.sourceFile.getFullText()).toContain('useCallback');
      expect(result.sourceFile.getFullText()).toContain('memo');
    });
  });

  describe('error handling', () => {
    it('should handle empty code', async () => {
      const result = await parser.parseCode('', 'typescript');
      expect(result).toBeDefined();
      expect(result.sourceFile.getFullText()).toBe('');
    });

    it('should handle whitespace-only code', async () => {
      const result = await parser.parseCode('   \n\t   ', 'typescript');
      expect(result).toBeDefined();
    });

    it('should handle unknown language gracefully', async () => {
      const code = 'const x = 1;';
      await expect(parser.parseCode(code, 'unknown' as any)).rejects.toThrow();
    });
  });

  describe('performance', () => {
    it('should parse large files efficiently', async () => {
      // Generate a large TypeScript file
      const largeCode = Array(1000)
        .fill(0)
        .map((_, i) => `function func${i}() { return ${i}; }`)
        .join('\n');

      const startTime = Date.now();
      const result = await parser.parseCode(largeCode, 'typescript');
      const endTime = Date.now();

      expect(result).toBeDefined();
      expect(endTime - startTime).toBeLessThan(5000); // Should parse within 5 seconds
    });

    it('should handle deeply nested structures', async () => {
      const deepCode = `
        interface A {
          b: {
            c: {
              d: {
                e: {
                  f: {
                    g: {
                      h: string;
                    };
                  };
                };
              };
            };
          };
        }
      `;

      const result = await parser.parseCode(deepCode, 'typescript');
      expect(result).toBeDefined();
    });
  });

  describe('language detection', () => {
    it('should properly distinguish between TypeScript and JavaScript', async () => {
      const tsCode = 'const x: number = 1;';
      const jsCode = 'const x = 1;';

      const tsResult = await parser.parseCode(tsCode, 'typescript');
      const jsResult = await parser.parseCode(jsCode, 'javascript');

      expect(tsResult).toBeDefined();
      expect(jsResult).toBeDefined();
    });

    it('should handle TSX vs JSX properly', async () => {
      const tsxCode = `
        interface Props {
          name: string;
        }
        const Component = ({ name }: Props) => <div>{name}</div>;
      `;

      const jsxCode = `
        const Component = ({ name }) => <div>{name}</div>;
      `;

      const tsxResult = await parser.parseCode(tsxCode, 'tsx');
      const jsxResult = await parser.parseCode(jsxCode, 'jsx');

      expect(tsxResult).toBeDefined();
      expect(jsxResult).toBeDefined();
    });
  });
});