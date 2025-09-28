import {
  createProjectGraphAsync,
  ProjectGraph,
  ProjectGraphDependency,
  ProjectGraphProjectNode,
  readJsonFile,
  workspaceRoot
} from '@nx/devkit';
import * as path from 'path';
import * as fs from 'fs';

export interface NxProjectData {
  name: string;
  root: string;
  sourceRoot?: string;
  projectType?: 'application' | 'library';
  targets?: Record<string, any>;
  tags?: string[];
  files?: string[];
  dependencies?: string[];
  implicitDependencies?: string[];
}

export interface NxGraphData {
  projects: Map<string, NxProjectData>;
  dependencies: Map<string, Set<string>>;
  affectedProjects?: Set<string>;
  workspaceLayout?: {
    appsDir?: string;
    libsDir?: string;
  };
}

export class NxGraphProcessor {
  private projectGraph: ProjectGraph | null = null;
  private workspaceRoot: string;

  constructor(workspaceRootPath?: string) {
    this.workspaceRoot = workspaceRootPath || workspaceRoot;
  }

  /**
   * Build or retrieve the Nx project graph
   */
  async buildProjectGraph(): Promise<ProjectGraph> {
    try {
      // Use Nx's optimized graph building
      this.projectGraph = await createProjectGraphAsync({
        exitOnError: false,
        resetDaemonClient: false
      });

      return this.projectGraph;
    } catch (error: any) {
      console.error('Failed to create Nx project graph:', error.message);
      throw new Error(`Nx graph creation failed: ${error.message}`);
    }
  }

  /**
   * Extract project data from Nx graph
   */
  async extractProjectData(): Promise<NxGraphData> {
    const graph = await this.buildProjectGraph();
    const projects = new Map<string, NxProjectData>();
    const dependencies = new Map<string, Set<string>>();

    // Process project nodes
    for (const [projectName, projectNode] of Object.entries(graph.nodes)) {
      const project = this.transformProjectNode(projectName, projectNode as ProjectGraphProjectNode);
      projects.set(projectName, project);

      // Extract files for this project
      project.files = await this.getProjectFiles(project.root, project.sourceRoot);

      // Initialize dependencies set
      dependencies.set(projectName, new Set());
    }

    // Process dependencies
    for (const [source, deps] of Object.entries(graph.dependencies)) {
      const projectDeps = dependencies.get(source) || new Set();

      for (const dep of deps) {
        if (dep.target) {
          projectDeps.add(dep.target);
        }
      }

      dependencies.set(source, projectDeps);
    }

    // Get workspace layout
    const workspaceLayout = await this.getWorkspaceLayout();

    return {
      projects,
      dependencies,
      workspaceLayout
    };
  }

  /**
   * Get all TypeScript/JavaScript files in a project
   */
  async getProjectFiles(projectRoot: string, sourceRoot?: string): Promise<string[]> {
    const searchRoot = sourceRoot
      ? path.join(this.workspaceRoot, sourceRoot)
      : path.join(this.workspaceRoot, projectRoot);

    if (!fs.existsSync(searchRoot)) {
      return [];
    }

    const files: string[] = [];
    const extensions = ['.ts', '.tsx', '.js', '.jsx'];

    const walkDirectory = (dir: string) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          // Skip node_modules and common build directories
          if (!['node_modules', 'dist', 'build', '.next', 'coverage'].includes(entry.name)) {
            walkDirectory(fullPath);
          }
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name);
          if (extensions.includes(ext)) {
            files.push(fullPath);
          }
        }
      }
    };

    walkDirectory(searchRoot);
    return files;
  }

  /**
   * Find affected projects based on file changes
   */
  async findAffectedProjects(changedFiles: string[]): Promise<Set<string>> {
    const graph = await this.buildProjectGraph();
    const affected = new Set<string>();

    for (const [projectName, projectNode] of Object.entries(graph.nodes)) {
      const project = projectNode as ProjectGraphProjectNode;
      const projectPath = path.join(this.workspaceRoot, project.data.root);

      // Check if any changed file belongs to this project
      for (const file of changedFiles) {
        if (file.startsWith(projectPath)) {
          affected.add(projectName);
          // Add dependent projects
          this.addDependentProjects(projectName, graph, affected);
          break;
        }
      }
    }

    return affected;
  }

  /**
   * Get project configuration
   */
  async getProjectConfig(projectName: string): Promise<any> {
    const graph = await this.buildProjectGraph();
    const projectNode = graph.nodes[projectName];

    if (!projectNode) {
      throw new Error(`Project ${projectName} not found in graph`);
    }

    // Try to read project.json
    const projectJsonPath = path.join(
      this.workspaceRoot,
      (projectNode as ProjectGraphProjectNode).data.root,
      'project.json'
    );

    if (fs.existsSync(projectJsonPath)) {
      return readJsonFile(projectJsonPath);
    }

    // Fallback to workspace.json/angular.json
    return (projectNode as ProjectGraphProjectNode).data;
  }

  /**
   * Get dependency chain for a project
   */
  async getDependencyChain(projectName: string): Promise<string[]> {
    const graph = await this.buildProjectGraph();
    const visited = new Set<string>();
    const chain: string[] = [];

    const traverse = (name: string) => {
      if (visited.has(name)) return;
      visited.add(name);

      const deps = graph.dependencies[name] || [];
      for (const dep of deps) {
        if (dep.target && graph.nodes[dep.target]) {
          chain.push(dep.target);
          traverse(dep.target);
        }
      }
    };

    traverse(projectName);
    return chain;
  }

  /**
   * Transform Nx project node to our format
   */
  private transformProjectNode(
    name: string,
    node: ProjectGraphProjectNode
  ): NxProjectData {
    return {
      name,
      root: node.data.root,
      sourceRoot: node.data.sourceRoot,
      projectType: node.data.projectType as 'application' | 'library',
      targets: node.data.targets,
      tags: node.data.tags,
      implicitDependencies: node.data.implicitDependencies
    };
  }

  /**
   * Add dependent projects recursively
   */
  private addDependentProjects(
    projectName: string,
    graph: ProjectGraph,
    affected: Set<string>
  ): void {
    for (const [depName, deps] of Object.entries(graph.dependencies)) {
      for (const dep of deps) {
        if (dep.target === projectName && !affected.has(depName)) {
          affected.add(depName);
          this.addDependentProjects(depName, graph, affected);
        }
      }
    }
  }

  /**
   * Get workspace layout configuration
   */
  private async getWorkspaceLayout(): Promise<any> {
    const nxJsonPath = path.join(this.workspaceRoot, 'nx.json');

    if (fs.existsSync(nxJsonPath)) {
      const nxJson = readJsonFile(nxJsonPath);
      return nxJson.workspaceLayout || {};
    }

    return {};
  }

  /**
   * Cache the project graph for performance
   */
  getCachedGraph(): ProjectGraph | null {
    return this.projectGraph;
  }

  /**
   * Clear the cached graph
   */
  clearCache(): void {
    this.projectGraph = null;
  }

  /**
   * Get graph statistics
   */
  async getGraphStatistics(): Promise<{
    projectCount: number;
    dependencyCount: number;
    applicationCount: number;
    libraryCount: number;
    avgDependencies: number;
  }> {
    const graph = await this.buildProjectGraph();
    const projects = Object.values(graph.nodes) as ProjectGraphProjectNode[];

    let dependencyCount = 0;
    let applicationCount = 0;
    let libraryCount = 0;

    for (const project of projects) {
      if (project.data.projectType === 'application') {
        applicationCount++;
      } else if (project.data.projectType === 'library') {
        libraryCount++;
      }

      dependencyCount += (graph.dependencies[project.name] || []).length;
    }

    return {
      projectCount: projects.length,
      dependencyCount,
      applicationCount,
      libraryCount,
      avgDependencies: projects.length > 0 ? dependencyCount / projects.length : 0
    };
  }
}