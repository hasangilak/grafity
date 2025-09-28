import { PluginSystem, PluginManifest, LoadedPlugin, PluginLoadResult } from './PluginSystem';
import { Node, Edge } from '../types/Graph';
import * as path from 'path';
import * as fs from 'fs/promises';

export interface PluginRegistry {
  name: string;
  version: string;
  description: string;
  downloadUrl: string;
  checksum: string;
  author: string;
  tags: string[];
  rating: number;
  downloads: number;
  lastUpdated: Date;
}

export interface PluginInstallOptions {
  force?: boolean;
  skipDependencies?: boolean;
  pluginDir?: string;
}

export interface PluginManagerConfig {
  pluginsDir: string;
  registryUrl?: string;
  autoUpdate?: boolean;
  sandboxConfig?: any;
}

export interface PluginDependency {
  name: string;
  version: string;
  required: boolean;
  resolved: boolean;
}

export interface PluginValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  dependencies: PluginDependency[];
}

export class PluginManager {
  private pluginSystem: PluginSystem;
  private config: PluginManagerConfig;
  private pluginDependencies: Map<string, PluginDependency[]> = new Map();

  constructor(config: PluginManagerConfig) {
    this.config = {
      registryUrl: 'https://registry.grafity.dev',
      autoUpdate: false,
      ...config
    };

    this.pluginSystem = new PluginSystem(config.sandboxConfig);
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.pluginSystem.on('plugin:loaded', (manifest: PluginManifest) => {
      console.log(`Plugin loaded: ${manifest.name} v${manifest.version}`);
    });

    this.pluginSystem.on('plugin:unloaded', (manifest: PluginManifest) => {
      console.log(`Plugin unloaded: ${manifest.name}`);
    });

    this.pluginSystem.on('plugin:error', ({ plugin, error }) => {
      console.error(`Plugin error in ${plugin}:`, error);
    });
  }

  async installPlugin(nameOrPath: string, options: PluginInstallOptions = {}): Promise<PluginLoadResult> {
    try {
      let pluginPath: string;

      if (await this.isLocalPath(nameOrPath)) {
        pluginPath = nameOrPath;
      } else {
        pluginPath = await this.downloadPlugin(nameOrPath, options);
      }

      const validation = await this.validatePlugin(pluginPath);
      if (!validation.valid) {
        throw new Error(`Plugin validation failed: ${validation.errors.join(', ')}`);
      }

      if (!options.skipDependencies) {
        await this.installDependencies(validation.dependencies);
      }

      const targetPath = path.join(this.config.pluginsDir, path.basename(pluginPath));
      await this.copyPlugin(pluginPath, targetPath);

      return await this.pluginSystem.loadPlugin(targetPath);

    } catch (error) {
      return {
        success: false,
        error: error as Error
      };
    }
  }

  async uninstallPlugin(pluginName: string): Promise<boolean> {
    try {
      const success = await this.pluginSystem.unloadPlugin(pluginName);
      if (success) {
        const pluginPath = path.join(this.config.pluginsDir, pluginName);
        await this.removeDirectory(pluginPath);
        this.pluginDependencies.delete(pluginName);
      }
      return success;
    } catch (error) {
      console.error(`Failed to uninstall plugin ${pluginName}:`, error);
      return false;
    }
  }

  async loadPlugin(pluginPath: string): Promise<PluginLoadResult> {
    const validation = await this.validatePlugin(pluginPath);
    if (!validation.valid) {
      return {
        success: false,
        error: new Error(`Plugin validation failed: ${validation.errors.join(', ')}`)
      };
    }

    return await this.pluginSystem.loadPlugin(pluginPath);
  }

  async unloadPlugin(pluginName: string): Promise<boolean> {
    return await this.pluginSystem.unloadPlugin(pluginName);
  }

  async enablePlugin(pluginName: string): Promise<boolean> {
    const plugin = this.getPlugin(pluginName);
    if (!plugin || plugin.active) {
      return false;
    }

    try {
      if (plugin.instance.onEnable) {
        await plugin.instance.onEnable();
      }
      plugin.active = true;
      return true;
    } catch (error) {
      console.error(`Failed to enable plugin ${pluginName}:`, error);
      return false;
    }
  }

  async disablePlugin(pluginName: string): Promise<boolean> {
    const plugin = this.getPlugin(pluginName);
    if (!plugin || !plugin.active) {
      return false;
    }

    try {
      if (plugin.instance.onDisable) {
        await plugin.instance.onDisable();
      }
      plugin.active = false;
      return true;
    } catch (error) {
      console.error(`Failed to disable plugin ${pluginName}:`, error);
      return false;
    }
  }

  async validatePlugin(pluginPath: string): Promise<PluginValidationResult> {
    const result: PluginValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
      dependencies: []
    };

    try {
      const manifestPath = path.join(pluginPath, 'plugin.json');
      const manifestExists = await this.fileExists(manifestPath);

      if (!manifestExists) {
        result.errors.push('Missing plugin.json manifest file');
        result.valid = false;
        return result;
      }

      const manifestContent = await fs.readFile(manifestPath, 'utf-8');
      const manifest: PluginManifest = JSON.parse(manifestContent);

      if (!manifest.name || !manifest.version || !manifest.main) {
        result.errors.push('Invalid manifest: missing required fields (name, version, main)');
        result.valid = false;
      }

      const mainPath = path.join(pluginPath, manifest.main);
      const mainExists = await this.fileExists(mainPath);

      if (!mainExists) {
        result.errors.push(`Main file not found: ${manifest.main}`);
        result.valid = false;
      }

      if (manifest.dependencies) {
        for (const dep of manifest.dependencies) {
          const dependency: PluginDependency = {
            name: dep,
            version: '*',
            required: true,
            resolved: this.pluginSystem.isPluginLoaded(dep)
          };
          result.dependencies.push(dependency);

          if (!dependency.resolved) {
            result.warnings.push(`Dependency not loaded: ${dep}`);
          }
        }
      }

      if (manifest.permissions) {
        const dangerousPermissions = manifest.permissions.filter(
          p => p.type === 'process' || p.type === 'filesystem'
        );

        if (dangerousPermissions.length > 0) {
          result.warnings.push(`Plugin requests dangerous permissions: ${dangerousPermissions.map(p => p.type).join(', ')}`);
        }
      }

    } catch (error) {
      result.errors.push(`Validation error: ${error.message}`);
      result.valid = false;
    }

    return result;
  }

  async searchPlugins(query: string, tags?: string[]): Promise<PluginRegistry[]> {
    try {
      if (!this.config.registryUrl) {
        return [];
      }

      const searchUrl = new URL('/search', this.config.registryUrl);
      searchUrl.searchParams.set('q', query);

      if (tags && tags.length > 0) {
        searchUrl.searchParams.set('tags', tags.join(','));
      }

      const response = await fetch(searchUrl.toString());
      if (!response.ok) {
        throw new Error(`Registry search failed: ${response.statusText}`);
      }

      return await response.json();

    } catch (error) {
      console.error('Plugin search failed:', error);
      return [];
    }
  }

  async updatePlugin(pluginName: string): Promise<PluginLoadResult> {
    const plugin = this.getPlugin(pluginName);
    if (!plugin) {
      return {
        success: false,
        error: new Error(`Plugin not found: ${pluginName}`)
      };
    }

    try {
      const registry = await this.searchPlugins(pluginName);
      const registryEntry = registry.find(p => p.name === pluginName);

      if (!registryEntry) {
        return {
          success: false,
          error: new Error(`Plugin not found in registry: ${pluginName}`)
        };
      }

      if (registryEntry.version === plugin.manifest.version) {
        return {
          success: true,
          plugin,
          warnings: ['Plugin is already up to date']
        };
      }

      await this.uninstallPlugin(pluginName);
      return await this.installPlugin(pluginName);

    } catch (error) {
      return {
        success: false,
        error: error as Error
      };
    }
  }

  async checkForUpdates(): Promise<{ plugin: string; currentVersion: string; latestVersion: string; }[]> {
    const updates: { plugin: string; currentVersion: string; latestVersion: string; }[] = [];
    const plugins = this.getLoadedPlugins();

    for (const plugin of plugins) {
      try {
        const registry = await this.searchPlugins(plugin.manifest.name);
        const registryEntry = registry.find(p => p.name === plugin.manifest.name);

        if (registryEntry && registryEntry.version !== plugin.manifest.version) {
          updates.push({
            plugin: plugin.manifest.name,
            currentVersion: plugin.manifest.version,
            latestVersion: registryEntry.version
          });
        }
      } catch (error) {
        console.error(`Failed to check updates for ${plugin.manifest.name}:`, error);
      }
    }

    return updates;
  }

  private async isLocalPath(nameOrPath: string): Promise<boolean> {
    try {
      const stats = await fs.stat(nameOrPath);
      return stats.isDirectory();
    } catch {
      return false;
    }
  }

  private async downloadPlugin(pluginName: string, options: PluginInstallOptions): Promise<string> {
    if (!this.config.registryUrl) {
      throw new Error('No registry URL configured');
    }

    const registry = await this.searchPlugins(pluginName);
    const plugin = registry.find(p => p.name === pluginName);

    if (!plugin) {
      throw new Error(`Plugin not found in registry: ${pluginName}`);
    }

    const downloadDir = path.join(this.config.pluginsDir, '.downloads');
    await this.ensureDirectory(downloadDir);

    const pluginPath = path.join(downloadDir, pluginName);

    // In a real implementation, this would download and extract the plugin
    // For now, we'll simulate the download
    console.log(`Downloading plugin ${pluginName} from ${plugin.downloadUrl}`);

    return pluginPath;
  }

  private async installDependencies(dependencies: PluginDependency[]): Promise<void> {
    for (const dep of dependencies) {
      if (!dep.resolved && dep.required) {
        console.log(`Installing dependency: ${dep.name}`);
        await this.installPlugin(dep.name, { skipDependencies: true });
      }
    }
  }

  private async copyPlugin(source: string, target: string): Promise<void> {
    await this.ensureDirectory(path.dirname(target));

    // In a real implementation, this would copy the plugin directory
    console.log(`Copying plugin from ${source} to ${target}`);
  }

  private async removeDirectory(dirPath: string): Promise<void> {
    try {
      await fs.rmdir(dirPath, { recursive: true });
    } catch (error) {
      console.error(`Failed to remove directory ${dirPath}:`, error);
    }
  }

  private async ensureDirectory(dirPath: string): Promise<void> {
    try {
      await fs.mkdir(dirPath, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  getLoadedPlugins(): LoadedPlugin[] {
    return this.pluginSystem.getLoadedPlugins();
  }

  getPlugin(pluginName: string): LoadedPlugin | undefined {
    return this.getLoadedPlugins().find(p => p.manifest.name === pluginName);
  }

  getPluginManifest(pluginName: string): PluginManifest | undefined {
    return this.pluginSystem.getPluginManifest(pluginName);
  }

  isPluginLoaded(pluginName: string): boolean {
    return this.pluginSystem.isPluginLoaded(pluginName);
  }

  getRegisteredHooks(): string[] {
    return this.pluginSystem.getRegisteredHooks();
  }

  setGraphData(nodes: Node[], edges: Edge[]): void {
    this.pluginSystem.setGraphData(nodes, edges);
  }

  getPluginSystem(): PluginSystem {
    return this.pluginSystem;
  }
}