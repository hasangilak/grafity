import { tool } from '@anthropic-ai/claude-code';
import { z } from 'zod';
import { ReactProjectGraphProcessor } from '../graph/project-graph-processor';
import { ReactDataFlowAnalyzer } from '../analyzers';
import { ReactMCPToolResult, PropFlowGraph } from '../types';

/**
 * MCP tool for analyzing prop flows between React components
 */
export const reactPropFlow = tool({
  name: 'grafity_react_prop_flow',
  description: 'Analyze how props flow between React components, detect prop drilling, and identify data flow patterns',
  inputSchema: z.object({
    projectName: z.string().describe('Name of the Nx project to analyze'),
    maxDepth: z.number().optional().default(5).describe('Maximum prop passing depth to analyze'),
    includeTypes: z.boolean().optional().default(true).describe('Include prop type information'),
    detectPropDrilling: z.boolean().optional().default(true).describe('Detect potential prop drilling anti-patterns'),
  }),

  async handler({ projectName, maxDepth, includeTypes, detectPropDrilling }) {
    try {
      const processor = new ReactProjectGraphProcessor();
      const dataFlowAnalyzer = new ReactDataFlowAnalyzer();
      const projectRoot = `apps/${projectName}`;

      const analysis = await processor.processProject(
        projectName,
        projectRoot,
        {} as any
      );

      if (!analysis) {
        return {
          content: [{
            type: 'text' as const,
            text: `No React components found in project '${projectName}'.`
          }]
        } satisfies ReactMCPToolResult;
      }

      const propFlowAnalysis = analyzePropFlows(
        analysis.components,
        analysis.dataFlows.propFlows,
        { maxDepth, includeTypes, detectPropDrilling }
      );

      const report = generatePropFlowReport(propFlowAnalysis, projectName);

      return {
        content: [{
          type: 'text' as const,
          text: report
        }]
      } satisfies ReactMCPToolResult;

    } catch (error) {
      return {
        content: [{
          type: 'text' as const,
          text: `Error analyzing prop flows in '${projectName}': ${error instanceof Error ? error.message : String(error)}`
        }]
      } satisfies ReactMCPToolResult;
    }
  }
});

interface PropFlowAnalysis {
  flows: Array<{
    from: string;
    to: string;
    propName: string;
    propType: string;
    isRequired: boolean;
    depth: number;
  }>;
  propDrillingCases: Array<{
    propName: string;
    path: string[];
    depth: number;
    severity: 'low' | 'medium' | 'high';
  }>;
  complexProps: Array<{
    component: string;
    propName: string;
    propType: string;
    complexity: number;
  }>;
  statistics: {
    totalPropFlows: number;
    averagePropsPerComponent: number;
    maxPropDepth: number;
    mostUsedPropNames: Map<string, number>;
  };
}

function analyzePropFlows(
  components: any[],
  propFlows: any[],
  options: {
    maxDepth: number;
    includeTypes: boolean;
    detectPropDrilling: boolean;
  }
): PropFlowAnalysis {
  const analysis: PropFlowAnalysis = {
    flows: [],
    propDrillingCases: [],
    complexProps: [],
    statistics: {
      totalPropFlows: 0,
      averagePropsPerComponent: 0,
      maxPropDepth: 0,
      mostUsedPropNames: new Map(),
    }
  };

  // Process all prop flows
  const propPaths = new Map<string, string[]>();

  propFlows.forEach(flow => {
    analysis.flows.push({
      from: flow.fromComponent,
      to: flow.toComponent,
      propName: flow.propName,
      propType: flow.propType,
      isRequired: flow.isRequired,
      depth: 1 // Will be calculated in path analysis
    });

    // Track prop paths for drilling detection
    if (!propPaths.has(flow.propName)) {
      propPaths.set(flow.propName, []);
    }
    propPaths.get(flow.propName)!.push(flow.fromComponent, flow.toComponent);
  });

  // Calculate statistics
  analysis.statistics.totalPropFlows = propFlows.length;

  const propCounts = new Map<string, number>();
  components.forEach(component => {
    const componentId = `${component.filePath}#${component.name}`;
    propCounts.set(componentId, component.props.length);

    // Track prop name usage
    component.props.forEach((prop: any) => {
      const count = analysis.statistics.mostUsedPropNames.get(prop.name) || 0;
      analysis.statistics.mostUsedPropNames.set(prop.name, count + 1);
    });

    // Identify complex props
    component.props.forEach((prop: any) => {
      const complexity = calculatePropComplexity(prop);
      if (complexity > 3) {
        analysis.complexProps.push({
          component: component.name,
          propName: prop.name,
          propType: prop.type,
          complexity
        });
      }
    });
  });

  if (components.length > 0) {
    const totalProps = Array.from(propCounts.values()).reduce((a, b) => a + b, 0);
    analysis.statistics.averagePropsPerComponent = totalProps / components.length;
  }

  // Detect prop drilling
  if (options.detectPropDrilling) {
    propPaths.forEach((path, propName) => {
      const uniquePath = [...new Set(path)];
      if (uniquePath.length > 3) {
        const severity = uniquePath.length > 5 ? 'high' : uniquePath.length > 4 ? 'medium' : 'low';
        analysis.propDrillingCases.push({
          propName,
          path: uniquePath,
          depth: uniquePath.length,
          severity
        });

        analysis.statistics.maxPropDepth = Math.max(
          analysis.statistics.maxPropDepth,
          uniquePath.length
        );
      }
    });
  }

  return analysis;
}

function calculatePropComplexity(prop: any): number {
  let complexity = 1;

  // Type complexity
  const type = prop.type.toLowerCase();
  if (type.includes('object') || type.includes('{')) complexity += 2;
  if (type.includes('function') || type.includes('=>')) complexity += 2;
  if (type.includes('array') || type.includes('[]')) complexity += 1;
  if (type.includes('union') || type.includes('|')) complexity += 1;
  if (type.includes('generic') || type.includes('<')) complexity += 1;

  // Length-based complexity
  if (prop.type.length > 50) complexity += 1;
  if (prop.type.length > 100) complexity += 1;

  return complexity;
}

function generatePropFlowReport(analysis: PropFlowAnalysis, projectName: string): string {
  let report = `# React Prop Flow Analysis - ${projectName}\n\n`;

  // Summary
  report += `## Summary\n\n`;
  report += `- **Total Prop Flows**: ${analysis.statistics.totalPropFlows}\n`;
  report += `- **Average Props per Component**: ${analysis.statistics.averagePropsPerComponent.toFixed(1)}\n`;
  report += `- **Max Prop Depth**: ${analysis.statistics.maxPropDepth}\n`;
  report += `- **Prop Drilling Cases**: ${analysis.propDrillingCases.length}\n`;
  report += `- **Complex Props**: ${analysis.complexProps.length}\n\n`;

  // Most used prop names
  if (analysis.statistics.mostUsedPropNames.size > 0) {
    report += `## Most Common Prop Names\n\n`;

    const sortedProps = Array.from(analysis.statistics.mostUsedPropNames.entries())
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10);

    sortedProps.forEach(([propName, count]) => {
      report += `- **${propName}**: ${count} components\n`;
    });

    report += '\n';
  }

  // Prop drilling detection
  if (analysis.propDrillingCases.length > 0) {
    report += `## 🚨 Prop Drilling Detection\n\n`;

    // Group by severity
    const bySeverity = new Map<string, any[]>();
    analysis.propDrillingCases.forEach(case_ => {
      if (!bySeverity.has(case_.severity)) {
        bySeverity.set(case_.severity, []);
      }
      bySeverity.get(case_.severity)!.push(case_);
    });

    ['high', 'medium', 'low'].forEach(severity => {
      const cases = bySeverity.get(severity);
      if (cases && cases.length > 0) {
        const icon = severity === 'high' ? '🚨' : severity === 'medium' ? '⚠️' : 'ℹ️';
        report += `### ${icon} ${severity.toUpperCase()} Priority (${cases.length} cases)\n\n`;

        cases.forEach(case_ => {
          report += `**Prop: \`${case_.propName}\`** (${case_.depth} levels deep)\n`;
          report += `Path: ${case_.path.map(p => p.split('#')[1] || p).join(' → ')}\n\n`;
        });
      }
    });

    report += `### 💡 Prop Drilling Solutions\n\n`;
    report += `- **React Context**: For app-wide state that many components need\n`;
    report += `- **State Management**: Libraries like Redux, Zustand, or Jotai\n`;
    report += `- **Component Composition**: Use children props and component composition\n`;
    report += `- **Custom Hooks**: Extract shared logic into reusable hooks\n\n`;
  }

  // Complex props analysis
  if (analysis.complexProps.length > 0) {
    report += `## 🔍 Complex Props Analysis\n\n`;

    const sortedComplexProps = analysis.complexProps
      .sort((a, b) => b.complexity - a.complexity)
      .slice(0, 10);

    sortedComplexProps.forEach(prop => {
      report += `### ${prop.component}.${prop.propName}\n`;
      report += `- **Complexity Score**: ${prop.complexity}\n`;
      report += `- **Type**: \`${prop.propType}\`\n\n`;
    });

    report += `### 💡 Complex Props Recommendations\n\n`;
    report += `- Break down complex objects into smaller, focused props\n`;
    report += `- Use TypeScript interfaces to make prop types clearer\n`;
    report += `- Consider using discriminated unions for polymorphic props\n`;
    report += `- Extract prop validation logic into custom validators\n\n`;
  }

  // Detailed flow analysis
  if (analysis.flows.length > 0 && analysis.flows.length <= 20) {
    report += `## Detailed Prop Flows\n\n`;

    // Group flows by component
    const flowsByComponent = new Map<string, any[]>();
    analysis.flows.forEach(flow => {
      const fromComponent = flow.from.split('#')[1] || flow.from;
      if (!flowsByComponent.has(fromComponent)) {
        flowsByComponent.set(fromComponent, []);
      }
      flowsByComponent.get(fromComponent)!.push(flow);
    });

    flowsByComponent.forEach((flows, component) => {
      report += `### ${component}\n\n`;
      flows.forEach(flow => {
        const toComponent = flow.to.split('#')[1] || flow.to;
        const required = flow.isRequired ? '**required**' : '_optional_';
        report += `- \`${flow.propName}\`: \`${flow.propType}\` → **${toComponent}** (${required})\n`;
      });
      report += '\n';
    });
  } else if (analysis.flows.length > 20) {
    report += `## Prop Flow Summary\n\n`;
    report += `Too many prop flows to list individually (${analysis.flows.length} total).\n`;
    report += `Consider running the analysis on individual components for detailed breakdown.\n\n`;
  }

  // Recommendations
  report += `## 📋 Overall Recommendations\n\n`;

  if (analysis.propDrillingCases.length > 0) {
    report += `- **High Priority**: Address ${analysis.propDrillingCases.filter(c => c.severity === 'high').length} severe prop drilling cases\n`;
  }

  if (analysis.statistics.averagePropsPerComponent > 8) {
    report += `- **Simplification**: Average of ${analysis.statistics.averagePropsPerComponent.toFixed(1)} props per component is high - consider breaking down components\n`;
  }

  if (analysis.complexProps.length > 0) {
    report += `- **Type Safety**: Simplify ${analysis.complexProps.length} complex prop types for better maintainability\n`;
  }

  report += `- **Documentation**: Add PropTypes or TypeScript interfaces for better prop documentation\n`;
  report += `- **Testing**: Test components with different prop combinations\n`;
  report += `- **Performance**: Consider using React.memo for components receiving many props\n`;

  return report;
}