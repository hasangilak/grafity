import request from 'supertest';
import { GrafityServer } from '../../../src/server/index';

describe('GraphQL API Integration', () => {
  let server: GrafityServer;
  let app: any;
  let authToken: string;
  let testUser: any;

  beforeAll(async () => {
    server = new GrafityServer();
    await server.start(0);
    app = (server as any).app;

    testUser = generateTestUser();
    authToken = await generateAuthToken(testUser);
  });

  afterAll(async () => {
    if (server) {
      await (server as any).gracefulShutdown('test');
    }
  });

  describe('Schema Introspection', () => {
    it('should support introspection queries', async () => {
      const introspectionQuery = `
        query IntrospectionQuery {
          __schema {
            types {
              name
              kind
            }
          }
        }
      `;

      const response = await request(app)
        .post('/graphql')
        .send({ query: introspectionQuery });

      expect(response).toHaveHttpStatus(200);
      expect(response.body.data).toHaveProperty('__schema');
      expect(response.body.data.__schema.types).toBeInstanceOf(Array);

      // Check for our custom types
      const typeNames = response.body.data.__schema.types.map((t: any) => t.name);
      expect(typeNames).toContain('Project');
      expect(typeNames).toContain('Component');
      expect(typeNames).toContain('Pattern');
    });

    it('should return schema documentation', async () => {
      const schemaQuery = `
        query {
          __type(name: "Project") {
            name
            fields {
              name
              type {
                name
                kind
              }
            }
          }
        }
      `;

      const response = await request(app)
        .post('/graphql')
        .send({ query: schemaQuery });

      expect(response).toHaveHttpStatus(200);
      expect(response.body.data.__type.name).toBe('Project');
      expect(response.body.data.__type.fields).toBeInstanceOf(Array);
    });
  });

  describe('Authentication & Authorization', () => {
    it('should allow queries without authentication for public fields', async () => {
      const publicQuery = `
        query {
          __schema {
            queryType {
              name
            }
          }
        }
      `;

      const response = await request(app)
        .post('/graphql')
        .send({ query: publicQuery });

      expect(response).toHaveHttpStatus(200);
      expect(response.body.data).toBeDefined();
    });

    it('should require authentication for protected queries', async () => {
      const protectedQuery = `
        query {
          getProjectMetrics(projectId: "test-project") {
            totalComponents
          }
        }
      `;

      const response = await request(app)
        .post('/graphql')
        .send({ query: protectedQuery });

      expect(response).toHaveHttpStatus(200);
      expect(response.body.errors).toBeDefined();
      expect(response.body.errors[0].message).toContain('authentication');
    });

    it('should accept valid JWT tokens', async () => {
      const authenticatedQuery = `
        query {
          getProjectMetrics(projectId: "test-project") {
            totalComponents
          }
        }
      `;

      const response = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ query: authenticatedQuery });

      expect(response).toHaveHttpStatus(200);
      // Should not have authentication errors
      if (response.body.errors) {
        expect(response.body.errors[0].message).not.toContain('authentication');
      }
    });
  });

  describe('Project Mutations', () => {
    it('should create a new project', async () => {
      const createProjectMutation = `
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
          description: 'Created via GraphQL mutation',
          path: '/test/graphql-project',
          type: 'REACT'
        }
      };

      const response = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ query: createProjectMutation, variables });

      expect(response).toHaveHttpStatus(200);
      expect(response.body.errors).toBeUndefined();
      expect(response.body.data.createProject.success).toBe(true);
      expect(response.body.data.createProject.project).toBeDefined();
      expect(response.body.data.createProject.project.name).toBe(variables.input.name);
      expect(response.body.data.createProject.project.type).toBe('react');
    });

    it('should validate required fields in mutations', async () => {
      const invalidMutation = `
        mutation CreateProject($input: CreateProjectInput!) {
          createProject(input: $input) {
            success
            errors {
              message
              code
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

      const response = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ query: invalidMutation, variables });

      expect(response).toHaveHttpStatus(400);
      expect(response.body.errors).toBeDefined();
    });

    it('should update an existing project', async () => {
      // First create a project
      const createProject = await createTestProjectViaGraphQL();
      const projectId = createProject.id;

      const updateMutation = `
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
            }
          }
        }
      `;

      const variables = {
        id: projectId,
        input: {
          name: 'Updated Project Name',
          description: 'Updated via GraphQL'
        }
      };

      const response = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ query: updateMutation, variables });

      expect(response).toHaveHttpStatus(200);
      expect(response.body.data.updateProject.success).toBe(true);
      expect(response.body.data.updateProject.project.name).toBe('Updated Project Name');
    });

    it('should delete a project', async () => {
      const createProject = await createTestProjectViaGraphQL();
      const projectId = createProject.id;

      const deleteMutation = `
        mutation DeleteProject($id: ID!) {
          deleteProject(id: $id) {
            success
            message
            errors {
              message
            }
          }
        }
      `;

      const response = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ query: deleteMutation, variables: { id: projectId } });

      expect(response).toHaveHttpStatus(200);
      expect(response.body.data.deleteProject.success).toBe(true);
    });
  });

  describe('Project Queries', () => {
    let testProject: any;

    beforeEach(async () => {
      testProject = await createTestProjectViaGraphQL();
    });

    it('should get project metrics', async () => {
      const metricsQuery = `
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
              critical
              major
              minor
            }
            performance {
              score
              bundleSize
              loadTime
            }
            security {
              score
              vulnerabilities
              lowRisk
              mediumRisk
              highRisk
            }
          }
        }
      `;

      const response = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ query: metricsQuery, variables: { projectId: testProject.id } });

      expect(response).toHaveHttpStatus(200);
      expect(response.body.errors).toBeUndefined();
      expect(response.body.data.getProjectMetrics).toBeDefined();
      expect(response.body.data.getProjectMetrics.projectId).toBe(testProject.id);
      expect(response.body.data.getProjectMetrics.overview).toBeDefined();
    });

    it('should get project graph', async () => {
      const graphQuery = `
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

      const response = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ query: graphQuery, variables: { projectId: testProject.id } });

      expect(response).toHaveHttpStatus(200);
      expect(response.body.data.getProjectGraph).toBeDefined();
      expect(response.body.data.getProjectGraph.nodes).toBeInstanceOf(Array);
      expect(response.body.data.getProjectGraph.edges).toBeInstanceOf(Array);
    });

    it('should get component tree', async () => {
      const treeQuery = `
        query GetComponentTree($projectId: ID!) {
          getComponentTree(projectId: $projectId) {
            root {
              component {
                id
                name
                type
                path
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

      const response = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ query: treeQuery, variables: { projectId: testProject.id } });

      expect(response).toHaveHttpStatus(200);
      expect(response.body.data.getComponentTree).toBeDefined();
    });

    it('should find patterns in project', async () => {
      const patternsQuery = `
        query FindPatterns($projectId: ID!, $patternTypes: [PatternType!]) {
          findPatterns(projectId: $projectId, patternTypes: $patternTypes) {
            id
            name
            type
            description
            confidence
            severity
            components {
              id
              name
            }
            examples {
              component {
                id
                name
              }
              code
              explanation
            }
          }
        }
      `;

      const variables = {
        projectId: testProject.id,
        patternTypes: ['CUSTOM_HOOK', 'GOD_COMPONENT']
      };

      const response = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ query: patternsQuery, variables });

      expect(response).toHaveHttpStatus(200);
      expect(response.body.data.findPatterns).toBeInstanceOf(Array);
    });

    it('should search components', async () => {
      const searchQuery = `
        query SearchComponents($query: String!, $filters: ComponentFilters) {
          searchComponents(query: $query, filters: $filters) {
            components {
              id
              name
              type
              path
              complexity
              size
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
              complexity {
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
          complexity: { min: 1, max: 10 }
        }
      };

      const response = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ query: searchQuery, variables });

      expect(response).toHaveHttpStatus(200);
      expect(response.body.data.searchComponents).toBeDefined();
      expect(response.body.data.searchComponents.components).toBeInstanceOf(Array);
      expect(response.body.data.searchComponents.facets).toBeDefined();
    });
  });

  describe('Analysis Operations', () => {
    let testProject: any;

    beforeEach(async () => {
      testProject = await createTestProjectViaGraphQL();
    });

    it('should trigger project analysis', async () => {
      const analysisMutation = `
        mutation TriggerAnalysis($projectId: ID!, $options: AnalysisOptions) {
          triggerAnalysis(projectId: $projectId, options: $options) {
            success
            analysis {
              project {
                id
                name
              }
            }
            errors {
              message
              code
            }
          }
        }
      `;

      const variables = {
        projectId: testProject.id,
        options: {
          includePatterns: true,
          includeMetrics: true,
          includeDependencies: true,
          depth: 'FULL'
        }
      };

      const response = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ query: analysisMutation, variables });

      expect(response).toHaveHttpStatus(200);
      expect(response.body.data.triggerAnalysis.success).toBe(true);
    });

    it('should get code complexity analysis', async () => {
      const complexityQuery = `
        query GetCodeComplexity($projectId: ID!) {
          getCodeComplexity(projectId: $projectId) {
            overall
            byComponent {
              component {
                id
                name
                type
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

      const response = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ query: complexityQuery, variables: { projectId: testProject.id } });

      expect(response).toHaveHttpStatus(200);
      expect(response.body.data.getCodeComplexity).toBeDefined();
      expect(response.body.data.getCodeComplexity.distribution).toBeDefined();
      expect(response.body.data.getCodeComplexity.recommendations).toBeInstanceOf(Array);
    });

    it('should get dependency insights', async () => {
      const dependencyQuery = `
        query GetDependencyInsights($projectId: ID!) {
          getDependencyInsights(projectId: $projectId) {
            graph {
              nodes {
                id
                name
                type
                isExternal
                size
              }
              edges {
                source
                target
                type
                strength
              }
            }
            circular {
              components {
                id
                name
              }
              path
              severity
            }
            critical {
              component {
                id
                name
              }
              dependents
              impact
              type
            }
            recommendations
          }
        }
      `;

      const response = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ query: dependencyQuery, variables: { projectId: testProject.id } });

      expect(response).toHaveHttpStatus(200);
      expect(response.body.data.getDependencyInsights).toBeDefined();
      expect(response.body.data.getDependencyInsights.graph).toBeDefined();
      expect(response.body.data.getDependencyInsights.recommendations).toBeInstanceOf(Array);
    });
  });

  describe('Pattern Management', () => {
    it('should save a custom pattern', async () => {
      const savePatternMutation = `
        mutation SavePattern($input: SavePatternInput!) {
          savePattern(input: $input) {
            success
            pattern {
              id
              name
              type
              description
              category
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

      const response = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ query: savePatternMutation, variables });

      expect(response).toHaveHttpStatus(200);
      expect(response.body.data.savePattern.success).toBe(true);
      expect(response.body.data.savePattern.pattern).toBeDefined();
      expect(response.body.data.savePattern.pattern.name).toBe('Custom GraphQL Pattern');
    });

    it('should remove a pattern', async () => {
      const removePatternMutation = `
        mutation RemovePattern($id: ID!) {
          removePattern(id: $id) {
            success
            message
            errors {
              message
              code
            }
          }
        }
      `;

      const response = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ query: removePatternMutation, variables: { id: 'test-pattern-id' } });

      expect(response).toHaveHttpStatus(200);
      expect(response.body.data.removePattern.success).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle GraphQL syntax errors', async () => {
      const invalidQuery = `
        query {
          invalidField {
            nonExistentField
          }
        }
      `;

      const response = await request(app)
        .post('/graphql')
        .send({ query: invalidQuery });

      expect(response).toHaveHttpStatus(400);
      expect(response.body.errors).toBeDefined();
    });

    it('should handle missing variables', async () => {
      const queryWithVariables = `
        query GetProject($id: ID!) {
          getProject(id: $id) {
            name
          }
        }
      `;

      const response = await request(app)
        .post('/graphql')
        .send({ query: queryWithVariables });
        // Missing variables

      expect(response).toHaveHttpStatus(400);
      expect(response.body.errors).toBeDefined();
    });

    it('should handle non-existent resources gracefully', async () => {
      const query = `
        query GetProject($projectId: ID!) {
          getProjectMetrics(projectId: $projectId) {
            totalComponents
          }
        }
      `;

      const response = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          query,
          variables: { projectId: 'non-existent-project-id' }
        });

      expect(response).toHaveHttpStatus(200);
      expect(response.body.errors).toBeDefined();
      expect(response.body.errors[0].message).toContain('not found');
    });

    it('should handle invalid input types', async () => {
      const mutation = `
        mutation CreateProject($input: CreateProjectInput!) {
          createProject(input: $input) {
            success
          }
        }
      `;

      const response = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          query: mutation,
          variables: {
            input: {
              name: 123, // Should be string
              path: '/test/path',
              type: 'REACT'
            }
          }
        });

      expect(response).toHaveHttpStatus(400);
      expect(response.body.errors).toBeDefined();
    });
  });

  describe('Performance', () => {
    it('should handle concurrent GraphQL requests', async () => {
      const query = `
        query {
          __schema {
            queryType {
              name
            }
          }
        }
      `;

      const requests = Array(10).fill(0).map(() =>
        request(app)
          .post('/graphql')
          .send({ query })
      );

      const responses = await Promise.all(requests);

      responses.forEach(response => {
        expect(response).toHaveHttpStatus(200);
        expect(response.body.data).toBeDefined();
      });
    });

    it('should handle large query complexity', async () => {
      const complexQuery = `
        query GetFullProjectData($projectId: ID!) {
          getProjectMetrics(projectId: $projectId) {
            projectId
            overview {
              totalComponents
              totalLines
              complexity
              maintainability
            }
            codeQuality {
              score
              issues
            }
            performance {
              score
              bundleSize
            }
          }
          getProjectGraph(projectId: $projectId) {
            nodes {
              id
              label
              type
            }
            edges {
              id
              source
              target
            }
          }
          getComponentTree(projectId: $projectId) {
            totalComponents
            maxDepth
          }
        }
      `;

      const testProject = await createTestProjectViaGraphQL();
      const startTime = Date.now();

      const response = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ query: complexQuery, variables: { projectId: testProject.id } });

      const endTime = Date.now();

      expect(response).toHaveHttpStatus(200);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
    });
  });

  // Helper functions
  async function generateAuthToken(user: any): Promise<string> {
    const jwt = require('jsonwebtoken');
    return jwt.sign(
      { userId: user.id, username: user.username, roles: user.roles },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
  }

  async function createTestProjectViaGraphQL(): Promise<any> {
    const mutation = `
      mutation CreateProject($input: CreateProjectInput!) {
        createProject(input: $input) {
          project {
            id
            name
            type
            path
          }
        }
      }
    `;

    const variables = {
      input: {
        name: `Test Project ${Math.random().toString(36).substr(2, 6)}`,
        description: 'GraphQL integration test project',
        path: `/test/graphql/${Math.random().toString(36).substr(2, 6)}`,
        type: 'REACT'
      }
    };

    const response = await request(app)
      .post('/graphql')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ query: mutation, variables });

    expect(response).toHaveHttpStatus(200);
    expect(response.body.data.createProject.project).toBeDefined();
    return response.body.data.createProject.project;
  }
});