/**
 * Tests for WebGLGraphRenderer
 */

import { WebGLGraphRenderer, isWebGLSupported, hexToRGBA, convertNodesToWebGL } from '../renderers/WebGLGraphRenderer';
import { createMockGraphData, PerformanceProfiler, MemoryTester } from './TestUtils';

// Mock WebGL context
const mockWebGLContext = {
  VERTEX_SHADER: 35633,
  FRAGMENT_SHADER: 35632,
  COMPILE_STATUS: 35713,
  LINK_STATUS: 35714,
  COLOR_BUFFER_BIT: 16384,
  DEPTH_BUFFER_BIT: 256,
  BLEND: 3042,
  DEPTH_TEST: 2929,
  SRC_ALPHA: 770,
  ONE_MINUS_SRC_ALPHA: 771,
  LEQUAL: 515,
  ARRAY_BUFFER: 34962,
  STATIC_DRAW: 35044,
  DYNAMIC_DRAW: 35048,
  FLOAT: 5126,
  TRIANGLE_STRIP: 5,
  TEXTURE_2D: 3553,
  RGBA: 6408,
  UNSIGNED_BYTE: 5121,
  NEAREST: 9728,
  FRAMEBUFFER: 36160,
  RENDERBUFFER: 36161,
  COLOR_ATTACHMENT0: 36064,
  DEPTH_ATTACHMENT: 36096,
  DEPTH_COMPONENT16: 33189,

  createShader: jest.fn(() => ({})),
  shaderSource: jest.fn(),
  compileShader: jest.fn(),
  getShaderParameter: jest.fn(() => true),
  getShaderInfoLog: jest.fn(() => ''),
  createProgram: jest.fn(() => ({})),
  attachShader: jest.fn(),
  linkProgram: jest.fn(),
  getProgramParameter: jest.fn(() => true),
  getProgramInfoLog: jest.fn(() => ''),
  useProgram: jest.fn(),
  getAttribLocation: jest.fn(() => 0),
  getUniformLocation: jest.fn(() => ({})),
  enableVertexAttribArray: jest.fn(),
  vertexAttribPointer: jest.fn(),
  uniform1f: jest.fn(),
  uniform1i: jest.fn(),
  uniformMatrix4fv: jest.fn(),
  createBuffer: jest.fn(() => ({})),
  bindBuffer: jest.fn(),
  bufferData: jest.fn(),
  createTexture: jest.fn(() => ({})),
  createFramebuffer: jest.fn(() => ({})),
  createRenderbuffer: jest.fn(() => ({})),
  bindTexture: jest.fn(),
  bindFramebuffer: jest.fn(),
  bindRenderbuffer: jest.fn(),
  texImage2D: jest.fn(),
  texParameteri: jest.fn(),
  renderbufferStorage: jest.fn(),
  framebufferTexture2D: jest.fn(),
  framebufferRenderbuffer: jest.fn(),
  viewport: jest.fn(),
  enable: jest.fn(),
  blendFunc: jest.fn(),
  depthFunc: jest.fn(),
  clearColor: jest.fn(),
  clear: jest.fn(),
  drawArrays: jest.fn(),
  readPixels: jest.fn(),
  deleteProgram: jest.fn(),
  deleteBuffer: jest.fn(),
  deleteTexture: jest.fn(),
  deleteFramebuffer: jest.fn(),
  deleteRenderbuffer: jest.fn()
};

// Mock Canvas and WebGL
Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
  value: jest.fn((contextType) => {
    if (contextType === 'webgl' || contextType === 'experimental-webgl') {
      return mockWebGLContext;
    }
    return null;
  })
});

describe('WebGLGraphRenderer', () => {
  let canvas: HTMLCanvasElement;
  let renderer: WebGLGraphRenderer;
  let profiler: PerformanceProfiler;

  beforeEach(() => {
    canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;
    document.body.appendChild(canvas);

    profiler = new PerformanceProfiler();

    renderer = new WebGLGraphRenderer(canvas, {
      width: 800,
      height: 600,
      enablePicking: true
    });
  });

  afterEach(() => {
    if (renderer) {
      renderer.dispose();
    }
    if (canvas.parentNode) {
      document.body.removeChild(canvas);
    }
    profiler.clear();
  });

  describe('Initialization', () => {
    it('initializes WebGL renderer successfully', () => {
      expect(renderer).toBeInstanceOf(WebGLGraphRenderer);
    });

    it('throws error when WebGL is not available', () => {
      // Mock getContext to return null
      const mockCanvas = document.createElement('canvas');
      mockCanvas.getContext = jest.fn(() => null);

      expect(() => {
        new WebGLGraphRenderer(mockCanvas, { width: 800, height: 600 });
      }).toThrow('WebGL not supported in this browser');
    });

    it('initializes with custom options', () => {
      const customRenderer = new WebGLGraphRenderer(canvas, {
        width: 1200,
        height: 800,
        devicePixelRatio: 2,
        antialias: false,
        maxNodes: 100000,
        maxEdges: 200000,
        enablePicking: false
      });

      expect(customRenderer).toBeInstanceOf(WebGLGraphRenderer);
      customRenderer.dispose();
    });
  });

  describe('Data Management', () => {
    it('sets node and edge data correctly', () => {
      const { nodes, edges } = createMockGraphData(100, 150);
      const positions = new Map();

      nodes.forEach((node, i) => {
        positions.set(node.id, { x: i * 10, y: i * 5 });
      });

      const webglNodes = convertNodesToWebGL(nodes, positions);
      const webglEdges = edges.map(edge => ({
        id: edge.id,
        sourceX: positions.get(edge.sourceId)?.x || 0,
        sourceY: positions.get(edge.sourceId)?.y || 0,
        targetX: positions.get(edge.targetId)?.x || 0,
        targetY: positions.get(edge.targetId)?.y || 0,
        width: 2,
        color: [0.5, 0.5, 0.5, 1] as [number, number, number, number],
        data: edge
      }));

      profiler.start('set-data');
      renderer.setData(webglNodes, webglEdges);
      profiler.end('set-data');

      const stats = renderer.getStats();
      expect(stats.nodeCount).toBe(nodes.length);
      expect(stats.edgeCount).toBe(edges.length);
    });

    it('handles large datasets efficiently', () => {
      const { nodes, edges } = createMockGraphData(10000, 15000);
      const positions = new Map();

      nodes.forEach((node, i) => {
        positions.set(node.id, {
          x: Math.random() * 1000,
          y: Math.random() * 1000
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

      profiler.start('large-dataset');
      renderer.setData(webglNodes, webglEdges);
      profiler.end('large-dataset');

      const setDataTime = profiler.getStats('large-dataset');
      expect(setDataTime?.avg).toBeLessThan(1000); // Should handle large data quickly
    });

    it('respects max node and edge limits', () => {
      const limitedRenderer = new WebGLGraphRenderer(canvas, {
        width: 800,
        height: 600,
        maxNodes: 50,
        maxEdges: 75
      });

      const { nodes, edges } = createMockGraphData(100, 150);
      const positions = new Map();

      nodes.forEach((node, i) => {
        positions.set(node.id, { x: i * 10, y: i * 5 });
      });

      const webglNodes = convertNodesToWebGL(nodes, positions);
      const webglEdges = edges.map(edge => ({
        id: edge.id,
        sourceX: positions.get(edge.sourceId)?.x || 0,
        sourceY: positions.get(edge.sourceId)?.y || 0,
        targetX: positions.get(edge.targetId)?.x || 0,
        targetY: positions.get(edge.targetId)?.y || 0,
        width: 1,
        color: [0.5, 0.5, 0.5, 1] as [number, number, number, number],
        data: edge
      }));

      limitedRenderer.setData(webglNodes, webglEdges);

      const stats = limitedRenderer.getStats();
      expect(stats.nodeCount).toBe(50);
      expect(stats.edgeCount).toBe(75);

      limitedRenderer.dispose();
    });
  });

  describe('Rendering Performance', () => {
    it('renders small graphs efficiently', () => {
      const { nodes, edges } = createMockGraphData(50, 75);
      const positions = new Map();

      nodes.forEach((node, i) => {
        positions.set(node.id, { x: i * 10, y: i * 5 });
      });

      const webglNodes = convertNodesToWebGL(nodes, positions);
      const webglEdges = edges.map(edge => ({
        id: edge.id,
        sourceX: positions.get(edge.sourceId)?.x || 0,
        sourceY: positions.get(edge.sourceId)?.y || 0,
        targetX: positions.get(edge.targetId)?.x || 0,
        targetY: positions.get(edge.targetId)?.y || 0,
        width: 1,
        color: [0.5, 0.5, 0.5, 1] as [number, number, number, number],
        data: edge
      }));

      renderer.setData(webglNodes, webglEdges);

      profiler.start('render-small');
      renderer.render();
      profiler.end('render-small');

      const renderTime = profiler.getStats('render-small');
      expect(renderTime?.avg).toBeLessThan(50); // Should be very fast
    });

    it('handles multiple render calls efficiently', () => {
      const { nodes, edges } = createMockGraphData(100, 150);
      const positions = new Map();

      nodes.forEach((node, i) => {
        positions.set(node.id, { x: i * 10, y: i * 5 });
      });

      const webglNodes = convertNodesToWebGL(nodes, positions);
      const webglEdges = edges.map(edge => ({
        id: edge.id,
        sourceX: positions.get(edge.sourceId)?.x || 0,
        sourceY: positions.get(edge.sourceId)?.y || 0,
        targetX: positions.get(edge.targetId)?.x || 0,
        targetY: positions.get(edge.targetId)?.y || 0,
        width: 1,
        color: [0.5, 0.5, 0.5, 1] as [number, number, number, number],
        data: edge
      }));

      renderer.setData(webglNodes, webglEdges);

      profiler.start('multiple-renders');
      for (let i = 0; i < 60; i++) { // Simulate 60 FPS for 1 second
        renderer.render();
      }
      profiler.end('multiple-renders');

      const renderTime = profiler.getStats('multiple-renders');
      expect(renderTime?.avg).toBeLessThan(1000); // Should maintain good FPS
    });
  });

  describe('Transform Operations', () => {
    it('sets transform correctly', () => {
      renderer.setTransform(100, 50, 2.0);

      // Transform is internal state, test that it doesn't throw
      expect(() => {
        renderer.render();
      }).not.toThrow();
    });

    it('handles extreme transform values', () => {
      const extremeTransforms = [
        { x: -10000, y: -10000, scale: 0.01 },
        { x: 10000, y: 10000, scale: 100 },
        { x: 0, y: 0, scale: 1 }
      ];

      extremeTransforms.forEach(transform => {
        expect(() => {
          renderer.setTransform(transform.x, transform.y, transform.scale);
          renderer.render();
        }).not.toThrow();
      });
    });
  });

  describe('Picking System', () => {
    it('initializes picking system when enabled', () => {
      const pickingRenderer = new WebGLGraphRenderer(canvas, {
        width: 800,
        height: 600,
        enablePicking: true
      });

      expect(pickingRenderer).toBeInstanceOf(WebGLGraphRenderer);
      pickingRenderer.dispose();
    });

    it('handles picking operations', () => {
      const { nodes } = createMockGraphData(10, 0);
      const positions = new Map();

      nodes.forEach((node, i) => {
        positions.set(node.id, { x: i * 50, y: 100 });
      });

      const webglNodes = convertNodesToWebGL(nodes, positions);
      renderer.setData(webglNodes, []);

      // Mock readPixels to return a valid node ID
      (mockWebGLContext.readPixels as jest.Mock).mockImplementation((x, y, w, h, format, type, pixels) => {
        pixels[0] = 0; // Node ID 0
        pixels[1] = 0;
        pixels[2] = 0;
        pixels[3] = 255;
      });

      const pickedNode = renderer.pick(100, 100);
      expect(pickedNode).toBeTruthy();
    });

    it('returns null when picking empty space', () => {
      const { nodes } = createMockGraphData(10, 0);
      const positions = new Map();

      nodes.forEach((node, i) => {
        positions.set(node.id, { x: i * 50, y: 100 });
      });

      const webglNodes = convertNodesToWebGL(nodes, positions);
      renderer.setData(webglNodes, []);

      // Mock readPixels to return no node
      (mockWebGLContext.readPixels as jest.Mock).mockImplementation((x, y, w, h, format, type, pixels) => {
        pixels[0] = 255; // Invalid node ID
        pixels[1] = 255;
        pixels[2] = 255;
        pixels[3] = 255;
      });

      const pickedNode = renderer.pick(500, 500);
      expect(pickedNode).toBeNull();
    });
  });

  describe('Resize Operations', () => {
    it('handles resize correctly', () => {
      renderer.resize(1200, 800);

      expect(() => {
        renderer.render();
      }).not.toThrow();
    });

    it('handles multiple resize operations', () => {
      const sizes = [
        { width: 400, height: 300 },
        { width: 800, height: 600 },
        { width: 1600, height: 1200 },
        { width: 800, height: 600 }
      ];

      sizes.forEach(size => {
        expect(() => {
          renderer.resize(size.width, size.height);
          renderer.render();
        }).not.toThrow();
      });
    });
  });

  describe('Memory Management', () => {
    it('reports memory usage correctly', () => {
      const { nodes, edges } = createMockGraphData(100, 150);
      const positions = new Map();

      nodes.forEach((node, i) => {
        positions.set(node.id, { x: i * 10, y: i * 5 });
      });

      const webglNodes = convertNodesToWebGL(nodes, positions);
      const webglEdges = edges.map(edge => ({
        id: edge.id,
        sourceX: positions.get(edge.sourceId)?.x || 0,
        sourceY: positions.get(edge.sourceId)?.y || 0,
        targetX: positions.get(edge.targetId)?.x || 0,
        targetY: positions.get(edge.targetId)?.y || 0,
        width: 1,
        color: [0.5, 0.5, 0.5, 1] as [number, number, number, number],
        data: edge
      }));

      renderer.setData(webglNodes, webglEdges);

      const stats = renderer.getStats();
      expect(stats.gpuMemoryUsage).toBeGreaterThan(0);
      expect(stats.isWebGLSupported).toBe(true);
    });

    it('cleans up resources on dispose', async () => {
      const memoryTest = await MemoryTester.detectMemoryLeak(
        () => {
          const testRenderer = new WebGLGraphRenderer(canvas, {
            width: 800,
            height: 600
          });
          testRenderer.dispose();
        },
        10,
        1024 * 1024 // 1MB threshold
      );

      expect(memoryTest.leaked).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('handles shader compilation errors gracefully', () => {
      // Mock shader compilation failure
      const failingContext = {
        ...mockWebGLContext,
        getShaderParameter: jest.fn(() => false),
        getShaderInfoLog: jest.fn(() => 'Shader compilation failed')
      };

      const mockCanvas = document.createElement('canvas');
      mockCanvas.getContext = jest.fn(() => failingContext);

      expect(() => {
        new WebGLGraphRenderer(mockCanvas, { width: 800, height: 600 });
      }).toThrow();
    });

    it('handles program linking errors gracefully', () => {
      // Mock program linking failure
      const failingContext = {
        ...mockWebGLContext,
        getProgramParameter: jest.fn(() => false),
        getProgramInfoLog: jest.fn(() => 'Program linking failed')
      };

      const mockCanvas = document.createElement('canvas');
      mockCanvas.getContext = jest.fn(() => failingContext);

      expect(() => {
        new WebGLGraphRenderer(mockCanvas, { width: 800, height: 600 });
      }).toThrow();
    });
  });
});

describe('Utility Functions', () => {
  describe('isWebGLSupported', () => {
    it('detects WebGL support correctly', () => {
      const supported = isWebGLSupported();
      expect(typeof supported).toBe('boolean');
    });
  });

  describe('hexToRGBA', () => {
    it('converts hex colors correctly', () => {
      expect(hexToRGBA('#FF0000')).toEqual([1, 0, 0, 1]);
      expect(hexToRGBA('#00FF00')).toEqual([0, 1, 0, 1]);
      expect(hexToRGBA('#0000FF')).toEqual([0, 0, 1, 1]);
      expect(hexToRGBA('#FFFFFF')).toEqual([1, 1, 1, 1]);
      expect(hexToRGBA('#000000')).toEqual([0, 0, 0, 1]);
    });

    it('handles alpha channel correctly', () => {
      expect(hexToRGBA('#FF0000', 0.5)).toEqual([1, 0, 0, 0.5]);
      expect(hexToRGBA('#00FF00', 0)).toEqual([0, 1, 0, 0]);
    });
  });

  describe('convertNodesToWebGL', () => {
    it('converts nodes correctly', () => {
      const { nodes } = createMockGraphData(5, 0);
      const positions = new Map();

      nodes.forEach((node, i) => {
        positions.set(node.id, { x: i * 10, y: i * 5 });
      });

      const webglNodes = convertNodesToWebGL(nodes, positions);

      expect(webglNodes).toHaveLength(5);
      webglNodes.forEach((webglNode, i) => {
        expect(webglNode.id).toBe(nodes[i].id);
        expect(webglNode.x).toBe(i * 10);
        expect(webglNode.y).toBe(i * 5);
        expect(webglNode.color).toHaveLength(4);
      });
    });

    it('uses custom color and size functions', () => {
      const { nodes } = createMockGraphData(3, 0);
      const positions = new Map();

      nodes.forEach((node, i) => {
        positions.set(node.id, { x: i * 10, y: i * 5 });
      });

      const getColor = (node: any) => node.type === 'code' ? '#FF0000' : '#00FF00';
      const getSize = (node: any) => node.type === 'code' ? 16 : 8;

      const webglNodes = convertNodesToWebGL(nodes, positions, getColor, getSize);

      webglNodes.forEach(webglNode => {
        if (webglNode.data.type === 'code') {
          expect(webglNode.color).toEqual([1, 0, 0, 1]);
          expect(webglNode.size).toBe(16);
        } else {
          expect(webglNode.color).toEqual([0, 1, 0, 1]);
          expect(webglNode.size).toBe(8);
        }
      });
    });
  });
});