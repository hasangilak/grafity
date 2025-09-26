import { ComponentInfo, ReactPattern, ReactPatternRule } from '../types';

export class ReactPatternAnalyzer {
  private rules: ReactPatternRule[] = [
    {
      name: 'God Component',
      type: 'anti-pattern',
      description: 'Component with too many responsibilities',
      detect: this.detectGodComponents.bind(this)
    },
    {
      name: 'Prop Drilling',
      type: 'anti-pattern',
      description: 'Props passed through multiple component levels',
      detect: this.detectPropDrilling.bind(this)
    },
    {
      name: 'Hook Overuse',
      type: 'anti-pattern',
      description: 'Component using too many hooks',
      detect: this.detectHookOveruse.bind(this)
    },
    {
      name: 'Custom Hook Pattern',
      type: 'pattern',
      description: 'Well-structured custom hook implementation',
      detect: this.detectCustomHookPatterns.bind(this)
    },
    {
      name: 'Render Props Pattern',
      type: 'pattern',
      description: 'Component using render props for reusability',
      detect: this.detectRenderPropsPattern.bind(this)
    },
    {
      name: 'Context Provider Pattern',
      type: 'pattern',
      description: 'Proper context usage for state management',
      detect: this.detectContextProviderPattern.bind(this)
    }
  ];

  public analyzePatterns(components: ComponentInfo[]): ReactPattern[] {
    const patterns: ReactPattern[] = [];

    this.rules.forEach(rule => {
      const detectedPatterns = rule.detect(components);
      patterns.push(...detectedPatterns);
    });

    return patterns.sort((a, b) => b.confidence - a.confidence);
  }

  private detectGodComponents(components: ComponentInfo[]): ReactPattern[] {
    const patterns: ReactPattern[] = [];

    components.forEach(component => {
      const complexity = this.calculateComponentComplexity(component);

      if (complexity > 10) { // Threshold for god component
        patterns.push({
          id: `god-component-${component.filePath}-${component.name}`,
          name: 'God Component',
          type: 'anti-pattern',
          confidence: Math.min(complexity / 15, 1), // Scale confidence
          location: component.location,
          description: `Component '${component.name}' has high complexity (${complexity})`,
          components: [`${component.filePath}#${component.name}`],
          suggestions: [
            'Break this component into smaller, focused components',
            'Extract custom hooks for complex logic',
            'Consider using composition over inheritance',
            'Move side effects to separate service functions'
          ]
        });
      }
    });

    return patterns;
  }

  private calculateComponentComplexity(component: ComponentInfo): number {
    let complexity = 0;

    // Base complexity
    complexity += 1;

    // Props complexity
    complexity += component.props.length * 0.5;

    // Hooks complexity
    complexity += component.hooks.length;
    component.hooks.forEach(hook => {
      if (hook.type === 'useEffect') complexity += 2; // useEffect is more complex
      if (hook.type === 'custom') complexity += 1.5; // Custom hooks add complexity
    });

    // Children complexity
    complexity += component.children.length * 0.3;

    return Math.round(complexity);
  }

  private detectPropDrilling(components: ComponentInfo[]): ReactPattern[] {
    const patterns: ReactPattern[] = [];
    const propPaths = this.tracePropPaths(components);

    propPaths.forEach(path => {
      if (path.length > 3) { // Prop passed through 3+ levels
        patterns.push({
          id: `prop-drilling-${path.map(p => p.component).join('-')}`,
          name: 'Prop Drilling',
          type: 'anti-pattern',
          confidence: Math.min((path.length - 2) / 5, 1),
          location: path[0].location,
          description: `Prop '${path[0].propName}' passed through ${path.length} component levels`,
          components: path.map(p => p.component),
          suggestions: [
            'Consider using React Context for shared state',
            'Implement a state management library (Redux, Zustand)',
            'Create a custom hook for shared logic',
            'Restructure component hierarchy to reduce prop passing'
          ]
        });
      }
    });

    return patterns;
  }

  private tracePropPaths(components: ComponentInfo[]): Array<Array<{
    component: string,
    propName: string,
    location: any
  }>> {
    // Simplified prop path tracing
    // In a real implementation, this would require deeper AST analysis
    const paths: Array<Array<{component: string, propName: string, location: any}>> = [];

    components.forEach(component => {
      component.props.forEach(prop => {
        // Simple heuristic: if prop name appears in multiple components
        const propUsage = components.filter(c =>
          c.props.some(p => p.name === prop.name)
        );

        if (propUsage.length > 3) {
          const path = propUsage.map(c => ({
            component: `${c.filePath}#${c.name}`,
            propName: prop.name,
            location: c.location
          }));
          paths.push(path);
        }
      });
    });

    return paths;
  }

  private detectHookOveruse(components: ComponentInfo[]): ReactPattern[] {
    const patterns: ReactPattern[] = [];

    components.forEach(component => {
      if (component.hooks.length > 8) { // Threshold for too many hooks
        patterns.push({
          id: `hook-overuse-${component.filePath}-${component.name}`,
          name: 'Hook Overuse',
          type: 'anti-pattern',
          confidence: Math.min(component.hooks.length / 15, 1),
          location: component.location,
          description: `Component '${component.name}' uses ${component.hooks.length} hooks`,
          components: [`${component.filePath}#${component.name}`],
          suggestions: [
            'Extract related hooks into custom hooks',
            'Split component into smaller components',
            'Consider if all hooks are necessary',
            'Group related state using useReducer'
          ]
        });
      }
    });

    return patterns;
  }

  private detectCustomHookPatterns(components: ComponentInfo[]): ReactPattern[] {
    const patterns: ReactPattern[] = [];

    // Look for functions that start with 'use' and return hook-like patterns
    components.forEach(component => {
      const customHooks = component.hooks.filter(hook => hook.type === 'custom');

      if (customHooks.length > 0) {
        customHooks.forEach(hook => {
          patterns.push({
            id: `custom-hook-${component.filePath}-${hook.name}`,
            name: 'Custom Hook Pattern',
            type: 'pattern',
            confidence: 0.8,
            location: hook.location,
            description: `Custom hook '${hook.name}' provides reusable logic`,
            components: [`${component.filePath}#${component.name}`],
            suggestions: [
              'Document the custom hook with JSDoc',
              'Add TypeScript types for better type safety',
              'Consider extracting to a separate file for reusability'
            ]
          });
        });
      }
    });

    return patterns;
  }

  private detectRenderPropsPattern(components: ComponentInfo[]): ReactPattern[] {
    const patterns: ReactPattern[] = [];

    components.forEach(component => {
      // Look for props that might be render functions
      const renderProps = component.props.filter(prop =>
        prop.name.includes('render') ||
        prop.name.includes('children') ||
        prop.type.includes('React.ReactNode') ||
        prop.type.includes('() =>')
      );

      if (renderProps.length > 0) {
        patterns.push({
          id: `render-props-${component.filePath}-${component.name}`,
          name: 'Render Props Pattern',
          type: 'pattern',
          confidence: 0.7,
          location: component.location,
          description: `Component '${component.name}' uses render props for flexibility`,
          components: [`${component.filePath}#${component.name}`],
          suggestions: [
            'Document the render prop interface',
            'Consider using TypeScript generics for type safety',
            'Provide examples of render prop usage'
          ]
        });
      }
    });

    return patterns;
  }

  private detectContextProviderPattern(components: ComponentInfo[]): ReactPattern[] {
    const patterns: ReactPattern[] = [];

    components.forEach(component => {
      // Look for components that might be context providers
      if (component.name.includes('Provider') ||
          component.hooks.some(hook => hook.name.includes('Context'))) {

        const contextHooks = component.hooks.filter(hook =>
          hook.name.includes('Context') || hook.type === 'useContext'
        );

        if (contextHooks.length > 0) {
          patterns.push({
            id: `context-provider-${component.filePath}-${component.name}`,
            name: 'Context Provider Pattern',
            type: 'pattern',
            confidence: 0.8,
            location: component.location,
            description: `Component '${component.name}' implements context provider pattern`,
            components: [`${component.filePath}#${component.name}`],
            suggestions: [
              'Split context into smaller, focused contexts',
              'Provide TypeScript types for context value',
              'Add context consumer hook for easier usage',
              'Document context usage examples'
            ]
          });
        }
      }
    });

    return patterns;
  }

  /**
   * Generate a summary report of all patterns found
   */
  public generatePatternReport(patterns: ReactPattern[]): string {
    const patternsByType = patterns.reduce((acc, pattern) => {
      if (!acc[pattern.type]) acc[pattern.type] = [];
      acc[pattern.type].push(pattern);
      return acc;
    }, {} as Record<string, ReactPattern[]>);

    let report = '# React Pattern Analysis Report\n\n';

    // Summary
    report += '## Summary\n';
    report += `- Total patterns detected: ${patterns.length}\n`;
    report += `- Patterns: ${patternsByType.pattern?.length || 0}\n`;
    report += `- Anti-patterns: ${patternsByType['anti-pattern']?.length || 0}\n\n`;

    // Anti-patterns (issues to fix)
    if (patternsByType['anti-pattern']) {
      report += '## ⚠️ Anti-patterns (Issues to Address)\n\n';
      patternsByType['anti-pattern']
        .sort((a, b) => b.confidence - a.confidence)
        .forEach(pattern => {
          report += `### ${pattern.name} (Confidence: ${Math.round(pattern.confidence * 100)}%)\n`;
          report += `**Location:** \`${pattern.components.join(', ')}\`\n`;
          report += `**Issue:** ${pattern.description}\n\n`;
          if (pattern.suggestions && pattern.suggestions.length > 0) {
            report += '**Suggestions:**\n';
            pattern.suggestions.forEach(suggestion => {
              report += `- ${suggestion}\n`;
            });
          }
          report += '\n';
        });
    }

    // Good patterns
    if (patternsByType.pattern) {
      report += '## ✅ Good Patterns (Well-implemented)\n\n';
      patternsByType.pattern
        .sort((a, b) => b.confidence - a.confidence)
        .forEach(pattern => {
          report += `### ${pattern.name} (Confidence: ${Math.round(pattern.confidence * 100)}%)\n`;
          report += `**Location:** \`${pattern.components.join(', ')}\`\n`;
          report += `**Description:** ${pattern.description}\n\n`;
          if (pattern.suggestions && pattern.suggestions.length > 0) {
            report += '**Recommendations:**\n';
            pattern.suggestions.forEach(suggestion => {
              report += `- ${suggestion}\n`;
            });
          }
          report += '\n';
        });
    }

    return report;
  }
}