import { APIDocGenerator } from './APIDocGenerator';
import { MarkdownExporter } from './MarkdownExporter';
import { ExampleExtractor } from './ExampleExtractor';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface DocumentationConfig {
  outputDir: string;
  includePrivate: boolean;
  includeInternal: boolean;
  generateAPI: boolean;
  generateUserGuides: boolean;
  generateExamples: boolean;
  generateVisualization: boolean;
  formats: ('markdown' | 'html' | 'pdf' | 'json')[];
  template: string;
  customStyles?: string;
  metadata: DocumentationMetadata;
}

export interface DocumentationMetadata {
  title: string;
  version: string;
  description: string;
  author: string;
  repository?: string;
  license?: string;
  homepage?: string;
  keywords?: string[];
}

export interface DocumentationSection {
  id: string;
  title: string;
  content: string;
  subsections?: DocumentationSection[];
  examples?: CodeExample[];
  diagrams?: Diagram[];
  metadata?: Record<string, any>;
}

export interface CodeExample {
  id: string;
  title: string;
  description: string;
  language: string;
  code: string;
  output?: string;
  runnable: boolean;
  tags: string[];
}

export interface Diagram {
  id: string;
  title: string;
  type: 'flowchart' | 'sequence' | 'class' | 'component' | 'graph';
  content: string;
  format: 'mermaid' | 'plantuml' | 'dot' | 'svg';
}

export interface GenerationResult {
  success: boolean;
  outputFiles: string[];
  errors: string[];
  warnings: string[];
  stats: GenerationStats;
}

export interface GenerationStats {
  totalSections: number;
  totalExamples: number;
  totalDiagrams: number;
  filesGenerated: number;
  generationTime: number;
  fileSize: number;
}

export interface SourceFile {
  path: string;
  content: string;
  language: string;
  exports: string[];
  imports: string[];
  functions: FunctionDoc[];
  classes: ClassDoc[];
  interfaces: InterfaceDoc[];
  types: TypeDoc[];
  comments: CommentDoc[];
}

export interface FunctionDoc {
  name: string;
  description: string;
  parameters: ParameterDoc[];
  returnType: string;
  returnDescription: string;
  examples: string[];
  since?: string;
  deprecated?: boolean;
  visibility: 'public' | 'private' | 'protected';
}

export interface ClassDoc {
  name: string;
  description: string;
  extends?: string;
  implements?: string[];
  properties: PropertyDoc[];
  methods: MethodDoc[];
  constructor?: ConstructorDoc;
  examples: string[];
  since?: string;
  deprecated?: boolean;
}

export interface InterfaceDoc {
  name: string;
  description: string;
  extends?: string[];
  properties: PropertyDoc[];
  methods: MethodDoc[];
  examples: string[];
  since?: string;
  deprecated?: boolean;
}

export interface TypeDoc {
  name: string;
  description: string;
  definition: string;
  examples: string[];
  since?: string;
  deprecated?: boolean;
}

export interface ParameterDoc {
  name: string;
  type: string;
  description: string;
  optional: boolean;
  defaultValue?: string;
}

export interface PropertyDoc {
  name: string;
  type: string;
  description: string;
  optional: boolean;
  readonly: boolean;
  visibility: 'public' | 'private' | 'protected';
}

export interface MethodDoc {
  name: string;
  description: string;
  parameters: ParameterDoc[];
  returnType: string;
  returnDescription: string;
  examples: string[];
  visibility: 'public' | 'private' | 'protected';
  static: boolean;
  abstract: boolean;
}

export interface ConstructorDoc {
  parameters: ParameterDoc[];
  description: string;
  examples: string[];
}

export interface CommentDoc {
  type: 'block' | 'line' | 'jsdoc';
  content: string;
  location: { line: number; column: number };
  tags?: Record<string, string>;
}

export class DocumentationGenerator {
  private config: DocumentationConfig;
  private apiDocGenerator: APIDocGenerator;
  private markdownExporter: MarkdownExporter;
  private exampleExtractor: ExampleExtractor;
  private sourceFiles: SourceFile[] = [];
  private sections: DocumentationSection[] = [];

  constructor(config: Partial<DocumentationConfig>) {
    this.config = {
      outputDir: './docs',
      includePrivate: false,
      includeInternal: false,
      generateAPI: true,
      generateUserGuides: true,
      generateExamples: true,
      generateVisualization: true,
      formats: ['markdown', 'html'],
      template: 'default',
      metadata: {
        title: 'Grafity Documentation',
        version: '1.0.0',
        description: 'Graph-based analysis and visualization platform',
        author: 'Grafity Team'
      },
      ...config
    };

    this.apiDocGenerator = new APIDocGenerator();
    this.markdownExporter = new MarkdownExporter();
    this.exampleExtractor = new ExampleExtractor();
  }

  async generateDocumentation(sourceDir: string): Promise<GenerationResult> {
    const startTime = Date.now();
    const result: GenerationResult = {
      success: true,
      outputFiles: [],
      errors: [],
      warnings: [],
      stats: {
        totalSections: 0,
        totalExamples: 0,
        totalDiagrams: 0,
        filesGenerated: 0,
        generationTime: 0,
        fileSize: 0
      }
    };

    try {
      // Step 1: Scan and parse source files
      await this.scanSourceFiles(sourceDir);

      // Step 2: Generate API documentation
      if (this.config.generateAPI) {
        await this.generateAPIDocumentation();
      }

      // Step 3: Generate user guides
      if (this.config.generateUserGuides) {
        await this.generateUserGuides();
      }

      // Step 4: Extract and generate examples
      if (this.config.generateExamples) {
        await this.generateExampleDocumentation();
      }

      // Step 5: Generate visualizations
      if (this.config.generateVisualization) {
        await this.generateVisualizationDocumentation();
      }

      // Step 6: Create output directory
      await this.ensureOutputDirectory();

      // Step 7: Generate documentation in requested formats
      for (const format of this.config.formats) {
        const files = await this.generateInFormat(format);
        result.outputFiles.push(...files);
      }

      // Step 8: Generate index and navigation
      await this.generateIndex();

      result.stats.totalSections = this.sections.length;
      result.stats.totalExamples = this.getAllExamples().length;
      result.stats.totalDiagrams = this.getAllDiagrams().length;
      result.stats.filesGenerated = result.outputFiles.length;
      result.stats.generationTime = Date.now() - startTime;
      result.stats.fileSize = await this.calculateTotalFileSize(result.outputFiles);

    } catch (error) {
      result.success = false;
      result.errors.push(error.message);
    }

    return result;
  }

  async generateAPIDocumentation(): Promise<void> {
    const apiDocs = await this.apiDocGenerator.generateFromSources(this.sourceFiles);

    // Create API documentation sections
    for (const moduleDoc of apiDocs.modules) {
      const section: DocumentationSection = {
        id: `api-${moduleDoc.name}`,
        title: `API: ${moduleDoc.name}`,
        content: this.generateModuleContent(moduleDoc),
        subsections: []
      };

      // Add function documentation
      for (const func of moduleDoc.functions) {
        section.subsections?.push({
          id: `api-${moduleDoc.name}-${func.name}`,
          title: func.name,
          content: this.generateFunctionContent(func),
          examples: this.extractFunctionExamples(func)
        });
      }

      // Add class documentation
      for (const cls of moduleDoc.classes) {
        section.subsections?.push({
          id: `api-${moduleDoc.name}-${cls.name}`,
          title: cls.name,
          content: this.generateClassContent(cls),
          examples: this.extractClassExamples(cls)
        });
      }

      this.sections.push(section);
    }
  }

  async generateUserGuides(): Promise<void> {
    const guides = [
      {
        id: 'getting-started',
        title: 'Getting Started',
        content: await this.generateGettingStartedGuide()
      },
      {
        id: 'installation',
        title: 'Installation',
        content: await this.generateInstallationGuide()
      },
      {
        id: 'configuration',
        title: 'Configuration',
        content: await this.generateConfigurationGuide()
      },
      {
        id: 'api-usage',
        title: 'API Usage',
        content: await this.generateAPIUsageGuide()
      },
      {
        id: 'examples',
        title: 'Examples',
        content: await this.generateExamplesGuide()
      },
      {
        id: 'troubleshooting',
        title: 'Troubleshooting',
        content: await this.generateTroubleshootingGuide()
      }
    ];

    this.sections.push(...guides);
  }

  async generateExampleDocumentation(): Promise<void> {
    const examples = await this.exampleExtractor.extractFromSources(this.sourceFiles);

    const exampleSection: DocumentationSection = {
      id: 'examples',
      title: 'Code Examples',
      content: 'Collection of code examples demonstrating various features and use cases.',
      examples: examples.map(example => ({
        id: example.id,
        title: example.title,
        description: example.description,
        language: example.language,
        code: example.code,
        output: example.expectedOutput,
        runnable: example.runnable,
        tags: example.tags
      }))
    };

    this.sections.push(exampleSection);
  }

  async generateVisualizationDocumentation(): Promise<void> {
    const diagrams: Diagram[] = [
      {
        id: 'architecture-overview',
        title: 'Architecture Overview',
        type: 'component',
        content: this.generateArchitectureDiagram(),
        format: 'mermaid'
      },
      {
        id: 'data-flow',
        title: 'Data Flow',
        type: 'flowchart',
        content: this.generateDataFlowDiagram(),
        format: 'mermaid'
      },
      {
        id: 'class-hierarchy',
        title: 'Class Hierarchy',
        type: 'class',
        content: this.generateClassDiagram(),
        format: 'mermaid'
      }
    ];

    const visualizationSection: DocumentationSection = {
      id: 'visualizations',
      title: 'System Visualizations',
      content: 'Visual representations of the system architecture and data flows.',
      diagrams
    };

    this.sections.push(visualizationSection);
  }

  private async scanSourceFiles(sourceDir: string): Promise<void> {
    const files = await this.getAllSourceFiles(sourceDir);

    for (const filePath of files) {
      const content = await fs.readFile(filePath, 'utf-8');
      const sourceFile = await this.parseSourceFile(filePath, content);
      this.sourceFiles.push(sourceFile);
    }
  }

  private async getAllSourceFiles(dir: string): Promise<string[]> {
    const files: string[] = [];
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory() && !this.shouldSkipDirectory(entry.name)) {
        const subFiles = await this.getAllSourceFiles(fullPath);
        files.push(...subFiles);
      } else if (entry.isFile() && this.isSourceFile(entry.name)) {
        files.push(fullPath);
      }
    }

    return files;
  }

  private shouldSkipDirectory(dirName: string): boolean {
    const skipDirs = ['node_modules', '.git', 'dist', 'build', 'coverage', '.next'];
    return skipDirs.includes(dirName) || dirName.startsWith('.');
  }

  private isSourceFile(fileName: string): boolean {
    const extensions = ['.ts', '.tsx', '.js', '.jsx', '.vue', '.svelte'];
    return extensions.some(ext => fileName.endsWith(ext));
  }

  private async parseSourceFile(filePath: string, content: string): Promise<SourceFile> {
    // This would use TypeScript compiler API or other parsers
    // For now, simplified implementation
    return {
      path: filePath,
      content,
      language: this.detectLanguage(filePath),
      exports: this.extractExports(content),
      imports: this.extractImports(content),
      functions: this.extractFunctions(content),
      classes: this.extractClasses(content),
      interfaces: this.extractInterfaces(content),
      types: this.extractTypes(content),
      comments: this.extractComments(content)
    };
  }

  private detectLanguage(filePath: string): string {
    if (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) return 'typescript';
    if (filePath.endsWith('.js') || filePath.endsWith('.jsx')) return 'javascript';
    if (filePath.endsWith('.vue')) return 'vue';
    if (filePath.endsWith('.svelte')) return 'svelte';
    return 'unknown';
  }

  private extractExports(content: string): string[] {
    const exportMatches = content.match(/export\s+(?:default\s+)?(?:class|function|interface|type|const|let|var)\s+(\w+)/g);
    return exportMatches?.map(match => match.split(/\s+/).pop() || '') || [];
  }

  private extractImports(content: string): string[] {
    const importMatches = content.match(/import\s+.*?\s+from\s+['"]([^'"]+)['"]/g);
    return importMatches?.map(match => match.split(/['"]([^'"]+)['"]/).pop() || '') || [];
  }

  private extractFunctions(content: string): FunctionDoc[] {
    // Simplified function extraction
    const functions: FunctionDoc[] = [];
    const functionRegex = /\/\*\*([\s\S]*?)\*\/\s*(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\((.*?)\)/g;

    let match;
    while ((match = functionRegex.exec(content)) !== null) {
      const [, comment, name, params] = match;
      functions.push({
        name,
        description: this.parseJSDocDescription(comment),
        parameters: this.parseParameters(params),
        returnType: 'unknown',
        returnDescription: '',
        examples: [],
        visibility: 'public'
      });
    }

    return functions;
  }

  private extractClasses(content: string): ClassDoc[] {
    // Simplified class extraction
    const classes: ClassDoc[] = [];
    const classRegex = /\/\*\*([\s\S]*?)\*\/\s*(?:export\s+)?class\s+(\w+)/g;

    let match;
    while ((match = classRegex.exec(content)) !== null) {
      const [, comment, name] = match;
      classes.push({
        name,
        description: this.parseJSDocDescription(comment),
        properties: [],
        methods: [],
        examples: []
      });
    }

    return classes;
  }

  private extractInterfaces(content: string): InterfaceDoc[] {
    // Simplified interface extraction
    const interfaces: InterfaceDoc[] = [];
    const interfaceRegex = /\/\*\*([\s\S]*?)\*\/\s*(?:export\s+)?interface\s+(\w+)/g;

    let match;
    while ((match = interfaceRegex.exec(content)) !== null) {
      const [, comment, name] = match;
      interfaces.push({
        name,
        description: this.parseJSDocDescription(comment),
        properties: [],
        methods: [],
        examples: []
      });
    }

    return interfaces;
  }

  private extractTypes(content: string): TypeDoc[] {
    // Simplified type extraction
    const types: TypeDoc[] = [];
    const typeRegex = /\/\*\*([\s\S]*?)\*\/\s*(?:export\s+)?type\s+(\w+)\s*=\s*(.*?);/g;

    let match;
    while ((match = typeRegex.exec(content)) !== null) {
      const [, comment, name, definition] = match;
      types.push({
        name,
        description: this.parseJSDocDescription(comment),
        definition,
        examples: []
      });
    }

    return types;
  }

  private extractComments(content: string): CommentDoc[] {
    const comments: CommentDoc[] = [];
    const lines = content.split('\n');

    lines.forEach((line, index) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('//')) {
        comments.push({
          type: 'line',
          content: trimmed.substring(2).trim(),
          location: { line: index + 1, column: line.indexOf('//') }
        });
      }
    });

    return comments;
  }

  private parseJSDocDescription(comment: string): string {
    const lines = comment.split('\n').map(line => line.replace(/^\s*\*\s?/, ''));
    return lines.join('\n').trim();
  }

  private parseParameters(paramString: string): ParameterDoc[] {
    if (!paramString.trim()) return [];

    return paramString.split(',').map(param => {
      const trimmed = param.trim();
      const [name, type] = trimmed.split(':').map(s => s.trim());

      return {
        name: name.replace(/[?=].*$/, ''),
        type: type || 'any',
        description: '',
        optional: trimmed.includes('?') || trimmed.includes('=')
      };
    });
  }

  private async generateInFormat(format: string): Promise<string[]> {
    const files: string[] = [];

    switch (format) {
      case 'markdown':
        files.push(...await this.generateMarkdown());
        break;
      case 'html':
        files.push(...await this.generateHTML());
        break;
      case 'pdf':
        files.push(...await this.generatePDF());
        break;
      case 'json':
        files.push(...await this.generateJSON());
        break;
    }

    return files;
  }

  private async generateMarkdown(): Promise<string[]> {
    const files: string[] = [];

    for (const section of this.sections) {
      const filename = `${section.id}.md`;
      const filepath = path.join(this.config.outputDir, filename);
      const content = await this.markdownExporter.generateSectionMarkdown(section);

      await fs.writeFile(filepath, content);
      files.push(filepath);
    }

    return files;
  }

  private async generateHTML(): Promise<string[]> {
    // HTML generation would involve converting markdown to HTML
    // and applying templates/styling
    return [];
  }

  private async generatePDF(): Promise<string[]> {
    // PDF generation would use libraries like puppeteer or similar
    return [];
  }

  private async generateJSON(): Promise<string[]> {
    const filename = 'documentation.json';
    const filepath = path.join(this.config.outputDir, filename);
    const content = JSON.stringify({
      metadata: this.config.metadata,
      sections: this.sections,
      generated: new Date().toISOString()
    }, null, 2);

    await fs.writeFile(filepath, content);
    return [filepath];
  }

  private async generateIndex(): Promise<void> {
    const indexContent = this.markdownExporter.generateIndex(this.sections, this.config.metadata);
    const indexPath = path.join(this.config.outputDir, 'README.md');
    await fs.writeFile(indexPath, indexContent);
  }

  private async ensureOutputDirectory(): Promise<void> {
    await fs.mkdir(this.config.outputDir, { recursive: true });
  }

  private async calculateTotalFileSize(files: string[]): Promise<number> {
    let totalSize = 0;

    for (const file of files) {
      try {
        const stats = await fs.stat(file);
        totalSize += stats.size;
      } catch {
        // File might not exist yet
      }
    }

    return totalSize;
  }

  private getAllExamples(): CodeExample[] {
    const examples: CodeExample[] = [];
    this.sections.forEach(section => {
      if (section.examples) {
        examples.push(...section.examples);
      }
      section.subsections?.forEach(subsection => {
        if (subsection.examples) {
          examples.push(...subsection.examples);
        }
      });
    });
    return examples;
  }

  private getAllDiagrams(): Diagram[] {
    const diagrams: Diagram[] = [];
    this.sections.forEach(section => {
      if (section.diagrams) {
        diagrams.push(...section.diagrams);
      }
      section.subsections?.forEach(subsection => {
        if (subsection.diagrams) {
          diagrams.push(...subsection.diagrams);
        }
      });
    });
    return diagrams;
  }

  // Content generation helpers
  private generateModuleContent(module: any): string {
    return `Module: ${module.name}\n\n${module.description || 'No description available.'}`;
  }

  private generateFunctionContent(func: FunctionDoc): string {
    let content = `## ${func.name}\n\n${func.description}\n\n`;

    if (func.parameters.length > 0) {
      content += '### Parameters\n\n';
      func.parameters.forEach(param => {
        content += `- **${param.name}** (${param.type}): ${param.description}\n`;
      });
      content += '\n';
    }

    if (func.returnType !== 'void') {
      content += `### Returns\n\n${func.returnType}: ${func.returnDescription}\n\n`;
    }

    return content;
  }

  private generateClassContent(cls: ClassDoc): string {
    let content = `## ${cls.name}\n\n${cls.description}\n\n`;

    if (cls.extends) {
      content += `Extends: ${cls.extends}\n\n`;
    }

    if (cls.implements && cls.implements.length > 0) {
      content += `Implements: ${cls.implements.join(', ')}\n\n`;
    }

    return content;
  }

  private extractFunctionExamples(func: FunctionDoc): CodeExample[] {
    return func.examples.map((example, index) => ({
      id: `${func.name}-example-${index}`,
      title: `${func.name} Example ${index + 1}`,
      description: `Example usage of ${func.name}`,
      language: 'typescript',
      code: example,
      runnable: false,
      tags: ['function', func.name]
    }));
  }

  private extractClassExamples(cls: ClassDoc): CodeExample[] {
    return cls.examples.map((example, index) => ({
      id: `${cls.name}-example-${index}`,
      title: `${cls.name} Example ${index + 1}`,
      description: `Example usage of ${cls.name}`,
      language: 'typescript',
      code: example,
      runnable: false,
      tags: ['class', cls.name]
    }));
  }

  // Guide generation methods
  private async generateGettingStartedGuide(): string {
    return `# Getting Started

Welcome to ${this.config.metadata.title}! This guide will help you get up and running quickly.

## Quick Start

1. Install the package
2. Configure your environment
3. Run your first analysis

## Next Steps

- Read the [Configuration Guide](configuration.md)
- Explore [API Documentation](api.md)
- Check out [Examples](examples.md)
`;
  }

  private async generateInstallationGuide(): string {
    return `# Installation

## Prerequisites

- Node.js 18 or higher
- npm or yarn

## Install via npm

\`\`\`bash
npm install ${this.config.metadata.title?.toLowerCase()}
\`\`\`

## Install via yarn

\`\`\`bash
yarn add ${this.config.metadata.title?.toLowerCase()}
\`\`\`
`;
  }

  private async generateConfigurationGuide(): string {
    return `# Configuration

Configuration options and examples for ${this.config.metadata.title}.

## Basic Configuration

\`\`\`javascript
const config = {
  // Add your configuration here
};
\`\`\`
`;
  }

  private async generateAPIUsageGuide(): string {
    return `# API Usage

Learn how to use the ${this.config.metadata.title} API effectively.

## Basic Usage

\`\`\`typescript
import { SomeClass } from '${this.config.metadata.title?.toLowerCase()}';

const instance = new SomeClass();
\`\`\`
`;
  }

  private async generateExamplesGuide(): string {
    return `# Examples

Collection of examples demonstrating various features and use cases.
`;
  }

  private async generateTroubleshootingGuide(): string {
    return `# Troubleshooting

Common issues and their solutions.

## Common Issues

### Issue 1
Description and solution.

### Issue 2
Description and solution.
`;
  }

  private generateArchitectureDiagram(): string {
    return `graph TB
    A[User Interface] --> B[API Layer]
    B --> C[Core Engine]
    C --> D[Plugin System]
    C --> E[Data Layer]
    E --> F[Storage]`;
  }

  private generateDataFlowDiagram(): string {
    return `flowchart LR
    A[Input] --> B[Processing]
    B --> C[Analysis]
    C --> D[Output]`;
  }

  private generateClassDiagram(): string {
    return `classDiagram
    class BaseClass {
        +method1()
        +method2()
    }
    class DerivedClass {
        +method3()
    }
    BaseClass <|-- DerivedClass`;
  }
}