/**
 * Performance benchmark tests for visual components
 */

import { D3GraphRenderer } from '../renderers/D3GraphRenderer';
import { WebGLGraphRenderer, isWebGLSupported, convertNodesToWebGL } from '../renderers/WebGLGraphRenderer';
import { GraphStore } from '../../core/graph-engine/GraphStore';
import { createMockGraphData, PerformanceProfiler, MemoryTester } from './TestUtils';

describe('Performance Benchmarks', () => {
  let profiler: PerformanceProfiler;
  let memoryTester: MemoryTester;

  beforeEach(() => {
    profiler = new PerformanceProfiler();
    memoryTester = new MemoryTester();
  });

  afterEach(() => {
    profiler.clear();
  });

  describe('D3GraphRenderer Performance', () => {
    let container: HTMLDivElement;

    beforeEach(() => {
      container = document.createElement('div');
      container.style.width = '800px';
      container.style.height = '600px';
      document.body.appendChild(container);
    });

    afterEach(() => {
      document.body.removeChild(container);
    });

    it('handles small graphs (< 100 nodes) efficiently', () => {
      const graphStore = new GraphStore();
      const { nodes, edges } = createMockGraphData(50, 75);

      nodes.forEach(node => graphStore.addNode(node));
      edges.forEach(edge => graphStore.addEdge(edge));

      const renderer = new D3GraphRenderer(graphStore);

      profiler.start('d3-small-graph');
      renderer.init(container);
      const initTime = profiler.end('d3-small-graph');

      expect(initTime).toBeLessThan(200);

      profiler.start('d3-small-update');
      renderer.update();
      const updateTime = profiler.end('d3-small-update');

      expect(updateTime).toBeLessThan(50);

      renderer.destroy();
    });

    it('handles medium graphs (100-500 nodes) with acceptable performance', () => {
      const graphStore = new GraphStore();
      const { nodes, edges } = createMockGraphData(250, 400);

      nodes.forEach(node => graphStore.addNode(node));
      edges.forEach(edge => graphStore.addEdge(edge));

      const renderer = new D3GraphRenderer(graphStore);

      profiler.start('d3-medium-graph');
      renderer.init(container);
      const initTime = profiler.end('d3-medium-graph');

      expect(initTime).toBeLessThan(1000);

      // Test multiple updates
      for (let i = 0; i < 10; i++) {
        profiler.start(`d3-medium-update-${i}`);
        renderer.update();
        profiler.end(`d3-medium-update-${i}`);
      }

      const avgUpdateTime = Array.from({ length: 10 }, (_, i) =>
        profiler.getStats(`d3-medium-update-${i}`)?.avg || 0
      ).reduce((sum, time) => sum + time, 0) / 10;

      expect(avgUpdateTime).toBeLessThan(100);

      renderer.destroy();
    });

    it('handles large graphs (500+ nodes) with optimizations', () => {
      const graphStore = new GraphStore();
      const { nodes, edges } = createMockGraphData(1000, 1500);

      nodes.forEach(node => graphStore.addNode(node));
      edges.forEach(edge => graphStore.addEdge(edge));

      const renderer = new D3GraphRenderer(graphStore, {
        useWebWorker: true,
        enableCollision: false // Disable for better performance
      });

      profiler.start('d3-large-graph');
      renderer.init(container);
      const initTime = profiler.end('d3-large-graph');

      expect(initTime).toBeLessThan(3000);

      renderer.destroy();
    });

    it('measures edge bundling performance impact', () => {
      const graphStore = new GraphStore();
      const { nodes, edges } = createMockGraphData(100, 200);

      nodes.forEach(node => graphStore.addNode(node));
      edges.forEach(edge => graphStore.addEdge(edge));

      // Test without bundling
      const rendererNoBundling = new D3GraphRenderer(graphStore, {
        enableEdgeBundling: false
      });

      profiler.start('d3-no-bundling');
      rendererNoBundling.init(container);
      const noBundlingTime = profiler.end('d3-no-bundling');

      rendererNoBundling.destroy();

      // Test with bundling
      const rendererWithBundling = new D3GraphRenderer(graphStore, {
        enableEdgeBundling: true,
        bundlingIterations: 30 // Reduced for testing
      });

      profiler.start('d3-with-bundling');
      rendererWithBundling.init(container);
      const withBundlingTime = profiler.end('d3-with-bundling');

      rendererWithBundling.destroy();

      // Bundling should add overhead but still be reasonable
      expect(withBundlingTime).toBeLessThan(noBundlingTime * 3);
    });
  });

  describe('WebGL Renderer Performance', () => {
    let canvas: HTMLCanvasElement;

    beforeEach(() => {
      canvas = document.createElement('canvas');
      canvas.width = 800;
      canvas.height = 600;
      document.body.appendChild(canvas);
    });

    afterEach(() => {
      if (canvas.parentNode) {
        document.body.removeChild(canvas);
      }
    });

    it('handles very large graphs (10k+ nodes) efficiently', () => {
      if (!isWebGLSupported()) {
        console.warn('WebGL not supported, skipping WebGL performance tests');
        return;
      }

      const renderer = new WebGLGraphRenderer(canvas, {
        width: 800,
        height: 600,
        maxNodes: 15000,
        maxEdges: 25000
      });

      const { nodes, edges } = createMockGraphData(10000, 15000);
      const positions = new Map();

      // Generate random positions
      nodes.forEach(node => {
        positions.set(node.id, {
          x: Math.random() * 800,
          y: Math.random() * 600
        });
      });

      const webglNodes = convertNodesToWebGL(nodes, positions);
      const webglEdges = edges.map(edge => ({
        id: edge.id,
        sourceX: positions.get(edge.sourceId)?.x || 0,
        sourceY: positions.get(edge.sourceId)?.y || 0,
        targetX: positions.get(edge.targetId)?.x || 0,
        targetY: positions.get(edge.targetId)?.y || 0,
        width: 1,
        color: [0.5, 0.5, 0.5, 0.8] as [number, number, number, number],
        data: edge
      }));

      profiler.start('webgl-large-set-data');
      renderer.setData(webglNodes, webglEdges);
      const setDataTime = profiler.end('webgl-large-set-data');

      expect(setDataTime).toBeLessThan(1000);

      profiler.start('webgl-large-render');
      renderer.render();
      const renderTime = profiler.end('webgl-large-render');

      expect(renderTime).toBeLessThan(100);

      renderer.dispose();
    });

    it('maintains 60 FPS with continuous rendering', () => {
      if (!isWebGLSupported()) {
        console.warn('WebGL not supported, skipping WebGL performance tests');
        return;
      }

      const renderer = new WebGLGraphRenderer(canvas, {
        width: 800,
        height: 600
      });

      const { nodes, edges } = createMockGraphData(1000, 1500);
      const positions = new Map();

      nodes.forEach((node, i) => {
        positions.set(node.id, {
          x: (i % 40) * 20,
          y: Math.floor(i / 40) * 20
        });
      });

      const webglNodes = convertNodesToWebGL(nodes, positions);
      const webglEdges = edges.map(edge => ({
        id: edge.id,
        sourceX: positions.get(edge.sourceId)?.x || 0,
        sourceY: positions.get(edge.sourceId)?.y || 0,
        targetX: positions.get(edge.targetId)?.x || 0,
        targetY: positions.get(edge.targetId)?.y || 0,
        width: 1,
        color: [0.4, 0.4, 0.4, 0.8] as [number, number, number, number],
        data: edge
      }));

      renderer.setData(webglNodes, webglEdges);

      // Simulate 60 FPS for 1 second
      const frameCount = 60;
      const frameTargetTime = 1000 / 60; // 16.67ms per frame

      profiler.start('webgl-60fps-test');

      for (let i = 0; i < frameCount; i++) {
        profiler.start(`webgl-frame-${i}`);
        renderer.render();
        profiler.end(`webgl-frame-${i}`);
      }

      profiler.end('webgl-60fps-test');

      // Calculate average frame time
      const frameTimes = Array.from({ length: frameCount }, (_, i) =>
        profiler.getStats(`webgl-frame-${i}`)?.avg || 0
      );

      const avgFrameTime = frameTimes.reduce((sum, time) => sum + time, 0) / frameCount;
      const maxFrameTime = Math.max(...frameTimes);

      expect(avgFrameTime).toBeLessThan(frameTargetTime);
      expect(maxFrameTime).toBeLessThan(frameTargetTime * 2); // Allow some variance

      renderer.dispose();
    });

    it('measures picking performance impact', () => {
      if (!isWebGLSupported()) {
        console.warn('WebGL not supported, skipping WebGL performance tests');
        return;
      }

      const { nodes } = createMockGraphData(5000, 0);
      const positions = new Map();

      nodes.forEach((node, i) => {
        positions.set(node.id, {
          x: (i % 100) * 8,
          y: Math.floor(i / 100) * 8
        });
      });

      const webglNodes = convertNodesToWebGL(nodes, positions);

      // Test without picking
      const rendererNoPicking = new WebGLGraphRenderer(canvas, {
        width: 800,
        height: 600,
        enablePicking: false
      });

      rendererNoPicking.setData(webglNodes, []);

      profiler.start('webgl-no-picking');
      rendererNoPicking.render();
      const noPickingTime = profiler.end('webgl-no-picking');

      rendererNoPicking.dispose();

      // Test with picking
      const rendererWithPicking = new WebGLGraphRenderer(canvas, {
        width: 800,
        height: 600,
        enablePicking: true
      });

      rendererWithPicking.setData(webglNodes, []);

      profiler.start('webgl-with-picking');
      rendererWithPicking.render();
      const withPickingTime = profiler.end('webgl-with-picking');

      rendererWithPicking.dispose();

      // Picking should add minimal overhead
      expect(withPickingTime).toBeLessThan(noPickingTime * 1.5);
    });
  });

  describe('Comparative Performance', () => {
    it('compares D3 vs WebGL for large graphs', () => {
      const graphStore = new GraphStore();
      const { nodes, edges } = createMockGraphData(1000, 1500);

      nodes.forEach(node => graphStore.addNode(node));
      edges.forEach(edge => graphStore.addEdge(edge));

      // Test D3 renderer
      const container = document.createElement('div');
      container.style.width = '800px';
      container.style.height = '600px';
      document.body.appendChild(container);

      const d3Renderer = new D3GraphRenderer(graphStore);

      profiler.start('d3-large-comparison');
      d3Renderer.init(container);
      const d3Time = profiler.end('d3-large-comparison');

      d3Renderer.destroy();
      document.body.removeChild(container);

      // Test WebGL renderer
      if (isWebGLSupported()) {
        const canvas = document.createElement('canvas');
        canvas.width = 800;
        canvas.height = 600;
        document.body.appendChild(canvas);

        const webglRenderer = new WebGLGraphRenderer(canvas, {
          width: 800,
          height: 600
        });

        const positions = new Map();
        nodes.forEach((node, i) => {
          positions.set(node.id, {
            x: (i % 40) * 20,
            y: Math.floor(i / 40) * 20
          });
        });

        const webglNodes = convertNodesToWebGL(nodes, positions);
        const webglEdges = edges.map(edge => ({
          id: edge.id,
          sourceX: positions.get(edge.sourceId)?.x || 0,
          sourceY: positions.get(edge.sourceId)?.y || 0,
          targetX: positions.get(edge.targetId)?.x || 0,
          targetY: positions.get(edge.targetId)?.y || 0,
          width: 1,
          color: [0.5, 0.5, 0.5, 0.8] as [number, number, number, number],
          data: edge
        }));

        profiler.start('webgl-large-comparison');
        webglRenderer.setData(webglNodes, webglEdges);
        webglRenderer.render();
        const webglTime = profiler.end('webgl-large-comparison');

        webglRenderer.dispose();
        document.body.removeChild(canvas);

        // WebGL should be significantly faster for large graphs
        expect(webglTime).toBeLessThan(d3Time * 0.5);

        console.log(`Performance Comparison (1000 nodes):
          D3.js: ${d3Time.toFixed(2)}ms
          WebGL: ${webglTime.toFixed(2)}ms
          WebGL is ${(d3Time / webglTime).toFixed(1)}x faster`);
      }
    });
  });

  describe('Memory Usage Tests', () => {
    it('tracks memory usage during graph operations', async () => {
      const initialMemory = MemoryTester.getMemoryUsage();

      const graphStore = new GraphStore();
      const { nodes, edges } = createMockGraphData(500, 750);

      nodes.forEach(node => graphStore.addNode(node));
      edges.forEach(edge => graphStore.addEdge(edge));

      const container = document.createElement('div');
      container.style.width = '800px';
      container.style.height = '600px';
      document.body.appendChild(container);

      const renderer = new D3GraphRenderer(graphStore);
      renderer.init(container);

      const afterRenderMemory = MemoryTester.getMemoryUsage();

      renderer.destroy();
      document.body.removeChild(container);

      // Force garbage collection if available
      if ('gc' in window) {
        (window as any).gc();
      }

      await new Promise(resolve => setTimeout(resolve, 100));

      const finalMemory = MemoryTester.getMemoryUsage();

      if (initialMemory && afterRenderMemory && finalMemory) {
        const memoryGrowth = afterRenderMemory.used - initialMemory.used;
        const memoryLeaked = finalMemory.used - initialMemory.used;

        console.log(`Memory Usage Test:
          Initial: ${(initialMemory.used / 1024 / 1024).toFixed(2)}MB
          After Render: ${(afterRenderMemory.used / 1024 / 1024).toFixed(2)}MB
          After Cleanup: ${(finalMemory.used / 1024 / 1024).toFixed(2)}MB
          Growth: ${(memoryGrowth / 1024 / 1024).toFixed(2)}MB
          Leaked: ${(memoryLeaked / 1024 / 1024).toFixed(2)}MB`);

        // Memory leak should be minimal (less than 10MB)
        expect(memoryLeaked).toBeLessThan(10 * 1024 * 1024);
      }
    });

    it('detects memory leaks in repeated operations', async () => {
      const memoryTest = await MemoryTester.detectMemoryLeak(
        async () => {
          const graphStore = new GraphStore();
          const { nodes, edges } = createMockGraphData(50, 75);

          nodes.forEach(node => graphStore.addNode(node));
          edges.forEach(edge => graphStore.addEdge(edge));

          const container = document.createElement('div');
          container.style.width = '400px';
          container.style.height = '300px';
          document.body.appendChild(container);

          const renderer = new D3GraphRenderer(graphStore);
          renderer.init(container);
          renderer.update();
          renderer.destroy();

          document.body.removeChild(container);
        },
        20, // 20 iterations
        5 * 1024 * 1024 // 5MB threshold
      );

      expect(memoryTest.leaked).toBe(false);

      if (memoryTest.usage.length > 0) {
        const firstUsage = memoryTest.usage[0].memory;
        const lastUsage = memoryTest.usage[memoryTest.usage.length - 1].memory;
        const growth = lastUsage - firstUsage;

        console.log(`Memory Leak Test:
          First: ${(firstUsage / 1024 / 1024).toFixed(2)}MB
          Last: ${(lastUsage / 1024 / 1024).toFixed(2)}MB
          Growth: ${(growth / 1024 / 1024).toFixed(2)}MB
          Leaked: ${memoryTest.leaked}`);
      }
    });
  });

  describe('Scalability Tests', () => {
    it('measures performance across different graph sizes', () => {
      const sizes = [
        { nodes: 10, edges: 15, name: 'tiny' },
        { nodes: 50, edges: 75, name: 'small' },
        { nodes: 100, edges: 150, name: 'medium' },
        { nodes: 500, edges: 750, name: 'large' }
      ];

      const results: Array<{ size: string; time: number; throughput: number }> = [];

      sizes.forEach(({ nodes: nodeCount, edges: edgeCount, name }) => {
        const graphStore = new GraphStore();
        const { nodes, edges } = createMockGraphData(nodeCount, edgeCount);

        nodes.forEach(node => graphStore.addNode(node));
        edges.forEach(edge => graphStore.addEdge(edge));

        const container = document.createElement('div');
        container.style.width = '800px';
        container.style.height = '600px';
        document.body.appendChild(container);

        const renderer = new D3GraphRenderer(graphStore);

        profiler.start(`scalability-${name}`);
        renderer.init(container);
        const time = profiler.end(`scalability-${name}`);

        const throughput = (nodeCount + edgeCount) / time; // elements per millisecond

        results.push({
          size: `${name} (${nodeCount}n, ${edgeCount}e)`,
          time,
          throughput
        });

        renderer.destroy();
        document.body.removeChild(container);
      });

      console.log('Scalability Test Results:');
      results.forEach(result => {
        console.log(`  ${result.size}: ${result.time.toFixed(2)}ms (${result.throughput.toFixed(3)} elements/ms)`);
      });

      // Verify that performance doesn't degrade exponentially
      const largeResult = results.find(r => r.size.includes('large'));
      const smallResult = results.find(r => r.size.includes('small'));

      if (largeResult && smallResult) {
        const scalingFactor = largeResult.time / smallResult.time;
        const sizeFactor = 500 / 50; // 10x more nodes

        // Time should not scale worse than O(n log n)
        expect(scalingFactor).toBeLessThan(sizeFactor * Math.log10(sizeFactor) * 2);
      }
    });
  });
});