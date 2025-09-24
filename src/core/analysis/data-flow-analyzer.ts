import {
  ComponentInfo,
  FunctionInfo,
  DataFlow,
  SourceLocation,
  HookInfo,
  PropInfo
} from '../../types';

export interface DataFlowAnalysisResult {
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

export class DataFlowAnalyzer {
  private components: ComponentInfo[] = [];
  private functions: FunctionInfo[] = [];

  public analyze(
    components: ComponentInfo[],
    functions: FunctionInfo[]
  ): DataFlowAnalysisResult {
    this.components = components;
    this.functions = functions;

    const stateFlows = this.analyzeStateFlows();
    const propFlows = this.analyzePropFlows();
    const contextFlows = this.analyzeContextFlows();
    const eventFlows = this.analyzeEventFlows();
    const apiFlows = this.analyzeApiFlows();

    return {
      stateFlows,
      propFlows,
      contextFlows,
      eventFlows,
      apiFlows
    };
  }

  private analyzeStateFlows(): StateFlow[] {
    const stateFlows: StateFlow[] = [];

    this.components.forEach(component => {
      component.hooks.forEach(hook => {
        if (hook.type === 'useState' || hook.type === 'useReducer') {
          const stateFlow: StateFlow = {
            id: `${component.filePath}#${component.name}#${hook.name}`,
            componentId: `${component.filePath}#${component.name}`,
            hookName: hook.name,
            hookType: hook.type,
            readers: this.findStateReaders(component, hook),
            writers: this.findStateWriters(component, hook),
            location: hook.location
          };
          stateFlows.push(stateFlow);
        }
      });
    });

    return stateFlows;
  }

  private findStateReaders(component: ComponentInfo, hook: HookInfo): string[] {
    const readers: string[] = [];

    // This is a simplified implementation
    // In a real implementation, we would need to analyze the AST more deeply
    // to find where state variables are actually used

    // For useState, the first element of the returned array is the reader
    if (hook.type === 'useState') {
      readers.push(`${component.filePath}#${component.name}#render`);
    }

    // Check if state is passed as props to children
    component.children.forEach(child => {
      child.props.forEach(prop => {
        if (prop.name.includes(hook.name.replace('use', '').toLowerCase())) {
          readers.push(`${child.filePath}#${child.name}`);
        }
      });
    });

    return readers;
  }

  private findStateWriters(component: ComponentInfo, hook: HookInfo): string[] {
    const writers: string[] = [];

    // For useState, the second element of the returned array is the writer
    if (hook.type === 'useState') {
      writers.push(`${component.filePath}#${component.name}#setState`);
    }

    // Look for event handlers that might update state
    const eventHandlerPatterns = ['onClick', 'onChange', 'onSubmit', 'onInput'];
    eventHandlerPatterns.forEach(pattern => {
      // This would need deeper AST analysis in a real implementation
      writers.push(`${component.filePath}#${component.name}#${pattern}`);
    });

    return writers;
  }

  private analyzePropFlows(): PropFlow[] {
    const propFlows: PropFlow[] = [];

    this.components.forEach(component => {
      component.children.forEach(child => {
        child.props.forEach(prop => {
          const propFlow: PropFlow = {
            id: `${component.filePath}#${component.name}->${child.filePath}#${child.name}#${prop.name}`,
            fromComponent: `${component.filePath}#${component.name}`,
            toComponent: `${child.filePath}#${child.name}`,
            propName: prop.name,
            propType: prop.type,
            isRequired: prop.isRequired,
            location: component.location // Would need actual prop passing location
          };
          propFlows.push(propFlow);
        });
      });
    });

    return propFlows;
  }

  private analyzeContextFlows(): ContextFlow[] {
    const contextFlows: ContextFlow[] = [];

    // Find context providers and consumers
    this.components.forEach(component => {
      component.hooks.forEach(hook => {
        if (hook.type === 'useContext') {
          // Find the context provider (simplified heuristic)
          const contextName = this.extractContextName(hook.name);
          const providers = this.findContextProviders(contextName);
          const consumers = this.findContextConsumers(contextName);

          if (providers.length > 0) {
            const contextFlow: ContextFlow = {
              id: `context-${contextName}`,
              contextName,
              provider: providers[0], // Simplified - take first provider
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
    // Extract context name from hook like useUserContext -> UserContext
    return hookName.replace('use', '').replace('Context', '') + 'Context';
  }

  private findContextProviders(contextName: string): string[] {
    const providers: string[] = [];

    this.components.forEach(component => {
      if (component.name.toLowerCase().includes('provider') ||
          component.name.toLowerCase().includes(contextName.toLowerCase())) {
        providers.push(`${component.filePath}#${component.name}`);
      }
    });

    return providers;
  }

  private findContextConsumers(contextName: string): string[] {
    const consumers: string[] = [];

    this.components.forEach(component => {
      component.hooks.forEach(hook => {
        if (hook.type === 'useContext' && hook.name.includes(contextName)) {
          consumers.push(`${component.filePath}#${component.name}`);
        }
      });
    });

    return consumers;
  }

  private analyzeEventFlows(): EventFlow[] {
    const eventFlows: EventFlow[] = [];

    // Find event handlers in components
    this.components.forEach(component => {
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

    // This is a simplified implementation
    // In practice, we would need to analyze JSX attributes for event handlers
    const commonEvents = [
      'onClick', 'onChange', 'onSubmit', 'onInput', 'onFocus', 'onBlur',
      'onMouseEnter', 'onMouseLeave', 'onKeyDown', 'onKeyUp'
    ];

    commonEvents.forEach(eventType => {
      // Simplified: assume there might be handlers for these events
      const handlerName = `handle${eventType.substring(2)}`; // onClick -> handleClick
      handlers.push({ eventType, handlerName });
    });

    return handlers;
  }

  private analyzeApiFlows(): ApiFlow[] {
    const apiFlows: ApiFlow[] = [];

    // Look for API calls in functions and components
    this.functions.forEach(func => {
      func.calls.forEach(call => {
        if (this.isApiCall(call.name)) {
          const apiFlow: ApiFlow = {
            id: `${func.filePath}#${func.name}#${call.name}`,
            endpoint: this.extractEndpoint(call),
            method: this.extractHttpMethod(call.name),
            component: `${func.filePath}#${func.name}`,
            location: call.location
          };
          apiFlows.push(apiFlow);
        }
      });
    });

    // Look for API calls in useEffect hooks
    this.components.forEach(component => {
      component.hooks.forEach(hook => {
        if (hook.type === 'useEffect') {
          // This would need deeper AST analysis to find actual API calls
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

  private isApiCall(callName: string): boolean {
    const apiPatterns = [
      'fetch', 'axios', 'get', 'post', 'put', 'delete', 'patch',
      'request', 'ajax', 'api', 'call'
    ];

    return apiPatterns.some(pattern =>
      callName.toLowerCase().includes(pattern.toLowerCase())
    );
  }

  private extractEndpoint(call: any): string | undefined {
    // Try to extract endpoint from function call arguments
    if (call.arguments && call.arguments.length > 0) {
      const firstArg = call.arguments[0];
      // Look for string literals that might be URLs
      if (typeof firstArg === 'string' && (firstArg.startsWith('/') || firstArg.startsWith('http'))) {
        return firstArg.replace(/['"]/g, ''); // Remove quotes
      }
    }
    return undefined;
  }

  private extractHttpMethod(callName: string): string | undefined {
    const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
    const lowerCallName = callName.toLowerCase();

    for (const method of methods) {
      if (lowerCallName.includes(method.toLowerCase())) {
        return method;
      }
    }

    // Default assumptions based on common patterns
    if (lowerCallName.includes('fetch') || lowerCallName.includes('get')) {
      return 'GET';
    }
    if (lowerCallName.includes('post') || lowerCallName.includes('create')) {
      return 'POST';
    }
    if (lowerCallName.includes('put') || lowerCallName.includes('update')) {
      return 'PUT';
    }
    if (lowerCallName.includes('delete')) {
      return 'DELETE';
    }

    return undefined;
  }

  public generateDataFlowGraph(analysisResult: DataFlowAnalysisResult): {
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