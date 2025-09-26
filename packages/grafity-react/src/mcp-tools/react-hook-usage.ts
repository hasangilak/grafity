import { tool } from '@anthropic-ai/claude-code';
import { z } from 'zod';
import { ReactProjectGraphProcessor } from '../graph/project-graph-processor';
import { ReactMCPToolResult, HookUsageGraph } from '../types';

/**
 * MCP tool for analyzing React hooks usage across components
 */
export const reactHookUsage = tool({
  name: 'grafity_react_hook_usage',
  description: 'Analyze React hooks usage patterns, dependencies, and potential issues across components',
  inputSchema: z.object({
    projectName: z.string().describe('Name of the Nx project to analyze'),
    hookType: z.string().optional().describe('Filter by specific hook type (useState, useEffect, useContext, custom, etc.)'),
    includeCustomHooks: z.boolean().optional().default(true).describe('Include custom hooks in analysis'),
    showDependencies: z.boolean().optional().default(true).describe('Show hook dependency arrays'),
  }),

  async handler({ projectName, hookType, includeCustomHooks, showDependencies }) {
    try {
      const processor = new ReactProjectGraphProcessor();
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

      const hookAnalysis = analyzeHookUsage(analysis.components, {
        hookType,
        includeCustomHooks,
        showDependencies
      });

      const report = generateHookUsageReport(hookAnalysis, projectName);

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
          text: `Error analyzing hooks in '${projectName}': ${error instanceof Error ? error.message : String(error)}`
        }]
      } satisfies ReactMCPToolResult;
    }
  }
});

interface HookUsageAnalysis {
  byComponent: Map<string, {
    component: string;
    filePath: string;
    hooks: any[];
  }>;
  byType: Map<string, any[]>;
  totalHooks: number;
  customHooks: any[];
  potentialIssues: Array<{
    type: string;
    component: string;
    hook: string;
    description: string;
    severity: 'low' | 'medium' | 'high';
  }>;
}

function analyzeHookUsage(
  components: any[],
  options: {
    hookType?: string;
    includeCustomHooks: boolean;
    showDependencies: boolean;
  }
): HookUsageAnalysis {
  const analysis: HookUsageAnalysis = {
    byComponent: new Map(),
    byType: new Map(),
    totalHooks: 0,
    customHooks: [],
    potentialIssues: []
  };

  components.forEach(component => {
    const componentId = `${component.filePath}#${component.name}`;
    const componentHooks = component.hooks.filter((hook: any) => {
      if (options.hookType && hook.type !== options.hookType) {
        return false;
      }
      if (!options.includeCustomHooks && hook.type === 'custom') {
        return false;
      }
      return true;
    });

    if (componentHooks.length > 0) {
      analysis.byComponent.set(componentId, {
        component: component.name,
        filePath: component.filePath,
        hooks: componentHooks
      });

      componentHooks.forEach((hook: any) => {
        analysis.totalHooks++;

        // Group by type
        if (!analysis.byType.has(hook.type)) {
          analysis.byType.set(hook.type, []);
        }
        analysis.byType.get(hook.type)!.push({
          ...hook,
          component: component.name,
          componentPath: component.filePath
        });

        // Track custom hooks
        if (hook.type === 'custom') {
          analysis.customHooks.push({
            ...hook,
            component: component.name,
            componentPath: component.filePath
          });
        }

        // Detect potential issues
        detectHookIssues(hook, component, analysis.potentialIssues);
      });
    }
  });

  return analysis;
}

function detectHookIssues(
  hook: any,
  component: any,
  issues: Array<{
    type: string;
    component: string;
    hook: string;
    description: string;
    severity: 'low' | 'medium' | 'high';
  }>
) {
  const componentId = `${component.filePath}#${component.name}`;

  // Missing dependencies in useEffect
  if (hook.type === 'useEffect' && hook.dependencies.length === 0 && hook.name !== 'useEffect(...)') {
    issues.push({
      type: 'missing-dependencies',
      component: componentId,
      hook: hook.name,
      description: 'useEffect may be missing dependencies',
      severity: 'medium'
    });
  }

  // Empty dependency array (might be intentional)
  if (hook.type === 'useEffect' && Array.isArray(hook.dependencies) && hook.dependencies.length === 0) {
    issues.push({
      type: 'empty-deps-array',
      component: componentId,
      hook: hook.name,
      description: 'useEffect has empty dependency array - will only run once',
      severity: 'low'
    });
  }

  // Many hooks in single component
  if (component.hooks.length > 8) {
    issues.push({
      type: 'too-many-hooks',
      component: componentId,
      hook: 'multiple',
      description: `Component uses ${component.hooks.length} hooks - consider breaking into smaller components`,
      severity: 'high'
    });
  }
}

function generateHookUsageReport(analysis: HookUsageAnalysis, projectName: string): string {
  let report = `# React Hooks Usage Analysis - ${projectName}\n\n`;

  // Summary
  report += `## Summary\n\n`;
  report += `- **Total Hooks**: ${analysis.totalHooks}\n`;
  report += `- **Components Using Hooks**: ${analysis.byComponent.size}\n`;
  report += `- **Hook Types Used**: ${analysis.byType.size}\n`;
  report += `- **Custom Hooks**: ${analysis.customHooks.length}\n`;
  report += `- **Potential Issues**: ${analysis.potentialIssues.length}\n\n`;

  // Hook types breakdown
  if (analysis.byType.size > 0) {
    report += `## Hook Types Distribution\n\n`;

    // Sort by usage count
    const sortedTypes = Array.from(analysis.byType.entries())
      .sort(([,a], [,b]) => b.length - a.length);

    sortedTypes.forEach(([type, hooks]) => {
      const percentage = ((hooks.length / analysis.totalHooks) * 100).toFixed(1);
      report += `- **${type}**: ${hooks.length} uses (${percentage}%)\n`;
    });

    report += '\n';
  }

  // Custom hooks detail
  if (analysis.customHooks.length > 0) {
    report += `## Custom Hooks\n\n`;

    const customHooksByName = new Map<string, any[]>();
    analysis.customHooks.forEach(hook => {
      if (!customHooksByName.has(hook.name)) {
        customHooksByName.set(hook.name, []);
      }
      customHooksByName.get(hook.name)!.push(hook);
    });

    customHooksByName.forEach((hooks, hookName) => {
      report += `### ${hookName}\n`;
      report += `- **Uses**: ${hooks.length}\n`;
      report += `- **Components**: ${hooks.map(h => h.component).join(', ')}\n\n`;
    });
  }

  // Component-by-component breakdown
  if (analysis.byComponent.size > 0) {
    report += `## Hook Usage by Component\n\n`;

    // Sort by number of hooks (descending)
    const sortedComponents = Array.from(analysis.byComponent.entries())
      .sort(([,a], [,b]) => b.hooks.length - a.hooks.length);

    sortedComponents.forEach(([componentId, data]) => {
      report += `### ${data.component}\n`;
      report += `**Location**: \`${data.filePath}\`\n\n`;

      // Group hooks by type
      const hooksByType = new Map<string, any[]>();
      data.hooks.forEach(hook => {
        if (!hooksByType.has(hook.type)) {
          hooksByType.set(hook.type, []);
        }
        hooksByType.get(hook.type)!.push(hook);
      });

      hooksByType.forEach((hooks, type) => {
        report += `**${type}** (${hooks.length}):\n`;
        hooks.forEach(hook => {
          report += `- \`${hook.name}\``;
          if (hook.dependencies && hook.dependencies.length > 0) {
            report += ` - deps: [${hook.dependencies.join(', ')}]`;
          }
          report += '\n';
        });
        report += '\n';
      });
    });
  }

  // Potential issues
  if (analysis.potentialIssues.length > 0) {
    report += `## ⚠️ Potential Issues\n\n`;

    // Group by severity
    const issuesBySeverity = new Map<string, any[]>();
    analysis.potentialIssues.forEach(issue => {
      if (!issuesBySeverity.has(issue.severity)) {
        issuesBySeverity.set(issue.severity, []);
      }
      issuesBySeverity.get(issue.severity)!.push(issue);
    });

    // Show high severity first
    ['high', 'medium', 'low'].forEach(severity => {
      const issues = issuesBySeverity.get(severity);
      if (issues && issues.length > 0) {
        const icon = severity === 'high' ? '🚨' : severity === 'medium' ? '⚠️' : 'ℹ️';
        report += `### ${icon} ${severity.toUpperCase()} Priority\n\n`;

        issues.forEach(issue => {
          report += `**${issue.component}** - ${issue.description}\n`;
          report += `- Hook: \`${issue.hook}\`\n`;
          report += `- Type: ${issue.type}\n\n`;
        });
      }
    });
  }

  // Recommendations
  report += `## 💡 Recommendations\n\n`;

  if (analysis.potentialIssues.length > 0) {
    report += `- Address the ${analysis.potentialIssues.length} potential issues listed above\n`;
  }

  if (analysis.customHooks.length === 0) {
    report += `- Consider extracting reusable logic into custom hooks\n`;
  }

  const componentsWithManyHooks = Array.from(analysis.byComponent.values())
    .filter(comp => comp.hooks.length > 6);

  if (componentsWithManyHooks.length > 0) {
    report += `- Consider breaking down components with many hooks (${componentsWithManyHooks.length} components)\n`;
  }

  report += `- Use ESLint rules like \`react-hooks/exhaustive-deps\` to catch dependency issues\n`;
  report += `- Consider using \`useCallback\` and \`useMemo\` for performance optimization where needed\n`;

  return report;
}