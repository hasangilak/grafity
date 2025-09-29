import { GraphEngine } from '../../../src/core/graph-engine/GraphEngine';
import { Neo4jAdapter } from '../../../src/core/graph-engine/persistence/Neo4jAdapter';
import { CodeGraphBuilder } from '../../../src/core/graph-engine/builders/CodeGraphBuilder';

// Mock Neo4j adapter
jest.mock('../../../src/core/graph-engine/persistence/Neo4jAdapter');

describe('GraphEngine', () => {
  let graphEngine: GraphEngine;
  let mockNeo4jAdapter: jest.Mocked<Neo4jAdapter>;
  let codeGraphBuilder: CodeGraphBuilder;

  beforeEach(() => {
    mockNeo4jAdapter = new Neo4jAdapter({} as any) as jest.Mocked<Neo4jAdapter>;
    codeGraphBuilder = new CodeGraphBuilder();
    graphEngine = new GraphEngine(mockNeo4jAdapter);

    // Setup mock implementations
    mockNeo4jAdapter.connect.mockResolvedValue(undefined);
    mockNeo4jAdapter.disconnect.mockResolvedValue(undefined);
    mockNeo4jAdapter.createNode.mockResolvedValue('node-id');
    mockNeo4jAdapter.createRelationship.mockResolvedValue('rel-id');
    mockNeo4jAdapter.query.mockResolvedValue([]);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with Neo4j adapter', () => {
      expect(graphEngine).toBeDefined();
      expect(graphEngine).toBeInstanceOf(GraphEngine);
    });

    it('should connect to Neo4j on startup', async () => {
      await graphEngine.connect();
      expect(mockNeo4jAdapter.connect).toHaveBeenCalledTimes(1);
    });

    it('should disconnect from Neo4j on shutdown', async () => {
      await graphEngine.disconnect();
      expect(mockNeo4jAdapter.disconnect).toHaveBeenCalledTimes(1);
    });
  });

  describe('node operations', () => {
    beforeEach(async () => {
      await graphEngine.connect();
    });

    it('should create component node', async () => {
      const componentData = {
        id: 'comp-1',
        name: 'MyComponent',
        type: 'function_component',
        path: '/src/components/MyComponent.tsx',
        props: ['title', 'onClick'],
        hooks: ['useState', 'useEffect']
      };

      const nodeId = await graphEngine.createComponentNode(componentData);

      expect(nodeId).toBe('node-id');
      expect(mockNeo4jAdapter.createNode).toHaveBeenCalledWith(
        'Component',
        expect.objectContaining({
          id: 'comp-1',
          name: 'MyComponent',
          type: 'function_component'
        })
      );
    });

    it('should create hook node', async () => {
      const hookData = {
        id: 'hook-1',
        name: 'useCounter',
        type: 'custom',
        dependencies: ['useState', 'useCallback'],
        complexity: 3
      };

      const nodeId = await graphEngine.createHookNode(hookData);

      expect(nodeId).toBe('node-id');
      expect(mockNeo4jAdapter.createNode).toHaveBeenCalledWith(
        'Hook',
        expect.objectContaining({
          id: 'hook-1',
          name: 'useCounter',
          type: 'custom'
        })
      );
    });

    it('should create pattern node', async () => {
      const patternData = {
        id: 'pattern-1',
        name: 'Custom Hook Pattern',
        type: 'good_pattern',
        confidence: 0.95,
        components: ['comp-1', 'comp-2']
      };

      const nodeId = await graphEngine.createPatternNode(patternData);

      expect(nodeId).toBe('node-id');
      expect(mockNeo4jAdapter.createNode).toHaveBeenCalledWith(
        'Pattern',
        expect.objectContaining({
          id: 'pattern-1',
          name: 'Custom Hook Pattern',
          type: 'good_pattern'
        })
      );
    });

    it('should handle node creation errors', async () => {
      mockNeo4jAdapter.createNode.mockRejectedValue(new Error('Connection failed'));

      const componentData = {
        id: 'comp-1',
        name: 'MyComponent',
        type: 'function_component'
      };

      await expect(graphEngine.createComponentNode(componentData)).rejects.toThrow('Connection failed');
    });
  });

  describe('relationship operations', () => {
    beforeEach(async () => {
      await graphEngine.connect();
    });

    it('should create component dependency relationship', async () => {
      const relId = await graphEngine.createDependencyRelationship(
        'comp-1',
        'comp-2',
        { type: 'imports', strength: 0.8 }
      );

      expect(relId).toBe('rel-id');
      expect(mockNeo4jAdapter.createRelationship).toHaveBeenCalledWith(
        'comp-1',
        'comp-2',
        'DEPENDS_ON',
        expect.objectContaining({
          type: 'imports',
          strength: 0.8
        })
      );
    });

    it('should create hook usage relationship', async () => {
      const relId = await graphEngine.createHookUsageRelationship(
        'comp-1',
        'hook-1',
        { context: 'state_management' }
      );

      expect(relId).toBe('rel-id');
      expect(mockNeo4jAdapter.createRelationship).toHaveBeenCalledWith(
        'comp-1',
        'hook-1',
        'USES_HOOK',
        expect.objectContaining({
          context: 'state_management'
        })
      );
    });

    it('should create pattern detection relationship', async () => {
      const relId = await graphEngine.createPatternRelationship(
        'pattern-1',
        'comp-1',
        { confidence: 0.9, detected_at: expect.any(Date) }
      );

      expect(relId).toBe('rel-id');
      expect(mockNeo4jAdapter.createRelationship).toHaveBeenCalledWith(
        'pattern-1',
        'comp-1',
        'DETECTED_IN',
        expect.objectContaining({
          confidence: 0.9
        })
      );
    });
  });

  describe('graph queries', () => {
    beforeEach(async () => {
      await graphEngine.connect();
    });

    it('should query component dependencies', async () => {
      const mockResults = [
        {
          component: { id: 'comp-1', name: 'Component1' },
          dependency: { id: 'comp-2', name: 'Component2' },
          relationship: { type: 'imports', strength: 0.8 }
        }
      ];

      mockNeo4jAdapter.query.mockResolvedValue(mockResults);

      const dependencies = await graphEngine.getComponentDependencies('comp-1');

      expect(dependencies).toHaveLength(1);
      expect(dependencies[0]).toHaveValidStructure(['component', 'dependency', 'relationship']);
      expect(mockNeo4jAdapter.query).toHaveBeenCalledWith(
        expect.stringContaining('MATCH (c:Component {id: $componentId})-[r:DEPENDS_ON]->(dep:Component)'),
        { componentId: 'comp-1' }
      );
    });

    it('should query hook usage patterns', async () => {
      const mockResults = [
        {
          hook: { id: 'hook-1', name: 'useState', type: 'built_in' },
          components: [
            { id: 'comp-1', name: 'Component1' },
            { id: 'comp-2', name: 'Component2' }
          ]
        }
      ];

      mockNeo4jAdapter.query.mockResolvedValue(mockResults);

      const usage = await graphEngine.getHookUsagePatterns('hook-1');

      expect(usage).toHaveLength(1);
      expect(usage[0].hook.name).toBe('useState');
      expect(usage[0].components).toHaveLength(2);
    });

    it('should query detected patterns', async () => {
      const mockResults = [
        {
          pattern: { id: 'pattern-1', name: 'Custom Hook Pattern', confidence: 0.95 },
          components: [
            { id: 'comp-1', name: 'useCounter' },
            { id: 'comp-2', name: 'CounterComponent' }
          ]
        }
      ];

      mockNeo4jAdapter.query.mockResolvedValue(mockResults);

      const patterns = await graphEngine.getDetectedPatterns();

      expect(patterns).toHaveLength(1);
      expect(patterns[0].pattern.name).toBe('Custom Hook Pattern');
      expect(patterns[0].components).toHaveLength(2);
    });

    it('should handle complex graph traversals', async () => {
      const mockResults = [
        {
          path: [
            { id: 'comp-1', name: 'App' },
            { id: 'comp-2', name: 'UserList' },
            { id: 'comp-3', name: 'UserItem' }
          ],
          depth: 3
        }
      ];

      mockNeo4jAdapter.query.mockResolvedValue(mockResults);

      const paths = await graphEngine.findComponentPaths('comp-1', 'comp-3');

      expect(paths).toHaveLength(1);
      expect(paths[0].path).toHaveLength(3);
      expect(paths[0].depth).toBe(3);
    });
  });

  describe('graph analytics', () => {
    beforeEach(async () => {
      await graphEngine.connect();
    });

    it('should calculate component centrality', async () => {
      const mockResults = [
        { component: { id: 'comp-1', name: 'App' }, centrality: 0.95 },
        { component: { id: 'comp-2', name: 'UserList' }, centrality: 0.75 },
        { component: { id: 'comp-3', name: 'UserItem' }, centrality: 0.45 }
      ];

      mockNeo4jAdapter.query.mockResolvedValue(mockResults);

      const centrality = await graphEngine.calculateComponentCentrality();

      expect(centrality).toHaveLength(3);
      expect(centrality[0].centrality).toBe(0.95);
      expect(centrality[0].component.name).toBe('App');
    });

    it('should detect circular dependencies', async () => {
      const mockResults = [
        {
          cycle: [
            { id: 'comp-1', name: 'ComponentA' },
            { id: 'comp-2', name: 'ComponentB' },
            { id: 'comp-1', name: 'ComponentA' } // Back to start
          ],
          length: 2
        }
      ];

      mockNeo4jAdapter.query.mockResolvedValue(mockResults);

      const cycles = await graphEngine.detectCircularDependencies();

      expect(cycles).toHaveLength(1);
      expect(cycles[0].length).toBe(2);
      expect(cycles[0].cycle[0].name).toBe('ComponentA');
    });

    it('should calculate graph metrics', async () => {
      const mockResults = [
        {
          totalNodes: 50,
          totalRelationships: 75,
          avgDegree: 3.0,
          density: 0.15,
          diameter: 5
        }
      ];

      mockNeo4jAdapter.query.mockResolvedValue(mockResults);

      const metrics = await graphEngine.calculateGraphMetrics();

      expect(metrics).toHaveValidStructure([
        'totalNodes',
        'totalRelationships',
        'avgDegree',
        'density',
        'diameter'
      ]);
      expect(metrics.totalNodes).toBe(50);
      expect(metrics.density).toBe(0.15);
    });
  });

  describe('graph persistence', () => {
    beforeEach(async () => {
      await graphEngine.connect();
    });

    it('should clear entire graph', async () => {
      await graphEngine.clearGraph();

      expect(mockNeo4jAdapter.query).toHaveBeenCalledWith(
        'MATCH (n) DETACH DELETE n'
      );
    });

    it('should export graph data', async () => {
      const mockNodes = [
        { id: 'comp-1', labels: ['Component'], properties: { name: 'App' } }
      ];
      const mockRelationships = [
        { id: 'rel-1', type: 'DEPENDS_ON', startNode: 'comp-1', endNode: 'comp-2' }
      ];

      mockNeo4jAdapter.query
        .mockResolvedValueOnce(mockNodes)
        .mockResolvedValueOnce(mockRelationships);

      const exportData = await graphEngine.exportGraph();

      expect(exportData).toHaveValidStructure(['nodes', 'relationships']);
      expect(exportData.nodes).toHaveLength(1);
      expect(exportData.relationships).toHaveLength(1);
    });

    it('should import graph data', async () => {
      const importData = {
        nodes: [
          { id: 'comp-1', labels: ['Component'], properties: { name: 'App' } }
        ],
        relationships: [
          { id: 'rel-1', type: 'DEPENDS_ON', startNode: 'comp-1', endNode: 'comp-2' }
        ]
      };

      await graphEngine.importGraph(importData);

      expect(mockNeo4jAdapter.createNode).toHaveBeenCalledTimes(1);
      expect(mockNeo4jAdapter.createRelationship).toHaveBeenCalledTimes(1);
    });
  });

  describe('error handling', () => {
    it('should handle connection failures gracefully', async () => {
      mockNeo4jAdapter.connect.mockRejectedValue(new Error('Connection refused'));

      await expect(graphEngine.connect()).rejects.toThrow('Connection refused');
    });

    it('should handle query failures', async () => {
      await graphEngine.connect();
      mockNeo4jAdapter.query.mockRejectedValue(new Error('Query failed'));

      await expect(graphEngine.getComponentDependencies('comp-1')).rejects.toThrow('Query failed');
    });

    it('should handle malformed data gracefully', async () => {
      await graphEngine.connect();

      const invalidComponentData = {
        // Missing required fields
        name: 'Component'
      } as any;

      await expect(graphEngine.createComponentNode(invalidComponentData)).rejects.toThrow();
    });
  });

  describe('performance', () => {
    beforeEach(async () => {
      await graphEngine.connect();
    });

    it('should handle large graph operations efficiently', async () => {
      // Mock large dataset
      const largeDataset = Array(1000).fill(0).map((_, i) => ({
        component: { id: `comp-${i}`, name: `Component${i}` },
        dependencies: Math.floor(Math.random() * 5)
      }));

      mockNeo4jAdapter.query.mockResolvedValue(largeDataset);

      const startTime = Date.now();
      const result = await graphEngine.getComponentDependencies('comp-1');
      const endTime = Date.now();

      expect(result).toHaveLength(1000);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should batch operations efficiently', async () => {
      const components = Array(100).fill(0).map((_, i) => ({
        id: `comp-${i}`,
        name: `Component${i}`,
        type: 'function_component'
      }));

      await graphEngine.createComponentsBatch(components);

      // Should call createNode once per component
      expect(mockNeo4jAdapter.createNode).toHaveBeenCalledTimes(100);
    });
  });
});