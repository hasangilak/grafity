/**
 * Testing utilities for visual components
 */

import { AnyGraphNode } from '../../core/graph-engine/types/NodeTypes';
import { GraphEdge } from '../../core/graph-engine/types/EdgeTypes';

/**
 * Mock graph data for testing
 */
export const createMockNode = (id: string, overrides: Partial<AnyGraphNode> = {}): AnyGraphNode => ({
  id,
  type: 'code',
  label: `Node ${id}`,
  description: `Description for node ${id}`,
  metadata: {
    createdAt: new Date(),
    updatedAt: new Date(),
    confidence: 0.9,
    source: 'test',
    tags: ['test', 'mock']
  },
  ...overrides
} as AnyGraphNode);

export const createMockEdge = (id: string, sourceId: string, targetId: string, overrides: Partial<GraphEdge> = {}): GraphEdge => ({
  id,
  sourceId,
  targetId,
  type: 'dependency',
  label: `Edge ${id}`,
  weight: 1,
  bidirectional: false,
  metadata: {
    createdAt: new Date(),
    updatedAt: new Date(),
    confidence: 0.8
  },
  ...overrides
});

export const createMockGraphData = (nodeCount: number = 10, edgeCount: number = 15) => {
  const nodes: AnyGraphNode[] = [];
  const edges: GraphEdge[] = [];

  // Create nodes
  for (let i = 0; i < nodeCount; i++) {
    nodes.push(createMockNode(`node-${i}`, {
      type: i % 4 === 0 ? 'code' : i % 4 === 1 ? 'business' : i % 4 === 2 ? 'document' : 'conversation'
    }));
  }

  // Create edges
  for (let i = 0; i < edgeCount; i++) {
    const sourceIndex = i % nodeCount;
    const targetIndex = (i + 1) % nodeCount;
    edges.push(createMockEdge(`edge-${i}`, nodes[sourceIndex].id, nodes[targetIndex].id));
  }

  return { nodes, edges };
};

/**
 * Performance testing utilities
 */
export class PerformanceProfiler {
  private measurements: Map<string, number[]> = new Map();
  private startTimes: Map<string, number> = new Map();

  start(label: string): void {
    this.startTimes.set(label, performance.now());
  }

  end(label: string): number {
    const startTime = this.startTimes.get(label);
    if (!startTime) {
      throw new Error(`No start time found for ${label}`);
    }

    const duration = performance.now() - startTime;

    if (!this.measurements.has(label)) {
      this.measurements.set(label, []);
    }
    this.measurements.get(label)!.push(duration);

    this.startTimes.delete(label);
    return duration;
  }

  getStats(label: string): { min: number; max: number; avg: number; count: number } | null {
    const measurements = this.measurements.get(label);
    if (!measurements || measurements.length === 0) {
      return null;
    }

    return {
      min: Math.min(...measurements),
      max: Math.max(...measurements),
      avg: measurements.reduce((sum, val) => sum + val, 0) / measurements.length,
      count: measurements.length
    };
  }

  clear(): void {
    this.measurements.clear();
    this.startTimes.clear();
  }

  getAllStats(): Record<string, ReturnType<PerformanceProfiler['getStats']>> {
    const stats: Record<string, ReturnType<PerformanceProfiler['getStats']>> = {};
    for (const [label] of this.measurements) {
      stats[label] = this.getStats(label);
    }
    return stats;
  }
}

/**
 * Visual regression testing utilities
 */
export class VisualTester {
  private canvas: HTMLCanvasElement;
  private context: CanvasRenderingContext2D;

  constructor(width: number = 800, height: number = 600) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = width;
    this.canvas.height = height;

    const context = this.canvas.getContext('2d');
    if (!context) {
      throw new Error('Could not get 2D context');
    }
    this.context = context;
  }

  /**
   * Capture screenshot of DOM element
   */
  async captureElement(element: HTMLElement): Promise<ImageData> {
    // Use html2canvas or similar library in real implementation
    // For now, create a mock image data
    const rect = element.getBoundingClientRect();
    this.canvas.width = rect.width;
    this.canvas.height = rect.height;

    // Mock rendering - in real implementation, use html2canvas
    this.context.fillStyle = '#f0f0f0';
    this.context.fillRect(0, 0, rect.width, rect.height);

    return this.context.getImageData(0, 0, rect.width, rect.height);
  }

  /**
   * Compare two images and return difference percentage
   */
  compareImages(image1: ImageData, image2: ImageData): number {
    if (image1.width !== image2.width || image1.height !== image2.height) {
      return 100; // Completely different
    }

    let diffPixels = 0;
    const totalPixels = image1.width * image1.height;

    for (let i = 0; i < image1.data.length; i += 4) {
      const r1 = image1.data[i];
      const g1 = image1.data[i + 1];
      const b1 = image1.data[i + 2];
      const a1 = image1.data[i + 3];

      const r2 = image2.data[i];
      const g2 = image2.data[i + 1];
      const b2 = image2.data[i + 2];
      const a2 = image2.data[i + 3];

      const threshold = 10; // Allow small differences
      if (Math.abs(r1 - r2) > threshold ||
          Math.abs(g1 - g2) > threshold ||
          Math.abs(b1 - b2) > threshold ||
          Math.abs(a1 - a2) > threshold) {
        diffPixels++;
      }
    }

    return (diffPixels / totalPixels) * 100;
  }

  /**
   * Save image data as base64 string
   */
  imageDataToBase64(imageData: ImageData): string {
    this.canvas.width = imageData.width;
    this.canvas.height = imageData.height;
    this.context.putImageData(imageData, 0, 0);
    return this.canvas.toDataURL();
  }

  /**
   * Create diff image highlighting differences
   */
  createDiffImage(image1: ImageData, image2: ImageData): ImageData {
    const diffCanvas = document.createElement('canvas');
    diffCanvas.width = Math.max(image1.width, image2.width);
    diffCanvas.height = Math.max(image1.height, image2.height);

    const diffContext = diffCanvas.getContext('2d')!;
    const diffData = diffContext.createImageData(diffCanvas.width, diffCanvas.height);

    for (let i = 0; i < diffData.data.length; i += 4) {
      const pixelIndex = i / 4;
      const x = pixelIndex % diffCanvas.width;
      const y = Math.floor(pixelIndex / diffCanvas.width);

      const inBounds1 = x < image1.width && y < image1.height;
      const inBounds2 = x < image2.width && y < image2.height;

      if (!inBounds1 || !inBounds2) {
        // Mark out-of-bounds as red
        diffData.data[i] = 255;     // R
        diffData.data[i + 1] = 0;   // G
        diffData.data[i + 2] = 0;   // B
        diffData.data[i + 3] = 255; // A
        continue;
      }

      const index1 = (y * image1.width + x) * 4;
      const index2 = (y * image2.width + x) * 4;

      const r1 = image1.data[index1];
      const g1 = image1.data[index1 + 1];
      const b1 = image1.data[index1 + 2];

      const r2 = image2.data[index2];
      const g2 = image2.data[index2 + 1];
      const b2 = image2.data[index2 + 2];

      const threshold = 10;
      const isDifferent = Math.abs(r1 - r2) > threshold ||
                         Math.abs(g1 - g2) > threshold ||
                         Math.abs(b1 - b2) > threshold;

      if (isDifferent) {
        // Highlight differences in red
        diffData.data[i] = 255;     // R
        diffData.data[i + 1] = 0;   // G
        diffData.data[i + 2] = 0;   // B
        diffData.data[i + 3] = 255; // A
      } else {
        // Keep original color with reduced opacity
        diffData.data[i] = r1;
        diffData.data[i + 1] = g1;
        diffData.data[i + 2] = b1;
        diffData.data[i + 3] = 128; // Reduced alpha
      }
    }

    return diffData;
  }
}

/**
 * Animation testing utilities
 */
export class AnimationTester {
  private frameCallbacks: Array<(time: number) => void> = [];
  private isRunning = false;
  private currentTime = 0;
  private frameId: number | null = null;

  /**
   * Start animation loop
   */
  start(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    this.currentTime = performance.now();
    this.tick();
  }

  /**
   * Stop animation loop
   */
  stop(): void {
    this.isRunning = false;
    if (this.frameId) {
      cancelAnimationFrame(this.frameId);
      this.frameId = null;
    }
  }

  /**
   * Add frame callback
   */
  onFrame(callback: (time: number) => void): () => void {
    this.frameCallbacks.push(callback);
    return () => {
      const index = this.frameCallbacks.indexOf(callback);
      if (index >= 0) {
        this.frameCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Simulate time passage
   */
  advance(deltaTime: number): void {
    this.currentTime += deltaTime;
    this.frameCallbacks.forEach(callback => callback(this.currentTime));
  }

  /**
   * Wait for animation to complete
   */
  async waitForCompletion(duration: number): Promise<void> {
    return new Promise(resolve => {
      const startTime = this.currentTime;
      const checkCompletion = () => {
        if (this.currentTime - startTime >= duration) {
          resolve();
        } else {
          this.frameId = requestAnimationFrame(checkCompletion);
        }
      };
      checkCompletion();
    });
  }

  private tick = (): void => {
    if (!this.isRunning) return;

    const newTime = performance.now();
    this.currentTime = newTime;

    this.frameCallbacks.forEach(callback => callback(newTime));

    this.frameId = requestAnimationFrame(this.tick);
  };
}

/**
 * Interaction testing utilities
 */
export class InteractionTester {
  /**
   * Simulate mouse event
   */
  static mouseEvent(
    element: Element,
    type: 'click' | 'mousedown' | 'mouseup' | 'mousemove' | 'mouseenter' | 'mouseleave',
    options: Partial<MouseEventInit> = {}
  ): void {
    const event = new MouseEvent(type, {
      bubbles: true,
      cancelable: true,
      clientX: 100,
      clientY: 100,
      ...options
    });
    element.dispatchEvent(event);
  }

  /**
   * Simulate keyboard event
   */
  static keyboardEvent(
    element: Element,
    type: 'keydown' | 'keyup' | 'keypress',
    key: string,
    options: Partial<KeyboardEventInit> = {}
  ): void {
    const event = new KeyboardEvent(type, {
      bubbles: true,
      cancelable: true,
      key,
      ...options
    });
    element.dispatchEvent(event);
  }

  /**
   * Simulate touch event
   */
  static touchEvent(
    element: Element,
    type: 'touchstart' | 'touchmove' | 'touchend',
    touches: Array<{ clientX: number; clientY: number }> = [{ clientX: 100, clientY: 100 }]
  ): void {
    const touchList = touches.map(touch => new Touch({
      identifier: Math.random(),
      target: element,
      clientX: touch.clientX,
      clientY: touch.clientY
    }));

    const event = new TouchEvent(type, {
      bubbles: true,
      cancelable: true,
      touches: touchList,
      targetTouches: touchList,
      changedTouches: touchList
    });
    element.dispatchEvent(event);
  }

  /**
   * Simulate drag operation
   */
  static async simulateDrag(
    element: Element,
    from: { x: number; y: number },
    to: { x: number; y: number },
    steps: number = 10
  ): Promise<void> {
    // Start drag
    this.mouseEvent(element, 'mousedown', { clientX: from.x, clientY: from.y });

    // Intermediate steps
    for (let i = 1; i <= steps; i++) {
      const progress = i / steps;
      const x = from.x + (to.x - from.x) * progress;
      const y = from.y + (to.y - from.y) * progress;

      this.mouseEvent(element, 'mousemove', { clientX: x, clientY: y });
      await new Promise(resolve => setTimeout(resolve, 16)); // 60fps
    }

    // End drag
    this.mouseEvent(element, 'mouseup', { clientX: to.x, clientY: to.y });
  }
}

/**
 * Viewport testing utilities
 */
export class ViewportTester {
  /**
   * Set viewport size
   */
  static setViewportSize(width: number, height: number): void {
    // Mock viewport change
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: width,
    });
    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: height,
    });

    // Trigger resize event
    window.dispatchEvent(new Event('resize'));
  }

  /**
   * Test responsive behavior
   */
  static async testResponsive(
    element: HTMLElement,
    sizes: Array<{ width: number; height: number; name: string }>,
    callback: (size: { width: number; height: number; name: string }) => void | Promise<void>
  ): Promise<void> {
    for (const size of sizes) {
      this.setViewportSize(size.width, size.height);
      await new Promise(resolve => setTimeout(resolve, 100)); // Allow layout
      await callback(size);
    }
  }
}

/**
 * Memory testing utilities
 */
export class MemoryTester {
  /**
   * Get memory usage (if available)
   */
  static getMemoryUsage(): { used: number; total: number } | null {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      return {
        used: memory.usedJSHeapSize,
        total: memory.totalJSHeapSize
      };
    }
    return null;
  }

  /**
   * Test for memory leaks
   */
  static async detectMemoryLeak(
    operation: () => void | Promise<void>,
    iterations: number = 100,
    threshold: number = 10 * 1024 * 1024 // 10MB
  ): Promise<{ leaked: boolean; usage: Array<{ iteration: number; memory: number }> }> {
    const usageData: Array<{ iteration: number; memory: number }> = [];

    for (let i = 0; i < iterations; i++) {
      await operation();

      // Force garbage collection if available
      if ('gc' in window) {
        (window as any).gc();
      }

      const memory = this.getMemoryUsage();
      if (memory) {
        usageData.push({ iteration: i, memory: memory.used });
      }

      // Small delay to allow cleanup
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    // Check for consistent memory growth
    if (usageData.length < 2) {
      return { leaked: false, usage: usageData };
    }

    const firstMemory = usageData[0].memory;
    const lastMemory = usageData[usageData.length - 1].memory;
    const memoryGrowth = lastMemory - firstMemory;

    return {
      leaked: memoryGrowth > threshold,
      usage: usageData
    };
  }
}