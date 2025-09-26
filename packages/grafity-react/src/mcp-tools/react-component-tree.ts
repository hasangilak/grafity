import { tool } from '@anthropic-ai/claude-code';
import { z } from 'zod';
import { ReactProjectGraphProcessor } from '../graph/project-graph-processor';
import { ComponentHierarchy, ReactMCPToolResult } from '../types';

/**
 * MCP tool for getting React component hierarchy and relationships
 */
export const reactComponentTree = tool({
  name: 'grafity_react_component_tree',
  description: 'Get hierarchical tree of React components showing parent-child relationships, props, and hooks usage',
  inputSchema: z.object({
    projectName: z.string().describe('Name of the Nx project to analyze'),
    includeHooks: z.boolean().optional().default(true).describe('Include React hooks information'),
    includeProps: z.boolean().optional().default(true).describe('Include component props information'),
    maxDepth: z.number().optional().default(10).describe('Maximum depth to traverse component tree'),
  }),

  async handler({ projectName, includeHooks, includeProps, maxDepth }) {
    try {
      const processor = new ReactProjectGraphProcessor();

      // Get project configuration (this would come from Nx context)
      const projectRoot = `apps/${projectName}`; // Simplified - would get from actual Nx config

      const analysis = await processor.processProject(
        projectName,
        projectRoot,
        {} as any // Would pass actual Nx context
      );

      if (!analysis) {
        return {
          content: [{
            type: 'text' as const,
            text: `No React components found in project '${projectName}'.`
          }]
        } satisfies ReactMCPToolResult;
      }

      // Build component hierarchy
      const hierarchy = buildComponentHierarchy(analysis.components, {
        includeHooks,
        includeProps,
        maxDepth
      });

      const report = generateComponentTreeReport(hierarchy, projectName);

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
          text: `Error analyzing React components in '${projectName}': ${error instanceof Error ? error.message : String(error)}`
        }]
      } satisfies ReactMCPToolResult;
    }
  }
});

function buildComponentHierarchy(
  components: any[],
  options: { includeHooks: boolean; includeProps: boolean; maxDepth: number }
): ComponentHierarchy[] {
  // Create a map for quick lookup
  const componentMap = new Map(components.map(c =>
    [`${c.filePath}#${c.name}`, c]
  ));

  // Find root components (components not used as children by others)
  const usedAsChildren = new Set<string>();
  components.forEach(component => {
    component.children.forEach((child: any) => {
      usedAsChildren.add(`${child.filePath}#${child.name}`);
    });
  });

  const rootComponents = components.filter(c =>
    !usedAsChildren.has(`${c.filePath}#${c.name}`)
  );

  return rootComponents.map(component =>
    buildHierarchyNode(component, componentMap, options, 0)
  );
}

function buildHierarchyNode(
  component: any,
  componentMap: Map<string, any>,
  options: { includeHooks: boolean; includeProps: boolean; maxDepth: number },
  depth: number
): ComponentHierarchy {
  const node: ComponentHierarchy = {
    id: `${component.filePath}#${component.name}`,
    name: component.name,
    filePath: component.filePath,
    props: options.includeProps ? component.props : [],
    hooks: options.includeHooks ? component.hooks : [],
    children: []
  };

  if (depth < options.maxDepth) {
    node.children = component.children.map((child: any) => {
      const childComponent = componentMap.get(`${child.filePath}#${child.name}`);
      return childComponent
        ? buildHierarchyNode(childComponent, componentMap, options, depth + 1)
        : {
            id: `${child.filePath}#${child.name}`,
            name: child.name,
            filePath: child.filePath,
            props: options.includeProps ? child.props : [],
            hooks: [],
            children: []
          };
    });
  }

  return node;
}

function generateComponentTreeReport(hierarchy: ComponentHierarchy[], projectName: string): string {
  let report = `# React Component Tree - ${projectName}\n\n`;

  if (hierarchy.length === 0) {
    report += "No React components found or no clear component hierarchy detected.\n";
    return report;
  }

  report += `## Component Hierarchy\n\n`;

  hierarchy.forEach(rootComponent => {
    report += renderComponentNode(rootComponent, 0);
  });

  // Add summary statistics
  const stats = calculateTreeStats(hierarchy);
  report += `\n## Summary\n\n`;
  report += `- **Total Components**: ${stats.totalComponents}\n`;
  report += `- **Max Depth**: ${stats.maxDepth}\n`;
  report += `- **Total Props**: ${stats.totalProps}\n`;
  report += `- **Total Hooks**: ${stats.totalHooks}\n`;

  if (stats.hookTypes.size > 0) {
    report += `- **Hook Types Used**: ${Array.from(stats.hookTypes).join(', ')}\n`;
  }

  return report;
}

function renderComponentNode(node: ComponentHierarchy, depth: number): string {
  const indent = '  '.repeat(depth);
  const prefix = depth === 0 ? '📦' : '├─';

  let result = `${indent}${prefix} **${node.name}**\n`;
  result += `${indent}   📁 \`${node.filePath}\`\n`;

  if (node.props.length > 0) {
    result += `${indent}   🏷️ Props: ${node.props.map(p =>
      `${p.name}${p.isRequired ? '*' : '?'}: ${p.type}`
    ).join(', ')}\n`;
  }

  if (node.hooks.length > 0) {
    result += `${indent}   🎣 Hooks: ${node.hooks.map(h => h.name).join(', ')}\n`;
  }

  if (node.children.length > 0) {
    result += '\n';
    node.children.forEach(child => {
      result += renderComponentNode(child, depth + 1);
    });
  }

  result += '\n';
  return result;
}

function calculateTreeStats(hierarchy: ComponentHierarchy[]): {
  totalComponents: number;
  maxDepth: number;
  totalProps: number;
  totalHooks: number;
  hookTypes: Set<string>;
} {
  const stats = {
    totalComponents: 0,
    maxDepth: 0,
    totalProps: 0,
    totalHooks: 0,
    hookTypes: new Set<string>()
  };

  function traverse(node: ComponentHierarchy, depth: number) {
    stats.totalComponents++;
    stats.maxDepth = Math.max(stats.maxDepth, depth);
    stats.totalProps += node.props.length;
    stats.totalHooks += node.hooks.length;

    node.hooks.forEach(hook => {
      stats.hookTypes.add(hook.type);
    });

    node.children.forEach(child => {
      traverse(child, depth + 1);
    });
  }

  hierarchy.forEach(root => traverse(root, 0));
  return stats;
}