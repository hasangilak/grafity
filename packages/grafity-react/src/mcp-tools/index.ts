export * from './react-component-tree';
export * from './react-hook-usage';
export * from './react-prop-flow';

// Export all tools as an array for easy registration with nx-mcp
import { reactComponentTree } from './react-component-tree';
import { reactHookUsage } from './react-hook-usage';
import { reactPropFlow } from './react-prop-flow';

export const grafityReactMCPTools = [
  reactComponentTree,
  reactHookUsage,
  reactPropFlow,
];

// Tool descriptions for documentation
export const grafityReactToolsInfo = {
  'grafity_react_component_tree': {
    description: 'Analyze React component hierarchy, relationships, and structure',
    category: 'Structure Analysis',
    useCase: 'Understanding component composition and parent-child relationships'
  },
  'grafity_react_hook_usage': {
    description: 'Analyze React hooks usage patterns and detect potential issues',
    category: 'Hooks Analysis',
    useCase: 'Optimizing hook usage and detecting anti-patterns'
  },
  'grafity_react_prop_flow': {
    description: 'Analyze prop flows between components and detect prop drilling',
    category: 'Data Flow Analysis',
    useCase: 'Understanding data flow and identifying architectural improvements'
  },
};