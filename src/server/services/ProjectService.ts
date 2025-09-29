import { ConfigManager } from '../../config/ConfigManager';
import { CacheService } from '../cache/service';
import { JobQueue } from '../jobs/queue';
import { AnalysisService } from './AnalysisService';

export interface Project {
  id: string;
  name: string;
  description?: string;
  path: string;
  type: 'react' | 'vue' | 'angular' | 'node' | 'typescript' | 'javascript';
  status: 'active' | 'analyzing' | 'completed' | 'error' | 'archived';
  owner: string;
  settings: any;
  metrics?: any;
  createdAt: Date;
  updatedAt: Date;
  lastAnalyzed?: Date;
}

export interface ProjectFilters {
  type?: string;
  status?: string;
  search?: string;
  owner?: string;
}

export class ProjectService {
  private configManager: ConfigManager;
  private cacheService: CacheService;
  private jobQueue: JobQueue;
  private analysisService: AnalysisService;

  // In-memory storage for demo purposes
  // In production, this would be replaced with database operations
  private projects: Map<string, Project> = new Map();

  constructor(
    configManager: ConfigManager,
    cacheService: CacheService,
    jobQueue: JobQueue,
    analysisService: AnalysisService
  ) {
    this.configManager = configManager;
    this.cacheService = cacheService;
    this.jobQueue = jobQueue;
    this.analysisService = analysisService;

    // Initialize with sample data
    this.initializeSampleData();
  }

  async createProject(
    name: string,
    path: string,
    type: Project['type'],
    owner: string,
    description?: string,
    settings?: any
  ): Promise<Project> {
    const projectId = `proj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const project: Project = {
      id: projectId,
      name,
      description,
      path,
      type,
      status: 'active',
      owner,
      settings: settings || {},
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Store project
    this.projects.set(projectId, project);

    // Clear owner's projects cache
    await this.cacheService.clearPattern(`projects:${owner}:*`);

    return project;
  }

  async getProject(projectId: string): Promise<Project | null> {
    const project = this.projects.get(projectId);
    return project || null;
  }

  async updateProject(
    projectId: string,
    updates: Partial<Pick<Project, 'name' | 'description' | 'path' | 'settings' | 'status'>>
  ): Promise<Project | null> {
    const project = this.projects.get(projectId);
    if (!project) {
      return null;
    }

    const updatedProject = {
      ...project,
      ...updates,
      updatedAt: new Date()
    };

    this.projects.set(projectId, updatedProject);

    // Clear caches
    await this.cacheService.delete(`project:${projectId}`);
    await this.cacheService.clearPattern(`projects:${project.owner}:*`);

    return updatedProject;
  }

  async deleteProject(projectId: string): Promise<boolean> {
    const project = this.projects.get(projectId);
    if (!project) {
      return false;
    }

    // Delete project
    this.projects.delete(projectId);

    // Clear related caches
    await this.cacheService.delete(`project:${projectId}`);
    await this.cacheService.clearPattern(`projects:${project.owner}:*`);
    await this.cacheService.clearPattern(`analysis:project:${projectId}:*`);

    return true;
  }

  async listProjects(
    filters: ProjectFilters = {},
    pagination: { page: number; limit: number; offset: number },
    sort?: { field: string; order: 'asc' | 'desc' }
  ): Promise<{ projects: Project[]; totalCount: number }> {
    let filteredProjects = Array.from(this.projects.values());

    // Apply filters
    if (filters.type) {
      filteredProjects = filteredProjects.filter(p => p.type === filters.type);
    }

    if (filters.status) {
      filteredProjects = filteredProjects.filter(p => p.status === filters.status);
    }

    if (filters.owner) {
      filteredProjects = filteredProjects.filter(p => p.owner === filters.owner);
    }

    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filteredProjects = filteredProjects.filter(p =>
        p.name.toLowerCase().includes(searchLower) ||
        (p.description && p.description.toLowerCase().includes(searchLower))
      );
    }

    // Apply sorting
    if (sort) {
      filteredProjects.sort((a, b) => {
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
    const totalCount = filteredProjects.length;
    const paginatedProjects = filteredProjects.slice(
      pagination.offset,
      pagination.offset + pagination.limit
    );

    return {
      projects: paginatedProjects,
      totalCount
    };
  }

  async analyzeProject(
    projectId: string,
    options: {
      includePatterns?: boolean;
      includeMetrics?: boolean;
      includeDependencies?: boolean;
      depth?: 'shallow' | 'medium' | 'full' | 'deep';
    } = {}
  ): Promise<string> {
    const project = this.projects.get(projectId);
    if (!project) {
      throw new Error('Project not found');
    }

    // Update project status
    await this.updateProject(projectId, { status: 'analyzing' });

    // Start analysis
    const analysisJobId = await this.analysisService.analyzeProject(
      project.path,
      projectId,
      options
    );

    return analysisJobId;
  }

  async getProjectAnalysis(
    projectId: string,
    options: {
      includeComponents?: boolean;
      includePatterns?: boolean;
      includeMetrics?: boolean;
    } = {}
  ): Promise<any> {
    const cacheKey = `analysis:project:${projectId}:${JSON.stringify(options)}`;

    // Try cache first
    const cached = await this.cacheService.get(cacheKey);
    if (cached) {
      return cached;
    }

    // TODO: Fetch actual analysis results from database
    // For now, return mock data
    const analysisResult = {
      projectId,
      lastAnalyzed: new Date(),
      status: 'completed',
      summary: {
        totalComponents: 13,
        totalFiles: 25,
        totalLines: 1245,
        complexity: 'medium',
        maintainabilityScore: 82.5
      },
      components: options.includeComponents ? [
        {
          id: 'comp_1',
          name: 'App',
          type: 'function_component',
          path: 'src/App.tsx',
          complexity: 5,
          props: ['theme', 'user'],
          hooks: ['useState', 'useContext']
        }
      ] : undefined,
      patterns: options.includePatterns ? [
        {
          id: 'pattern_1',
          name: 'Custom Hook Pattern',
          type: 'good_pattern',
          confidence: 95,
          components: ['useUserData', 'useTheme']
        }
      ] : undefined,
      metrics: options.includeMetrics ? {
        codeQuality: 85,
        testCoverage: 75,
        performance: 90,
        security: 88,
        maintainability: 82
      } : undefined
    };

    // Cache for 30 minutes
    await this.cacheService.set(cacheKey, analysisResult, 1800);

    return analysisResult;
  }

  async getProjectGraph(
    projectId: string,
    options: {
      format?: 'json' | 'cytoscape' | 'd3';
      includeEdges?: boolean;
      maxDepth?: number;
    } = {}
  ): Promise<any> {
    const { format = 'json', includeEdges = true, maxDepth = 5 } = options;

    const cacheKey = `graph:project:${projectId}:${format}:${includeEdges}:${maxDepth}`;

    // Try cache first
    const cached = await this.cacheService.get(cacheKey);
    if (cached) {
      return cached;
    }

    // TODO: Generate actual graph data using graph engine
    const graphData = {
      nodes: [
        {
          id: 'App',
          label: 'App Component',
          type: 'component',
          data: { path: 'src/App.tsx', complexity: 5 }
        },
        {
          id: 'UserContext',
          label: 'User Context',
          type: 'context',
          data: { path: 'src/contexts/UserContext.tsx' }
        }
      ],
      edges: includeEdges ? [
        {
          id: 'App-UserContext',
          source: 'App',
          target: 'UserContext',
          type: 'uses'
        }
      ] : []
    };

    // Cache for 20 minutes
    await this.cacheService.set(cacheKey, graphData, 1200);

    return graphData;
  }

  async getProjectMetrics(projectId: string): Promise<any> {
    const project = this.projects.get(projectId);
    if (!project) {
      throw new Error('Project not found');
    }

    const cacheKey = `metrics:project:${projectId}`;

    // Try cache first
    const cached = await this.cacheService.get(cacheKey);
    if (cached) {
      return cached;
    }

    // TODO: Calculate actual metrics
    const metrics = {
      projectId,
      overview: {
        totalComponents: 13,
        totalLines: 1245,
        complexity: 'medium',
        maintainability: 82.5,
        testCoverage: 75.3
      },
      codeQuality: {
        score: 85,
        issues: 5,
        critical: 0,
        major: 2,
        minor: 3
      },
      performance: {
        score: 88,
        bundleSize: 245.8,
        loadTime: 1.2
      },
      security: {
        score: 90,
        vulnerabilities: 1,
        lowRisk: 1,
        mediumRisk: 0,
        highRisk: 0
      },
      trends: {
        lastWeek: { complexity: +0.2, maintainability: +1.5 },
        lastMonth: { complexity: -0.8, maintainability: +3.2 }
      }
    };

    // Cache for 1 hour
    await this.cacheService.set(cacheKey, metrics, 3600);

    return metrics;
  }

  async getUserProjects(userId: string): Promise<Project[]> {
    return Array.from(this.projects.values()).filter(p => p.owner === userId);
  }

  private initializeSampleData(): void {
    // Add sample project for demo
    const sampleProject: Project = {
      id: 'proj_1',
      name: 'Sample React App',
      description: 'A sample React application for testing Grafity analysis',
      path: '/path/to/sample-react-app',
      type: 'react',
      status: 'active',
      owner: 'user_1',
      settings: {
        includeTests: true,
        analyzeHooks: true,
        detectPatterns: true
      },
      metrics: {
        totalComponents: 13,
        totalLines: 1245,
        complexity: 'medium',
        coverage: 85.5
      },
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-15'),
      lastAnalyzed: new Date('2024-01-10')
    };

    this.projects.set('proj_1', sampleProject);
  }
}