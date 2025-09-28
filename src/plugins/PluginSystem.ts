import { Node, Edge } from '../types/Graph';
import { EventEmitter } from 'events';
import * as vm from 'vm';
import * as path from 'path';
import * as fs from 'fs/promises';

export interface PluginManifest {
  name: string;
  version: string;
  description: string;
  author: string;
  main: string;
  permissions: PluginPermission[];
  dependencies?: string[];
  hooks?: string[];
  api?: string;
}

export interface PluginPermission {
  type: 'read' | 'write' | 'network' | 'filesystem' | 'process';
  scope: string;
  description: string;
}

export interface PluginContext {
  manifest: PluginManifest;
  pluginDir: string;
  sandbox: vm.Context;
  permissions: Set<string>;
  api: PluginAPI;
}

export interface PluginAPI {
  graph: {
    getNodes: () => Node[];
    getEdges: () => Edge[];
    addNode: (node: Omit<Node, 'id'>) => string;
    updateNode: (id: string, updates: Partial<Node>) => boolean;
    removeNode: (id: string) => boolean;
    addEdge: (edge: Omit<Edge, 'id'>) => string;
    updateEdge: (id: string, updates: Partial<Edge>) => boolean;
    removeEdge: (id: string) => boolean;
  };
  hooks: {
    register: (hookName: string, handler: Function) => void;
    emit: (hookName: string, ...args: any[]) => Promise<any[]>;
  };
  utils: {
    log: (level: 'info' | 'warn' | 'error', message: string) => void;
    fetch: (url: string, options?: any) => Promise<any>;
    readFile: (filepath: string) => Promise<string>;
    writeFile: (filepath: string, content: string) => Promise<void>;
  };
  storage: {
    get: (key: string) => Promise<any>;
    set: (key: string, value: any) => Promise<void>;
    delete: (key: string) => Promise<void>;
    list: () => Promise<string[]>;
  };
}

export interface PluginHook {
  name: string;
  handlers: Array<{
    plugin: string;
    handler: Function;
    priority: number;
  }>;
}

export interface PluginLoadResult {
  success: boolean;
  plugin?: LoadedPlugin;
  error?: Error;
  warnings?: string[];
}

export interface LoadedPlugin {
  manifest: PluginManifest;
  context: PluginContext;
  instance: any;
  active: boolean;
  loadTime: Date;
}

export interface SandboxConfig {
  timeout: number;
  memoryLimit: number;
  allowedModules: string[];
  restrictedGlobals: string[];
}

export class PluginSystem extends EventEmitter {
  private plugins: Map<string, LoadedPlugin> = new Map();
  private hooks: Map<string, PluginHook> = new Map();
  private pluginStorage: Map<string, Map<string, any>> = new Map();
  private sandboxConfig: SandboxConfig;
  private nodes: Node[] = [];
  private edges: Edge[] = [];

  constructor(sandboxConfig: Partial<SandboxConfig> = {}) {
    super();

    this.sandboxConfig = {
      timeout: 30000,
      memoryLimit: 50 * 1024 * 1024, // 50MB
      allowedModules: ['path', 'crypto', 'util'],
      restrictedGlobals: ['process', 'require', 'module', '__dirname', '__filename'],
      ...sandboxConfig
    };

    this.initializeBuiltinHooks();
  }

  private initializeBuiltinHooks(): void {
    const builtinHooks = [
      'plugin:loaded',
      'plugin:unloaded',
      'plugin:error',
      'graph:node:added',
      'graph:node:updated',
      'graph:node:removed',
      'graph:edge:added',
      'graph:edge:updated',
      'graph:edge:removed',
      'analysis:started',
      'analysis:completed',
      'export:started',
      'export:completed',
      'import:started',
      'import:completed'
    ];

    builtinHooks.forEach(hookName => {
      this.hooks.set(hookName, {
        name: hookName,
        handlers: []
      });
    });
  }

  async loadPlugin(pluginPath: string): Promise<PluginLoadResult> {
    try {
      const manifestPath = path.join(pluginPath, 'plugin.json');
      const manifestContent = await fs.readFile(manifestPath, 'utf-8');
      const manifest: PluginManifest = JSON.parse(manifestContent);

      if (this.plugins.has(manifest.name)) {
        throw new Error(`Plugin ${manifest.name} is already loaded`);
      }

      const mainPath = path.join(pluginPath, manifest.main);
      const pluginCode = await fs.readFile(mainPath, 'utf-8');

      const context = await this.createPluginContext(manifest, pluginPath);
      const instance = await this.executePluginCode(pluginCode, context);

      const loadedPlugin: LoadedPlugin = {
        manifest,
        context,
        instance,
        active: true,
        loadTime: new Date()
      };

      this.plugins.set(manifest.name, loadedPlugin);
      this.pluginStorage.set(manifest.name, new Map());

      await this.registerPluginHooks(manifest, instance);
      await this.emitHook('plugin:loaded', manifest);

      return {
        success: true,
        plugin: loadedPlugin
      };

    } catch (error) {
      return {
        success: false,
        error: error as Error
      };
    }
  }

  async unloadPlugin(pluginName: string): Promise<boolean> {
    const plugin = this.plugins.get(pluginName);
    if (!plugin) {
      return false;
    }

    try {
      if (plugin.instance.onUnload) {
        await plugin.instance.onUnload();
      }

      this.unregisterPluginHooks(pluginName);
      this.plugins.delete(pluginName);
      this.pluginStorage.delete(pluginName);

      await this.emitHook('plugin:unloaded', plugin.manifest);
      return true;

    } catch (error) {
      await this.emitHook('plugin:error', { plugin: pluginName, error });
      return false;
    }
  }

  private async createPluginContext(manifest: PluginManifest, pluginDir: string): Promise<PluginContext> {
    const permissions = new Set(manifest.permissions.map(p => `${p.type}:${p.scope}`));

    const api: PluginAPI = {
      graph: {
        getNodes: () => [...this.nodes],
        getEdges: () => [...this.edges],
        addNode: (node: Omit<Node, 'id'>) => this.addNode(node),
        updateNode: (id: string, updates: Partial<Node>) => this.updateNode(id, updates),
        removeNode: (id: string) => this.removeNode(id),
        addEdge: (edge: Omit<Edge, 'id'>) => this.addEdge(edge),
        updateEdge: (id: string, updates: Partial<Edge>) => this.updateEdge(id, updates),
        removeEdge: (id: string) => this.removeEdge(id)
      },
      hooks: {
        register: (hookName: string, handler: Function) =>
          this.registerHook(hookName, manifest.name, handler),
        emit: (hookName: string, ...args: any[]) =>
          this.emitHook(hookName, ...args)
      },
      utils: {
        log: (level: 'info' | 'warn' | 'error', message: string) =>
          this.log(manifest.name, level, message),
        fetch: this.createSandboxedFetch(permissions),
        readFile: this.createSandboxedReadFile(permissions, pluginDir),
        writeFile: this.createSandboxedWriteFile(permissions, pluginDir)
      },
      storage: {
        get: (key: string) => this.getPluginStorage(manifest.name, key),
        set: (key: string, value: any) => this.setPluginStorage(manifest.name, key, value),
        delete: (key: string) => this.deletePluginStorage(manifest.name, key),
        list: () => this.listPluginStorage(manifest.name)
      }
    };

    const sandbox = this.createSandbox(api);

    return {
      manifest,
      pluginDir,
      sandbox,
      permissions,
      api
    };
  }

  private createSandbox(api: PluginAPI): vm.Context {
    const sandbox = {
      console: {
        log: (...args: any[]) => api.utils.log('info', args.join(' ')),
        warn: (...args: any[]) => api.utils.log('warn', args.join(' ')),
        error: (...args: any[]) => api.utils.log('error', args.join(' '))
      },
      setTimeout,
      clearTimeout,
      setInterval,
      clearInterval,
      Buffer,
      JSON,
      Math,
      Date,
      RegExp,
      String,
      Number,
      Boolean,
      Array,
      Object,
      Promise,
      Error,
      api
    };

    this.sandboxConfig.allowedModules.forEach(moduleName => {
      try {
        sandbox[moduleName] = require(moduleName);
      } catch (error) {
        // Module not available
      }
    });

    return vm.createContext(sandbox);
  }

  private async executePluginCode(code: string, context: PluginContext): Promise<any> {
    const script = new vm.Script(`
      (function(exports, module) {
        ${code}
        return module.exports || exports;
      })
    `);

    const exports = {};
    const module = { exports };

    const result = script.runInContext(context.sandbox, {
      timeout: this.sandboxConfig.timeout,
      displayErrors: true
    });

    return result.call(null, exports, module);
  }

  private async registerPluginHooks(manifest: PluginManifest, instance: any): Promise<void> {
    if (manifest.hooks && instance.hooks) {
      for (const hookName of manifest.hooks) {
        if (instance.hooks[hookName]) {
          this.registerHook(hookName, manifest.name, instance.hooks[hookName]);
        }
      }
    }
  }

  private registerHook(hookName: string, pluginName: string, handler: Function, priority: number = 0): void {
    if (!this.hooks.has(hookName)) {
      this.hooks.set(hookName, {
        name: hookName,
        handlers: []
      });
    }

    const hook = this.hooks.get(hookName)!;
    hook.handlers.push({
      plugin: pluginName,
      handler,
      priority
    });

    hook.handlers.sort((a, b) => b.priority - a.priority);
  }

  private unregisterPluginHooks(pluginName: string): void {
    this.hooks.forEach(hook => {
      hook.handlers = hook.handlers.filter(h => h.plugin !== pluginName);
    });
  }

  private async emitHook(hookName: string, ...args: any[]): Promise<any[]> {
    const hook = this.hooks.get(hookName);
    if (!hook) {
      return [];
    }

    const results: any[] = [];

    for (const { handler, plugin } of hook.handlers) {
      try {
        const result = await Promise.resolve(handler(...args));
        results.push(result);
      } catch (error) {
        await this.emitHook('plugin:error', { plugin, error, hook: hookName });
      }
    }

    return results;
  }

  private createSandboxedFetch(permissions: Set<string>) {
    return async (url: string, options?: any): Promise<any> => {
      if (!permissions.has('network:*') && !permissions.has(`network:${new URL(url).hostname}`)) {
        throw new Error('Network access denied');
      }
      return fetch(url, options);
    };
  }

  private createSandboxedReadFile(permissions: Set<string>, pluginDir: string) {
    return async (filepath: string): Promise<string> => {
      const resolvedPath = path.resolve(pluginDir, filepath);

      if (!permissions.has('filesystem:read') && !resolvedPath.startsWith(pluginDir)) {
        throw new Error('File read access denied');
      }

      return fs.readFile(resolvedPath, 'utf-8');
    };
  }

  private createSandboxedWriteFile(permissions: Set<string>, pluginDir: string) {
    return async (filepath: string, content: string): Promise<void> => {
      const resolvedPath = path.resolve(pluginDir, filepath);

      if (!permissions.has('filesystem:write') && !resolvedPath.startsWith(pluginDir)) {
        throw new Error('File write access denied');
      }

      return fs.writeFile(resolvedPath, content, 'utf-8');
    };
  }

  private log(plugin: string, level: string, message: string): void {
    console.log(`[Plugin:${plugin}] [${level.toUpperCase()}] ${message}`);
  }

  private async getPluginStorage(pluginName: string, key: string): Promise<any> {
    const storage = this.pluginStorage.get(pluginName);
    return storage?.get(key);
  }

  private async setPluginStorage(pluginName: string, key: string, value: any): Promise<void> {
    const storage = this.pluginStorage.get(pluginName);
    storage?.set(key, value);
  }

  private async deletePluginStorage(pluginName: string, key: string): Promise<void> {
    const storage = this.pluginStorage.get(pluginName);
    storage?.delete(key);
  }

  private async listPluginStorage(pluginName: string): Promise<string[]> {
    const storage = this.pluginStorage.get(pluginName);
    return storage ? Array.from(storage.keys()) : [];
  }

  private addNode(node: Omit<Node, 'id'>): string {
    const id = `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newNode: Node = { ...node, id };
    this.nodes.push(newNode);
    this.emitHook('graph:node:added', newNode);
    return id;
  }

  private updateNode(id: string, updates: Partial<Node>): boolean {
    const index = this.nodes.findIndex(n => n.id === id);
    if (index === -1) return false;

    this.nodes[index] = { ...this.nodes[index], ...updates };
    this.emitHook('graph:node:updated', this.nodes[index]);
    return true;
  }

  private removeNode(id: string): boolean {
    const index = this.nodes.findIndex(n => n.id === id);
    if (index === -1) return false;

    const removedNode = this.nodes.splice(index, 1)[0];
    this.edges = this.edges.filter(e => e.source !== id && e.target !== id);
    this.emitHook('graph:node:removed', removedNode);
    return true;
  }

  private addEdge(edge: Omit<Edge, 'id'>): string {
    const id = `edge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newEdge: Edge = { ...edge, id };
    this.edges.push(newEdge);
    this.emitHook('graph:edge:added', newEdge);
    return id;
  }

  private updateEdge(id: string, updates: Partial<Edge>): boolean {
    const index = this.edges.findIndex(e => e.id === id);
    if (index === -1) return false;

    this.edges[index] = { ...this.edges[index], ...updates };
    this.emitHook('graph:edge:updated', this.edges[index]);
    return true;
  }

  private removeEdge(id: string): boolean {
    const index = this.edges.findIndex(e => e.id === id);
    if (index === -1) return false;

    const removedEdge = this.edges.splice(index, 1)[0];
    this.emitHook('graph:edge:removed', removedEdge);
    return true;
  }

  getLoadedPlugins(): LoadedPlugin[] {
    return Array.from(this.plugins.values());
  }

  getPluginManifest(pluginName: string): PluginManifest | undefined {
    return this.plugins.get(pluginName)?.manifest;
  }

  isPluginLoaded(pluginName: string): boolean {
    return this.plugins.has(pluginName);
  }

  getRegisteredHooks(): string[] {
    return Array.from(this.hooks.keys());
  }

  setGraphData(nodes: Node[], edges: Edge[]): void {
    this.nodes = [...nodes];
    this.edges = [...edges];
  }
}