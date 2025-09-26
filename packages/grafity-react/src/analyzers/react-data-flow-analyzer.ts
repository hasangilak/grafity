import { ProjectGraphProjectNode } from '@nx/devkit';
import { ComponentInfo, HookInfo, SourceLocation } from '../types';

export interface ReactDataFlowResult {
  stateFlows: StateFlow[];
  propFlows: PropFlow[];
  contextFlows: ContextFlow[];
  eventFlows: EventFlow[];
  apiFlows: ApiFlow[];
}

export interface StateFlow {
  id: string;
  componentId: string;
  hookName: string;
  hookType: string;
  readers: string[];
  writers: string[];
  location: SourceLocation;
}

export interface PropFlow {
  id: string;
  fromComponent: string;
  toComponent: string;
  propName: string;
  propType: string;
  isRequired: boolean;
  location: SourceLocation;
}

export interface ContextFlow {
  id: string;
  contextName: string;
  provider: string;
  consumers: string[];
  location: SourceLocation;
}

export interface EventFlow {
  id: string;
  eventType: string;
  source: string;
  handlers: string[];
  location: SourceLocation;
}

export interface ApiFlow {
  id: string;
  endpoint?: string;
  method?: string;
  component: string;
  dataState?: string;
  location: SourceLocation;
}

export class ReactDataFlowAnalyzer {
  /**
   * Analyzes React data flows within an Nx project
   */
  public analyzeProject(
    projectNode: ProjectGraphProjectNode,
    components: ComponentInfo[]
  ): ReactDataFlowResult {
    const stateFlows = this.analyzeStateFlows(components);
    const propFlows = this.analyzePropFlows(components);
    const contextFlows = this.analyzeContextFlows(components);
    const eventFlows = this.analyzeEventFlows(components);
    const apiFlows = this.analyzeApiFlows(components);

    return {
      stateFlows,
      propFlows,
      contextFlows,
      eventFlows,
      apiFlows
    };
  }

  private analyzeStateFlows(components: ComponentInfo[]): StateFlow[] {
    const stateFlows: StateFlow[] = [];

    components.forEach(component => {
      component.hooks.forEach(hook => {
        if (hook.type === 'useState' || hook.type === 'useReducer') {
          const stateFlow: StateFlow = {
            id: `${component.filePath}#${component.name}#${hook.name}`,
            componentId: `${component.filePath}#${component.name}`,
            hookName: hook.name,
            hookType: hook.type,
            readers: this.findStateReaders(component, hook, components),
            writers: this.findStateWriters(component, hook),
            location: hook.location
          };
          stateFlows.push(stateFlow);
        }
      });
    });

    return stateFlows;
  }

  private findStateReaders(
    component: ComponentInfo,
    hook: HookInfo,
    allComponents: ComponentInfo[]
  ): string[] {
    const readers: string[] = [];

    // State is used in the component's render
    if (hook.type === 'useState') {
      readers.push(`${component.filePath}#${component.name}#render`);
    }

    // Check if state is passed as props to children
    component.children.forEach(child => {
      const childComponent = allComponents.find(c =>
        c.filePath === child.filePath && c.name === child.name
      );

      if (childComponent) {
        childComponent.props.forEach(prop => {
          // Simple heuristic: if prop name contains hook name
          const stateName = hook.name.replace('use', '').replace('State', '').toLowerCase();
          if (prop.name.toLowerCase().includes(stateName)) {
            readers.push(`${child.filePath}#${child.name}`);
          }
        });
      }
    });

    return readers;
  }

  private findStateWriters(component: ComponentInfo, hook: HookInfo): string[] {
    const writers: string[] = [];

    // For useState, the setter function is a writer
    if (hook.type === 'useState') {
      const setterName = hook.name.replace('use', 'set').replace('State', '');
      writers.push(`${component.filePath}#${component.name}#${setterName}`);
    }

    // Event handlers that might update state
    const eventHandlerPatterns = ['onClick', 'onChange', 'onSubmit', 'onInput'];
    eventHandlerPatterns.forEach(pattern => {
      writers.push(`${component.filePath}#${component.name}#${pattern}`);
    });

    return writers;
  }

  private analyzePropFlows(components: ComponentInfo[]): PropFlow[] {
    const propFlows: PropFlow[] = [];

    components.forEach(component => {
      component.children.forEach(child => {
        child.props.forEach(prop => {
          const propFlow: PropFlow = {
            id: `${component.filePath}#${component.name}->${child.filePath}#${child.name}#${prop.name}`,
            fromComponent: `${component.filePath}#${component.name}`,
            toComponent: `${child.filePath}#${child.name}`,
            propName: prop.name,
            propType: prop.type,
            isRequired: prop.isRequired,
            location: component.location
          };
          propFlows.push(propFlow);
        });
      });
    });

    return propFlows;
  }

  private analyzeContextFlows(components: ComponentInfo[]): ContextFlow[] {
    const contextFlows: ContextFlow[] = [];

    components.forEach(component => {
      component.hooks.forEach(hook => {
        if (hook.type === 'useContext') {
          const contextName = this.extractContextName(hook.name);
          const providers = this.findContextProviders(contextName, components);
          const consumers = this.findContextConsumers(contextName, components);

          if (providers.length > 0) {
            const contextFlow: ContextFlow = {
              id: `context-${contextName}`,
              contextName,
              provider: providers[0], // Take first provider
              consumers,
              location: hook.location
            };
            contextFlows.push(contextFlow);
          }
        }
      });
    });

    return contextFlows;
  }

  private extractContextName(hookName: string): string {
    return hookName.replace('use', '').replace('Context', '') + 'Context';
  }

  private findContextProviders(contextName: string, components: ComponentInfo[]): string[] {
    const providers: string[] = [];

    components.forEach(component => {
      if (component.name.toLowerCase().includes('provider') ||
          component.name.toLowerCase().includes(contextName.toLowerCase())) {
        providers.push(`${component.filePath}#${component.name}`);
      }
    });

    return providers;
  }

  private findContextConsumers(contextName: string, components: ComponentInfo[]): string[] {
    const consumers: string[] = [];

    components.forEach(component => {
      component.hooks.forEach(hook => {
        if (hook.type === 'useContext' && hook.name.includes(contextName)) {
          consumers.push(`${component.filePath}#${component.name}`);
        }
      });
    });

    return consumers;
  }

  private analyzeEventFlows(components: ComponentInfo[]): EventFlow[] {
    const eventFlows: EventFlow[] = [];

    components.forEach(component => {
      const eventHandlers = this.findEventHandlers(component);

      eventHandlers.forEach(handler => {
        const eventFlow: EventFlow = {
          id: `${component.filePath}#${component.name}#${handler.eventType}`,
          eventType: handler.eventType,
          source: `${component.filePath}#${component.name}`,
          handlers: [handler.handlerName],
          location: component.location
        };
        eventFlows.push(eventFlow);
      });
    });

    return eventFlows;
  }

  private findEventHandlers(component: ComponentInfo): Array<{eventType: string, handlerName: string}> {
    const handlers: Array<{eventType: string, handlerName: string}> = [];

    const commonEvents = [
      'onClick', 'onChange', 'onSubmit', 'onInput', 'onFocus', 'onBlur',
      'onMouseEnter', 'onMouseLeave', 'onKeyDown', 'onKeyUp'
    ];

    commonEvents.forEach(eventType => {
      const handlerName = `handle${eventType.substring(2)}`; // onClick -> handleClick
      handlers.push({ eventType, handlerName });
    });

    return handlers;
  }

  private analyzeApiFlows(components: ComponentInfo[]): ApiFlow[] {
    const apiFlows: ApiFlow[] = [];

    // Look for API calls in useEffect hooks
    components.forEach(component => {
      component.hooks.forEach(hook => {
        if (hook.type === 'useEffect') {
          const apiFlow: ApiFlow = {
            id: `${component.filePath}#${component.name}#${hook.name}`,
            component: `${component.filePath}#${component.name}`,
            dataState: `${component.filePath}#${component.name}#data`,
            location: hook.location
          };
          apiFlows.push(apiFlow);
        }
      });
    });

    return apiFlows;
  }

  /**
   * Generate a visualization-ready graph from data flow analysis
   */
  public generateDataFlowGraph(analysisResult: ReactDataFlowResult): {
    nodes: Array<{id: string, label: string, type: string}>,
    edges: Array<{from: string, to: string, type: string, label?: string}>
  } {
    const nodes: Array<{id: string, label: string, type: string}> = [];
    const edges: Array<{from: string, to: string, type: string, label?: string}> = [];

    // Add state nodes and edges
    analysisResult.stateFlows.forEach(flow => {
      nodes.push({
        id: flow.id,
        label: `${flow.hookName} (${flow.hookType})`,
        type: 'state'
      });

      // Add edges from state to readers
      flow.readers.forEach(reader => {
        edges.push({
          from: flow.id,
          to: reader,
          type: 'reads'
        });
      });

      // Add edges from writers to state
      flow.writers.forEach(writer => {
        edges.push({
          from: writer,
          to: flow.id,
          type: 'writes'
        });
      });
    });

    // Add prop flow edges
    analysisResult.propFlows.forEach(flow => {
      edges.push({
        from: flow.fromComponent,
        to: flow.toComponent,
        type: 'passes_prop',
        label: flow.propName
      });
    });

    // Add context flow edges
    analysisResult.contextFlows.forEach(flow => {
      flow.consumers.forEach(consumer => {
        edges.push({
          from: flow.provider,
          to: consumer,
          type: 'provides_context',
          label: flow.contextName
        });
      });
    });

    // Add event flow edges
    analysisResult.eventFlows.forEach(flow => {
      flow.handlers.forEach(handler => {
        edges.push({
          from: flow.source,
          to: handler,
          type: 'triggers_event',
          label: flow.eventType
        });
      });
    });

    // Add API flow nodes and edges
    analysisResult.apiFlows.forEach(flow => {
      const apiNodeId = `api-${flow.id}`;
      nodes.push({
        id: apiNodeId,
        label: flow.endpoint || 'API Call',
        type: 'api'
      });

      edges.push({
        from: flow.component,
        to: apiNodeId,
        type: 'api_call',
        label: flow.method
      });

      if (flow.dataState) {
        edges.push({
          from: apiNodeId,
          to: flow.dataState,
          type: 'updates_data'
        });
      }
    });

    return { nodes, edges };
  }
}