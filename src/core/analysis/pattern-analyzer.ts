import {
  ProjectGraph,
  ComponentInfo,
  FunctionInfo,
  ArchitecturalPattern,
  AntiPattern,
  ComplexityMetrics,
  SemanticData,
  SourceLocation,
  DependencyGraph,
  QualityIndicators
} from '../../types';

export class PatternAnalyzer {

  public analyzePatterns(graph: ProjectGraph): SemanticData {
    const architecturalPatterns = this.detectArchitecturalPatterns(graph);
    const antiPatterns = this.detectAntiPatterns(graph);
    const complexityMetrics = this.calculateComplexityMetrics(graph);
    const qualityIndicators = this.calculateQualityIndicators(graph, antiPatterns);

    return {
      architecturalPatterns,
      antiPatterns,
      businessDomains: [], // Will be populated by business context analyzer
      complexityMetrics,
      qualityIndicators
    };
  }

  private detectArchitecturalPatterns(graph: ProjectGraph): ArchitecturalPattern[] {
    const patterns: ArchitecturalPattern[] = [];

    // Detect MVC Pattern
    const mvcPattern = this.detectMVCPattern(graph);
    if (mvcPattern) patterns.push(mvcPattern);

    // Detect Observer Pattern (React Context/Hooks)
    const observerPatterns = this.detectObserverPattern(graph);
    patterns.push(...observerPatterns);

    // Detect Factory Pattern
    const factoryPatterns = this.detectFactoryPattern(graph);
    patterns.push(...factoryPatterns);

    // Detect Singleton Pattern
    const singletonPatterns = this.detectSingletonPattern(graph);
    patterns.push(...singletonPatterns);

    // Detect Strategy Pattern
    const strategyPatterns = this.detectStrategyPattern(graph);
    patterns.push(...strategyPatterns);

    // Detect Component Composition Pattern
    const compositionPatterns = this.detectCompositionPattern(graph);
    patterns.push(...compositionPatterns);

    return patterns;
  }

  private detectMVCPattern(graph: ProjectGraph): ArchitecturalPattern | null {
    const controllers: string[] = [];
    const models: string[] = [];
    const views: string[] = [];

    // Analyze components for MVC characteristics
    graph.components.forEach(component => {
      const name = component.name.toLowerCase();
      const filePath = component.filePath.toLowerCase();

      // Controller detection
      if (name.includes('controller') || filePath.includes('controller') ||
          name.includes('handler') || name.includes('service')) {
        controllers.push(component.name);
      }

      // Model detection
      if (name.includes('model') || filePath.includes('model') ||
          name.includes('entity') || name.includes('data')) {
        models.push(component.name);
      }

      // View detection (React components)
      if (component.type === 'function' || component.type === 'class') {
        if (!name.includes('controller') && !name.includes('model') &&
            !name.includes('service') && !name.includes('util')) {
          views.push(component.name);
        }
      }
    });

    // Check if we have all three layers with reasonable distribution
    if (controllers.length > 0 && models.length > 0 && views.length > 0) {
      const totalComponents = controllers.length + models.length + views.length;
      const confidence = Math.min(
        0.7 + (Math.min(controllers.length, models.length, views.length) / totalComponents) * 0.3,
        1.0
      );

      return {
        type: 'MVC',
        name: 'Model-View-Controller Pattern',
        description: 'Separation of concerns into Model (data), View (presentation), and Controller (logic) layers',
        components: [...controllers, ...models, ...views],
        confidence,
        location: { start: { line: 1, column: 1 }, end: { line: 1, column: 1 } },
        benefits: [
          'Clear separation of concerns',
          'Easier testing and maintenance',
          'Better code organization',
          'Improved scalability'
        ],
        considerations: [
          'May introduce complexity for simple applications',
          'Requires discipline to maintain boundaries'
        ]
      };
    }

    return null;
  }

  private detectObserverPattern(graph: ProjectGraph): ArchitecturalPattern[] {
    const patterns: ArchitecturalPattern[] = [];

    // Detect React Context patterns
    const contextComponents = graph.components.filter(comp =>
      comp.name.toLowerCase().includes('context') ||
      comp.name.toLowerCase().includes('provider')
    );

    contextComponents.forEach(context => {
      const consumers = graph.components.filter(comp =>
        comp.hooks.some(hook =>
          hook.type === 'useContext' ||
          hook.name.toLowerCase().includes(context.name.toLowerCase())
        )
      );

      if (consumers.length > 1) {
        patterns.push({
          type: 'Observer',
          name: `${context.name} Observer Pattern`,
          description: 'React Context-based state management enabling components to observe state changes',
          components: [context.name, ...consumers.map(c => c.name)],
          confidence: Math.min(0.8 + (consumers.length * 0.05), 1.0),
          location: context.location,
          benefits: [
            'Decoupled communication between components',
            'Automatic UI updates on state changes',
            'Centralized state management'
          ],
          considerations: [
            'Can cause unnecessary re-renders if not optimized',
            'May complicate component testing'
          ]
        });
      }
    });

    return patterns;
  }

  private detectFactoryPattern(graph: ProjectGraph): ArchitecturalPattern[] {
    const patterns: ArchitecturalPattern[] = [];

    graph.functions.forEach(func => {
      // Look for factory functions that create objects/components
      const isFactory = func.name.toLowerCase().includes('create') ||
                       func.name.toLowerCase().includes('factory') ||
                       func.name.toLowerCase().includes('builder') ||
                       func.name.toLowerCase().includes('make');

      if (isFactory && func.isExported) {
        // Check if function returns different types based on parameters
        const callsCreatePattern = func.calls.some(call =>
          call.name.includes('new') ||
          call.name.includes('create') ||
          call.name.includes('React.createElement')
        );

        if (callsCreatePattern) {
          patterns.push({
            type: 'Factory',
            name: `${func.name} Factory Pattern`,
            description: `Factory function for creating objects or components dynamically`,
            components: [func.name],
            confidence: 0.7,
            location: func.location,
            benefits: [
              'Encapsulates object creation logic',
              'Provides flexibility in object instantiation',
              'Promotes loose coupling'
            ],
            considerations: [
              'May add unnecessary abstraction for simple cases',
              'Can make debugging more difficult'
            ]
          });
        }
      }
    });

    return patterns;
  }

  private detectSingletonPattern(graph: ProjectGraph): ArchitecturalPattern[] {
    const patterns: ArchitecturalPattern[] = [];

    // Look for singleton-like patterns (services, utilities)
    graph.functions.forEach(func => {
      const name = func.name.toLowerCase();
      const path = func.filePath.toLowerCase();

      if ((name.includes('service') || name.includes('manager') || name.includes('instance')) &&
          func.isExported) {

        // Check if it's likely a singleton (no constructor calls, global state)
        const hasSingletonCharacteristics =
          !func.calls.some(call => call.name.includes('new')) &&
          (path.includes('service') || path.includes('manager') || path.includes('singleton'));

        if (hasSingletonCharacteristics) {
          patterns.push({
            type: 'Singleton',
            name: `${func.name} Singleton Pattern`,
            description: 'Service or utility that maintains single instance behavior',
            components: [func.name],
            confidence: 0.6,
            location: func.location,
            benefits: [
              'Ensures single instance access',
              'Global point of access',
              'Lazy initialization'
            ],
            considerations: [
              'Can create tight coupling',
              'Difficult to unit test',
              'May hide dependencies'
            ]
          });
        }
      }
    });

    return patterns;
  }

  private detectStrategyPattern(graph: ProjectGraph): ArchitecturalPattern[] {
    const patterns: ArchitecturalPattern[] = [];

    // Look for strategy-like patterns (multiple implementations of similar interface)
    const strategyGroups = new Map<string, string[]>();

    graph.components.forEach(component => {
      const name = component.name.toLowerCase();

      // Look for naming patterns that suggest strategies
      if (name.includes('strategy') || name.includes('handler') ||
          name.includes('provider') || name.includes('adapter')) {

        const basePattern = name.replace(/(strategy|handler|provider|adapter).*/, '');
        if (basePattern) {
          if (!strategyGroups.has(basePattern)) {
            strategyGroups.set(basePattern, []);
          }
          strategyGroups.get(basePattern)!.push(component.name);
        }
      }
    });

    // Create patterns for groups with multiple strategies
    strategyGroups.forEach((components, basePattern) => {
      if (components.length > 1) {
        patterns.push({
          type: 'Strategy',
          name: `${basePattern} Strategy Pattern`,
          description: `Multiple implementations providing different algorithms for ${basePattern}`,
          components,
          confidence: 0.7,
          location: { start: { line: 1, column: 1 }, end: { line: 1, column: 1 } },
          benefits: [
            'Flexible algorithm selection',
            'Easy to add new strategies',
            'Promotes open/closed principle'
          ],
          considerations: [
            'May increase complexity',
            'Client must be aware of different strategies'
          ]
        });
      }
    });

    return patterns;
  }

  private detectCompositionPattern(graph: ProjectGraph): ArchitecturalPattern[] {
    const patterns: ArchitecturalPattern[] = [];

    // Analyze component composition in React
    graph.components.forEach(component => {
      if (component.children.length > 2) {
        // This component composes multiple children
        const hasPropsFlow = component.children.some(child =>
          child.props.length > 0
        );

        if (hasPropsFlow) {
          patterns.push({
            type: 'Custom',
            name: `${component.name} Composition Pattern`,
            description: 'Component that composes multiple child components with prop passing',
            components: [component.name, ...component.children.map(c => c.name)],
            confidence: 0.8,
            location: component.location,
            benefits: [
              'Promotes reusability',
              'Clear component hierarchy',
              'Flexible composition'
            ],
            considerations: [
              'May create deep component trees',
              'Prop drilling can become an issue'
            ]
          });
        }
      }
    });

    return patterns;
  }

  private detectAntiPatterns(graph: ProjectGraph): AntiPattern[] {
    const antiPatterns: AntiPattern[] = [];

    // Detect God Objects
    antiPatterns.push(...this.detectGodObjects(graph));

    // Detect Circular Dependencies
    antiPatterns.push(...this.detectCircularDependencies(graph));

    // Detect Dead Code
    antiPatterns.push(...this.detectDeadCode(graph));

    // Detect Duplicated Code (simplified)
    antiPatterns.push(...this.detectDuplicatedCode(graph));

    // Detect Long Parameter Lists
    antiPatterns.push(...this.detectLongParameterLists(graph));

    return antiPatterns;
  }

  private detectGodObjects(graph: ProjectGraph): AntiPattern[] {
    const godObjects: AntiPattern[] = [];

    graph.components.forEach(component => {
      // Heuristics for God Object detection
      const functionCount = graph.functions.filter(f => f.filePath === component.filePath).length;
      const propsCount = component.props.length;
      const hooksCount = component.hooks.length;
      const childrenCount = component.children.length;

      const complexityScore = functionCount + (propsCount * 0.5) + hooksCount + (childrenCount * 0.3);

      if (complexityScore > 20) {
        godObjects.push({
          type: 'GodObject',
          name: `${component.name} God Object`,
          description: `Component ${component.name} has too many responsibilities and high complexity`,
          severity: complexityScore > 40 ? 'critical' : complexityScore > 30 ? 'high' : 'medium',
          affectedComponents: [component.name],
          location: component.location,
          suggestedFix: 'Consider breaking this component into smaller, focused components'
        });
      }
    });

    return godObjects;
  }

  private detectCircularDependencies(graph: ProjectGraph): AntiPattern[] {
    // This would integrate with existing circular dependency detection
    return []; // Placeholder - would use existing DependencyAnalyzer logic
  }

  private detectDeadCode(graph: ProjectGraph): AntiPattern[] {
    const deadCode: AntiPattern[] = [];

    // Simple dead code detection - functions/components that are defined but never used
    graph.functions.forEach(func => {
      if (!func.isExported) {
        const isUsed = graph.functions.some(otherFunc =>
          otherFunc.filePath !== func.filePath &&
          otherFunc.calls.some(call => call.name === func.name)
        );

        if (!isUsed) {
          deadCode.push({
            type: 'DeadCode',
            name: `Unused function: ${func.name}`,
            description: `Function ${func.name} is defined but never used`,
            severity: 'low',
            affectedComponents: [func.name],
            location: func.location,
            suggestedFix: 'Remove unused function or export if needed elsewhere'
          });
        }
      }
    });

    return deadCode;
  }

  private detectDuplicatedCode(graph: ProjectGraph): AntiPattern[] {
    // Simplified duplication detection based on similar function names
    const duplicates: AntiPattern[] = [];
    const functionGroups = new Map<string, FunctionInfo[]>();

    graph.functions.forEach(func => {
      const normalizedName = func.name.toLowerCase()
        .replace(/[0-9]/g, '')
        .replace(/(get|set|handle|on)/g, '');

      if (normalizedName.length > 3) {
        if (!functionGroups.has(normalizedName)) {
          functionGroups.set(normalizedName, []);
        }
        functionGroups.get(normalizedName)!.push(func);
      }
    });

    functionGroups.forEach((functions, pattern) => {
      if (functions.length > 2) {
        duplicates.push({
          type: 'DuplicatedCode',
          name: `Potential code duplication: ${pattern}`,
          description: `Multiple functions with similar names may indicate code duplication`,
          severity: 'medium',
          affectedComponents: functions.map(f => f.name),
          location: functions[0].location,
          suggestedFix: 'Review for potential refactoring into shared utility functions'
        });
      }
    });

    return duplicates;
  }

  private detectLongParameterLists(graph: ProjectGraph): AntiPattern[] {
    const longParameterLists: AntiPattern[] = [];

    graph.functions.forEach(func => {
      if (func.parameters.length > 5) {
        longParameterLists.push({
          type: 'LongParameterList',
          name: `Long parameter list: ${func.name}`,
          description: `Function ${func.name} has ${func.parameters.length} parameters`,
          severity: func.parameters.length > 8 ? 'high' : 'medium',
          affectedComponents: [func.name],
          location: func.location,
          suggestedFix: 'Consider using object parameters or breaking function into smaller functions'
        });
      }
    });

    return longParameterLists;
  }

  private calculateComplexityMetrics(graph: ProjectGraph): ComplexityMetrics {
    // Simplified complexity calculation
    const totalComponents = graph.components.length + graph.functions.length;
    const totalDependencies = graph.dependencies.edges.length;

    const cyclomaticComplexity = this.calculateCyclomaticComplexity(graph);
    const cognitiveComplexity = cyclomaticComplexity * 1.2; // Approximation
    const maintainabilityIndex = Math.max(0, 171 - 5.2 * Math.log(cyclomaticComplexity) - 0.23 * cognitiveComplexity);

    return {
      cyclomaticComplexity,
      cognitiveComplexity,
      maintainabilityIndex,
      technicalDebt: {
        totalMinutes: Math.round(cyclomaticComplexity * 2.5),
        issues: [],
        trends: []
      },
      coupling: {
        afferentCoupling: totalDependencies / totalComponents,
        efferentCoupling: totalDependencies / totalComponents,
        instability: 0.5 // Placeholder
      },
      cohesion: {
        lackOfCohesion: 0.3, // Placeholder
        cohesionRatio: 0.7 // Placeholder
      }
    };
  }

  private calculateCyclomaticComplexity(graph: ProjectGraph): number {
    // Simplified cyclomatic complexity based on function calls and conditions
    let complexity = graph.functions.length; // Base complexity

    graph.functions.forEach(func => {
      // Add complexity for function calls (approximation)
      complexity += func.calls.length * 0.1;
    });

    return Math.round(complexity);
  }

  private calculateQualityIndicators(graph: ProjectGraph, antiPatterns: AntiPattern[]): QualityIndicators {
    const criticalIssues = antiPatterns.filter(ap => ap.severity === 'critical').length;
    const highIssues = antiPatterns.filter(ap => ap.severity === 'high').length;
    const mediumIssues = antiPatterns.filter(ap => ap.severity === 'medium').length;

    const totalComponents = graph.components.length + graph.functions.length;
    const totalIssues = criticalIssues + highIssues + mediumIssues;

    // Calculate quality scores based on issues
    const maintainability = Math.max(0, 100 - (criticalIssues * 20 + highIssues * 10 + mediumIssues * 5));
    const reliability = Math.max(0, 100 - (criticalIssues * 25 + highIssues * 12));
    const security = Math.max(0, 100 - (criticalIssues * 30)); // Security issues are weighted more heavily

    // Documentation score based on exported functions vs total functions
    const exportedFunctions = graph.functions.filter(f => f.isExported).length;
    const documentation = totalComponents > 0 ? (exportedFunctions / totalComponents) * 100 : 100;

    return {
      maintainability: Math.round(maintainability),
      reliability: Math.round(reliability),
      security: Math.round(security),
      documentation: Math.round(documentation)
    };
  }
}