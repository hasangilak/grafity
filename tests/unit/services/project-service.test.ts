import { ProjectService } from '../../../src/server/services/ProjectService';
import { ConfigManager } from '../../../src/config/ConfigManager';
import { CacheService } from '../../../src/server/cache/service';
import { JobQueue } from '../../../src/server/jobs/queue';
import { AnalysisService } from '../../../src/server/services/AnalysisService';

// Mock dependencies
jest.mock('../../../src/config/ConfigManager');
jest.mock('../../../src/server/cache/service');
jest.mock('../../../src/server/jobs/queue');
jest.mock('../../../src/server/services/AnalysisService');

describe('ProjectService', () => {
  let projectService: ProjectService;
  let mockConfigManager: jest.Mocked<ConfigManager>;
  let mockCacheService: jest.Mocked<CacheService>;
  let mockJobQueue: jest.Mocked<JobQueue>;
  let mockAnalysisService: jest.Mocked<AnalysisService>;

  beforeEach(() => {
    mockConfigManager = new ConfigManager() as jest.Mocked<ConfigManager>;
    mockCacheService = new CacheService(mockConfigManager) as jest.Mocked<CacheService>;
    mockJobQueue = new JobQueue(mockConfigManager) as jest.Mocked<JobQueue>;
    mockAnalysisService = new AnalysisService(
      mockConfigManager,
      mockCacheService,
      mockJobQueue
    ) as jest.Mocked<AnalysisService>;

    // Setup mock implementations
    mockCacheService.get.mockResolvedValue(null);
    mockCacheService.set.mockResolvedValue(undefined);
    mockCacheService.delete.mockResolvedValue(undefined);
    mockCacheService.clearPattern.mockResolvedValue(undefined);
    mockAnalysisService.analyzeProject.mockResolvedValue('job-123');

    projectService = new ProjectService(
      mockConfigManager,
      mockCacheService,
      mockJobQueue,
      mockAnalysisService
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createProject', () => {
    it('should create a new project with valid data', async () => {
      const projectData = {
        name: 'Test Project',
        path: '/test/path',
        type: 'react' as const,
        owner: 'test-user',
        description: 'A test project'
      };

      const project = await projectService.createProject(
        projectData.name,
        projectData.path,
        projectData.type,
        projectData.owner,
        projectData.description
      );

      expect(project).toHaveValidStructure([
        'id', 'name', 'path', 'type', 'owner', 'status', 'createdAt', 'updatedAt'
      ]);
      expect(project.name).toBe(projectData.name);
      expect(project.path).toBe(projectData.path);
      expect(project.type).toBe(projectData.type);
      expect(project.owner).toBe(projectData.owner);
      expect(project.status).toBe('active');
      expect(project.createdAt).toBeValidTimestamp();
      expect(project.updatedAt).toBeValidTimestamp();
    });

    it('should generate unique project IDs', async () => {
      const project1 = await projectService.createProject('Project 1', '/path1', 'react', 'user1');
      const project2 = await projectService.createProject('Project 2', '/path2', 'vue', 'user2');

      expect(project1.id).not.toBe(project2.id);
      expect(project1.id).toMatch(/^proj_\d+_[a-z0-9]{9}$/);
      expect(project2.id).toMatch(/^proj_\d+_[a-z0-9]{9}$/);
    });

    it('should clear cache after project creation', async () => {
      const owner = 'test-user';
      await projectService.createProject('Test Project', '/test/path', 'react', owner);

      expect(mockCacheService.clearPattern).toHaveBeenCalledWith(`projects:${owner}:*`);
    });

    it('should set default settings if not provided', async () => {
      const project = await projectService.createProject('Test Project', '/test/path', 'react', 'user');

      expect(project.settings).toEqual({});
    });

    it('should use provided settings', async () => {
      const settings = { includeTests: true, analyzeHooks: false };
      const project = await projectService.createProject(
        'Test Project',
        '/test/path',
        'react',
        'user',
        'description',
        settings
      );

      expect(project.settings).toEqual(settings);
    });
  });

  describe('getProject', () => {
    it('should retrieve an existing project', async () => {
      const createdProject = await projectService.createProject(
        'Test Project',
        '/test/path',
        'react',
        'user'
      );

      const retrievedProject = await projectService.getProject(createdProject.id);

      expect(retrievedProject).not.toBeNull();
      expect(retrievedProject!.id).toBe(createdProject.id);
      expect(retrievedProject!.name).toBe('Test Project');
    });

    it('should return null for non-existent project', async () => {
      const project = await projectService.getProject('non-existent-id');
      expect(project).toBeNull();
    });
  });

  describe('updateProject', () => {
    let testProject: any;

    beforeEach(async () => {
      testProject = await projectService.createProject(
        'Test Project',
        '/test/path',
        'react',
        'user'
      );
    });

    it('should update project name', async () => {
      const updatedProject = await projectService.updateProject(testProject.id, {
        name: 'Updated Project Name'
      });

      expect(updatedProject).not.toBeNull();
      expect(updatedProject!.name).toBe('Updated Project Name');
      expect(updatedProject!.updatedAt.getTime()).toBeGreaterThan(testProject.updatedAt.getTime());
    });

    it('should update project description', async () => {
      const updatedProject = await projectService.updateProject(testProject.id, {
        description: 'Updated description'
      });

      expect(updatedProject!.description).toBe('Updated description');
    });

    it('should update project path', async () => {
      const updatedProject = await projectService.updateProject(testProject.id, {
        path: '/updated/path'
      });

      expect(updatedProject!.path).toBe('/updated/path');
    });

    it('should update project settings', async () => {
      const newSettings = { includeTests: false, analyzeHooks: true };
      const updatedProject = await projectService.updateProject(testProject.id, {
        settings: newSettings
      });

      expect(updatedProject!.settings).toEqual(newSettings);
    });

    it('should return null for non-existent project', async () => {
      const result = await projectService.updateProject('non-existent-id', {
        name: 'New Name'
      });

      expect(result).toBeNull();
    });

    it('should clear cache after update', async () => {
      await projectService.updateProject(testProject.id, { name: 'Updated' });

      expect(mockCacheService.delete).toHaveBeenCalledWith(`project:${testProject.id}`);
      expect(mockCacheService.clearPattern).toHaveBeenCalledWith(`projects:${testProject.owner}:*`);
    });
  });

  describe('deleteProject', () => {
    let testProject: any;

    beforeEach(async () => {
      testProject = await projectService.createProject(
        'Test Project',
        '/test/path',
        'react',
        'user'
      );
    });

    it('should delete an existing project', async () => {
      const success = await projectService.deleteProject(testProject.id);

      expect(success).toBe(true);

      const deletedProject = await projectService.getProject(testProject.id);
      expect(deletedProject).toBeNull();
    });

    it('should return false for non-existent project', async () => {
      const success = await projectService.deleteProject('non-existent-id');
      expect(success).toBe(false);
    });

    it('should clear related caches after deletion', async () => {
      await projectService.deleteProject(testProject.id);

      expect(mockCacheService.delete).toHaveBeenCalledWith(`project:${testProject.id}`);
      expect(mockCacheService.clearPattern).toHaveBeenCalledWith(`projects:${testProject.owner}:*`);
      expect(mockCacheService.clearPattern).toHaveBeenCalledWith(`analysis:project:${testProject.id}:*`);
    });
  });

  describe('listProjects', () => {
    beforeEach(async () => {
      // Create test projects
      await projectService.createProject('React Project', '/react/path', 'react', 'user1');
      await projectService.createProject('Vue Project', '/vue/path', 'vue', 'user1');
      await projectService.createProject('Angular Project', '/angular/path', 'angular', 'user2');
      await projectService.createProject('Node Project', '/node/path', 'node', 'user1');
    });

    it('should list all projects with pagination', async () => {
      const result = await projectService.listProjects(
        {},
        { page: 1, limit: 10, offset: 0 }
      );

      expect(result.projects).toHaveLength(4);
      expect(result.totalCount).toBe(4);
    });

    it('should filter projects by type', async () => {
      const result = await projectService.listProjects(
        { type: 'react' },
        { page: 1, limit: 10, offset: 0 }
      );

      expect(result.projects).toHaveLength(1);
      expect(result.projects[0].type).toBe('react');
    });

    it('should filter projects by owner', async () => {
      const result = await projectService.listProjects(
        { owner: 'user1' },
        { page: 1, limit: 10, offset: 0 }
      );

      expect(result.projects).toHaveLength(3);
      result.projects.forEach(project => {
        expect(project.owner).toBe('user1');
      });
    });

    it('should filter projects by status', async () => {
      const result = await projectService.listProjects(
        { status: 'active' },
        { page: 1, limit: 10, offset: 0 }
      );

      expect(result.projects).toHaveLength(4);
      result.projects.forEach(project => {
        expect(project.status).toBe('active');
      });
    });

    it('should search projects by name', async () => {
      const result = await projectService.listProjects(
        { search: 'React' },
        { page: 1, limit: 10, offset: 0 }
      );

      expect(result.projects).toHaveLength(1);
      expect(result.projects[0].name).toContain('React');
    });

    it('should search projects by description', async () => {
      // Update a project with description
      const projects = await projectService.listProjects({}, { page: 1, limit: 1, offset: 0 });
      await projectService.updateProject(projects.projects[0].id, {
        description: 'Special test description'
      });

      const result = await projectService.listProjects(
        { search: 'Special' },
        { page: 1, limit: 10, offset: 0 }
      );

      expect(result.projects).toHaveLength(1);
    });

    it('should handle pagination correctly', async () => {
      const page1 = await projectService.listProjects(
        {},
        { page: 1, limit: 2, offset: 0 }
      );

      const page2 = await projectService.listProjects(
        {},
        { page: 2, limit: 2, offset: 2 }
      );

      expect(page1.projects).toHaveLength(2);
      expect(page2.projects).toHaveLength(2);
      expect(page1.totalCount).toBe(4);
      expect(page2.totalCount).toBe(4);

      // Ensure no overlap
      const page1Ids = page1.projects.map(p => p.id);
      const page2Ids = page2.projects.map(p => p.id);
      expect(page1Ids).not.toEqual(expect.arrayContaining(page2Ids));
    });

    it('should sort projects by creation date', async () => {
      const result = await projectService.listProjects(
        {},
        { page: 1, limit: 10, offset: 0 },
        { field: 'createdAt', order: 'desc' }
      );

      expect(result.projects).toHaveLength(4);
      for (let i = 1; i < result.projects.length; i++) {
        expect(result.projects[i - 1].createdAt.getTime())
          .toBeGreaterThanOrEqual(result.projects[i].createdAt.getTime());
      }
    });

    it('should sort projects by name ascending', async () => {
      const result = await projectService.listProjects(
        {},
        { page: 1, limit: 10, offset: 0 },
        { field: 'name', order: 'asc' }
      );

      for (let i = 1; i < result.projects.length; i++) {
        expect(result.projects[i - 1].name <= result.projects[i].name).toBe(true);
      }
    });
  });

  describe('analyzeProject', () => {
    let testProject: any;

    beforeEach(async () => {
      testProject = await projectService.createProject(
        'Test Project',
        '/test/path',
        'react',
        'user'
      );
    });

    it('should trigger project analysis', async () => {
      const analysisJobId = await projectService.analyzeProject(testProject.id, {
        includePatterns: true,
        includeMetrics: true
      });

      expect(analysisJobId).toBe('job-123');
      expect(mockAnalysisService.analyzeProject).toHaveBeenCalledWith(
        testProject.path,
        testProject.id,
        { includePatterns: true, includeMetrics: true }
      );
    });

    it('should update project status to analyzing', async () => {
      await projectService.analyzeProject(testProject.id);

      const updatedProject = await projectService.getProject(testProject.id);
      expect(updatedProject!.status).toBe('analyzing');
    });

    it('should throw error for non-existent project', async () => {
      await expect(
        projectService.analyzeProject('non-existent-id')
      ).rejects.toThrow('Project not found');
    });

    it('should use default options if not provided', async () => {
      await projectService.analyzeProject(testProject.id);

      expect(mockAnalysisService.analyzeProject).toHaveBeenCalledWith(
        testProject.path,
        testProject.id,
        {}
      );
    });
  });

  describe('getProjectMetrics', () => {
    let testProject: any;

    beforeEach(async () => {
      testProject = await projectService.createProject(
        'Test Project',
        '/test/path',
        'react',
        'user'
      );
    });

    it('should return project metrics', async () => {
      const metrics = await projectService.getProjectMetrics(testProject.id);

      expect(metrics).toHaveValidStructure([
        'projectId',
        'overview',
        'codeQuality',
        'performance',
        'security',
        'trends'
      ]);
      expect(metrics.projectId).toBe(testProject.id);
    });

    it('should cache metrics results', async () => {
      await projectService.getProjectMetrics(testProject.id);

      expect(mockCacheService.set).toHaveBeenCalledWith(
        `metrics:project:${testProject.id}`,
        expect.any(Object),
        3600
      );
    });

    it('should return cached metrics if available', async () => {
      const cachedMetrics = { projectId: testProject.id, cached: true };
      mockCacheService.get.mockResolvedValueOnce(cachedMetrics);

      const metrics = await projectService.getProjectMetrics(testProject.id);

      expect(metrics).toEqual(cachedMetrics);
      expect(mockCacheService.get).toHaveBeenCalledWith(`metrics:project:${testProject.id}`);
    });
  });

  describe('getUserProjects', () => {
    beforeEach(async () => {
      await projectService.createProject('Project 1', '/path1', 'react', 'user1');
      await projectService.createProject('Project 2', '/path2', 'vue', 'user1');
      await projectService.createProject('Project 3', '/path3', 'angular', 'user2');
    });

    it('should return projects for specific user', async () => {
      const userProjects = await projectService.getUserProjects('user1');

      expect(userProjects).toHaveLength(2);
      userProjects.forEach(project => {
        expect(project.owner).toBe('user1');
      });
    });

    it('should return empty array for user with no projects', async () => {
      const userProjects = await projectService.getUserProjects('user-with-no-projects');
      expect(userProjects).toHaveLength(0);
    });
  });

  describe('error handling', () => {
    it('should handle cache service errors gracefully', async () => {
      mockCacheService.clearPattern.mockRejectedValue(new Error('Cache error'));

      // Should still create project even if cache operations fail
      const project = await projectService.createProject(
        'Test Project',
        '/test/path',
        'react',
        'user'
      );

      expect(project).toBeDefined();
      expect(project.name).toBe('Test Project');
    });

    it('should handle analysis service errors', async () => {
      const testProject = await projectService.createProject(
        'Test Project',
        '/test/path',
        'react',
        'user'
      );

      mockAnalysisService.analyzeProject.mockRejectedValue(new Error('Analysis failed'));

      await expect(
        projectService.analyzeProject(testProject.id)
      ).rejects.toThrow('Analysis failed');
    });
  });
});