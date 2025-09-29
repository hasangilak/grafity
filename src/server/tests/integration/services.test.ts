import { ConfigManager } from '../../../config/ConfigManager';
import { CacheService } from '../../cache/service';
import { JobQueue } from '../../jobs/queue';
import { ProjectService } from '../../services/ProjectService';
import { AnalysisService } from '../../services/AnalysisService';
import { PatternService } from '../../services/PatternService';
import { ComponentService } from '../../services/ComponentService';

describe('Services Integration Tests', () => {
  let configManager: ConfigManager;
  let cacheService: CacheService;
  let jobQueue: JobQueue;
  let projectService: ProjectService;
  let analysisService: AnalysisService;
  let patternService: PatternService;
  let componentService: ComponentService;

  beforeAll(async () => {
    // Initialize services for testing
    configManager = new ConfigManager();
    cacheService = new CacheService(configManager);
    jobQueue = new JobQueue(configManager);

    analysisService = new AnalysisService(configManager, cacheService, jobQueue);
    projectService = new ProjectService(configManager, cacheService, jobQueue, analysisService);
    patternService = new PatternService(configManager, cacheService);
    componentService = new ComponentService(configManager, cacheService);

    // Connect services
    await cacheService.connect();
    await jobQueue.connect();
  });

  afterAll(async () => {
    // Cleanup
    await cacheService.disconnect();
    await jobQueue.disconnect();
  });

  describe('ProjectService', () => {
    let testProjectId: string;

    it('should create a new project', async () => {
      const project = await projectService.createProject(
        'Test Project',
        '/test/path',
        'react',
        'test-user',
        'Test description'
      );

      expect(project).toBeDefined();
      expect(project.name).toBe('Test Project');
      expect(project.type).toBe('react');
      expect(project.owner).toBe('test-user');
      expect(project.status).toBe('active');

      testProjectId = project.id;
    });

    it('should retrieve the created project', async () => {
      const project = await projectService.getProject(testProjectId);

      expect(project).toBeDefined();
      expect(project!.id).toBe(testProjectId);
      expect(project!.name).toBe('Test Project');
    });

    it('should update project details', async () => {
      const updatedProject = await projectService.updateProject(testProjectId, {
        name: 'Updated Test Project',
        description: 'Updated description'
      });

      expect(updatedProject).toBeDefined();
      expect(updatedProject!.name).toBe('Updated Test Project');
      expect(updatedProject!.description).toBe('Updated description');
    });

    it('should list projects with filters', async () => {
      const result = await projectService.listProjects(
        { type: 'react' },
        { page: 1, limit: 10, offset: 0 }
      );

      expect(result).toBeDefined();
      expect(result.projects).toBeInstanceOf(Array);
      expect(result.totalCount).toBeGreaterThan(0);
    });

    it('should get project metrics', async () => {
      const metrics = await projectService.getProjectMetrics(testProjectId);

      expect(metrics).toBeDefined();
      expect(metrics).toHaveProperty('projectId', testProjectId);
      expect(metrics).toHaveProperty('overview');
      expect(metrics).toHaveProperty('codeQuality');
      expect(metrics).toHaveProperty('performance');
    });

    it('should trigger project analysis', async () => {
      const analysisJobId = await projectService.analyzeProject(testProjectId, {
        includePatterns: true,
        includeMetrics: true
      });

      expect(analysisJobId).toBeDefined();
      expect(typeof analysisJobId).toBe('string');
    });

    it('should delete the project', async () => {
      const success = await projectService.deleteProject(testProjectId);
      expect(success).toBe(true);

      const deletedProject = await projectService.getProject(testProjectId);
      expect(deletedProject).toBeNull();
    });
  });

  describe('AnalysisService', () => {
    it('should analyze code snippet', async () => {
      const code = `
        import React, { useState } from 'react';

        function TestComponent() {
          const [count, setCount] = useState(0);

          return (
            <div>
              <p>Count: {count}</p>
              <button onClick={() => setCount(count + 1)}>Increment</button>
            </div>
          );
        }

        export default TestComponent;
      `;

      const result = await analysisService.analyzeCode(code, 'tsx', {
        includePatterns: true,
        includeMetrics: true,
        includeDependencies: true
      });

      expect(result).toBeDefined();
      expect(result.status).toBe('completed');
      expect(result.type).toBe('code');
      expect(result.components).toBeInstanceOf(Array);
      expect(result.duration).toBeGreaterThan(0);
    });

    it('should handle invalid code gracefully', async () => {
      const invalidCode = `
        invalid javascript syntax {{{
      `;

      const result = await analysisService.analyzeCode(invalidCode, 'javascript');

      expect(result).toBeDefined();
      expect(result.status).toBe('failed');
      expect(result.error).toBeDefined();
    });

    it('should analyze file', async () => {
      // Create a temporary test file
      const fs = require('fs/promises');
      const path = '/tmp/test-component.tsx';
      const code = `
        import React from 'react';

        export function TestComponent() {
          return <div>Test</div>;
        }
      `;

      await fs.writeFile(path, code);

      try {
        const result = await analysisService.analyzeFile(path, 'test-project');

        expect(result).toBeDefined();
        expect(result.type).toBe('file');
        expect(result.filePath).toBe(path);
      } finally {
        // Cleanup
        await fs.unlink(path).catch(() => {});
      }
    });
  });

  describe('PatternService', () => {
    it('should detect patterns in code', async () => {
      const code = `
        import React, { useState, useEffect } from 'react';

        function useCustomHook() {
          const [data, setData] = useState(null);

          useEffect(() => {
            // Custom hook logic
          }, []);

          return data;
        }

        function Component() {
          const data = useCustomHook();
          return <div>{data}</div>;
        }
      `;

      const patterns = await patternService.detectPatterns(code, 'tsx', 'test-project');

      expect(patterns).toBeInstanceOf(Array);
      // Note: Actual pattern detection depends on the implementation
    });

    it('should list patterns with filters', async () => {
      const result = await patternService.listPatterns(
        { type: 'good_pattern' },
        { page: 1, limit: 10, offset: 0 }
      );

      expect(result).toBeDefined();
      expect(result.patterns).toBeInstanceOf(Array);
      expect(result.totalCount).toBeGreaterThanOrEqual(0);
    });

    it('should get pattern statistics', async () => {
      const stats = await patternService.getPatternStats();

      expect(stats).toBeDefined();
      expect(stats).toHaveProperty('total');
      expect(stats).toHaveProperty('byType');
      expect(stats).toHaveProperty('bySeverity');
      expect(stats).toHaveProperty('averageConfidence');
    });

    it('should create custom pattern', async () => {
      const patternDefinition = {
        name: 'Test Pattern',
        description: 'A test pattern for integration testing',
        type: 'good_pattern' as const,
        category: 'testing',
        pattern: 'test.*Pattern',
        language: ['typescript'],
        severity: 'low' as const,
        recommendations: ['Use this pattern for testing'],
        tags: ['test', 'pattern']
      };

      const patternId = await patternService.createCustomPattern(patternDefinition);

      expect(patternId).toBeDefined();
      expect(typeof patternId).toBe('string');
    });
  });

  describe('ComponentService', () => {
    it('should analyze React component', async () => {
      const code = `
        import React, { useState, useEffect } from 'react';
        import { UserService } from '../services/UserService';

        interface Props {
          userId: string;
          onUpdate?: (user: User) => void;
        }

        export function UserProfile({ userId, onUpdate }: Props) {
          const [user, setUser] = useState(null);
          const [loading, setLoading] = useState(true);

          useEffect(() => {
            UserService.getUser(userId).then(setUser);
          }, [userId]);

          return (
            <div>
              {loading ? 'Loading...' : user?.name}
            </div>
          );
        }
      `;

      const components = await componentService.analyzeComponent(
        code,
        'src/components/UserProfile.tsx',
        'test-project'
      );

      expect(components).toBeInstanceOf(Array);
      expect(components.length).toBeGreaterThan(0);

      const component = components[0];
      expect(component.name).toBeDefined();
      expect(component.type).toBeDefined();
      expect(component.path).toBe('src/components/UserProfile.tsx');
      expect(component.props).toBeInstanceOf(Array);
      expect(component.hooks).toBeInstanceOf(Array);
    });

    it('should list components with filters', async () => {
      const result = await componentService.listComponents(
        { type: 'function_component' },
        { page: 1, limit: 10, offset: 0 }
      );

      expect(result).toBeDefined();
      expect(result.components).toBeInstanceOf(Array);
      expect(result.totalCount).toBeGreaterThanOrEqual(0);
    });

    it('should get component metrics', async () => {
      const metrics = await componentService.getComponentMetrics();

      expect(metrics).toBeDefined();
      expect(metrics).toHaveProperty('totalComponents');
      expect(metrics).toHaveProperty('byType');
      expect(metrics).toHaveProperty('averageComplexity');
      expect(metrics).toHaveProperty('hookUsage');
    });

    it('should get component dependencies', async () => {
      // First create a component
      const code = `
        import React from 'react';
        import { Button } from './Button';

        export function Dialog() {
          return (
            <div>
              <Button>Close</Button>
            </div>
          );
        }
      `;

      const components = await componentService.analyzeComponent(
        code,
        'src/components/Dialog.tsx',
        'test-project'
      );

      if (components.length > 0) {
        const dependencies = await componentService.getComponentDependencies(components[0].id);

        expect(dependencies).toBeDefined();
        expect(dependencies).toHaveProperty('dependencies');
        expect(dependencies).toHaveProperty('dependents');
        expect(dependencies).toHaveProperty('graph');
      }
    });
  });

  describe('Service Integration', () => {
    it('should work together for full project analysis', async () => {
      // Create a test project
      const project = await projectService.createProject(
        'Integration Test Project',
        '/test/integration',
        'react',
        'test-user'
      );

      // Analyze components
      const code = `
        import React, { useState } from 'react';

        export function TestComponent() {
          const [value, setValue] = useState('');

          return (
            <input
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          );
        }
      `;

      const components = await componentService.analyzeComponent(
        code,
        'src/TestComponent.tsx',
        project.id
      );

      // Detect patterns
      const patterns = await patternService.detectPatterns(
        code,
        'tsx',
        project.id
      );

      // Get project metrics
      const metrics = await projectService.getProjectMetrics(project.id);

      // Verify all services worked together
      expect(components).toBeInstanceOf(Array);
      expect(patterns).toBeInstanceOf(Array);
      expect(metrics).toBeDefined();
      expect(metrics.projectId).toBe(project.id);

      // Cleanup
      await projectService.deleteProject(project.id);
    });
  });
});