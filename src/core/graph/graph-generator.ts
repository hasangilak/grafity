import { ASTParser } from '../ast/parser';
import { FileScanner } from '../ast/scanner';
import { DependencyAnalyzer, DependencyAnalysisResult } from '../analysis/dependency-analyzer';
import {
  FileInfo,
  ProjectGraph,
  AnalysisOptions,
  ComponentInfo,
  FunctionInfo,
  ImportDeclaration,
  ExportDeclaration,
  DataFlow,
  UserJourney
} from '../../types';

export class GraphGenerator {
  private scanner: FileScanner;
  private dependencyAnalyzer: DependencyAnalyzer;

  constructor(options: Partial<AnalysisOptions> = {}) {
    this.scanner = new FileScanner(options);
    this.dependencyAnalyzer = new DependencyAnalyzer();
  }

  public async generateProjectGraph(rootPath: string): Promise<ProjectGraph> {
    console.log(`Scanning project at: ${rootPath}`);

    // Step 1: Scan files
    const files = await this.scanner.scanDirectory(rootPath);
    console.log(`Found ${files.length} files`);

    // Step 2: Parse AST for each file
    const allImports = new Map<string, ImportDeclaration[]>();
    const allExports = new Map<string, ExportDeclaration[]>();
    const allComponents = new Map<string, ComponentInfo[]>();
    const allFunctions = new Map<string, FunctionInfo[]>();

    const filePaths = files.map(f => f.path);
    const parser = new ASTParser(filePaths);

    for (const file of files) {
      try {
        console.log(`Parsing: ${file.name}`);
        const parsed = parser.parseFile(file.path);

        allImports.set(file.path, parsed.imports);
        allExports.set(file.path, parsed.exports);
        allComponents.set(file.path, parsed.components);
        allFunctions.set(file.path, parsed.functions);
      } catch (error) {
        console.warn(`Failed to parse ${file.path}:`, error);
        // Continue with other files
        allImports.set(file.path, []);
        allExports.set(file.path, []);
        allComponents.set(file.path, []);
        allFunctions.set(file.path, []);
      }
    }

    // Step 3: Analyze dependencies
    const dependencyAnalysis = this.dependencyAnalyzer.analyze(
      files,
      allImports,
      allExports,
      allComponents,
      allFunctions
    );

    // Step 4: Extract data flows
    const dataFlows = this.extractDataFlows(allComponents, allFunctions, allImports);

    // Step 5: Infer user journeys
    const userJourneys = this.inferUserJourneys(allComponents, allFunctions);

    // Flatten collections for final result
    const allImportsFlat = Array.from(allImports.values()).flat();
    const allExportsFlat = Array.from(allExports.values()).flat();
    const allComponentsFlat = Array.from(allComponents.values()).flat();
    const allFunctionsFlat = Array.from(allFunctions.values()).flat();

    const projectGraph: ProjectGraph = {
      files,
      components: allComponentsFlat,
      functions: allFunctionsFlat,
      imports: allImportsFlat,
      exports: allExportsFlat,
      dataFlows,
      userJourneys,
      dependencies: dependencyAnalysis.graph
    };

    console.log(`Generated graph with:`);
    console.log(`  - ${files.length} files`);
    console.log(`  - ${allComponentsFlat.length} components`);
    console.log(`  - ${allFunctionsFlat.length} functions`);
    console.log(`  - ${allImportsFlat.length} imports`);
    console.log(`  - ${dependencyAnalysis.graph.edges.length} dependencies`);
    console.log(`  - ${dependencyAnalysis.cycles.length} circular dependencies`);

    return projectGraph;
  }

  private extractDataFlows(
    components: Map<string, ComponentInfo[]>,
    functions: Map<string, FunctionInfo[]>,
    imports: Map<string, ImportDeclaration[]>
  ): DataFlow[] {
    const dataFlows: DataFlow[] = [];

    // Extract prop flows between components
    components.forEach((componentList, filePath) => {
      componentList.forEach(component => {
        // Props passed to child components
        component.children.forEach(child => {
          dataFlows.push({
            from: `${component.filePath}#${component.name}`,
            to: `${child.filePath}#${child.name}`,
            type: 'props',
            location: component.location
          });
        });

        // State flows from hooks
        component.hooks.forEach(hook => {
          if (hook.type === 'useState' || hook.type === 'useContext') {
            dataFlows.push({
              from: `${component.filePath}#${component.name}#${hook.name}`,
              to: `${component.filePath}#${component.name}`,
              type: 'state',
              location: hook.location
            });
          }
        });
      });
    });

    // Extract function call flows
    functions.forEach((functionList, filePath) => {
      functionList.forEach(func => {
        func.calls.forEach(call => {
          dataFlows.push({
            from: `${func.filePath}#${func.name}`,
            to: call.name,
            type: 'function_call',
            data: { arguments: call.arguments },
            location: call.location
          });
        });
      });
    });

    // Extract import flows
    imports.forEach((importList, filePath) => {
      importList.forEach(importDecl => {
        dataFlows.push({
          from: importDecl.source,
          to: filePath,
          type: 'import',
          data: { specifiers: importDecl.specifiers },
          location: importDecl.location
        });
      });
    });

    return dataFlows;
  }

  private inferUserJourneys(
    components: Map<string, ComponentInfo[]>,
    functions: Map<string, FunctionInfo[]>
  ): UserJourney[] {
    const userJourneys: UserJourney[] = [];

    // Simple heuristics for user journey detection
    const routeComponents = new Set<string>();
    const formComponents = new Set<string>();
    const buttonComponents = new Set<string>();

    components.forEach((componentList, filePath) => {
      componentList.forEach(component => {
        const name = component.name.toLowerCase();

        // Detect route components
        if (name.includes('route') || name.includes('page') || name.includes('screen')) {
          routeComponents.add(`${filePath}#${component.name}`);
        }

        // Detect form components
        if (name.includes('form') || name.includes('input') || name.includes('field')) {
          formComponents.add(`${filePath}#${component.name}`);
        }

        // Detect interactive components
        if (name.includes('button') || name.includes('link') || name.includes('modal')) {
          buttonComponents.add(`${filePath}#${component.name}`);
        }
      });
    });

    // Create a user journey for form interactions
    if (formComponents.size > 0) {
      const formJourney: UserJourney = {
        id: 'form-interaction',
        name: 'Form Interaction Journey',
        steps: [
          {
            id: 'form-input',
            type: 'input',
            component: Array.from(formComponents)[0],
            description: 'User fills out form',
            triggers: ['onChange', 'onInput']
          },
          {
            id: 'form-submit',
            type: 'form_submit',
            component: Array.from(formComponents)[0],
            description: 'User submits form',
            triggers: ['onSubmit', 'onClick']
          }
        ],
        components: Array.from(formComponents),
        routes: []
      };
      userJourneys.push(formJourney);
    }

    // Create navigation journey
    if (routeComponents.size > 1) {
      const navJourney: UserJourney = {
        id: 'navigation',
        name: 'Navigation Journey',
        steps: Array.from(routeComponents).map((component, index) => ({
          id: `nav-step-${index}`,
          type: 'navigation',
          component,
          description: `Navigate to ${component}`,
          triggers: ['onClick', 'onNavigate']
        })),
        components: [],
        routes: Array.from(routeComponents)
      };
      userJourneys.push(navJourney);
    }

    return userJourneys;
  }

  public async watchProject(
    rootPath: string,
    onChange: (graph: ProjectGraph) => void
  ): Promise<() => void> {
    let currentGraph = await this.generateProjectGraph(rootPath);
    onChange(currentGraph);

    return this.scanner.watchDirectory(rootPath, async (event, filePath) => {
      console.log(`File ${event}: ${filePath}`);

      // Regenerate graph when files change
      try {
        currentGraph = await this.generateProjectGraph(rootPath);
        onChange(currentGraph);
      } catch (error) {
        console.error('Error regenerating graph:', error);
      }
    });
  }

  public filterGraph(
    graph: ProjectGraph,
    filters: {
      fileTypes?: string[];
      componentTypes?: string[];
      includeTests?: boolean;
      includeNodeModules?: boolean;
    }
  ): ProjectGraph {
    let filteredFiles = graph.files;

    // Filter by file types
    if (filters.fileTypes) {
      filteredFiles = filteredFiles.filter(file =>
        filters.fileTypes!.includes(file.extension)
      );
    }

    // Filter out tests
    if (!filters.includeTests) {
      filteredFiles = filteredFiles.filter(file =>
        !file.name.includes('.test.') && !file.name.includes('.spec.')
      );
    }

    // Filter out node_modules
    if (!filters.includeNodeModules) {
      filteredFiles = filteredFiles.filter(file =>
        !file.path.includes('node_modules')
      );
    }

    const filteredPaths = new Set(filteredFiles.map(f => f.path));

    return {
      ...graph,
      files: filteredFiles,
      components: graph.components.filter(c => filteredPaths.has(c.filePath)),
      functions: graph.functions.filter(f => filteredPaths.has(f.filePath)),
      imports: graph.imports.filter(i => {
        // This is approximated - would need source file path mapping
        return true;
      }),
      exports: graph.exports.filter(e => {
        // This is approximated - would need source file path mapping
        return true;
      }),
      dependencies: {
        nodes: graph.dependencies.nodes.filter(n => filteredPaths.has(n.filePath)),
        edges: graph.dependencies.edges.filter(e =>
          filteredPaths.has(e.from) && filteredPaths.has(e.to)
        )
      }
    };
  }
}