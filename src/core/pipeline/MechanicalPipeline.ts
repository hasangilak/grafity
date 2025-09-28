import * as ts from 'typescript';
import { EventEmitter } from 'events';
import { NxGraphProcessor, NxGraphData } from '../nx-integration/NxGraphProcessor';
import { NxGraphTransformer, TransformedGraph } from '../nx-integration/NxGraphTransformer';
import { NxCacheManager } from '../nx-integration/NxCacheManager';
import { ProgramBuilder, ProgramInfo } from '../ast-mechanical/ProgramBuilder';
import { ComponentExtractor, ComponentInfo } from '../ast-mechanical/extractors/ComponentExtractor';
import { FunctionAnalyzer, FunctionInfo } from '../ast-mechanical/extractors/FunctionAnalyzer';
import { ImportExportTracker, ImportInfo, ExportInfo } from '../ast-mechanical/extractors/ImportExportTracker';
import { TypeExtractor, TypeInfo } from '../ast-mechanical/extractors/TypeExtractor';
import { DataFlowAnalyzer, DataFlowGraph } from '../ast-mechanical/DataFlowAnalyzer';
import { PatternDetector, PatternReport } from '../ast-mechanical/PatternDetector';

export interface MechanicalAnalysisResult {
  projectGraph: TransformedGraph;
  components: ComponentInfo[];
  functions: FunctionInfo[];
  imports: ImportInfo[];
  exports: ExportInfo[];
  types: TypeInfo[];
  dataFlow: DataFlowGraph[];
  patterns: PatternReport;
  metrics: {
    totalFiles: number;
    totalComponents: number;
    totalFunctions: number;
    totalTypes: number;
    analysisTime: number;
  };
}

export interface PipelineOptions {
  useCache?: boolean;
  parallel?: boolean;
  includeNodeModules?: boolean;
  maxDepth?: number;
  progressCallback?: (progress: PipelineProgress) => void;
}

export interface PipelineProgress {
  phase: string;
  current: number;
  total: number;
  message: string;
}

export class MechanicalPipeline extends EventEmitter {
  private nxProcessor: NxGraphProcessor;
  private nxTransformer: NxGraphTransformer;
  private cacheManager: NxCacheManager;
  private programBuilder: ProgramBuilder;
  private options: PipelineOptions;

  constructor(options: PipelineOptions = {}) {
    super();
    this.options = {
      useCache: true,
      parallel: true,
      includeNodeModules: false,
      maxDepth: 100,
      ...options
    };

    this.nxProcessor = new NxGraphProcessor();
    this.nxTransformer = new NxGraphTransformer();
    this.cacheManager = new NxCacheManager();
    this.programBuilder = new ProgramBuilder({
      includeNodeModules: this.options.includeNodeModules
    });
  }

  /**
   * Run complete mechanical analysis pipeline
   */
  async analyze(): Promise<MechanicalAnalysisResult> {
    const startTime = Date.now();

    try {
      // Phase 1: Nx Graph Extraction
      this.emitProgress('Nx Graph Extraction', 0, 6);
      const nxData = await this.extractNxGraph();

      // Phase 2: Transform Graph
      this.emitProgress('Graph Transformation', 1, 6);
      const transformedGraph = await this.transformGraph(nxData);

      // Phase 3: Build TypeScript Program
      this.emitProgress('TypeScript Program Setup', 2, 6);
      const programInfo = await this.buildProgram(nxData);

      // Phase 4: AST Analysis
      this.emitProgress('AST Analysis', 3, 6);
      const astResults = await this.analyzeAST(programInfo);

      // Phase 5: Data Flow Analysis
      this.emitProgress('Data Flow Analysis', 4, 6);
      const dataFlows = await this.analyzeDataFlow(programInfo, astResults.functions);

      // Phase 6: Pattern Detection
      this.emitProgress('Pattern Detection', 5, 6);
      const patterns = await this.detectPatterns(
        programInfo,
        astResults.components,
        astResults.functions
      );

      // Calculate metrics
      const metrics = {
        totalFiles: programInfo.sourceFiles.length,
        totalComponents: astResults.components.length,
        totalFunctions: astResults.functions.length,
        totalTypes: astResults.types.length,
        analysisTime: Date.now() - startTime
      };

      this.emitProgress('Analysis Complete', 6, 6);

      return {
        projectGraph: transformedGraph,
        components: astResults.components,
        functions: astResults.functions,
        imports: astResults.imports,
        exports: astResults.exports,
        types: astResults.types,
        dataFlow: dataFlows,
        patterns,
        metrics
      };
    } catch (error: any) {
      this.emit('error', error);
      throw new Error(`Pipeline failed: ${error.message}`);
    }
  }

  /**
   * Extract Nx project graph
   */
  private async extractNxGraph(): Promise<NxGraphData> {
    const cacheKey = 'nx-graph-data';

    if (this.options.useCache) {
      const cached = await this.cacheManager.get<NxGraphData>(cacheKey);
      if (cached) {
        this.emit('cache-hit', cacheKey);
        return cached;
      }
    }

    const data = await this.nxProcessor.extractProjectData();

    if (this.options.useCache) {
      await this.cacheManager.set(cacheKey, data, 3600000); // 1 hour TTL
    }

    return data;
  }

  /**
   * Transform Nx graph to internal format
   */
  private async transformGraph(nxData: NxGraphData): Promise<TransformedGraph> {
    const cacheKey = 'transformed-graph';

    if (this.options.useCache) {
      const cached = await this.cacheManager.get<TransformedGraph>(cacheKey);
      if (cached) {
        return cached;
      }
    }

    const graph = this.nxTransformer.transformNxData(nxData);

    if (this.options.useCache) {
      await this.cacheManager.set(cacheKey, graph);
    }

    return graph;
  }

  /**
   * Build TypeScript program
   */
  private async buildProgram(nxData: NxGraphData): Promise<ProgramInfo> {
    // Collect all TypeScript files from projects
    const allFiles: string[] = [];
    for (const [_, project] of nxData.projects) {
      if (project.files) {
        allFiles.push(...project.files);
      }
    }

    // Create program from config or files
    const programInfo = this.programBuilder.createProgramFromConfig();

    return programInfo;
  }

  /**
   * Analyze AST with all extractors
   */
  private async analyzeAST(programInfo: ProgramInfo): Promise<{
    components: ComponentInfo[];
    functions: FunctionInfo[];
    imports: ImportInfo[];
    exports: ExportInfo[];
    types: TypeInfo[];
  }> {
    const { checker, sourceFiles } = programInfo;

    const componentExtractor = new ComponentExtractor(checker);
    const functionAnalyzer = new FunctionAnalyzer(checker);
    const importExportTracker = new ImportExportTracker(checker);
    const typeExtractor = new TypeExtractor(checker);

    const allComponents: ComponentInfo[] = [];
    const allFunctions: FunctionInfo[] = [];
    const allImports: ImportInfo[] = [];
    const allExports: ExportInfo[] = [];
    const allTypes: TypeInfo[] = [];

    // Process files in parallel if enabled
    if (this.options.parallel) {
      const promises = sourceFiles.map(async sourceFile => {
        const fileResults = await this.analyzeFile(
          sourceFile,
          componentExtractor,
          functionAnalyzer,
          importExportTracker,
          typeExtractor
        );
        return fileResults;
      });

      const results = await Promise.all(promises);
      for (const result of results) {
        allComponents.push(...result.components);
        allFunctions.push(...result.functions);
        allImports.push(...result.imports);
        allExports.push(...result.exports);
        allTypes.push(...result.types);
      }
    } else {
      // Sequential processing
      for (const sourceFile of sourceFiles) {
        const result = await this.analyzeFile(
          sourceFile,
          componentExtractor,
          functionAnalyzer,
          importExportTracker,
          typeExtractor
        );
        allComponents.push(...result.components);
        allFunctions.push(...result.functions);
        allImports.push(...result.imports);
        allExports.push(...result.exports);
        allTypes.push(...result.types);
      }
    }

    return {
      components: allComponents,
      functions: allFunctions,
      imports: allImports,
      exports: allExports,
      types: allTypes
    };
  }

  /**
   * Analyze single file
   */
  private async analyzeFile(
    sourceFile: ts.SourceFile,
    componentExtractor: ComponentExtractor,
    functionAnalyzer: FunctionAnalyzer,
    importExportTracker: ImportExportTracker,
    typeExtractor: TypeExtractor
  ) {
    const components = componentExtractor.visit(sourceFile);
    const functions = functionAnalyzer.visit(sourceFile);
    const importExports = importExportTracker.visit(sourceFile);
    const types = typeExtractor.visit(sourceFile);

    const imports = importExports.filter(item => 'specifiers' in item) as ImportInfo[];
    const exports = importExports.filter(item => 'type' in item && !('specifiers' in item)) as ExportInfo[];

    return { components, functions, imports, exports, types };
  }

  /**
   * Analyze data flow
   */
  private async analyzeDataFlow(
    programInfo: ProgramInfo,
    functions: FunctionInfo[]
  ): Promise<DataFlowGraph[]> {
    const dataFlowAnalyzer = new DataFlowAnalyzer(programInfo.checker);
    const dataFlows: DataFlowGraph[] = [];

    for (const sourceFile of programInfo.sourceFiles) {
      dataFlowAnalyzer.visit(sourceFile);
      const graph = dataFlowAnalyzer.buildDataFlowGraph();
      if (graph.nodes.length > 0) {
        dataFlows.push(graph);
      }
    }

    return dataFlows;
  }

  /**
   * Detect patterns
   */
  private async detectPatterns(
    programInfo: ProgramInfo,
    components: ComponentInfo[],
    functions: FunctionInfo[]
  ): Promise<PatternReport> {
    const patternDetector = new PatternDetector(
      programInfo.checker,
      components,
      functions
    );

    for (const sourceFile of programInfo.sourceFiles) {
      patternDetector.visit(sourceFile);
    }

    return patternDetector.generateReport();
  }

  /**
   * Emit progress event
   */
  private emitProgress(phase: string, current: number, total: number): void {
    const progress: PipelineProgress = {
      phase,
      current,
      total,
      message: `${phase} (${current}/${total})`
    };

    this.emit('progress', progress);

    if (this.options.progressCallback) {
      this.options.progressCallback(progress);
    }
  }

  /**
   * Clear all caches
   */
  async clearCache(): Promise<void> {
    await this.cacheManager.clear();
    this.nxProcessor.clearCache();
    this.programBuilder.clearCache();
  }

  /**
   * Get cache statistics
   */
  async getCacheStats() {
    return await this.cacheManager.getStatistics();
  }
}