/**
 * WebGL Graph Renderer for high-performance visualization of large graphs
 * Optimized for rendering 10,000+ nodes and edges efficiently
 */

import { AnyGraphNode } from '../../core/graph-engine/types/NodeTypes';
import { GraphEdge } from '../../core/graph-engine/types/EdgeTypes';

export interface WebGLNode {
  id: string;
  x: number;
  y: number;
  size: number;
  color: [number, number, number, number]; // RGBA
  data: AnyGraphNode;
  selected?: boolean;
  hovered?: boolean;
}

export interface WebGLEdge {
  id: string;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  width: number;
  color: [number, number, number, number]; // RGBA
  data: GraphEdge;
}

export interface WebGLRenderOptions {
  width: number;
  height: number;
  devicePixelRatio?: number;
  antialias?: boolean;
  preserveDrawingBuffer?: boolean;
  maxNodes?: number;
  maxEdges?: number;
  enablePicking?: boolean;
}

/**
 * High-performance WebGL renderer for large graphs
 */
export class WebGLGraphRenderer {
  private canvas: HTMLCanvasElement;
  private gl: WebGLRenderingContext;
  private options: Required<WebGLRenderOptions>;

  // Shader programs
  private nodeProgram: WebGLProgram | null = null;
  private edgeProgram: WebGLProgram | null = null;

  // Buffers
  private nodeBuffer: WebGLBuffer | null = null;
  private edgeBuffer: WebGLBuffer | null = null;
  private nodeInstanceBuffer: WebGLBuffer | null = null;
  private edgeInstanceBuffer: WebGLBuffer | null = null;

  // Textures for advanced rendering
  private nodeTexture: WebGLTexture | null = null;

  // Data arrays
  private nodes: WebGLNode[] = [];
  private edges: WebGLEdge[] = [];
  private nodeData: Float32Array = new Float32Array(0);
  private edgeData: Float32Array = new Float32Array(0);

  // Transform matrices
  private viewMatrix: Float32Array = new Float32Array(16);
  private projectionMatrix: Float32Array = new Float32Array(16);

  // Picking support
  private pickingFramebuffer: WebGLFramebuffer | null = null;
  private pickingTexture: WebGLTexture | null = null;
  private pickingRenderbuffer: WebGLRenderbuffer | null = null;

  constructor(canvas: HTMLCanvasElement, options: WebGLRenderOptions) {
    this.canvas = canvas;
    this.options = {
      width: options.width,
      height: options.height,
      devicePixelRatio: options.devicePixelRatio || window.devicePixelRatio || 1,
      antialias: options.antialias !== false,
      preserveDrawingBuffer: options.preserveDrawingBuffer || false,
      maxNodes: options.maxNodes || 50000,
      maxEdges: options.maxEdges || 100000,
      enablePicking: options.enablePicking !== false
    };

    // Initialize WebGL context
    const gl = canvas.getContext('webgl', {
      antialias: this.options.antialias,
      preserveDrawingBuffer: this.options.preserveDrawingBuffer,
      alpha: true,
      premultipliedAlpha: false
    });

    if (!gl) {
      throw new Error('WebGL not supported in this browser');
    }

    this.gl = gl;
    this.initialize();
  }

  /**
   * Initialize WebGL resources
   */
  private initialize(): void {
    this.setupCanvas();
    this.createShaderPrograms();
    this.createBuffers();
    this.setupMatrices();

    if (this.options.enablePicking) {
      this.setupPicking();
    }

    // Enable blending for transparency
    this.gl.enable(this.gl.BLEND);
    this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);

    // Enable depth testing
    this.gl.enable(this.gl.DEPTH_TEST);
    this.gl.depthFunc(this.gl.LEQUAL);
  }

  /**
   * Setup canvas dimensions
   */
  private setupCanvas(): void {
    const { width, height, devicePixelRatio } = this.options;

    this.canvas.width = width * devicePixelRatio;
    this.canvas.height = height * devicePixelRatio;
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;

    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  }

  /**
   * Create shader programs
   */
  private createShaderPrograms(): void {
    // Node vertex shader
    const nodeVertexShader = `
      attribute vec2 a_position;
      attribute vec2 a_offset;
      attribute float a_size;
      attribute vec4 a_color;
      attribute float a_nodeId;

      uniform mat4 u_viewMatrix;
      uniform mat4 u_projectionMatrix;
      uniform float u_pixelRatio;

      varying vec4 v_color;
      varying vec2 v_uv;
      varying float v_nodeId;

      void main() {
        v_color = a_color;
        v_uv = a_position;
        v_nodeId = a_nodeId;

        vec2 scaledPosition = a_position * a_size * u_pixelRatio;
        vec4 worldPosition = u_viewMatrix * vec4(a_offset + scaledPosition, 0.0, 1.0);
        gl_Position = u_projectionMatrix * worldPosition;
      }
    `;

    // Node fragment shader
    const nodeFragmentShader = `
      precision mediump float;

      varying vec4 v_color;
      varying vec2 v_uv;
      varying float v_nodeId;

      uniform bool u_picking;

      void main() {
        // Create circular node
        float dist = length(v_uv);
        if (dist > 1.0) discard;

        if (u_picking) {
          // Encode node ID for picking
          float id = v_nodeId / 65536.0;
          gl_FragColor = vec4(id, fract(id * 256.0), fract(id * 65536.0), 1.0);
        } else {
          // Normal rendering with anti-aliasing
          float alpha = v_color.a * (1.0 - smoothstep(0.8, 1.0, dist));
          gl_FragColor = vec4(v_color.rgb, alpha);
        }
      }
    `;

    // Edge vertex shader
    const edgeVertexShader = `
      attribute vec2 a_position;
      attribute vec2 a_start;
      attribute vec2 a_end;
      attribute float a_width;
      attribute vec4 a_color;

      uniform mat4 u_viewMatrix;
      uniform mat4 u_projectionMatrix;
      uniform float u_pixelRatio;

      varying vec4 v_color;
      varying vec2 v_uv;

      void main() {
        v_color = a_color;
        v_uv = a_position;

        vec2 direction = normalize(a_end - a_start);
        vec2 normal = vec2(-direction.y, direction.x);

        vec2 worldPosition = mix(a_start, a_end, a_position.x) + normal * a_position.y * a_width * u_pixelRatio;

        vec4 viewPosition = u_viewMatrix * vec4(worldPosition, 0.0, 1.0);
        gl_Position = u_projectionMatrix * viewPosition;
      }
    `;

    // Edge fragment shader
    const edgeFragmentShader = `
      precision mediump float;

      varying vec4 v_color;
      varying vec2 v_uv;

      void main() {
        // Anti-aliased edge rendering
        float alpha = v_color.a * (1.0 - smoothstep(0.8, 1.0, abs(v_uv.y)));
        gl_FragColor = vec4(v_color.rgb, alpha);
      }
    `;

    this.nodeProgram = this.createProgram(nodeVertexShader, nodeFragmentShader);
    this.edgeProgram = this.createProgram(edgeVertexShader, edgeFragmentShader);
  }

  /**
   * Create WebGL shader program
   */
  private createProgram(vertexSource: string, fragmentSource: string): WebGLProgram {
    const vertexShader = this.createShader(this.gl.VERTEX_SHADER, vertexSource);
    const fragmentShader = this.createShader(this.gl.FRAGMENT_SHADER, fragmentSource);

    const program = this.gl.createProgram();
    if (!program) throw new Error('Failed to create WebGL program');

    this.gl.attachShader(program, vertexShader);
    this.gl.attachShader(program, fragmentShader);
    this.gl.linkProgram(program);

    if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
      const error = this.gl.getProgramInfoLog(program);
      this.gl.deleteProgram(program);
      throw new Error(`Failed to link program: ${error}`);
    }

    return program;
  }

  /**
   * Create WebGL shader
   */
  private createShader(type: number, source: string): WebGLShader {
    const shader = this.gl.createShader(type);
    if (!shader) throw new Error('Failed to create shader');

    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);

    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      const error = this.gl.getShaderInfoLog(shader);
      this.gl.deleteShader(shader);
      throw new Error(`Failed to compile shader: ${error}`);
    }

    return shader;
  }

  /**
   * Create vertex buffers
   */
  private createBuffers(): void {
    // Node geometry (quad)
    const nodeVertices = new Float32Array([
      -1, -1,
       1, -1,
      -1,  1,
       1,  1
    ]);

    this.nodeBuffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.nodeBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, nodeVertices, this.gl.STATIC_DRAW);

    // Edge geometry (quad)
    const edgeVertices = new Float32Array([
      0, -1,
      1, -1,
      0,  1,
      1,  1
    ]);

    this.edgeBuffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.edgeBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, edgeVertices, this.gl.STATIC_DRAW);

    // Instance buffers (will be populated with data)
    this.nodeInstanceBuffer = this.gl.createBuffer();
    this.edgeInstanceBuffer = this.gl.createBuffer();
  }

  /**
   * Setup transformation matrices
   */
  private setupMatrices(): void {
    // Orthographic projection matrix
    const left = 0;
    const right = this.options.width;
    const bottom = this.options.height;
    const top = 0;
    const near = -1;
    const far = 1;

    this.projectionMatrix[0] = 2 / (right - left);
    this.projectionMatrix[5] = 2 / (top - bottom);
    this.projectionMatrix[10] = -2 / (far - near);
    this.projectionMatrix[12] = -(right + left) / (right - left);
    this.projectionMatrix[13] = -(top + bottom) / (top - bottom);
    this.projectionMatrix[14] = -(far + near) / (far - near);
    this.projectionMatrix[15] = 1;

    // Identity view matrix (will be updated during rendering)
    this.viewMatrix.fill(0);
    this.viewMatrix[0] = this.viewMatrix[5] = this.viewMatrix[10] = this.viewMatrix[15] = 1;
  }

  /**
   * Setup picking framebuffer
   */
  private setupPicking(): void {
    if (!this.options.enablePicking) return;

    this.pickingFramebuffer = this.gl.createFramebuffer();
    this.pickingTexture = this.gl.createTexture();
    this.pickingRenderbuffer = this.gl.createRenderbuffer();

    // Setup picking texture
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.pickingTexture);
    this.gl.texImage2D(
      this.gl.TEXTURE_2D, 0, this.gl.RGBA,
      this.canvas.width, this.canvas.height, 0,
      this.gl.RGBA, this.gl.UNSIGNED_BYTE, null
    );
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.NEAREST);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.NEAREST);

    // Setup depth renderbuffer
    this.gl.bindRenderbuffer(this.gl.RENDERBUFFER, this.pickingRenderbuffer);
    this.gl.renderbufferStorage(this.gl.RENDERBUFFER, this.gl.DEPTH_COMPONENT16, this.canvas.width, this.canvas.height);

    // Attach to framebuffer
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.pickingFramebuffer);
    this.gl.framebufferTexture2D(this.gl.FRAMEBUFFER, this.gl.COLOR_ATTACHMENT0, this.gl.TEXTURE_2D, this.pickingTexture, 0);
    this.gl.framebufferRenderbuffer(this.gl.FRAMEBUFFER, this.gl.DEPTH_ATTACHMENT, this.gl.RENDERBUFFER, this.pickingRenderbuffer);

    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
  }

  /**
   * Update graph data
   */
  setData(nodes: WebGLNode[], edges: WebGLEdge[]): void {
    this.nodes = nodes.slice(0, this.options.maxNodes);
    this.edges = edges.slice(0, this.options.maxEdges);

    this.updateNodeBuffer();
    this.updateEdgeBuffer();
  }

  /**
   * Update node instance buffer
   */
  private updateNodeBuffer(): void {
    const stride = 8; // x, y, size, r, g, b, a, id
    this.nodeData = new Float32Array(this.nodes.length * stride);

    this.nodes.forEach((node, i) => {
      const offset = i * stride;
      this.nodeData[offset] = node.x;
      this.nodeData[offset + 1] = node.y;
      this.nodeData[offset + 2] = node.size;
      this.nodeData[offset + 3] = node.color[0];
      this.nodeData[offset + 4] = node.color[1];
      this.nodeData[offset + 5] = node.color[2];
      this.nodeData[offset + 6] = node.color[3];
      this.nodeData[offset + 7] = i; // Node ID for picking
    });

    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.nodeInstanceBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, this.nodeData, this.gl.DYNAMIC_DRAW);
  }

  /**
   * Update edge instance buffer
   */
  private updateEdgeBuffer(): void {
    const stride = 9; // startX, startY, endX, endY, width, r, g, b, a
    this.edgeData = new Float32Array(this.edges.length * stride);

    this.edges.forEach((edge, i) => {
      const offset = i * stride;
      this.edgeData[offset] = edge.sourceX;
      this.edgeData[offset + 1] = edge.sourceY;
      this.edgeData[offset + 2] = edge.targetX;
      this.edgeData[offset + 3] = edge.targetY;
      this.edgeData[offset + 4] = edge.width;
      this.edgeData[offset + 5] = edge.color[0];
      this.edgeData[offset + 6] = edge.color[1];
      this.edgeData[offset + 7] = edge.color[2];
      this.edgeData[offset + 8] = edge.color[3];
    });

    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.edgeInstanceBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, this.edgeData, this.gl.DYNAMIC_DRAW);
  }

  /**
   * Set view transform
   */
  setTransform(x: number, y: number, scale: number): void {
    // Update view matrix with translation and scale
    this.viewMatrix.fill(0);
    this.viewMatrix[0] = scale;
    this.viewMatrix[5] = scale;
    this.viewMatrix[10] = 1;
    this.viewMatrix[12] = x;
    this.viewMatrix[13] = y;
    this.viewMatrix[15] = 1;
  }

  /**
   * Render the graph
   */
  render(picking: boolean = false): void {
    if (picking && !this.options.enablePicking) return;

    // Bind appropriate framebuffer
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, picking ? this.pickingFramebuffer : null);

    // Clear canvas
    this.gl.clearColor(0, 0, 0, picking ? 1 : 0);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);

    // Render edges first (behind nodes)
    this.renderEdges(picking);

    // Render nodes
    this.renderNodes(picking);
  }

  /**
   * Render nodes using instanced rendering
   */
  private renderNodes(picking: boolean): void {
    if (!this.nodeProgram || this.nodes.length === 0) return;

    this.gl.useProgram(this.nodeProgram);

    // Set uniforms
    const viewMatrixLocation = this.gl.getUniformLocation(this.nodeProgram, 'u_viewMatrix');
    const projectionMatrixLocation = this.gl.getUniformLocation(this.nodeProgram, 'u_projectionMatrix');
    const pixelRatioLocation = this.gl.getUniformLocation(this.nodeProgram, 'u_pixelRatio');
    const pickingLocation = this.gl.getUniformLocation(this.nodeProgram, 'u_picking');

    this.gl.uniformMatrix4fv(viewMatrixLocation, false, this.viewMatrix);
    this.gl.uniformMatrix4fv(projectionMatrixLocation, false, this.projectionMatrix);
    this.gl.uniform1f(pixelRatioLocation, this.options.devicePixelRatio);
    this.gl.uniform1i(pickingLocation, picking ? 1 : 0);

    // Bind vertex buffer (quad geometry)
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.nodeBuffer);
    const positionLocation = this.gl.getAttribLocation(this.nodeProgram, 'a_position');
    this.gl.enableVertexAttribArray(positionLocation);
    this.gl.vertexAttribPointer(positionLocation, 2, this.gl.FLOAT, false, 0, 0);

    // Bind instance buffer
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.nodeInstanceBuffer);

    const offsetLocation = this.gl.getAttribLocation(this.nodeProgram, 'a_offset');
    const sizeLocation = this.gl.getAttribLocation(this.nodeProgram, 'a_size');
    const colorLocation = this.gl.getAttribLocation(this.nodeProgram, 'a_color');
    const nodeIdLocation = this.gl.getAttribLocation(this.nodeProgram, 'a_nodeId');

    this.gl.enableVertexAttribArray(offsetLocation);
    this.gl.enableVertexAttribArray(sizeLocation);
    this.gl.enableVertexAttribArray(colorLocation);
    this.gl.enableVertexAttribArray(nodeIdLocation);

    const stride = 8 * 4; // 8 floats * 4 bytes per float
    this.gl.vertexAttribPointer(offsetLocation, 2, this.gl.FLOAT, false, stride, 0);
    this.gl.vertexAttribPointer(sizeLocation, 1, this.gl.FLOAT, false, stride, 8);
    this.gl.vertexAttribPointer(colorLocation, 4, this.gl.FLOAT, false, stride, 12);
    this.gl.vertexAttribPointer(nodeIdLocation, 1, this.gl.FLOAT, false, stride, 28);

    // Enable instancing (draw same geometry for each node)
    // Note: This uses a simple approach without instanced arrays extension
    for (let i = 0; i < this.nodes.length; i++) {
      this.gl.vertexAttribPointer(offsetLocation, 2, this.gl.FLOAT, false, stride, i * stride);
      this.gl.vertexAttribPointer(sizeLocation, 1, this.gl.FLOAT, false, stride, i * stride + 8);
      this.gl.vertexAttribPointer(colorLocation, 4, this.gl.FLOAT, false, stride, i * stride + 12);
      this.gl.vertexAttribPointer(nodeIdLocation, 1, this.gl.FLOAT, false, stride, i * stride + 28);

      this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
    }
  }

  /**
   * Render edges
   */
  private renderEdges(picking: boolean): void {
    if (!this.edgeProgram || this.edges.length === 0 || picking) return; // Skip edges in picking mode

    this.gl.useProgram(this.edgeProgram);

    // Set uniforms
    const viewMatrixLocation = this.gl.getUniformLocation(this.edgeProgram, 'u_viewMatrix');
    const projectionMatrixLocation = this.gl.getUniformLocation(this.edgeProgram, 'u_projectionMatrix');
    const pixelRatioLocation = this.gl.getUniformLocation(this.edgeProgram, 'u_pixelRatio');

    this.gl.uniformMatrix4fv(viewMatrixLocation, false, this.viewMatrix);
    this.gl.uniformMatrix4fv(projectionMatrixLocation, false, this.projectionMatrix);
    this.gl.uniform1f(pixelRatioLocation, this.options.devicePixelRatio);

    // Bind vertex buffer (quad geometry)
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.edgeBuffer);
    const positionLocation = this.gl.getAttribLocation(this.edgeProgram, 'a_position');
    this.gl.enableVertexAttribArray(positionLocation);
    this.gl.vertexAttribPointer(positionLocation, 2, this.gl.FLOAT, false, 0, 0);

    // Bind instance buffer
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.edgeInstanceBuffer);

    const startLocation = this.gl.getAttribLocation(this.edgeProgram, 'a_start');
    const endLocation = this.gl.getAttribLocation(this.edgeProgram, 'a_end');
    const widthLocation = this.gl.getAttribLocation(this.edgeProgram, 'a_width');
    const colorLocation = this.gl.getAttribLocation(this.edgeProgram, 'a_color');

    this.gl.enableVertexAttribArray(startLocation);
    this.gl.enableVertexAttribArray(endLocation);
    this.gl.enableVertexAttribArray(widthLocation);
    this.gl.enableVertexAttribArray(colorLocation);

    const stride = 9 * 4; // 9 floats * 4 bytes per float
    for (let i = 0; i < this.edges.length; i++) {
      this.gl.vertexAttribPointer(startLocation, 2, this.gl.FLOAT, false, stride, i * stride);
      this.gl.vertexAttribPointer(endLocation, 2, this.gl.FLOAT, false, stride, i * stride + 8);
      this.gl.vertexAttribPointer(widthLocation, 1, this.gl.FLOAT, false, stride, i * stride + 16);
      this.gl.vertexAttribPointer(colorLocation, 4, this.gl.FLOAT, false, stride, i * stride + 20);

      this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
    }
  }

  /**
   * Pick node at screen coordinates
   */
  pick(x: number, y: number): WebGLNode | null {
    if (!this.options.enablePicking || !this.pickingFramebuffer) return null;

    // Render for picking
    this.render(true);

    // Read pixel at mouse position
    const pixels = new Uint8Array(4);
    this.gl.readPixels(
      Math.floor(x * this.options.devicePixelRatio),
      Math.floor((this.options.height - y) * this.options.devicePixelRatio),
      1, 1, this.gl.RGBA, this.gl.UNSIGNED_BYTE, pixels
    );

    // Decode node ID from color
    const nodeId = pixels[0] + pixels[1] * 256 + pixels[2] * 65536;

    return nodeId < this.nodes.length ? this.nodes[nodeId] : null;
  }

  /**
   * Resize the renderer
   */
  resize(width: number, height: number): void {
    this.options.width = width;
    this.options.height = height;

    this.setupCanvas();
    this.setupMatrices();

    if (this.options.enablePicking) {
      this.setupPicking();
    }
  }

  /**
   * Get performance statistics
   */
  getStats(): {
    nodeCount: number;
    edgeCount: number;
    gpuMemoryUsage: number;
    isWebGLSupported: boolean;
  } {
    const nodeMemory = this.nodeData.byteLength;
    const edgeMemory = this.edgeData.byteLength;

    return {
      nodeCount: this.nodes.length,
      edgeCount: this.edges.length,
      gpuMemoryUsage: nodeMemory + edgeMemory,
      isWebGLSupported: !!this.gl
    };
  }

  /**
   * Dispose of WebGL resources
   */
  dispose(): void {
    if (this.nodeProgram) this.gl.deleteProgram(this.nodeProgram);
    if (this.edgeProgram) this.gl.deleteProgram(this.edgeProgram);
    if (this.nodeBuffer) this.gl.deleteBuffer(this.nodeBuffer);
    if (this.edgeBuffer) this.gl.deleteBuffer(this.edgeBuffer);
    if (this.nodeInstanceBuffer) this.gl.deleteBuffer(this.nodeInstanceBuffer);
    if (this.edgeInstanceBuffer) this.gl.deleteBuffer(this.edgeInstanceBuffer);

    if (this.pickingFramebuffer) this.gl.deleteFramebuffer(this.pickingFramebuffer);
    if (this.pickingTexture) this.gl.deleteTexture(this.pickingTexture);
    if (this.pickingRenderbuffer) this.gl.deleteRenderbuffer(this.pickingRenderbuffer);
  }
}

/**
 * Utility functions for WebGL rendering
 */

/**
 * Convert hex color to RGBA array
 */
export function hexToRGBA(hex: string, alpha: number = 1): [number, number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return [r, g, b, alpha];
}

/**
 * Convert graph nodes to WebGL format
 */
export function convertNodesToWebGL(
  nodes: AnyGraphNode[],
  positions: Map<string, { x: number; y: number }>,
  getColor: (node: AnyGraphNode) => string = () => '#666666',
  getSize: (node: AnyGraphNode) => number = () => 8
): WebGLNode[] {
  return nodes.map(node => {
    const pos = positions.get(node.id) || { x: 0, y: 0 };
    return {
      id: node.id,
      x: pos.x,
      y: pos.y,
      size: getSize(node),
      color: hexToRGBA(getColor(node)),
      data: node
    };
  });
}

/**
 * Convert graph edges to WebGL format
 */
export function convertEdgesToWebGL(
  edges: GraphEdge[],
  positions: Map<string, { x: number; y: number }>,
  getColor: (edge: GraphEdge) => string = () => '#999999',
  getWidth: (edge: GraphEdge) => number = () => 1
): WebGLEdge[] {
  return edges.map(edge => {
    const sourcePos = positions.get(edge.sourceId) || { x: 0, y: 0 };
    const targetPos = positions.get(edge.targetId) || { x: 0, y: 0 };

    return {
      id: edge.id,
      sourceX: sourcePos.x,
      sourceY: sourcePos.y,
      targetX: targetPos.x,
      targetY: targetPos.y,
      width: getWidth(edge),
      color: hexToRGBA(getColor(edge)),
      data: edge
    };
  });
}

/**
 * Check WebGL support
 */
export function isWebGLSupported(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return !!(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
  } catch (e) {
    return false;
  }
}