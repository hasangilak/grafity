import { ConfigManager } from '../../config/ConfigManager';
import { CacheService } from '../cache/service';
import { ComponentExtractor } from '../../core/ast-mechanical/extractors/ComponentExtractor';
import { FunctionAnalyzer } from '../../core/ast-mechanical/extractors/FunctionAnalyzer';
import { ASTParser } from '../../core/ast/parser';

export interface Component {
  id: string;
  name: string;
  type: 'function_component' | 'class_component' | 'arrow_function' | 'higher_order_component';
  path: string;
  startLine: number;
  endLine: number;
  props: ComponentProp[];
  hooks: ComponentHook[];
  children: string[];
  parents: string[];
  dependencies: ComponentDependency[];
  complexity: number;
  linesOfCode: number;
  testCoverage?: number;
  lastModified: Date;
  projectId: string;
  exports: string[];
  imports: ComponentImport[];
}

export interface ComponentProp {
  name: string;
  type: string;
  required: boolean;
  defaultValue?: string;
  description?: string;
}

export interface ComponentHook {
  name: string;
  type: 'useState' | 'useEffect' | 'useContext' | 'useReducer' | 'useMemo' | 'useCallback' | 'custom';
  dependencies?: string[];
  complexity: number;
}

export interface ComponentDependency {
  name: string;
  type: 'component' | 'hook' | 'utility' | 'external';
  source: string;
  isInternal: boolean;
}

export interface ComponentImport {
  name: string;
  source: string;
  isDefault: boolean;
  isNamespace: boolean;
}

export interface ComponentFilters {
  type?: string;
  projectId?: string;
  complexity?: { min?: number; max?: number };
  hooks?: string[];
  hasTests?: boolean;
  search?: string;
}

export interface ComponentMetrics {
  totalComponents: number;
  byType: Record<string, number>;
  averageComplexity: number;
  averageLinesOfCode: number;
  mostComplex: Component[];
  leastTested: Component[];
  hookUsage: Record<string, number>;
  dependencyStats: {
    mostDependedOn: Array<{ component: string; dependents: number }>;
    mostDependencies: Array<{ component: string; dependencies: number }>;
  };
}

export class ComponentService {
  private configManager: ConfigManager;
  private cacheService: CacheService;
  private componentExtractor: ComponentExtractor;
  private functionAnalyzer: FunctionAnalyzer;
  private astParser: ASTParser;

  // In-memory storage for demo purposes
  private components: Map<string, Component> = new Map();

  constructor(
    configManager: ConfigManager,
    cacheService: CacheService
  ) {
    this.configManager = configManager;
    this.cacheService = cacheService;
    this.componentExtractor = new ComponentExtractor();
    this.functionAnalyzer = new FunctionAnalyzer();
    this.astParser = new ASTParser();

    // Initialize with sample data
    this.initializeSampleComponents();
  }

  async analyzeComponent(
    code: string,
    filePath: string,
    projectId: string
  ): Promise<Component[]> {
    const cacheKey = `components:analyze:${projectId}:${filePath}:${this.generateCodeHash(code)}`;

    // Try cache first
    const cached = await this.cacheService.get(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      // Parse code and extract components
      const ast = await this.astParser.parseCode(code, this.detectLanguage(filePath));
      const extractedComponents = await this.componentExtractor.extract(ast);

      const components: Component[] = extractedComponents.map((comp: any) => ({
        id: `comp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: comp.name,
        type: comp.type || 'function_component',
        path: filePath,
        startLine: comp.startLine || 1,
        endLine: comp.endLine || 1,
        props: this.extractProps(comp),
        hooks: this.extractHooks(comp),
        children: comp.children || [],
        parents: [],
        dependencies: this.extractDependencies(comp),
        complexity: comp.complexity || this.calculateComplexity(comp),
        linesOfCode: comp.linesOfCode || (comp.endLine - comp.startLine + 1),
        lastModified: new Date(),
        projectId,
        exports: comp.exports || [comp.name],
        imports: this.extractImports(comp)
      }));

      // Store components
      components.forEach(component => {
        this.components.set(component.id, component);
      });

      // Update component relationships
      await this.updateComponentRelationships(components);

      // Cache for 20 minutes
      await this.cacheService.set(cacheKey, components, 1200);

      return components;

    } catch (error) {
      console.error('Component analysis failed:', error);
      return [];
    }
  }

  async getComponent(componentId: string): Promise<Component | null> {
    return this.components.get(componentId) || null;
  }

  async listComponents(
    filters: ComponentFilters = {},
    pagination: { page: number; limit: number; offset: number },
    sort?: { field: string; order: 'asc' | 'desc' }
  ): Promise<{ components: Component[]; totalCount: number }> {
    let filteredComponents = Array.from(this.components.values());

    // Apply filters
    if (filters.type) {
      filteredComponents = filteredComponents.filter(c => c.type === filters.type);
    }

    if (filters.projectId) {
      filteredComponents = filteredComponents.filter(c => c.projectId === filters.projectId);
    }

    if (filters.complexity) {
      const { min, max } = filters.complexity;
      filteredComponents = filteredComponents.filter(c =>
        (!min || c.complexity >= min) && (!max || c.complexity <= max)
      );
    }

    if (filters.hooks && filters.hooks.length > 0) {
      filteredComponents = filteredComponents.filter(c =>
        filters.hooks!.some(hook => c.hooks.some(h => h.name === hook))
      );
    }

    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filteredComponents = filteredComponents.filter(c =>
        c.name.toLowerCase().includes(searchLower) ||
        c.path.toLowerCase().includes(searchLower)
      );
    }

    // Apply sorting
    if (sort) {
      filteredComponents.sort((a, b) => {
        const aValue = (a as any)[sort.field];
        const bValue = (b as any)[sort.field];
        const order = sort.order === 'desc' ? -1 : 1;

        if (aValue instanceof Date && bValue instanceof Date) {
          return (aValue.getTime() - bValue.getTime()) * order;
        }

        return aValue > bValue ? order : -order;
      });
    }

    // Apply pagination
    const totalCount = filteredComponents.length;
    const paginatedComponents = filteredComponents.slice(
      pagination.offset,
      pagination.offset + pagination.limit
    );

    return {
      components: paginatedComponents,
      totalCount
    };
  }

  async getComponentsByProject(projectId: string): Promise<Component[]> {
    return Array.from(this.components.values()).filter(c => c.projectId === projectId);
  }

  async getComponentDependencies(componentId: string): Promise<{
    dependencies: Component[];
    dependents: Component[];
    graph: any;
  }> {
    const component = await this.getComponent(componentId);
    if (!component) {
      throw new Error('Component not found');
    }

    const allComponents = Array.from(this.components.values());

    // Find components this component depends on
    const dependencies = allComponents.filter(c =>
      component.dependencies.some(dep => dep.name === c.name)
    );

    // Find components that depend on this component
    const dependents = allComponents.filter(c =>
      c.dependencies.some(dep => dep.name === component.name)
    );

    // Generate dependency graph
    const graph = {
      nodes: [
        { id: component.id, label: component.name, type: 'current' },
        ...dependencies.map(c => ({ id: c.id, label: c.name, type: 'dependency' })),
        ...dependents.map(c => ({ id: c.id, label: c.name, type: 'dependent' }))
      ],
      edges: [
        ...dependencies.map(c => ({
          id: `${c.id}-${component.id}`,
          source: c.id,
          target: component.id,
          type: 'dependency'
        })),
        ...dependents.map(c => ({
          id: `${component.id}-${c.id}`,
          source: component.id,
          target: c.id,
          type: 'dependent'
        }))
      ]
    };

    return { dependencies, dependents, graph };
  }

  async getComponentMetrics(projectId?: string): Promise<ComponentMetrics> {
    const components = projectId
      ? await this.getComponentsByProject(projectId)
      : Array.from(this.components.values());

    const metrics: ComponentMetrics = {
      totalComponents: components.length,
      byType: {},
      averageComplexity: 0,
      averageLinesOfCode: 0,
      mostComplex: [],
      leastTested: [],
      hookUsage: {},
      dependencyStats: {
        mostDependedOn: [],
        mostDependencies: []
      }
    };

    // Calculate type distribution
    components.forEach(component => {
      metrics.byType[component.type] = (metrics.byType[component.type] || 0) + 1;
    });

    // Calculate averages
    if (components.length > 0) {
      metrics.averageComplexity = components.reduce((sum, c) => sum + c.complexity, 0) / components.length;
      metrics.averageLinesOfCode = components.reduce((sum, c) => sum + c.linesOfCode, 0) / components.length;
    }

    // Find most complex components
    metrics.mostComplex = components
      .sort((a, b) => b.complexity - a.complexity)
      .slice(0, 5);

    // Find least tested components
    metrics.leastTested = components
      .filter(c => c.testCoverage !== undefined)
      .sort((a, b) => (a.testCoverage || 0) - (b.testCoverage || 0))
      .slice(0, 5);

    // Calculate hook usage
    components.forEach(component => {
      component.hooks.forEach(hook => {
        metrics.hookUsage[hook.name] = (metrics.hookUsage[hook.name] || 0) + 1;
      });
    });

    // Calculate dependency statistics
    const dependencyCount = new Map<string, number>();
    const dependentCount = new Map<string, number>();

    components.forEach(component => {
      component.dependencies.forEach(dep => {
        dependentCount.set(dep.name, (dependentCount.get(dep.name) || 0) + 1);
      });
      dependencyCount.set(component.name, component.dependencies.length);
    });

    metrics.dependencyStats.mostDependedOn = Array.from(dependentCount.entries())
      .map(([component, dependents]) => ({ component, dependents }))
      .sort((a, b) => b.dependents - a.dependents)
      .slice(0, 5);

    metrics.dependencyStats.mostDependencies = Array.from(dependencyCount.entries())
      .map(([component, dependencies]) => ({ component, dependencies }))
      .sort((a, b) => b.dependencies - a.dependencies)
      .slice(0, 5);

    return metrics;
  }

  async updateComponent(
    componentId: string,
    updates: Partial<Pick<Component, 'testCoverage' | 'complexity'>>
  ): Promise<Component | null> {
    const component = this.components.get(componentId);
    if (!component) {
      return null;
    }

    const updatedComponent = {
      ...component,
      ...updates,
      lastModified: new Date()
    };

    this.components.set(componentId, updatedComponent);

    // Clear related caches
    await this.cacheService.clearPattern(`components:${component.projectId}:*`);

    return updatedComponent;
  }

  async deleteComponent(componentId: string): Promise<boolean> {
    const component = this.components.get(componentId);
    if (!component) {
      return false;
    }

    this.components.delete(componentId);

    // Clear related caches
    await this.cacheService.clearPattern(`components:${component.projectId}:*`);

    return true;
  }

  private extractProps(component: any): ComponentProp[] {
    // TODO: Implement actual prop extraction from AST
    return component.props || [];
  }

  private extractHooks(component: any): ComponentHook[] {
    // TODO: Implement actual hook extraction from AST
    return component.hooks || [];
  }

  private extractDependencies(component: any): ComponentDependency[] {
    // TODO: Implement actual dependency extraction from AST
    return component.dependencies || [];
  }

  private extractImports(component: any): ComponentImport[] {
    // TODO: Implement actual import extraction from AST
    return component.imports || [];
  }

  private calculateComplexity(component: any): number {
    // TODO: Implement actual complexity calculation
    return Math.floor(Math.random() * 15) + 1;
  }

  private async updateComponentRelationships(components: Component[]): Promise<void> {
    // TODO: Implement relationship updates between components
    // This would analyze component usage and update parent/children relationships
  }

  private detectLanguage(filePath: string): string {
    const extension = filePath.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'ts': return 'typescript';
      case 'tsx': return 'tsx';
      case 'js': return 'javascript';
      case 'jsx': return 'jsx';
      default: return 'typescript';
    }
  }

  private generateCodeHash(code: string): string {
    let hash = 0;
    for (let i = 0; i < code.length; i++) {
      const char = code.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  private initializeSampleComponents(): void {
    const sampleComponents: Component[] = [
      {
        id: 'comp_1',
        name: 'App',
        type: 'function_component',
        path: 'src/App.tsx',
        startLine: 10,
        endLine: 45,
        props: [
          { name: 'theme', type: 'Theme', required: false, defaultValue: 'light' },
          { name: 'user', type: 'User', required: true }
        ],
        hooks: [
          { name: 'useState', type: 'useState', complexity: 1 },
          { name: 'useContext', type: 'useContext', complexity: 2 }
        ],
        children: ['Header', 'MainContent', 'Footer'],
        parents: [],
        dependencies: [
          { name: 'Header', type: 'component', source: './components/Header', isInternal: true },
          { name: 'React', type: 'external', source: 'react', isInternal: false }
        ],
        complexity: 5,
        linesOfCode: 35,
        testCoverage: 85,
        lastModified: new Date('2024-01-15'),
        projectId: 'proj_1',
        exports: ['App'],
        imports: [
          { name: 'React', source: 'react', isDefault: true, isNamespace: false },
          { name: 'Header', source: './components/Header', isDefault: true, isNamespace: false }
        ]
      },
      {
        id: 'comp_2',
        name: 'UserProfile',
        type: 'function_component',
        path: 'src/components/UserProfile.tsx',
        startLine: 5,
        endLine: 85,
        props: [
          { name: 'userId', type: 'string', required: true },
          { name: 'onUpdate', type: '(user: User) => void', required: false }
        ],
        hooks: [
          { name: 'useState', type: 'useState', complexity: 2 },
          { name: 'useEffect', type: 'useEffect', dependencies: ['userId'], complexity: 3 },
          { name: 'useCustomHook', type: 'custom', complexity: 4 }
        ],
        children: ['Avatar', 'ContactInfo'],
        parents: ['App', 'Dashboard'],
        dependencies: [
          { name: 'Avatar', type: 'component', source: './Avatar', isInternal: true },
          { name: 'api', type: 'utility', source: '../services/api', isInternal: true }
        ],
        complexity: 12,
        linesOfCode: 80,
        testCoverage: 70,
        lastModified: new Date('2024-01-12'),
        projectId: 'proj_1',
        exports: ['UserProfile', 'UserProfileProps'],
        imports: [
          { name: 'React', source: 'react', isDefault: true, isNamespace: false },
          { name: 'Avatar', source: './Avatar', isDefault: true, isNamespace: false }
        ]
      }
    ];

    sampleComponents.forEach(component => {
      this.components.set(component.id, component);
    });
  }
}