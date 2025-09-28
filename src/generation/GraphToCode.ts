import { Node, Edge } from '../core/graph-engine/types/NodeTypes';
import { ComponentInfo } from '../types';

export interface CodeGenerationOptions {
  language: 'typescript' | 'javascript' | 'python' | 'go';
  framework?: 'react' | 'vue' | 'angular' | 'svelte';
  testFramework?: 'jest' | 'vitest' | 'cypress' | 'playwright';
  includeTests: boolean;
  includeTypes: boolean;
  outputDirectory?: string;
  fileNamingConvention: 'camelCase' | 'kebab-case' | 'PascalCase' | 'snake_case';
}

export interface GeneratedCode {
  filename: string;
  content: string;
  language: string;
  type: 'component' | 'function' | 'type' | 'test' | 'config';
  dependencies: string[];
  exports: string[];
}

export interface GenerationContext {
  projectName: string;
  namespace?: string;
  baseDirectory: string;
  existingImports: Map<string, string[]>;
  typeDefinitions: Map<string, string>;
  componentHierarchy: Map<string, string[]>;
}

export interface ComponentGenerationMetadata {
  nodeId: string;
  componentName: string;
  componentType: 'functional' | 'class' | 'arrow';
  props: Array<{
    name: string;
    type: string;
    required: boolean;
    defaultValue?: string;
    description?: string;
  }>;
  hooks: Array<{
    name: string;
    type: 'useState' | 'useEffect' | 'useContext' | 'custom';
    dependencies?: string[];
    initialValue?: string;
  }>;
  children: string[];
  imports: string[];
  exports: string[];
  stateVariables: Array<{
    name: string;
    type: string;
    initialValue?: string;
  }>;
  methods: Array<{
    name: string;
    params: Array<{ name: string; type: string }>;
    returnType: string;
    isAsync: boolean;
  }>;
}

export class GraphToCodeGenerator {
  private context: GenerationContext;
  private options: CodeGenerationOptions;

  constructor(context: GenerationContext, options: CodeGenerationOptions) {
    this.context = context;
    this.options = options;
  }

  /**
   * Generate code from a graph structure
   */
  async generateFromGraph(
    nodes: Node[],
    edges: Edge[],
    targetNodes?: string[]
  ): Promise<GeneratedCode[]> {
    const generatedFiles: GeneratedCode[] = [];

    // Filter nodes to generate code for
    const nodesToProcess = targetNodes
      ? nodes.filter(node => targetNodes.includes(node.id))
      : nodes.filter(node => this.shouldGenerateCode(node));

    // Build component hierarchy from edges
    this.buildComponentHierarchy(nodes, edges);

    // Generate code for each node
    for (const node of nodesToProcess) {
      const metadata = this.extractComponentMetadata(node, edges);

      if (metadata) {
        const componentCode = await this.generateComponent(metadata);
        generatedFiles.push(componentCode);

        if (this.options.includeTypes) {
          const typeDefinitions = this.generateTypeDefinitions(metadata);
          if (typeDefinitions) {
            generatedFiles.push(typeDefinitions);
          }
        }

        if (this.options.includeTests) {
          const testCode = await this.generateTests(metadata);
          if (testCode) {
            generatedFiles.push(testCode);
          }
        }
      }
    }

    // Generate index files and barrel exports
    const indexFiles = this.generateIndexFiles(generatedFiles);
    generatedFiles.push(...indexFiles);

    return generatedFiles;
  }

  /**
   * Generate a single component from graph metadata
   */
  async generateComponent(metadata: ComponentGenerationMetadata): Promise<GeneratedCode> {
    const { componentName, componentType, props, hooks, stateVariables, methods } = metadata;

    let content = '';

    // Generate imports
    content += this.generateImports(metadata);
    content += '\n';

    // Generate interfaces/types
    if (props.length > 0) {
      content += this.generatePropsInterface(componentName, props);
      content += '\n';
    }

    // Generate the component
    switch (componentType) {
      case 'functional':
        content += this.generateFunctionalComponent(metadata);
        break;
      case 'class':
        content += this.generateClassComponent(metadata);
        break;
      case 'arrow':
        content += this.generateArrowFunctionComponent(metadata);
        break;
    }

    // Generate exports
    content += this.generateExports(metadata);

    const filename = this.generateFilename(componentName);

    return {
      filename,
      content,
      language: this.options.language,
      type: 'component',
      dependencies: metadata.imports,
      exports: metadata.exports
    };
  }

  /**
   * Extract component metadata from graph node
   */
  private extractComponentMetadata(
    node: Node,
    edges: Edge[]
  ): ComponentGenerationMetadata | null {
    const nodeData = node.data as ComponentInfo;

    if (!nodeData || node.type !== 'component') {
      return null;
    }

    // Get connected nodes
    const connectedEdges = edges.filter(edge =>
      edge.source === node.id || edge.target === node.id
    );

    const children = connectedEdges
      .filter(edge => edge.source === node.id && edge.type === 'contains')
      .map(edge => edge.target);

    // Extract props from node metadata
    const props = nodeData.props?.map(prop => ({
      name: prop.name,
      type: this.mapTypeToTargetLanguage(prop.type),
      required: !prop.optional,
      defaultValue: prop.defaultValue,
      description: prop.description
    })) || [];

    // Extract hooks information
    const hooks = nodeData.hooks?.map(hook => ({
      name: hook.name,
      type: hook.type as any,
      dependencies: hook.dependencies,
      initialValue: hook.initialValue
    })) || [];

    // Extract state variables
    const stateVariables = nodeData.state?.map(state => ({
      name: state.name,
      type: this.mapTypeToTargetLanguage(state.type),
      initialValue: state.initialValue
    })) || [];

    // Extract methods
    const methods = nodeData.methods?.map(method => ({
      name: method.name,
      params: method.parameters?.map(param => ({
        name: param.name,
        type: this.mapTypeToTargetLanguage(param.type)
      })) || [],
      returnType: this.mapTypeToTargetLanguage(method.returnType || 'void'),
      isAsync: method.isAsync || false
    })) || [];

    return {
      nodeId: node.id,
      componentName: nodeData.name,
      componentType: nodeData.type || 'functional',
      props,
      hooks,
      children,
      imports: this.extractImports(nodeData),
      exports: [nodeData.name],
      stateVariables,
      methods
    };
  }

  /**
   * Generate functional component code
   */
  private generateFunctionalComponent(metadata: ComponentGenerationMetadata): string {
    const { componentName, props, hooks, stateVariables, methods } = metadata;

    let content = '';

    // Generate component signature
    const propsType = props.length > 0 ? `${componentName}Props` : '';
    const propsParam = propsType ? `props: ${propsType}` : '';

    content += `export const ${componentName}: React.FC${propsType ? `<${propsType}>` : ''} = (${propsParam}) => {\n`;

    // Generate destructured props
    if (props.length > 0) {
      const propNames = props.map(prop => prop.name).join(', ');
      content += `  const { ${propNames} } = props;\n\n`;
    }

    // Generate state hooks
    for (const state of stateVariables) {
      const initialValue = state.initialValue || this.getDefaultValue(state.type);
      content += `  const [${state.name}, set${this.capitalize(state.name)}] = useState<${state.type}>(${initialValue});\n`;
    }

    if (stateVariables.length > 0) content += '\n';

    // Generate effect hooks
    const effectHooks = hooks.filter(hook => hook.type === 'useEffect');
    for (const hook of effectHooks) {
      const deps = hook.dependencies ? `[${hook.dependencies.join(', ')}]` : '[]';
      content += `  useEffect(() => {\n`;
      content += `    // TODO: Implement effect logic\n`;
      content += `  }, ${deps});\n\n`;
    }

    // Generate methods
    for (const method of methods) {
      const params = method.params.map(p => `${p.name}: ${p.type}`).join(', ');
      const asyncKeyword = method.isAsync ? 'async ' : '';
      content += `  const ${method.name} = ${asyncKeyword}(${params}): ${method.returnType} => {\n`;
      content += `    // TODO: Implement ${method.name}\n`;
      content += `  };\n\n`;
    }

    // Generate JSX return
    content += `  return (\n`;
    content += `    <div className="${this.toKebabCase(componentName)}">\n`;
    content += `      {/* TODO: Implement component UI */}\n`;
    content += `      <h1>${componentName}</h1>\n`;

    // Add placeholders for child components
    for (const child of metadata.children) {
      content += `      {/* <${child} /> */}\n`;
    }

    content += `    </div>\n`;
    content += `  );\n`;
    content += `};\n\n`;

    return content;
  }

  /**
   * Generate class component code
   */
  private generateClassComponent(metadata: ComponentGenerationMetadata): string {
    const { componentName, props, stateVariables, methods } = metadata;

    let content = '';

    // Generate interface for state
    if (stateVariables.length > 0) {
      content += `interface ${componentName}State {\n`;
      for (const state of stateVariables) {
        content += `  ${state.name}: ${state.type};\n`;
      }
      content += `}\n\n`;
    }

    // Generate class signature
    const propsType = props.length > 0 ? `${componentName}Props` : '{}';
    const stateType = stateVariables.length > 0 ? `${componentName}State` : '{}';

    content += `export class ${componentName} extends React.Component<${propsType}, ${stateType}> {\n`;

    // Generate constructor and initial state
    if (stateVariables.length > 0) {
      content += `  constructor(props: ${propsType}) {\n`;
      content += `    super(props);\n`;
      content += `    this.state = {\n`;
      for (const state of stateVariables) {
        const initialValue = state.initialValue || this.getDefaultValue(state.type);
        content += `      ${state.name}: ${initialValue},\n`;
      }
      content += `    };\n`;
      content += `  }\n\n`;
    }

    // Generate lifecycle methods
    content += `  componentDidMount() {\n`;
    content += `    // TODO: Implement componentDidMount\n`;
    content += `  }\n\n`;

    // Generate custom methods
    for (const method of methods) {
      const params = method.params.map(p => `${p.name}: ${p.type}`).join(', ');
      const asyncKeyword = method.isAsync ? 'async ' : '';
      content += `  ${asyncKeyword}${method.name}(${params}): ${method.returnType} {\n`;
      content += `    // TODO: Implement ${method.name}\n`;
      content += `  }\n\n`;
    }

    // Generate render method
    content += `  render() {\n`;
    content += `    return (\n`;
    content += `      <div className="${this.toKebabCase(componentName)}">\n`;
    content += `        {/* TODO: Implement component UI */}\n`;
    content += `        <h1>${componentName}</h1>\n`;

    // Add placeholders for child components
    for (const child of metadata.children) {
      content += `        {/* <${child} /> */}\n`;
    }

    content += `      </div>\n`;
    content += `    );\n`;
    content += `  }\n`;
    content += `}\n\n`;

    return content;
  }

  /**
   * Generate arrow function component code
   */
  private generateArrowFunctionComponent(metadata: ComponentGenerationMetadata): string {
    const { componentName, props, hooks, stateVariables } = metadata;

    let content = '';

    const propsType = props.length > 0 ? `${componentName}Props` : '';
    const propsParam = propsType ? `{ ${props.map(p => p.name).join(', ')} }: ${propsType}` : '';

    content += `export const ${componentName} = (${propsParam}) => {\n`;

    // Generate state hooks
    for (const state of stateVariables) {
      const initialValue = state.initialValue || this.getDefaultValue(state.type);
      content += `  const [${state.name}, set${this.capitalize(state.name)}] = useState(${initialValue});\n`;
    }

    if (stateVariables.length > 0) content += '\n';

    content += `  return (\n`;
    content += `    <div className="${this.toKebabCase(componentName)}">\n`;
    content += `      {/* TODO: Implement component UI */}\n`;
    content += `      <h1>${componentName}</h1>\n`;
    content += `    </div>\n`;
    content += `  );\n`;
    content += `};\n\n`;

    return content;
  }

  /**
   * Generate imports for the component
   */
  private generateImports(metadata: ComponentGenerationMetadata): string {
    let imports = '';

    // React import
    if (this.options.framework === 'react') {
      const reactImports = ['React'];

      if (metadata.hooks.some(h => h.type === 'useState')) {
        reactImports.push('useState');
      }
      if (metadata.hooks.some(h => h.type === 'useEffect')) {
        reactImports.push('useEffect');
      }
      if (metadata.hooks.some(h => h.type === 'useContext')) {
        reactImports.push('useContext');
      }

      imports += `import ${reactImports.join(', ')} from 'react';\n`;
    }

    // Custom imports from metadata
    for (const importPath of metadata.imports) {
      if (!importPath.startsWith('react')) {
        imports += `import { /* TODO: Add imports */ } from '${importPath}';\n`;
      }
    }

    return imports;
  }

  /**
   * Generate props interface
   */
  private generatePropsInterface(componentName: string, props: ComponentGenerationMetadata['props']): string {
    let content = `export interface ${componentName}Props {\n`;

    for (const prop of props) {
      const optional = prop.required ? '' : '?';
      const description = prop.description ? `  /** ${prop.description} */\n` : '';
      content += description;
      content += `  ${prop.name}${optional}: ${prop.type};\n`;
    }

    content += `}\n`;
    return content;
  }

  /**
   * Generate type definitions for the component
   */
  private generateTypeDefinitions(metadata: ComponentGenerationMetadata): GeneratedCode | null {
    if (this.options.language !== 'typescript') {
      return null;
    }

    let content = '';

    // Generate custom types extracted from the component
    if (metadata.stateVariables.length > 0) {
      content += `// Type definitions for ${metadata.componentName}\n\n`;

      // Generate state type
      content += `export interface ${metadata.componentName}State {\n`;
      for (const state of metadata.stateVariables) {
        content += `  ${state.name}: ${state.type};\n`;
      }
      content += `}\n\n`;
    }

    if (!content) return null;

    const filename = this.generateFilename(metadata.componentName, 'types');

    return {
      filename,
      content,
      language: 'typescript',
      type: 'type',
      dependencies: [],
      exports: [`${metadata.componentName}State`]
    };
  }

  /**
   * Generate test code for the component
   */
  private async generateTests(metadata: ComponentGenerationMetadata): Promise<GeneratedCode | null> {
    if (!this.options.includeTests) {
      return null;
    }

    const { componentName } = metadata;
    let content = '';

    // Import statements
    content += `import { render, screen } from '@testing-library/react';\n`;
    content += `import { ${componentName} } from './${this.generateFilename(componentName, 'component').replace('.tsx', '')}';\n\n`;

    // Test suite
    content += `describe('${componentName}', () => {\n`;
    content += `  it('renders without crashing', () => {\n`;

    // Generate props for test
    const testProps = metadata.props.map(prop => {
      const value = this.generateTestValue(prop.type);
      return `${prop.name}: ${value}`;
    }).join(', ');

    content += `    render(<${componentName}${testProps ? ` ${testProps}` : ''} />);\n`;
    content += `    expect(screen.getByText('${componentName}')).toBeInTheDocument();\n`;
    content += `  });\n\n`;

    // Generate tests for each method
    for (const method of metadata.methods) {
      content += `  it('handles ${method.name} correctly', () => {\n`;
      content += `    // TODO: Implement test for ${method.name}\n`;
      content += `  });\n\n`;
    }

    content += `});\n`;

    const filename = this.generateFilename(componentName, 'test');

    return {
      filename,
      content,
      language: 'typescript',
      type: 'test',
      dependencies: ['@testing-library/react'],
      exports: []
    };
  }

  /**
   * Helper methods
   */
  private shouldGenerateCode(node: Node): boolean {
    return node.type === 'component' || node.type === 'function' || node.type === 'class';
  }

  private buildComponentHierarchy(nodes: Node[], edges: Edge[]): void {
    this.context.componentHierarchy.clear();

    for (const edge of edges) {
      if (edge.type === 'contains' || edge.type === 'imports') {
        if (!this.context.componentHierarchy.has(edge.source)) {
          this.context.componentHierarchy.set(edge.source, []);
        }
        this.context.componentHierarchy.get(edge.source)!.push(edge.target);
      }
    }
  }

  private extractImports(nodeData: ComponentInfo): string[] {
    const imports: string[] = [];

    // Extract from dependencies
    if (nodeData.dependencies) {
      imports.push(...nodeData.dependencies);
    }

    // Extract from imports metadata
    if (nodeData.imports) {
      imports.push(...nodeData.imports.map(imp => imp.source));
    }

    return [...new Set(imports)]; // Remove duplicates
  }

  private mapTypeToTargetLanguage(type: string): string {
    if (this.options.language === 'typescript') {
      return type;
    }

    // Map TypeScript types to other languages
    const typeMap: Record<string, Record<string, string>> = {
      javascript: {
        'string': 'string',
        'number': 'number',
        'boolean': 'boolean',
        'Array<any>': 'Array',
        'object': 'Object'
      },
      python: {
        'string': 'str',
        'number': 'float',
        'boolean': 'bool',
        'Array<any>': 'List',
        'object': 'Dict'
      }
    };

    return typeMap[this.options.language]?.[type] || type;
  }

  private generateFilename(name: string, type: 'component' | 'types' | 'test' = 'component'): string {
    let filename = '';

    switch (this.options.fileNamingConvention) {
      case 'camelCase':
        filename = this.toCamelCase(name);
        break;
      case 'PascalCase':
        filename = this.toPascalCase(name);
        break;
      case 'kebab-case':
        filename = this.toKebabCase(name);
        break;
      case 'snake_case':
        filename = this.toSnakeCase(name);
        break;
    }

    switch (type) {
      case 'component':
        return `${filename}.tsx`;
      case 'types':
        return `${filename}.types.ts`;
      case 'test':
        return `${filename}.test.tsx`;
    }
  }

  private generateExports(metadata: ComponentGenerationMetadata): string {
    return `export default ${metadata.componentName};\n`;
  }

  private generateIndexFiles(generatedFiles: GeneratedCode[]): GeneratedCode[] {
    const componentFiles = generatedFiles.filter(file => file.type === 'component');

    let content = '// Auto-generated index file\n\n';

    for (const file of componentFiles) {
      const componentName = file.exports[0];
      const importPath = `./${file.filename.replace('.tsx', '')}`;
      content += `export { default as ${componentName} } from '${importPath}';\n`;
    }

    return [{
      filename: 'index.ts',
      content,
      language: this.options.language,
      type: 'config',
      dependencies: [],
      exports: componentFiles.map(f => f.exports[0])
    }];
  }

  private getDefaultValue(type: string): string {
    const defaults: Record<string, string> = {
      'string': "''",
      'number': '0',
      'boolean': 'false',
      'Array<any>': '[]',
      'object': '{}',
      'null': 'null',
      'undefined': 'undefined'
    };

    return defaults[type] || 'undefined';
  }

  private generateTestValue(type: string): string {
    const testValues: Record<string, string> = {
      'string': "'test-value'",
      'number': '42',
      'boolean': 'true',
      'Array<any>': '[1, 2, 3]',
      'object': '{ key: "value" }'
    };

    return testValues[type] || "'test-value'";
  }

  // String utility methods
  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  private toCamelCase(str: string): string {
    return str.replace(/(?:^\w|[A-Z]|\b\w)/g, (letter, index) => {
      return index === 0 ? letter.toLowerCase() : letter.toUpperCase();
    }).replace(/\s+/g, '');
  }

  private toPascalCase(str: string): string {
    return str.replace(/(?:^\w|[A-Z]|\b\w)/g, letter => letter.toUpperCase()).replace(/\s+/g, '');
  }

  private toKebabCase(str: string): string {
    return str.replace(/([a-z0-9]|(?=[A-Z]))([A-Z])/g, '$1-$2').toLowerCase();
  }

  private toSnakeCase(str: string): string {
    return str.replace(/([a-z0-9]|(?=[A-Z]))([A-Z])/g, '$1_$2').toLowerCase();
  }
}

// Factory function for easy instantiation
export function createGraphToCodeGenerator(
  context: GenerationContext,
  options: Partial<CodeGenerationOptions> = {}
): GraphToCodeGenerator {
  const defaultOptions: CodeGenerationOptions = {
    language: 'typescript',
    framework: 'react',
    testFramework: 'jest',
    includeTests: true,
    includeTypes: true,
    fileNamingConvention: 'PascalCase'
  };

  return new GraphToCodeGenerator(context, { ...defaultOptions, ...options });
}