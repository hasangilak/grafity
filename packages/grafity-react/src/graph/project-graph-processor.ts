import {
  CreateDependencies,
  CreateDependenciesContext,
  CreateNodes,
  CreateNodesContext,
  DependencyType,
  ProjectConfiguration,
  TargetConfiguration,
  workspaceRoot,
} from '@nx/devkit';
import { dirname, join } from 'path';
import { ReactASTParser } from '../analyzers/react-ast-parser';
import { ReactDataFlowAnalyzer } from '../analyzers/react-data-flow-analyzer';
import { ReactPatternAnalyzer } from '../analyzers/react-pattern-analyzer';
import { NxReactProjectData, ComponentInfo, ReactMetrics } from '../types';

export const name = 'grafity-react';

/**
 * Nx CreateNodes function that adds React analysis to project configurations
 */
export const createNodes: CreateNodes = [
  '**/project.json',
  (configFilePath, options, context) => {
    const projectRoot = dirname(configFilePath);
    const projectConfiguration = readProjectConfiguration(configFilePath);

    // Only process React/TypeScript projects
    if (!isReactProject(projectRoot, context)) {
      return {};
    }

    // Add React analysis targets
    const targets: Record<string, TargetConfiguration> = {
      'analyze-react': {
        executor: '@grafity/nx-react:analyze-react',
        options: {
          projectRoot,
        },
      },
      'visualize-components': {
        executor: '@grafity/nx-react:visualize-components',
        options: {
          projectRoot,
          outputPath: `dist/grafity-react/${projectConfiguration.name}`,
        },
      },
      'detect-patterns': {
        executor: '@grafity/nx-react:detect-patterns',
        options: {
          projectRoot,
          outputPath: `dist/grafity-react/${projectConfiguration.name}/patterns.json`,
        },
      },
    };

    return {
      projects: {
        [projectConfiguration.name]: {
          ...projectConfiguration,
          targets: {
            ...projectConfiguration.targets,
            ...targets,
          },
        },
      },
    };
  },
];

/**
 * Nx CreateDependencies function that analyzes React component dependencies
 */
export const createDependencies: CreateDependencies = (
  options,
  context: CreateDependenciesContext
) => {
  const dependencies: ReturnType<CreateDependencies> = [];

  // Process each React project
  Object.entries(context.projects).forEach(([projectName, project]) => {
    if (isReactProject(project.root, context)) {
      const reactDependencies = analyzeReactDependencies(project.root, context);

      reactDependencies.forEach(dep => {
        dependencies.push({
          source: projectName,
          target: dep.target,
          type: dep.type,
        });
      });
    }
  });

  return dependencies;
};

/**
 * Extend Nx project graph with React-specific data
 */
export class ReactProjectGraphProcessor {
  private astParser: ReactASTParser;
  private dataFlowAnalyzer: ReactDataFlowAnalyzer;
  private patternAnalyzer: ReactPatternAnalyzer;

  constructor() {
    this.astParser = new ReactASTParser([]);
    this.dataFlowAnalyzer = new ReactDataFlowAnalyzer();
    this.patternAnalyzer = new ReactPatternAnalyzer();
  }

  /**
   * Process a project and add React intelligence to its data
   */
  public async processProject(
    projectName: string,
    projectRoot: string,
    context: CreateNodesContext
  ): Promise<NxReactProjectData | null> {
    if (!isReactProject(projectRoot, context)) {
      return null;
    }

    // Find TypeScript/React files
    const sourceFiles = await this.findReactFiles(projectRoot);
    if (sourceFiles.length === 0) {
      return null;
    }

    // Create AST parser with project files
    const parser = new ReactASTParser(sourceFiles);
    const projectGraphProjectNode = {
      name: projectName,
      type: 'lib' as const,
      data: { root: projectRoot },
    };

    // Analyze React components
    const reactAnalysis = parser.analyzeNxProject(projectGraphProjectNode);
    const components = reactAnalysis.components;

    // Analyze data flows
    const dataFlows = this.dataFlowAnalyzer.analyzeProject(
      projectGraphProjectNode,
      components
    );

    // Detect patterns
    const patterns = this.patternAnalyzer.analyzePatterns(components);

    // Calculate metrics
    const metrics = this.calculateMetrics(components, patterns);

    return {
      components,
      patterns,
      dataFlows: {
        stateFlows: dataFlows.stateFlows,
        propFlows: dataFlows.propFlows,
        contextFlows: dataFlows.contextFlows,
      },
      metrics,
    };
  }

  private async findReactFiles(projectRoot: string): Promise<string[]> {
    const glob = require('glob');
    const path = require('path');

    const patterns = [
      `${projectRoot}/**/*.{ts,tsx}`,
      `${projectRoot}/**/*.{js,jsx}`,
    ];

    const files: string[] = [];
    for (const pattern of patterns) {
      const matches = glob.sync(pattern, {
        ignore: [
          '**/node_modules/**',
          '**/dist/**',
          '**/*.spec.*',
          '**/*.test.*',
        ],
      });
      files.push(...matches);
    }

    return files.map(f => path.resolve(f));
  }

  private calculateMetrics(
    components: ComponentInfo[],
    patterns: any[]
  ): ReactMetrics {
    const hookUsage: Record<string, number> = {};
    let totalComplexity = 0;
    let maxPropDepth = 0;
    let contextUsageCount = 0;

    components.forEach(component => {
      // Calculate hook usage
      component.hooks.forEach(hook => {
        hookUsage[hook.type] = (hookUsage[hook.type] || 0) + 1;
        if (hook.type === 'useContext') {
          contextUsageCount++;
        }
      });

      // Calculate complexity (simplified)
      const complexity =
        1 +
        component.props.length * 0.5 +
        component.hooks.length +
        component.children.length * 0.3;

      totalComplexity += complexity;

      // Calculate prop depth
      const propDepth = this.calculatePropDepth(component);
      maxPropDepth = Math.max(maxPropDepth, propDepth);
    });

    return {
      componentCount: components.length,
      hookUsage,
      complexity: totalComplexity / components.length || 0,
      propDepth: maxPropDepth,
      contextUsage: contextUsageCount,
    };
  }

  private calculatePropDepth(component: ComponentInfo, depth = 0): number {
    if (component.children.length === 0) {
      return depth;
    }

    return Math.max(
      ...component.children.map(child =>
        this.calculatePropDepth(child, depth + 1)
      )
    );
  }
}

// Helper functions

function readProjectConfiguration(configFilePath: string): ProjectConfiguration {
  const fs = require('fs');
  const content = fs.readFileSync(configFilePath, 'utf-8');
  return JSON.parse(content);
}

function isReactProject(projectRoot: string, context: CreateNodesContext): boolean {
  const fs = require('fs');
  const path = require('path');

  // Check for package.json with React dependencies
  const packageJsonPath = path.join(projectRoot, 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    try {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

      if (deps.react || deps['@types/react'] || deps.next || deps.gatsby) {
        return true;
      }
    } catch (e) {
      // Ignore JSON parse errors
    }
  }

  // Check for TypeScript config with JSX
  const tsConfigPath = path.join(projectRoot, 'tsconfig.json');
  if (fs.existsSync(tsConfigPath)) {
    try {
      const tsConfig = JSON.parse(fs.readFileSync(tsConfigPath, 'utf-8'));
      if (tsConfig.compilerOptions?.jsx) {
        return true;
      }
    } catch (e) {
      // Ignore JSON parse errors
    }
  }

  // Check for React files
  const glob = require('glob');
  const reactFiles = glob.sync(`${projectRoot}/**/*.{tsx,jsx}`, {
    ignore: ['**/node_modules/**'],
  });

  return reactFiles.length > 0;
}

function analyzeReactDependencies(projectRoot: string, context: CreateNodesContext) {
  const dependencies: Array<{
    target: string;
    type: DependencyType;
  }> = [];

  // This would analyze React-specific dependencies like:
  // - Component imports between projects
  // - Shared hook dependencies
  // - Context provider relationships

  // For now, return empty array
  // In a full implementation, this would parse import statements
  // and track React-specific relationships

  return dependencies;
}