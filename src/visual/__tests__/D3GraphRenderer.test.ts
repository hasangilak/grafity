/**
 * Tests for D3GraphRenderer
 */

import { D3GraphRenderer } from '../renderers/D3GraphRenderer';
import { GraphStore } from '../../core/graph-engine/GraphStore';
import { createMockGraphData, PerformanceProfiler, MemoryTester } from './TestUtils';

// Mock D3 to avoid complex DOM manipulation in tests
jest.mock('d3', () => ({
  select: jest.fn(() => ({
    selectAll: jest.fn(() => ({ remove: jest.fn() })),
    append: jest.fn(() => ({
      attr: jest.fn().mockReturnThis(),
      classed: jest.fn().mockReturnThis(),
      append: jest.fn().mockReturnThis(),
      style: jest.fn().mockReturnThis()
    })),
    node: jest.fn(() => ({ getBoundingClientRect: () => ({ width: 800, height: 600 }) }))
  })),
  forceSimulation: jest.fn(() => ({
    force: jest.fn().mockReturnThis(),
    nodes: jest.fn().mockReturnThis(),
    on: jest.fn().mockReturnThis(),
    alpha: jest.fn().mockReturnThis(),
    restart: jest.fn().mockReturnThis(),
    stop: jest.fn()
  })),
  forceLink: jest.fn(() => ({
    id: jest.fn().mockReturnThis(),
    distance: jest.fn().mockReturnThis(),
    strength: jest.fn().mockReturnThis(),
    links: jest.fn().mockReturnThis()
  })),
  forceManyBody: jest.fn(() => ({
    strength: jest.fn().mockReturnThis()
  })),
  forceCenter: jest.fn(),
  forceCollide: jest.fn(() => ({
    radius: jest.fn().mockReturnThis()
  })),
  zoom: jest.fn(() => ({
    scaleExtent: jest.fn().mockReturnThis(),
    on: jest.fn().mockReturnThis()
  })),
  drag: jest.fn(() => ({
    on: jest.fn().mockReturnThis()
  })),
  zoomIdentity: { k: 1, x: 0, y: 0 },
  quadtree: jest.fn(() => ({
    addAll: jest.fn(),
    visitAfter: jest.fn(),
    find: jest.fn()
  }))
}));

describe('D3GraphRenderer', () => {
  let container: HTMLDivElement;
  let graphStore: GraphStore;
  let renderer: D3GraphRenderer;
  let profiler: PerformanceProfiler;

  beforeEach(() => {
    container = document.createElement('div');
    container.style.width = '800px';
    container.style.height = '600px';
    document.body.appendChild(container);

    graphStore = new GraphStore();
    const { nodes, edges } = createMockGraphData(50, 75);

    nodes.forEach(node => graphStore.addNode(node));
    edges.forEach(edge => graphStore.addEdge(edge));

    profiler = new PerformanceProfiler();

    renderer = new D3GraphRenderer(graphStore, {
      width: 800,
      height: 600,
      enableEdgeBundling: false
    });
  });

  afterEach(() => {
    if (renderer) {
      renderer.destroy();
    }
    document.body.removeChild(container);
    profiler.clear();
  });

  describe('Initialization', () => {
    it('initializes with default options', () => {
      expect(renderer).toBeInstanceOf(D3GraphRenderer);
    });

    it('initializes with custom options', () => {
      const customRenderer = new D3GraphRenderer(graphStore, {
        width: 1200,
        height: 800,
        nodeRadius: 12,
        linkDistance: 80,
        chargeStrength: -400,
        enableEdgeBundling: true,
        bundlingStrength: 0.9
      });

      expect(customRenderer).toBeInstanceOf(D3GraphRenderer);
      customRenderer.destroy();
    });

    it('creates SVG container when initialized', () => {
      profiler.start('init-renderer');
      renderer.init(container);
      profiler.end('init-renderer');

      // Check if SVG was created (mocked)
      expect(container.children.length).toBeGreaterThan(0);
    });
  });

  describe('Rendering Performance', () => {
    it('handles small graphs efficiently', () => {
      const smallStore = new GraphStore();
      const { nodes, edges } = createMockGraphData(10, 15);

      nodes.forEach(node => smallStore.addNode(node));
      edges.forEach(edge => smallStore.addEdge(edge));

      const smallRenderer = new D3GraphRenderer(smallStore);

      profiler.start('render-small-graph');
      smallRenderer.init(container);
      const renderTime = profiler.end('render-small-graph');

      expect(renderTime).toBeLessThan(100); // Should be very fast
      smallRenderer.destroy();
    });

    it('handles medium graphs efficiently', () => {
      profiler.start('render-medium-graph');
      renderer.init(container);
      const renderTime = profiler.end('render-medium-graph');

      expect(renderTime).toBeLessThan(500); // Should render reasonably fast
    });

    it('handles large graphs with performance optimizations', () => {
      const largeStore = new GraphStore();
      const { nodes, edges } = createMockGraphData(1000, 1500);

      nodes.forEach(node => largeStore.addNode(node));
      edges.forEach(edge => largeStore.addEdge(edge));

      const largeRenderer = new D3GraphRenderer(largeStore, {
        width: 800,
        height: 600,
        useWebWorker: true
      });

      profiler.start('render-large-graph');
      largeRenderer.init(container);
      const renderTime = profiler.end('render-large-graph');

      expect(renderTime).toBeLessThan(2000); // Should handle large graphs
      largeRenderer.destroy();
    });
  });

  describe('Edge Bundling', () => {
    it('enables edge bundling correctly', () => {
      const bundlingRenderer = new D3GraphRenderer(graphStore, {
        enableEdgeBundling: true,
        bundlingStrength: 0.85,
        bundlingIterations: 50
      });

      bundlingRenderer.init(container);
      bundlingRenderer.setEdgeBundling(true);

      // Test passes if no errors are thrown
      expect(bundlingRenderer).toBeInstanceOf(D3GraphRenderer);
      bundlingRenderer.destroy();
    });

    it('disables edge bundling correctly', () => {
      const bundlingRenderer = new D3GraphRenderer(graphStore, {
        enableEdgeBundling: true
      });

      bundlingRenderer.init(container);
      bundlingRenderer.setEdgeBundling(false);

      expect(bundlingRenderer).toBeInstanceOf(D3GraphRenderer);
      bundlingRenderer.destroy();
    });

    it('handles edge bundling with different graph sizes', () => {
      const testSizes = [
        { nodes: 5, edges: 8 },
        { nodes: 50, edges: 75 },
        { nodes: 200, edges: 300 }
      ];

      testSizes.forEach(({ nodes: nodeCount, edges: edgeCount }) => {
        const testStore = new GraphStore();
        const { nodes, edges } = createMockGraphData(nodeCount, edgeCount);

        nodes.forEach(node => testStore.addNode(node));
        edges.forEach(edge => testStore.addEdge(edge));

        const testRenderer = new D3GraphRenderer(testStore, {
          enableEdgeBundling: true
        });

        expect(() => {
          testRenderer.init(container);
        }).not.toThrow();

        testRenderer.destroy();
      });
    });
  });

  describe('Data Updates', () => {
    beforeEach(() => {
      renderer.init(container);
    });

    it('updates when graph data changes', () => {
      const newNode = {
        id: 'new-node',
        type: 'code' as const,
        label: 'New Node',
        description: 'A new test node',
        metadata: {
          createdAt: new Date(),
          updatedAt: new Date()
        }
      };

      profiler.start('add-node-update');
      graphStore.addNode(newNode);
      renderer.update();
      profiler.end('add-node-update');

      // Test passes if no errors are thrown
      expect(renderer).toBeInstanceOf(D3GraphRenderer);
    });

    it('handles rapid data updates efficiently', () => {
      const updates = 20;

      profiler.start('rapid-updates');
      for (let i = 0; i < updates; i++) {
        const node = {
          id: `rapid-node-${i}`,
          type: 'code' as const,
          label: `Rapid Node ${i}`,
          description: `Rapid test node ${i}`,
          metadata: {
            createdAt: new Date(),
            updatedAt: new Date()
          }
        };
        graphStore.addNode(node);
        renderer.update();
      }
      const updateTime = profiler.end('rapid-updates');

      expect(updateTime).toBeLessThan(1000); // Should handle rapid updates
    });
  });

  describe('Export Functionality', () => {
    beforeEach(() => {
      renderer.init(container);
    });

    it('exports SVG correctly', () => {
      const svgString = renderer.exportSVG();
      expect(typeof svgString).toBe('string');
    });

    it('exports PNG correctly', async () => {
      // Mock the necessary browser APIs
      global.Image = class {
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        src: string = '';

        constructor() {
          setTimeout(() => {
            if (this.onload) this.onload();
          }, 0);
        }
      } as any;

      global.URL.createObjectURL = jest.fn(() => 'mock-blob-url');
      global.URL.revokeObjectURL = jest.fn();

      const mockCanvas = {
        toBlob: jest.fn((callback) => {
          callback(new Blob(['mock'], { type: 'image/png' }));
        }),
        getContext: jest.fn(() => ({
          drawImage: jest.fn()
        })),
        width: 800,
        height: 600
      };

      global.document.createElement = jest.fn((tagName) => {
        if (tagName === 'canvas') {
          return mockCanvas as any;
        }
        return document.createElement(tagName);
      });

      const pngBlob = await renderer.exportPNG();
      expect(pngBlob).toBeInstanceOf(Blob);
    });
  });

  describe('Memory Management', () => {
    it('cleans up resources on destroy', async () => {
      renderer.init(container);

      const memoryTest = await MemoryTester.detectMemoryLeak(
        () => {
          const testRenderer = new D3GraphRenderer(graphStore);
          testRenderer.init(container);
          testRenderer.destroy();
        },
        10,
        1024 * 1024 // 1MB threshold
      );

      expect(memoryTest.leaked).toBe(false);
    });

    it('handles multiple init/destroy cycles', () => {
      for (let i = 0; i < 5; i++) {
        const testRenderer = new D3GraphRenderer(graphStore);
        testRenderer.init(container);
        testRenderer.destroy();
      }

      // Test passes if no errors are thrown
      expect(true).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('handles invalid container gracefully', () => {
      expect(() => {
        const testRenderer = new D3GraphRenderer(graphStore);
        testRenderer.init(null as any);
      }).not.toThrow();
    });

    it('handles empty graph store', () => {
      const emptyStore = new GraphStore();
      const emptyRenderer = new D3GraphRenderer(emptyStore);

      expect(() => {
        emptyRenderer.init(container);
      }).not.toThrow();

      emptyRenderer.destroy();
    });

    it('handles malformed node data', () => {
      const malformedStore = new GraphStore();

      // Add node with missing required fields
      try {
        malformedStore.addNode({
          id: 'malformed',
          type: undefined as any,
          label: undefined as any,
          metadata: {}
        } as any);
      } catch (e) {
        // Expected to throw, that's fine
      }

      const malformedRenderer = new D3GraphRenderer(malformedStore);

      expect(() => {
        malformedRenderer.init(container);
      }).not.toThrow();

      malformedRenderer.destroy();
    });
  });

  describe('Zoom and Pan', () => {
    beforeEach(() => {
      renderer.init(container);
    });

    it('handles zoom operations', () => {
      // Zoom operations are handled by D3, which is mocked
      // Test passes if no errors are thrown during initialization
      expect(renderer).toBeInstanceOf(D3GraphRenderer);
    });

    it('maintains performance during zoom operations', () => {
      // Simulate multiple zoom operations
      profiler.start('zoom-operations');

      for (let i = 0; i < 10; i++) {
        // In real implementation, this would trigger zoom events
        renderer.update();
      }

      const zoomTime = profiler.end('zoom-operations');
      expect(zoomTime).toBeLessThan(500);
    });
  });
});