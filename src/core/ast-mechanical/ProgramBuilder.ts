import * as ts from 'typescript';
import * as path from 'path';
import * as fs from 'fs';

export interface ProgramOptions {
  rootDir?: string;
  configPath?: string;
  compilerOptions?: ts.CompilerOptions;
  includeNodeModules?: boolean;
  followSymlinks?: boolean;
}

export interface ProgramInfo {
  program: ts.Program;
  checker: ts.TypeChecker;
  sourceFiles: ts.SourceFile[];
  diagnostics: ts.Diagnostic[];
  compilerOptions: ts.CompilerOptions;
}

export class ProgramBuilder {
  private program: ts.Program | null = null;
  private checker: ts.TypeChecker | null = null;
  private compilerOptions: ts.CompilerOptions;
  private rootDir: string;
  private sourceMapCache: Map<string, ts.SourceMapRange[]> = new Map();

  constructor(options: ProgramOptions = {}) {
    this.rootDir = options.rootDir || process.cwd();
    this.compilerOptions = this.buildCompilerOptions(options);
  }

  /**
   * Create TypeScript program from files
   */
  createProgram(fileNames: string[]): ProgramInfo {
    // Filter and resolve file paths
    const resolvedFiles = this.resolveFiles(fileNames);

    // Create the program
    this.program = ts.createProgram(resolvedFiles, this.compilerOptions);
    this.checker = this.program.getTypeChecker();

    // Get diagnostics
    const diagnostics = this.collectDiagnostics();

    // Get source files
    const sourceFiles = this.program.getSourceFiles()
      .filter(sf => !sf.isDeclarationFile && !sf.fileName.includes('node_modules'));

    return {
      program: this.program,
      checker: this.checker,
      sourceFiles,
      diagnostics,
      compilerOptions: this.compilerOptions
    };
  }

  /**
   * Create program from tsconfig.json
   */
  createProgramFromConfig(configPath?: string): ProgramInfo {
    const tsconfigPath = configPath || this.findTsConfig();

    if (!tsconfigPath) {
      throw new Error('No tsconfig.json found');
    }

    // Parse tsconfig
    const configFile = ts.readConfigFile(tsconfigPath, ts.sys.readFile);
    if (configFile.error) {
      throw new Error(`Failed to read tsconfig: ${configFile.error.messageText}`);
    }

    // Parse config contents
    const parsedConfig = ts.parseJsonConfigFileContent(
      configFile.config,
      ts.sys,
      path.dirname(tsconfigPath)
    );

    if (parsedConfig.errors.length > 0) {
      console.warn('TypeScript config warnings:', parsedConfig.errors);
    }

    // Update compiler options
    this.compilerOptions = {
      ...this.compilerOptions,
      ...parsedConfig.options
    };

    // Create program
    this.program = ts.createProgram({
      rootNames: parsedConfig.fileNames,
      options: this.compilerOptions,
      projectReferences: parsedConfig.projectReferences
    });

    this.checker = this.program.getTypeChecker();

    const sourceFiles = this.program.getSourceFiles()
      .filter(sf => !sf.isDeclarationFile && !sf.fileName.includes('node_modules'));

    return {
      program: this.program,
      checker: this.checker,
      sourceFiles,
      diagnostics: this.collectDiagnostics(),
      compilerOptions: this.compilerOptions
    };
  }

  /**
   * Configure compiler options
   */
  private buildCompilerOptions(options: ProgramOptions): ts.CompilerOptions {
    const baseOptions: ts.CompilerOptions = {
      target: ts.ScriptTarget.Latest,
      module: ts.ModuleKind.ESNext,
      lib: ['es2020', 'dom'],
      jsx: ts.JsxEmit.React,
      declaration: true,
      declarationMap: true,
      sourceMap: true,
      strict: false, // Disable strict for analysis
      esModuleInterop: true,
      skipLibCheck: true,
      forceConsistentCasingInFileNames: true,
      resolveJsonModule: true,
      allowJs: true,
      checkJs: false,
      moduleResolution: ts.ModuleResolutionKind.NodeJs,
      baseUrl: this.rootDir,
      paths: {}
    };

    return {
      ...baseOptions,
      ...options.compilerOptions
    };
  }

  /**
   * Handle tsconfig.json parsing
   */
  parseTsConfig(configPath: string): ts.ParsedCommandLine {
    const configFile = ts.readConfigFile(configPath, ts.sys.readFile);

    if (configFile.error) {
      throw new Error(`Error reading tsconfig: ${configFile.error.messageText}`);
    }

    const parsedConfig = ts.parseJsonConfigFileContent(
      configFile.config,
      ts.sys,
      path.dirname(configPath),
      undefined,
      configPath
    );

    return parsedConfig;
  }

  /**
   * Implement file resolution
   */
  private resolveFiles(fileNames: string[]): string[] {
    const resolved: string[] = [];

    for (const fileName of fileNames) {
      const fullPath = path.isAbsolute(fileName)
        ? fileName
        : path.resolve(this.rootDir, fileName);

      if (fs.existsSync(fullPath)) {
        resolved.push(fullPath);
      } else {
        console.warn(`File not found: ${fileName}`);
      }
    }

    return resolved;
  }

  /**
   * Add source map support
   */
  getSourceMapRange(sourceFile: ts.SourceFile, node: ts.Node): ts.SourceMapRange | undefined {
    const fileName = sourceFile.fileName;

    if (!this.sourceMapCache.has(fileName)) {
      // Parse source map if available
      const sourceMapPath = `${fileName}.map`;
      if (fs.existsSync(sourceMapPath)) {
        try {
          const sourceMap = JSON.parse(fs.readFileSync(sourceMapPath, 'utf8'));
          // Process source map data
          // This is simplified - real implementation would parse the mappings
          this.sourceMapCache.set(fileName, []);
        } catch (error) {
          console.error(`Failed to parse source map: ${sourceMapPath}`);
        }
      }
    }

    // Return source map range for node
    return undefined; // Simplified for now
  }

  /**
   * Find tsconfig.json
   */
  private findTsConfig(): string | null {
    let currentDir = this.rootDir;

    while (currentDir !== path.dirname(currentDir)) {
      const configPath = path.join(currentDir, 'tsconfig.json');
      if (fs.existsSync(configPath)) {
        return configPath;
      }
      currentDir = path.dirname(currentDir);
    }

    return null;
  }

  /**
   * Collect all diagnostics
   */
  private collectDiagnostics(): ts.Diagnostic[] {
    if (!this.program) {
      return [];
    }

    const diagnostics: ts.Diagnostic[] = [];

    // Syntactic diagnostics
    diagnostics.push(...this.program.getSyntacticDiagnostics());

    // Semantic diagnostics (optional for analysis)
    // diagnostics.push(...this.program.getSemanticDiagnostics());

    // Declaration diagnostics
    diagnostics.push(...this.program.getDeclarationDiagnostics());

    return diagnostics;
  }

  /**
   * Get type information for a node
   */
  getTypeAtLocation(node: ts.Node): ts.Type | undefined {
    if (!this.checker) {
      return undefined;
    }

    try {
      return this.checker.getTypeAtLocation(node);
    } catch (error) {
      console.error('Failed to get type at location:', error);
      return undefined;
    }
  }

  /**
   * Get symbol for a node
   */
  getSymbolAtLocation(node: ts.Node): ts.Symbol | undefined {
    if (!this.checker) {
      return undefined;
    }

    try {
      return this.checker.getSymbolAtLocation(node);
    } catch (error) {
      console.error('Failed to get symbol at location:', error);
      return undefined;
    }
  }

  /**
   * Resolve module name
   */
  resolveModuleName(moduleName: string, containingFile: string): ts.ResolvedModule | undefined {
    const result = ts.resolveModuleName(
      moduleName,
      containingFile,
      this.compilerOptions,
      ts.sys
    );

    return result.resolvedModule;
  }

  /**
   * Get all files in program
   */
  getAllFiles(): string[] {
    if (!this.program) {
      return [];
    }

    return this.program.getSourceFiles()
      .filter(sf => !sf.isDeclarationFile)
      .map(sf => sf.fileName);
  }

  /**
   * Get program statistics
   */
  getStatistics(): {
    fileCount: number;
    lineCount: number;
    nodeCount: number;
    diagnosticCount: number;
  } {
    if (!this.program) {
      return {
        fileCount: 0,
        lineCount: 0,
        nodeCount: 0,
        diagnosticCount: 0
      };
    }

    const sourceFiles = this.program.getSourceFiles()
      .filter(sf => !sf.isDeclarationFile && !sf.fileName.includes('node_modules'));

    let lineCount = 0;
    let nodeCount = 0;

    for (const sourceFile of sourceFiles) {
      lineCount += sourceFile.getLineAndCharacterOfPosition(sourceFile.getEnd()).line + 1;
      nodeCount += this.countNodes(sourceFile);
    }

    return {
      fileCount: sourceFiles.length,
      lineCount,
      nodeCount,
      diagnosticCount: this.collectDiagnostics().length
    };
  }

  /**
   * Count nodes in AST
   */
  private countNodes(node: ts.Node): number {
    let count = 1;
    node.forEachChild(child => {
      count += this.countNodes(child);
    });
    return count;
  }

  /**
   * Clear cached data
   */
  clearCache(): void {
    this.sourceMapCache.clear();
    this.program = null;
    this.checker = null;
  }

  /**
   * Get current program
   */
  getProgram(): ts.Program | null {
    return this.program;
  }

  /**
   * Get type checker
   */
  getChecker(): ts.TypeChecker | null {
    return this.checker;
  }
}