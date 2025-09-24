import { EventEmitter } from 'events';
import { ProjectGraph, AIResponse, VisualChange, AISuggestion, ImpactAnalysis, LearningData } from '../../types';

export interface AIPlugin {
  name: string;
  version: string;
  capabilities: AICapability[];
  initialize(config: AIPluginConfig): Promise<void>;
  analyzeGraph(graph: ProjectGraph): Promise<AIResponse>;
  generateCode(change: VisualChange): Promise<AIResponse>;
  suggestImprovements(graph: ProjectGraph): Promise<AISuggestion[]>;
  learnFromFeedback(feedback: LearningData): Promise<void>;
  cleanup(): Promise<void>;
}

export interface AIPluginConfig {
  apiKey?: string;
  modelName?: string;
  temperature?: number;
  maxTokens?: number;
  baseUrl?: string;
  customSettings?: Record<string, any>;
}

export type AICapability =
  | 'code_generation'
  | 'pattern_analysis'
  | 'impact_analysis'
  | 'suggestion_generation'
  | 'learning_adaptation';

export interface PluginRegistry {
  [pluginName: string]: {
    plugin: AIPlugin;
    config: AIPluginConfig;
    enabled: boolean;
    priority: number;
  };
}

export class AIPluginSystem extends EventEmitter {
  private plugins: PluginRegistry = {};
  private defaultPlugin: string | null = null;

  public async registerPlugin(
    plugin: AIPlugin,
    config: AIPluginConfig,
    options: { enabled?: boolean; priority?: number; setAsDefault?: boolean } = {}
  ): Promise<void> {
    const { enabled = true, priority = 50, setAsDefault = false } = options;

    try {
      await plugin.initialize(config);

      this.plugins[plugin.name] = {
        plugin,
        config,
        enabled,
        priority
      };

      if (setAsDefault || !this.defaultPlugin) {
        this.defaultPlugin = plugin.name;
      }

      this.emit('plugin_registered', {
        name: plugin.name,
        capabilities: plugin.capabilities,
        enabled
      });

      console.log(`AI Plugin registered: ${plugin.name} v${plugin.version}`);
    } catch (error) {
      console.error(`Failed to register AI plugin ${plugin.name}:`, error);
      throw error;
    }
  }

  public async unregisterPlugin(pluginName: string): Promise<void> {
    const pluginInfo = this.plugins[pluginName];
    if (!pluginInfo) {
      throw new Error(`Plugin ${pluginName} not found`);
    }

    try {
      await pluginInfo.plugin.cleanup();
      delete this.plugins[pluginName];

      if (this.defaultPlugin === pluginName) {
        this.defaultPlugin = Object.keys(this.plugins)[0] || null;
      }

      this.emit('plugin_unregistered', { name: pluginName });
      console.log(`AI Plugin unregistered: ${pluginName}`);
    } catch (error) {
      console.error(`Failed to unregister AI plugin ${pluginName}:`, error);
      throw error;
    }
  }

  public enablePlugin(pluginName: string): void {
    const pluginInfo = this.plugins[pluginName];
    if (!pluginInfo) {
      throw new Error(`Plugin ${pluginName} not found`);
    }

    pluginInfo.enabled = true;
    this.emit('plugin_enabled', { name: pluginName });
  }

  public disablePlugin(pluginName: string): void {
    const pluginInfo = this.plugins[pluginName];
    if (!pluginInfo) {
      throw new Error(`Plugin ${pluginName} not found`);
    }

    pluginInfo.enabled = false;
    this.emit('plugin_disabled', { name: pluginName });
  }

  public setDefaultPlugin(pluginName: string): void {
    const pluginInfo = this.plugins[pluginName];
    if (!pluginInfo) {
      throw new Error(`Plugin ${pluginName} not found`);
    }

    if (!pluginInfo.enabled) {
      throw new Error(`Cannot set disabled plugin ${pluginName} as default`);
    }

    this.defaultPlugin = pluginName;
    this.emit('default_plugin_changed', { name: pluginName });
  }

  public async analyzeGraph(graph: ProjectGraph, pluginName?: string): Promise<AIResponse> {
    const plugin = this.getPlugin(pluginName);

    if (!plugin.capabilities.includes('pattern_analysis')) {
      throw new Error(`Plugin ${plugin.name} does not support graph analysis`);
    }

    try {
      const response = await plugin.analyzeGraph(graph);
      this.emit('analysis_completed', { plugin: plugin.name, response });
      return response;
    } catch (error) {
      this.emit('analysis_failed', { plugin: plugin.name, error });
      throw error;
    }
  }

  public async generateCode(change: VisualChange, pluginName?: string): Promise<AIResponse> {
    const plugin = this.getPlugin(pluginName);

    if (!plugin.capabilities.includes('code_generation')) {
      throw new Error(`Plugin ${plugin.name} does not support code generation`);
    }

    try {
      const response = await plugin.generateCode(change);
      this.emit('code_generated', { plugin: plugin.name, response });
      return response;
    } catch (error) {
      this.emit('code_generation_failed', { plugin: plugin.name, error });
      throw error;
    }
  }

  public async suggestImprovements(graph: ProjectGraph, pluginName?: string): Promise<AISuggestion[]> {
    const plugin = this.getPlugin(pluginName);

    if (!plugin.capabilities.includes('suggestion_generation')) {
      throw new Error(`Plugin ${plugin.name} does not support suggestion generation`);
    }

    try {
      const suggestions = await plugin.suggestImprovements(graph);
      this.emit('suggestions_generated', { plugin: plugin.name, suggestions });
      return suggestions;
    } catch (error) {
      this.emit('suggestion_generation_failed', { plugin: plugin.name, error });
      throw error;
    }
  }

  public async provideFeedback(feedback: LearningData, pluginName?: string): Promise<void> {
    const plugin = this.getPlugin(pluginName);

    if (!plugin.capabilities.includes('learning_adaptation')) {
      console.warn(`Plugin ${plugin.name} does not support learning adaptation`);
      return;
    }

    try {
      await plugin.learnFromFeedback(feedback);
      this.emit('feedback_processed', { plugin: plugin.name, feedback });
    } catch (error) {
      this.emit('feedback_processing_failed', { plugin: plugin.name, error });
      throw error;
    }
  }

  public async analyzeWithConsensus(graph: ProjectGraph, capability: AICapability): Promise<AIResponse[]> {
    const availablePlugins = this.getPluginsWithCapability(capability);

    if (availablePlugins.length === 0) {
      throw new Error(`No plugins available with capability: ${capability}`);
    }

    const promises = availablePlugins.map(async (plugin) => {
      try {
        if (capability === 'pattern_analysis') {
          return await plugin.analyzeGraph(graph);
        }
        throw new Error(`Consensus analysis not implemented for capability: ${capability}`);
      } catch (error) {
        console.warn(`Plugin ${plugin.name} failed in consensus analysis:`, error);
        return null;
      }
    });

    const results = await Promise.all(promises);
    const validResults = results.filter((result): result is AIResponse => result !== null);

    this.emit('consensus_analysis_completed', {
      capability,
      results: validResults,
      participatingPlugins: availablePlugins.map(p => p.name)
    });

    return validResults;
  }

  public getAvailablePlugins(): Array<{ name: string; version: string; capabilities: AICapability[]; enabled: boolean }> {
    return Object.values(this.plugins).map(info => ({
      name: info.plugin.name,
      version: info.plugin.version,
      capabilities: info.plugin.capabilities,
      enabled: info.enabled
    }));
  }

  public getPluginCapabilities(pluginName: string): AICapability[] {
    const pluginInfo = this.plugins[pluginName];
    if (!pluginInfo) {
      throw new Error(`Plugin ${pluginName} not found`);
    }

    return pluginInfo.plugin.capabilities;
  }

  public async updatePluginConfig(pluginName: string, newConfig: Partial<AIPluginConfig>): Promise<void> {
    const pluginInfo = this.plugins[pluginName];
    if (!pluginInfo) {
      throw new Error(`Plugin ${pluginName} not found`);
    }

    const updatedConfig = { ...pluginInfo.config, ...newConfig };

    await pluginInfo.plugin.cleanup();
    await pluginInfo.plugin.initialize(updatedConfig);

    pluginInfo.config = updatedConfig;
    this.emit('plugin_config_updated', { name: pluginName, config: updatedConfig });
  }

  private getPlugin(pluginName?: string): AIPlugin {
    const targetPlugin = pluginName || this.defaultPlugin;

    if (!targetPlugin) {
      throw new Error('No plugin specified and no default plugin set');
    }

    const pluginInfo = this.plugins[targetPlugin];
    if (!pluginInfo) {
      throw new Error(`Plugin ${targetPlugin} not found`);
    }

    if (!pluginInfo.enabled) {
      throw new Error(`Plugin ${targetPlugin} is disabled`);
    }

    return pluginInfo.plugin;
  }

  private getPluginsWithCapability(capability: AICapability): AIPlugin[] {
    return Object.values(this.plugins)
      .filter(info => info.enabled && info.plugin.capabilities.includes(capability))
      .sort((a, b) => b.priority - a.priority)
      .map(info => info.plugin);
  }

  public async shutdown(): Promise<void> {
    const cleanupPromises = Object.values(this.plugins).map(async (info) => {
      try {
        await info.plugin.cleanup();
      } catch (error) {
        console.error(`Error cleaning up plugin ${info.plugin.name}:`, error);
      }
    });

    await Promise.all(cleanupPromises);
    this.plugins = {};
    this.defaultPlugin = null;
    this.emit('system_shutdown');
  }
}