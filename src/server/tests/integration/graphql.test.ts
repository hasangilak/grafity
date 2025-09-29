import { createTestClient } from 'apollo-server-testing';
import { ApolloServer } from 'apollo-server-express';
import { graphqlSchema } from '../../graphql/schema';
import { ConfigManager } from '../../../config/ConfigManager';
import { CacheService } from '../../cache/service';
import { JobQueue } from '../../jobs/queue';
import { ProjectService } from '../../services/ProjectService';
import { AnalysisService } from '../../services/AnalysisService';
import { PatternService } from '../../services/PatternService';
import { ComponentService } from '../../services/ComponentService';

describe('GraphQL Integration Tests', () => {
  let server: ApolloServer;
  let query: any;
  let mutate: any;
  let services: any;

  beforeAll(async () => {
    // Initialize services
    const configManager = new ConfigManager();
    const cacheService = new CacheService(configManager);
    const jobQueue = new JobQueue(configManager);

    const analysisService = new AnalysisService(configManager, cacheService, jobQueue);
    const projectService = new ProjectService(configManager, cacheService, jobQueue, analysisService);
    const patternService = new PatternService(configManager, cacheService);
    const componentService = new ComponentService(configManager, cacheService);

    services = {
      projectService,
      analysisService,
      patternService,
      componentService,
      cacheService,
      jobQueue
    };

    // Connect services
    await cacheService.connect();
    await jobQueue.connect();

    // Create Apollo Server for testing
    server = new ApolloServer({
      typeDefs: graphqlSchema.typeDefs,
      resolvers: graphqlSchema.resolvers,
      context: () => ({
        user: { id: 'test-user', username: 'testuser' },
        services,
        configManager,
        securityManager: null
      })
    });

    // Create test client
    const testClient = createTestClient(server);
    query = testClient.query;
    mutate = testClient.mutate;
  });

  afterAll(async () => {
    await services.cacheService.disconnect();
    await services.jobQueue.disconnect();
    await server.stop();
  });

  describe('Project Mutations', () => {
    let projectId: string;

    it('should create a new project', async () => {
      const CREATE_PROJECT = `
        mutation CreateProject($input: CreateProjectInput!) {
          createProject(input: $input) {
            success
            project {
              id
              name
              type
              path
              status
              createdAt
            }
            errors {
              message
              code
            }
          }
        }
      `;

      const variables = {
        input: {
          name: 'GraphQL Test Project',
          description: 'A project created for GraphQL testing',
          path: '/test/graphql-project',
          type: 'REACT'
        }
      };

      const response = await mutate({
        mutation: CREATE_PROJECT,
        variables
      });

      expect(response.errors).toBeUndefined();
      expect(response.data.createProject.success).toBe(true);
      expect(response.data.createProject.project).toBeDefined();
      expect(response.data.createProject.project.name).toBe('GraphQL Test Project');
      expect(response.data.createProject.project.type).toBe('react');

      projectId = response.data.createProject.project.id;
    });

    it('should update the project', async () => {
      const UPDATE_PROJECT = `
        mutation UpdateProject($id: ID!, $input: UpdateProjectInput!) {
          updateProject(id: $id, input: $input) {
            success
            project {
              id
              name
              description
            }
            errors {
              message
              code
            }
          }
        }
      `;

      const variables = {
        id: projectId,
        input: {
          name: 'Updated GraphQL Test Project',
          description: 'Updated description for GraphQL testing'
        }
      };

      const response = await mutate({
        mutation: UPDATE_PROJECT,
        variables
      });

      expect(response.errors).toBeUndefined();
      expect(response.data.updateProject.success).toBe(true);
      expect(response.data.updateProject.project.name).toBe('Updated GraphQL Test Project');
    });

    it('should trigger project analysis', async () => {
      const TRIGGER_ANALYSIS = `
        mutation TriggerAnalysis($projectId: ID!, $options: AnalysisOptions) {
          triggerAnalysis(projectId: $projectId, options: $options) {
            success
            errors {
              message
              code
            }
          }
        }
      `;

      const variables = {
        projectId,
        options: {
          includePatterns: true,
          includeMetrics: true,
          includeDependencies: true
        }
      };

      const response = await mutate({
        mutation: TRIGGER_ANALYSIS,
        variables
      });

      expect(response.errors).toBeUndefined();
      expect(response.data.triggerAnalysis.success).toBe(true);
    });

    it('should delete the project', async () => {
      const DELETE_PROJECT = `
        mutation DeleteProject($id: ID!) {
          deleteProject(id: $id) {
            success
            message
            errors {
              message
              code
            }
          }
        }
      `;

      const variables = { id: projectId };

      const response = await mutate({
        mutation: DELETE_PROJECT,
        variables
      });

      expect(response.errors).toBeUndefined();
      expect(response.data.deleteProject.success).toBe(true);
    });
  });

  describe('Project Queries', () => {
    let testProjectId: string;

    beforeAll(async () => {
      // Create a test project for queries
      const project = await services.projectService.createProject(
        'Query Test Project',
        '/test/query-project',
        'react',
        'test-user'
      );
      testProjectId = project.id;
    });

    afterAll(async () => {
      await services.projectService.deleteProject(testProjectId);
    });

    it('should get project metrics', async () => {
      const GET_PROJECT_METRICS = `
        query GetProjectMetrics($projectId: ID!) {
          getProjectMetrics(projectId: $projectId) {
            projectId
            overview {
              totalComponents
              totalLines
              complexity
              maintainability
              testCoverage
            }
            codeQuality {
              score
              issues
            }
            performance {
              score
              bundleSize
              loadTime
            }
          }
        }
      `;

      const variables = { projectId: testProjectId };

      const response = await query({
        query: GET_PROJECT_METRICS,
        variables
      });

      expect(response.errors).toBeUndefined();
      expect(response.data.getProjectMetrics).toBeDefined();
      expect(response.data.getProjectMetrics.projectId).toBe(testProjectId);
      expect(response.data.getProjectMetrics.overview).toBeDefined();
    });

    it('should get project graph', async () => {
      const GET_PROJECT_GRAPH = `
        query GetProjectGraph($projectId: ID!) {
          getProjectGraph(projectId: $projectId) {
            nodes {
              id
              label
              type
              data
            }
            edges {
              id
              source
              target
              type
            }
            metadata
          }
        }
      `;

      const variables = { projectId: testProjectId };

      const response = await query({
        query: GET_PROJECT_GRAPH,
        variables
      });

      expect(response.errors).toBeUndefined();
      expect(response.data.getProjectGraph).toBeDefined();
      expect(response.data.getProjectGraph.nodes).toBeInstanceOf(Array);
      expect(response.data.getProjectGraph.edges).toBeInstanceOf(Array);
    });

    it('should get component tree', async () => {
      const GET_COMPONENT_TREE = `
        query GetComponentTree($projectId: ID!) {
          getComponentTree(projectId: $projectId) {
            root {
              component {
                id
                name
                type
              }
              children {
                component {
                  id
                  name
                }
                depth
              }
              depth
            }
            totalComponents
            maxDepth
          }
        }
      `;

      const variables = { projectId: testProjectId };

      const response = await query({
        query: GET_COMPONENT_TREE,
        variables
      });

      expect(response.errors).toBeUndefined();
      expect(response.data.getComponentTree).toBeDefined();
    });

    it('should find patterns', async () => {
      const FIND_PATTERNS = `
        query FindPatterns($projectId: ID!, $patternTypes: [PatternType!]) {
          findPatterns(projectId: $projectId, patternTypes: $patternTypes) {
            id
            name
            type
            description
            confidence
            severity
          }
        }
      `;

      const variables = {
        projectId: testProjectId,
        patternTypes: ['CUSTOM_HOOK', 'GOD_COMPONENT']
      };

      const response = await query({
        query: FIND_PATTERNS,
        variables
      });

      expect(response.errors).toBeUndefined();
      expect(response.data.findPatterns).toBeInstanceOf(Array);
    });

    it('should search components', async () => {
      const SEARCH_COMPONENTS = `
        query SearchComponents($query: String!, $filters: ComponentFilters) {
          searchComponents(query: $query, filters: $filters) {
            components {
              id
              name
              type
              path
              complexity
            }
            totalCount
            facets {
              types {
                value
                count
              }
              patterns {
                value
                count
              }
            }
            suggestions
          }
        }
      `;

      const variables = {
        query: 'component',
        filters: {
          types: ['FUNCTION_COMPONENT'],
          complexity: {
            min: 1,
            max: 10
          }
        }
      };

      const response = await query({
        query: SEARCH_COMPONENTS,
        variables
      });

      expect(response.errors).toBeUndefined();
      expect(response.data.searchComponents).toBeDefined();
      expect(response.data.searchComponents.components).toBeInstanceOf(Array);
      expect(response.data.searchComponents.facets).toBeDefined();
    });

    it('should get code complexity analysis', async () => {
      const GET_CODE_COMPLEXITY = `
        query GetCodeComplexity($projectId: ID!) {
          getCodeComplexity(projectId: $projectId) {
            overall
            byComponent {
              component {
                id
                name
              }
              cyclomaticComplexity
              cognitiveComplexity
              maintainabilityIndex
            }
            distribution {
              low
              medium
              high
              critical
            }
            recommendations
          }
        }
      `;

      const variables = { projectId: testProjectId };

      const response = await query({
        query: GET_CODE_COMPLEXITY,
        variables
      });

      expect(response.errors).toBeUndefined();
      expect(response.data.getCodeComplexity).toBeDefined();
      expect(response.data.getCodeComplexity.distribution).toBeDefined();
      expect(response.data.getCodeComplexity.recommendations).toBeInstanceOf(Array);
    });

    it('should get dependency insights', async () => {
      const GET_DEPENDENCY_INSIGHTS = `
        query GetDependencyInsights($projectId: ID!) {
          getDependencyInsights(projectId: $projectId) {
            graph {
              nodes {
                id
                name
                type
                isExternal
              }
              edges {
                source
                target
                type
                strength
              }
            }
            recommendations
          }
        }
      `;

      const variables = { projectId: testProjectId };

      const response = await query({
        query: GET_DEPENDENCY_INSIGHTS,
        variables
      });

      expect(response.errors).toBeUndefined();
      expect(response.data.getDependencyInsights).toBeDefined();
      expect(response.data.getDependencyInsights.graph).toBeDefined();
      expect(response.data.getDependencyInsights.recommendations).toBeInstanceOf(Array);
    });
  });

  describe('Pattern Operations', () => {
    it('should save a custom pattern', async () => {
      const SAVE_PATTERN = `
        mutation SavePattern($input: SavePatternInput!) {
          savePattern(input: $input) {
            success
            pattern {
              id
              name
              type
              description
              category
            }
            errors {
              message
              code
            }
          }
        }
      `;

      const variables = {
        input: {
          name: 'Custom GraphQL Pattern',
          type: 'CUSTOM_HOOK',
          description: 'A custom pattern created via GraphQL',
          category: 'BEST_PRACTICE',
          examples: [
            {
              componentId: 'test-component',
              code: 'const useCustomHook = () => { /* implementation */ }',
              explanation: 'Example of custom hook pattern'
            }
          ],
          metadata: {
            language: 'typescript',
            framework: 'react'
          }
        }
      };

      const response = await mutate({
        mutation: SAVE_PATTERN,
        variables
      });

      expect(response.errors).toBeUndefined();
      expect(response.data.savePattern.success).toBe(true);
      expect(response.data.savePattern.pattern).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid project ID gracefully', async () => {
      const GET_PROJECT_METRICS = `
        query GetProjectMetrics($projectId: ID!) {
          getProjectMetrics(projectId: $projectId) {
            projectId
          }
        }
      `;

      const variables = { projectId: 'invalid-project-id' };

      const response = await query({
        query: GET_PROJECT_METRICS,
        variables
      });

      expect(response.errors).toBeDefined();
      expect(response.errors[0].message).toContain('not found');
    });

    it('should validate required fields', async () => {
      const CREATE_PROJECT = `
        mutation CreateProject($input: CreateProjectInput!) {
          createProject(input: $input) {
            success
            errors {
              message
            }
          }
        }
      `;

      const variables = {
        input: {
          // Missing required name field
          path: '/test/path',
          type: 'REACT'
        }
      };

      const response = await mutate({
        mutation: CREATE_PROJECT,
        variables
      });

      expect(response.errors).toBeDefined();
    });
  });
});