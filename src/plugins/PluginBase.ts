import { PluginAPI, PluginManifest } from './PluginSystem';
import { Node, Edge } from '../types/Graph';

export abstract class PluginBase {
  protected api: PluginAPI;
  protected manifest: PluginManifest;

  constructor(api: PluginAPI, manifest: PluginManifest) {
    this.api = api;
    this.manifest = manifest;
  }

  abstract async onLoad(): Promise<void>;
  abstract async onUnload(): Promise<void>;

  async onEnable(): Promise<void> {
    // Default implementation - can be overridden
  }

  async onDisable(): Promise<void> {
    // Default implementation - can be overridden
  }

  protected log(level: 'info' | 'warn' | 'error', message: string): void {
    this.api.utils.log(level, message);
  }

  protected async getStorage(key: string): Promise<any> {
    return await this.api.storage.get(key);
  }

  protected async setStorage(key: string, value: any): Promise<void> {
    return await this.api.storage.set(key, value);
  }

  protected registerHook(hookName: string, handler: Function): void {
    this.api.hooks.register(hookName, handler);
  }

  protected async emitHook(hookName: string, ...args: any[]): Promise<any[]> {
    return await this.api.hooks.emit(hookName, ...args);
  }

  protected getNodes(): Node[] {
    return this.api.graph.getNodes();
  }

  protected getEdges(): Edge[] {
    return this.api.graph.getEdges();
  }

  protected addNode(node: Omit<Node, 'id'>): string {
    return this.api.graph.addNode(node);
  }

  protected updateNode(id: string, updates: Partial<Node>): boolean {
    return this.api.graph.updateNode(id, updates);
  }

  protected removeNode(id: string): boolean {
    return this.api.graph.removeNode(id);
  }

  protected addEdge(edge: Omit<Edge, 'id'>): string {
    return this.api.graph.addEdge(edge);
  }

  protected updateEdge(id: string, updates: Partial<Edge>): boolean {
    return this.api.graph.updateEdge(id, updates);
  }

  protected removeEdge(id: string): boolean {
    return this.api.graph.removeEdge(id);
  }
}

export interface AnalysisPlugin {
  analyzeGraph(nodes: Node[], edges: Edge[]): Promise<any>;
  getAnalysisType(): string;
  getAnalysisName(): string;
}

export interface TransformPlugin {
  transformGraph(nodes: Node[], edges: Edge[]): Promise<{ nodes: Node[]; edges: Edge[]; }>;
  getTransformationType(): string;
  getTransformationName(): string;
}

export interface ExportPlugin {
  exportGraph(nodes: Node[], edges: Edge[], options?: any): Promise<string | Buffer>;
  getSupportedFormats(): string[];
  getExporterName(): string;
}

export interface ImportPlugin {
  importGraph(data: string | Buffer, options?: any): Promise<{ nodes: Node[]; edges: Edge[]; }>;
  getSupportedFormats(): string[];
  getImporterName(): string;
}

export interface VisualizationPlugin {
  generateVisualization(nodes: Node[], edges: Edge[], options?: any): Promise<string>;
  getVisualizationType(): string;
  getVisualizationName(): string;
}

export class AnalysisPluginBase extends PluginBase implements AnalysisPlugin {
  abstract analyzeGraph(nodes: Node[], edges: Edge[]): Promise<any>;
  abstract getAnalysisType(): string;
  abstract getAnalysisName(): string;

  async onLoad(): Promise<void> {
    this.registerHook('analysis:request', async (analysisType: string) => {
      if (analysisType === this.getAnalysisType()) {
        const nodes = this.getNodes();
        const edges = this.getEdges();
        return await this.analyzeGraph(nodes, edges);
      }
    });
  }

  async onUnload(): Promise<void> {
    // Cleanup if needed
  }
}

export class TransformPluginBase extends PluginBase implements TransformPlugin {
  abstract transformGraph(nodes: Node[], edges: Edge[]): Promise<{ nodes: Node[]; edges: Edge[]; }>;
  abstract getTransformationType(): string;
  abstract getTransformationName(): string;

  async onLoad(): Promise<void> {
    this.registerHook('transform:request', async (transformType: string) => {
      if (transformType === this.getTransformationType()) {
        const nodes = this.getNodes();
        const edges = this.getEdges();
        return await this.transformGraph(nodes, edges);
      }
    });
  }

  async onUnload(): Promise<void> {
    // Cleanup if needed
  }
}

export class ExportPluginBase extends PluginBase implements ExportPlugin {
  abstract exportGraph(nodes: Node[], edges: Edge[], options?: any): Promise<string | Buffer>;
  abstract getSupportedFormats(): string[];
  abstract getExporterName(): string;

  async onLoad(): Promise<void> {
    this.registerHook('export:request', async (format: string, options?: any) => {
      if (this.getSupportedFormats().includes(format)) {
        const nodes = this.getNodes();
        const edges = this.getEdges();
        return await this.exportGraph(nodes, edges, options);
      }
    });
  }

  async onUnload(): Promise<void> {
    // Cleanup if needed
  }
}

export class ImportPluginBase extends PluginBase implements ImportPlugin {
  abstract importGraph(data: string | Buffer, options?: any): Promise<{ nodes: Node[]; edges: Edge[]; }>;
  abstract getSupportedFormats(): string[];
  abstract getImporterName(): string;

  async onLoad(): Promise<void> {
    this.registerHook('import:request', async (format: string, data: string | Buffer, options?: any) => {
      if (this.getSupportedFormats().includes(format)) {
        return await this.importGraph(data, options);
      }
    });
  }

  async onUnload(): Promise<void> {
    // Cleanup if needed
  }
}

export class VisualizationPluginBase extends PluginBase implements VisualizationPlugin {
  abstract generateVisualization(nodes: Node[], edges: Edge[], options?: any): Promise<string>;
  abstract getVisualizationType(): string;
  abstract getVisualizationName(): string;

  async onLoad(): Promise<void> {
    this.registerHook('visualization:request', async (visualizationType: string, options?: any) => {
      if (visualizationType === this.getVisualizationType()) {
        const nodes = this.getNodes();
        const edges = this.getEdges();
        return await this.generateVisualization(nodes, edges, options);
      }
    });
  }

  async onUnload(): Promise<void> {
    // Cleanup if needed
  }
}