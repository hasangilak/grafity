import * as Handlebars from 'handlebars';
import { ComponentGenerationMetadata } from './GraphToCode';

export interface TemplateRegistry {
  [key: string]: Template;
}

export interface Template {
  id: string;
  name: string;
  language: 'typescript' | 'javascript' | 'python' | 'go' | 'java' | 'csharp';
  framework?: string;
  category: 'component' | 'function' | 'class' | 'test' | 'config' | 'utility';
  description: string;
  template: string;
  helpers?: Record<string, Handlebars.HelperDelegate>;
  partials?: Record<string, string>;
  variables: TemplateVariable[];
  defaultData?: Record<string, any>;
  validation?: TemplateValidation;
}

export interface TemplateVariable {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  required: boolean;
  description: string;
  defaultValue?: any;
  validation?: {
    pattern?: string;
    min?: number;
    max?: number;
    options?: string[];
  };
}

export interface TemplateValidation {
  schema?: any; // JSON Schema
  customValidator?: (data: any) => ValidationResult;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface RenderContext {
  data: Record<string, any>;
  metadata?: ComponentGenerationMetadata;
  options?: RenderOptions;
}

export interface RenderOptions {
  minify?: boolean;
  formatCode?: boolean;
  includeComments?: boolean;
  customHelpers?: Record<string, Handlebars.HelperDelegate>;
  customPartials?: Record<string, string>;
}

export interface RenderResult {
  content: string;
  filename?: string;
  warnings: string[];
  metadata: {
    templateId: string;
    renderTime: number;
    variables: Record<string, any>;
  };
}

export class TemplateEngine {
  private templates: TemplateRegistry = {};
  private handlebars: typeof Handlebars;
  private globalHelpers: Record<string, Handlebars.HelperDelegate> = {};
  private globalPartials: Record<string, string> = {};

  constructor() {
    this.handlebars = Handlebars.create();
    this.registerBuiltinHelpers();
    this.loadDefaultTemplates();
  }

  /**
   * Register a new template
   */
  registerTemplate(template: Template): void {
    // Validate template
    const validation = this.validateTemplate(template);
    if (!validation.isValid) {
      throw new Error(`Invalid template: ${validation.errors.map(e => e.message).join(', ')}`);
    }

    // Compile template
    try {
      this.handlebars.compile(template.template);
    } catch (error) {
      throw new Error(`Template compilation failed: ${error.message}`);
    }

    this.templates[template.id] = template;

    // Register template-specific helpers and partials
    if (template.helpers) {
      Object.entries(template.helpers).forEach(([name, helper]) => {
        this.handlebars.registerHelper(name, helper);
      });
    }

    if (template.partials) {
      Object.entries(template.partials).forEach(([name, partial]) => {
        this.handlebars.registerPartial(name, partial);
      });
    }
  }

  /**
   * Render a template with given data
   */
  async render(templateId: string, context: RenderContext): Promise<RenderResult> {
    const startTime = Date.now();

    const template = this.templates[templateId];
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    // Validate input data
    const validation = this.validateData(template, context.data);
    if (!validation.isValid) {
      throw new Error(`Invalid template data: ${validation.errors.map(e => e.message).join(', ')}`);
    }

    // Merge data with defaults
    const mergedData = {
      ...template.defaultData,
      ...context.data
    };

    // Register custom helpers for this render
    if (context.options?.customHelpers) {
      Object.entries(context.options.customHelpers).forEach(([name, helper]) => {
        this.handlebars.registerHelper(name, helper);
      });
    }

    // Register custom partials for this render
    if (context.options?.customPartials) {
      Object.entries(context.options.customPartials).forEach(([name, partial]) => {
        this.handlebars.registerPartial(name, partial);
      });
    }

    // Add metadata to context
    const renderData = {
      ...mergedData,
      _metadata: context.metadata,
      _options: context.options
    };

    // Compile and render template
    const compiledTemplate = this.handlebars.compile(template.template);
    let content = compiledTemplate(renderData);

    // Post-processing
    const warnings: string[] = [];

    if (context.options?.formatCode) {
      content = this.formatCode(content, template.language);
    }

    if (context.options?.minify) {
      content = this.minifyCode(content, template.language);
    }

    if (!context.options?.includeComments) {
      content = this.removeComments(content, template.language);
    }

    const renderTime = Date.now() - startTime;

    return {
      content,
      warnings,
      metadata: {
        templateId,
        renderTime,
        variables: renderData
      }
    };
  }

  /**
   * Get available templates
   */
  getTemplates(filter?: {
    language?: string;
    framework?: string;
    category?: string;
  }): Template[] {
    let templates = Object.values(this.templates);

    if (filter) {
      if (filter.language) {
        templates = templates.filter(t => t.language === filter.language);
      }
      if (filter.framework) {
        templates = templates.filter(t => t.framework === filter.framework);
      }
      if (filter.category) {
        templates = templates.filter(t => t.category === filter.category);
      }
    }

    return templates;
  }

  /**
   * Get template by ID
   */
  getTemplate(templateId: string): Template | null {
    return this.templates[templateId] || null;
  }

  /**
   * Register global helper
   */
  registerHelper(name: string, helper: Handlebars.HelperDelegate): void {
    this.globalHelpers[name] = helper;
    this.handlebars.registerHelper(name, helper);
  }

  /**
   * Register global partial
   */
  registerPartial(name: string, partial: string): void {
    this.globalPartials[name] = partial;
    this.handlebars.registerPartial(name, partial);
  }

  /**
   * Load templates from directory
   */
  async loadTemplatesFromDirectory(directory: string): Promise<void> {
    // This would load templates from filesystem
    // Implementation depends on specific requirements
  }

  /**
   * Create template from component metadata
   */
  createTemplateFromMetadata(metadata: ComponentGenerationMetadata): Template {
    const templateId = `generated_${metadata.componentName.toLowerCase()}`;

    // Generate template based on component structure
    let template = '{{> header}}\n\n';

    // Imports section
    template += '{{#if imports}}\n';
    template += '{{#each imports}}\n';
    template += 'import {{this}};\n';
    template += '{{/each}}\n';
    template += '{{/if}}\n\n';

    // Props interface
    if (metadata.props.length > 0) {
      template += 'export interface {{componentName}}Props {\n';
      template += '{{#each props}}\n';
      template += '  {{name}}{{#unless required}}?{{/unless}}: {{type}};\n';
      template += '{{/each}}\n';
      template += '}\n\n';
    }

    // Component body
    template += 'export const {{componentName}}: React.FC';
    if (metadata.props.length > 0) {
      template += '<{{componentName}}Props>';
    }
    template += ' = (';
    if (metadata.props.length > 0) {
      template += 'props';
    }
    template += ') => {\n';

    // Destructure props
    if (metadata.props.length > 0) {
      template += '  const { {{#each props}}{{name}}{{#unless @last}}, {{/unless}}{{/each}} } = props;\n\n';
    }

    // State hooks
    template += '{{#each stateVariables}}\n';
    template += '  const [{{name}}, set{{capitalize name}}] = useState<{{type}}>({{defaultValue}});\n';
    template += '{{/each}}\n\n';

    // Methods
    template += '{{#each methods}}\n';
    template += '  const {{name}} = {{#if isAsync}}async {{/if}}(';
    template += '{{#each params}}{{name}}: {{type}}{{#unless @last}}, {{/unless}}{{/each}}';
    template += '): {{returnType}} => {\n';
    template += '    // TODO: Implement {{name}}\n';
    template += '  };\n\n';
    template += '{{/each}}';

    // JSX return
    template += '  return (\n';
    template += '    <div className="{{kebabCase componentName}}">\n';
    template += '      <h1>{{componentName}}</h1>\n';
    template += '      {{> children}}\n';
    template += '    </div>\n';
    template += '  );\n';
    template += '};\n\n';

    template += '{{> footer}}';

    return {
      id: templateId,
      name: `${metadata.componentName} Template`,
      language: 'typescript',
      framework: 'react',
      category: 'component',
      description: `Generated template for ${metadata.componentName} component`,
      template,
      variables: [
        {
          name: 'componentName',
          type: 'string',
          required: true,
          description: 'Name of the component'
        },
        {
          name: 'props',
          type: 'array',
          required: false,
          description: 'Component props'
        },
        {
          name: 'stateVariables',
          type: 'array',
          required: false,
          description: 'State variables'
        },
        {
          name: 'methods',
          type: 'array',
          required: false,
          description: 'Component methods'
        }
      ],
      partials: {
        header: '// Generated component\n',
        footer: 'export default {{componentName}};',
        children: '{{#each children}}\n      <{{this}} />{{/each}}'
      }
    };
  }

  /**
   * Private methods
   */
  private registerBuiltinHelpers(): void {
    // String manipulation helpers
    this.handlebars.registerHelper('capitalize', (str: string) => {
      return str.charAt(0).toUpperCase() + str.slice(1);
    });

    this.handlebars.registerHelper('camelCase', (str: string) => {
      return str.replace(/(?:^\w|[A-Z]|\b\w)/g, (letter, index) => {
        return index === 0 ? letter.toLowerCase() : letter.toUpperCase();
      }).replace(/\s+/g, '');
    });

    this.handlebars.registerHelper('kebabCase', (str: string) => {
      return str.replace(/([a-z0-9]|(?=[A-Z]))([A-Z])/g, '$1-$2').toLowerCase();
    });

    this.handlebars.registerHelper('snakeCase', (str: string) => {
      return str.replace(/([a-z0-9]|(?=[A-Z]))([A-Z])/g, '$1_$2').toLowerCase();
    });

    this.handlebars.registerHelper('pascalCase', (str: string) => {
      return str.replace(/(?:^\w|[A-Z]|\b\w)/g, letter => letter.toUpperCase()).replace(/\s+/g, '');
    });

    // Array helpers
    this.handlebars.registerHelper('join', (array: any[], separator: string = ', ') => {
      return array.join(separator);
    });

    this.handlebars.registerHelper('first', (array: any[]) => {
      return array[0];
    });

    this.handlebars.registerHelper('last', (array: any[]) => {
      return array[array.length - 1];
    });

    // Logic helpers
    this.handlebars.registerHelper('eq', (a: any, b: any) => {
      return a === b;
    });

    this.handlebars.registerHelper('neq', (a: any, b: any) => {
      return a !== b;
    });

    this.handlebars.registerHelper('gt', (a: number, b: number) => {
      return a > b;
    });

    this.handlebars.registerHelper('lt', (a: number, b: number) => {
      return a < b;
    });

    // Code generation helpers
    this.handlebars.registerHelper('indent', (text: string, spaces: number = 2) => {
      const indent = ' '.repeat(spaces);
      return text.split('\n').map(line => line ? indent + line : line).join('\n');
    });

    this.handlebars.registerHelper('comment', function(this: any, options: Handlebars.HelperOptions) {
      const language = this._metadata?.language || 'typescript';
      const content = options.fn(this);

      switch (language) {
        case 'typescript':
        case 'javascript':
          return `// ${content}`;
        case 'python':
          return `# ${content}`;
        case 'java':
        case 'csharp':
          return `/* ${content} */`;
        default:
          return content;
      }
    });

    // Date helpers
    this.handlebars.registerHelper('now', () => {
      return new Date().toISOString();
    });

    this.handlebars.registerHelper('formatDate', (date: Date, format: string) => {
      // Simple date formatting - could be enhanced with a proper date library
      return date.toLocaleDateString();
    });
  }

  private loadDefaultTemplates(): void {
    // React Function Component Template
    this.registerTemplate({
      id: 'react_functional_component',
      name: 'React Functional Component',
      language: 'typescript',
      framework: 'react',
      category: 'component',
      description: 'Standard React functional component with TypeScript',
      template: `import React{{#if hasState}}, { useState }{{/if}}{{#if hasEffect}}, { useEffect }{{/if}} from 'react';

{{#if props}}
export interface {{componentName}}Props {
{{#each props}}
  {{name}}{{#unless required}}?{{/unless}}: {{type}};{{#if description}} // {{description}}{{/if}}
{{/each}}
}
{{/if}}

export const {{componentName}}: React.FC{{#if props}}<{{componentName}}Props>{{/if}} = ({{#if props}}props{{/if}}) => {
{{#if props}}
  const { {{#each props}}{{name}}{{#unless @last}}, {{/unless}}{{/each}} } = props;
{{/if}}

{{#each stateVariables}}
  const [{{name}}, set{{capitalize name}}] = useState<{{type}}>({{#if initialValue}}{{initialValue}}{{else}}{{getDefaultValue type}}{{/if}});
{{/each}}

{{#each effects}}
  useEffect(() => {
    // TODO: Implement effect
  }, [{{#if dependencies}}{{join dependencies}}{{/if}}]);
{{/each}}

{{#each methods}}
  const {{name}} = {{#if isAsync}}async {{/if}}({{#each params}}{{name}}: {{type}}{{#unless @last}}, {{/unless}}{{/each}}): {{returnType}} => {
    // TODO: Implement {{name}}
  };
{{/each}}

  return (
    <div className="{{kebabCase componentName}}">
      <h1>{{componentName}}</h1>
      {{#each children}}
      <{{this}} />
      {{/each}}
    </div>
  );
};

export default {{componentName}};`,
      variables: [
        { name: 'componentName', type: 'string', required: true, description: 'Component name' },
        { name: 'props', type: 'array', required: false, description: 'Component props' },
        { name: 'stateVariables', type: 'array', required: false, description: 'State variables' },
        { name: 'methods', type: 'array', required: false, description: 'Component methods' },
        { name: 'children', type: 'array', required: false, description: 'Child components' }
      ],
      helpers: {
        getDefaultValue: (type: string) => {
          const defaults: Record<string, string> = {
            'string': "''",
            'number': '0',
            'boolean': 'false',
            'array': '[]',
            'object': '{}'
          };
          return defaults[type] || 'undefined';
        },
        hasState: function(this: any) {
          return this.stateVariables && this.stateVariables.length > 0;
        },
        hasEffect: function(this: any) {
          return this.effects && this.effects.length > 0;
        }
      }
    });

    // Jest Test Template
    this.registerTemplate({
      id: 'jest_test',
      name: 'Jest Test Suite',
      language: 'typescript',
      framework: 'jest',
      category: 'test',
      description: 'Jest test suite for React components',
      template: `import { render, screen } from '@testing-library/react';
import { {{componentName}} } from './{{fileName}}';

describe('{{componentName}}', () => {
  it('renders without crashing', () => {
    render(<{{componentName}}{{#if testProps}} {{testProps}}{{/if}} />);
    expect(screen.getByText('{{componentName}}')).toBeInTheDocument();
  });

{{#each testCases}}
  it('{{description}}', () => {
    // TODO: Implement test
  });
{{/each}}
});`,
      variables: [
        { name: 'componentName', type: 'string', required: true, description: 'Component name' },
        { name: 'fileName', type: 'string', required: true, description: 'Component file name' },
        { name: 'testProps', type: 'string', required: false, description: 'Test props' },
        { name: 'testCases', type: 'array', required: false, description: 'Test cases' }
      ]
    });
  }

  private validateTemplate(template: Template): ValidationResult {
    const errors: ValidationError[] = [];

    if (!template.id) {
      errors.push({ field: 'id', message: 'Template ID is required', code: 'MISSING_ID' });
    }

    if (!template.name) {
      errors.push({ field: 'name', message: 'Template name is required', code: 'MISSING_NAME' });
    }

    if (!template.template) {
      errors.push({ field: 'template', message: 'Template content is required', code: 'MISSING_TEMPLATE' });
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  private validateData(template: Template, data: Record<string, any>): ValidationResult {
    const errors: ValidationError[] = [];

    for (const variable of template.variables) {
      if (variable.required && !(variable.name in data)) {
        errors.push({
          field: variable.name,
          message: `Required variable '${variable.name}' is missing`,
          code: 'MISSING_REQUIRED'
        });
      }

      if (variable.name in data) {
        const value = data[variable.name];
        const expectedType = variable.type;

        if (!this.isValidType(value, expectedType)) {
          errors.push({
            field: variable.name,
            message: `Invalid type for '${variable.name}'. Expected ${expectedType}`,
            code: 'INVALID_TYPE'
          });
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  private isValidType(value: any, expectedType: string): boolean {
    switch (expectedType) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number';
      case 'boolean':
        return typeof value === 'boolean';
      case 'array':
        return Array.isArray(value);
      case 'object':
        return typeof value === 'object' && value !== null && !Array.isArray(value);
      default:
        return true;
    }
  }

  private formatCode(content: string, language: string): string {
    // Basic code formatting - could be enhanced with prettier or other formatters
    let formatted = content;

    // Remove extra whitespace
    formatted = formatted.replace(/\n\s*\n\s*\n/g, '\n\n');

    // Fix indentation
    const lines = formatted.split('\n');
    let indentLevel = 0;
    const indentSize = 2;

    const formattedLines = lines.map(line => {
      const trimmed = line.trim();

      if (trimmed.includes('}') && !trimmed.includes('{')) {
        indentLevel = Math.max(0, indentLevel - 1);
      }

      const indentedLine = ' '.repeat(indentLevel * indentSize) + trimmed;

      if (trimmed.includes('{') && !trimmed.includes('}')) {
        indentLevel++;
      }

      return indentedLine;
    });

    return formattedLines.join('\n');
  }

  private minifyCode(content: string, language: string): string {
    // Basic minification
    return content
      .replace(/\s+/g, ' ')
      .replace(/;\s+/g, ';')
      .replace(/{\s+/g, '{')
      .replace(/\s+}/g, '}')
      .trim();
  }

  private removeComments(content: string, language: string): string {
    switch (language) {
      case 'typescript':
      case 'javascript':
        // Remove single-line comments
        content = content.replace(/\/\/.*$/gm, '');
        // Remove multi-line comments
        content = content.replace(/\/\*[\s\S]*?\*\//g, '');
        break;
      case 'python':
        // Remove Python comments
        content = content.replace(/#.*$/gm, '');
        break;
    }

    return content;
  }
}

// Factory function
export function createTemplateEngine(): TemplateEngine {
  return new TemplateEngine();
}