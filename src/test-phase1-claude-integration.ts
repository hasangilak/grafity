#!/usr/bin/env npx ts-node

/**
 * Phase 1 Test Harness: Claude Code CLI Integration
 *
 * This test suite validates the Claude Code CLI integration with:
 * 1. Basic CLI wrapper functionality
 * 2. Pipeline interface for large data
 * 3. AST analysis capabilities
 * 4. Graph analysis features
 * 5. Code generation from graphs
 */

import * as path from 'path';
import * as fs from 'fs';
import * as ts from 'typescript';
import { ClaudeCodeWrapper } from './integrations/claude-code/ClaudeCodeWrapper';
import { PipelineInterface } from './integrations/claude-code/PipelineInterface';
import { ASTAnalysis } from './integrations/claude-code/commands/ASTAnalysis';
import { GraphAnalysis } from './integrations/claude-code/commands/GraphAnalysis';
import { CodeGenerator } from './integrations/claude-code/CodeGenerator';

// Import types
import { ComponentInfo, FunctionInfo } from '../client/src/types';
import { ProjectGraph } from '../client/src/types';
import { BusinessGraph } from './core/reverse-engineering/BusinessGraphBuilder';

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m'
};

class Phase1TestRunner {
  private claude: ClaudeCodeWrapper;
  private pipeline: PipelineInterface;
  private astAnalysis: ASTAnalysis;
  private graphAnalysis: GraphAnalysis;
  private codeGen: CodeGenerator;
  private results: any[] = [];

  constructor() {
    this.claude = new ClaudeCodeWrapper({ timeout: 30000, outputFormat: 'json' });
    this.pipeline = new PipelineInterface(this.claude);
    this.astAnalysis = new ASTAnalysis(this.claude);
    this.graphAnalysis = new GraphAnalysis(this.claude);
    this.codeGen = new CodeGenerator(this.claude);
  }

  async runAllTests(): Promise<void> {
    console.log(`${colors.cyan}╔══════════════════════════════════════════════════════════════╗${colors.reset}`);
    console.log(`${colors.cyan}║         Phase 1: Claude Code CLI Integration Tests          ║${colors.reset}`);
    console.log(`${colors.cyan}╚══════════════════════════════════════════════════════════════╝${colors.reset}\n`);

    // Test 1: Claude CLI Availability
    await this.testClaudeAvailability();

    // Test 2: Basic Command Execution
    await this.testBasicExecution();

    // Test 3: JSON Response Parsing
    await this.testJsonParsing();

    // Test 4: Pipeline Interface
    await this.testPipeline();

    // Test 5: AST Analysis
    await this.testASTAnalysis();

    // Test 6: Graph Analysis
    await this.testGraphAnalysis();

    // Test 7: Code Generation
    await this.testCodeGeneration();

    // Print summary
    this.printSummary();
  }

  /**
   * Test 1: Check Claude CLI availability
   */
  private async testClaudeAvailability(): Promise<void> {
    console.log(`${colors.blue}Test 1: Claude CLI Availability${colors.reset}`);

    try {
      const available = await ClaudeCodeWrapper.testAvailability();

      if (available) {
        this.logSuccess('Claude CLI is installed and accessible');
        this.results.push({ test: 'CLI Availability', status: 'PASS' });
      } else {
        this.logError('Claude CLI not found');
        this.results.push({ test: 'CLI Availability', status: 'FAIL' });
      }
    } catch (error: any) {
      this.logError(`Error checking Claude CLI: ${error.message}`);
      this.results.push({ test: 'CLI Availability', status: 'ERROR', error: error.message });
    }
    console.log();
  }

  /**
   * Test 2: Basic command execution
   */
  private async testBasicExecution(): Promise<void> {
    console.log(`${colors.blue}Test 2: Basic Command Execution${colors.reset}`);

    try {
      const prompt = 'Say "Hello from Claude CLI integration test" and nothing else';
      const result = await this.claude.execute(prompt);

      if (result.toLowerCase().includes('hello')) {
        this.logSuccess(`Response received: "${result.substring(0, 50)}..."`);
        this.results.push({ test: 'Basic Execution', status: 'PASS' });
      } else {
        this.logError('Unexpected response');
        this.results.push({ test: 'Basic Execution', status: 'FAIL' });
      }
    } catch (error: any) {
      this.logError(`Execution failed: ${error.message}`);
      this.results.push({ test: 'Basic Execution', status: 'ERROR', error: error.message });
    }
    console.log();
  }

  /**
   * Test 3: JSON response parsing
   */
  private async testJsonParsing(): Promise<void> {
    console.log(`${colors.blue}Test 3: JSON Response Parsing${colors.reset}`);

    try {
      const prompt = 'Return a JSON object with keys: status (value: "ok"), timestamp (current time), test (value: true)';
      const response = await this.claude.executeJson<any>(prompt);

      if (response.success && response.data) {
        this.logSuccess('JSON response parsed successfully');
        this.logInfo(`Data: ${JSON.stringify(response.data).substring(0, 100)}`);
        this.results.push({ test: 'JSON Parsing', status: 'PASS' });
      } else {
        this.logError('Failed to parse JSON response');
        this.results.push({ test: 'JSON Parsing', status: 'FAIL' });
      }
    } catch (error: any) {
      this.logError(`JSON parsing failed: ${error.message}`);
      this.results.push({ test: 'JSON Parsing', status: 'ERROR', error: error.message });
    }
    console.log();
  }

  /**
   * Test 4: Pipeline interface with large data
   */
  private async testPipeline(): Promise<void> {
    console.log(`${colors.blue}Test 4: Pipeline Interface${colors.reset}`);

    try {
      // Create sample data
      const sampleData = {
        components: Array.from({ length: 10 }, (_, i) => ({
          name: `Component${i}`,
          type: 'functional',
          props: [`prop${i}A`, `prop${i}B`]
        }))
      };

      const prompt = 'Analyze this component data and return a summary count of components';
      const result = await this.pipeline.pipeData(
        JSON.stringify(sampleData),
        prompt
      );

      if (result) {
        this.logSuccess('Pipeline processed large data successfully');
        this.logInfo(`Result preview: ${result.substring(0, 100)}...`);
        this.results.push({ test: 'Pipeline Interface', status: 'PASS' });
      } else {
        this.logError('Pipeline returned empty result');
        this.results.push({ test: 'Pipeline Interface', status: 'FAIL' });
      }
    } catch (error: any) {
      this.logError(`Pipeline error: ${error.message}`);
      this.results.push({ test: 'Pipeline Interface', status: 'ERROR', error: error.message });
    }
    console.log();
  }

  /**
   * Test 5: AST Analysis
   */
  private async testASTAnalysis(): Promise<void> {
    console.log(`${colors.blue}Test 5: AST Analysis${colors.reset}`);

    try {
      // Load sample React component
      const sampleFile = path.join(__dirname, '../examples/sample-react-app/src/components/TodoList.tsx');

      if (fs.existsSync(sampleFile)) {
        const sourceCode = fs.readFileSync(sampleFile, 'utf8');
        const sourceFile = ts.createSourceFile(
          sampleFile,
          sourceCode,
          ts.ScriptTarget.Latest,
          true
        );

        const analysis = await this.astAnalysis.analyzeAST(sourceFile, sampleFile);

        if (analysis.insights.length > 0) {
          this.logSuccess(`Analyzed AST: ${analysis.insights.length} insights found`);
          this.logInfo(`Summary: ${analysis.summary.componentCount} components, ${analysis.summary.functionCount} functions`);
          this.results.push({ test: 'AST Analysis', status: 'PASS' });
        } else {
          this.logWarning('No insights generated from AST');
          this.results.push({ test: 'AST Analysis', status: 'PARTIAL' });
        }
      } else {
        this.logWarning('Sample file not found, skipping AST test');
        this.results.push({ test: 'AST Analysis', status: 'SKIP' });
      }
    } catch (error: any) {
      this.logError(`AST analysis failed: ${error.message}`);
      this.results.push({ test: 'AST Analysis', status: 'ERROR', error: error.message });
    }
    console.log();
  }

  /**
   * Test 6: Graph Analysis
   */
  private async testGraphAnalysis(): Promise<void> {
    console.log(`${colors.blue}Test 6: Graph Analysis${colors.reset}`);

    try {
      // Load existing business graph if available
      const graphFile = path.join(__dirname, '../dist/reverse-engineering-output/business-graph.json');

      if (fs.existsSync(graphFile)) {
        const graphData: BusinessGraph = JSON.parse(fs.readFileSync(graphFile, 'utf8'));

        const analysis = await this.graphAnalysis.analyzeBusinessGraph(graphData);

        if (analysis.patterns.length > 0 || analysis.insights.summary) {
          this.logSuccess(`Graph analyzed: ${analysis.patterns.length} patterns found`);
          this.logInfo(`Nodes: ${analysis.metrics.nodeCount}, Edges: ${analysis.metrics.edgeCount}`);
          this.results.push({ test: 'Graph Analysis', status: 'PASS' });
        } else {
          this.logWarning('Limited graph analysis results');
          this.results.push({ test: 'Graph Analysis', status: 'PARTIAL' });
        }
      } else {
        // Create simple test graph
        const testGraph: BusinessGraph = {
          nodes: [
            { id: '1', type: 'component', label: 'TodoList' },
            { id: '2', type: 'function', label: 'addTodo' },
            { id: '3', type: 'data', label: 'TodoModel' }
          ],
          edges: [
            { source: '1', target: '2', type: 'calls' },
            { source: '2', target: '3', type: 'uses' }
          ]
        } as any;

        const analysis = await this.graphAnalysis.analyzeBusinessGraph(testGraph);

        if (analysis) {
          this.logSuccess('Test graph analyzed successfully');
          this.results.push({ test: 'Graph Analysis', status: 'PASS' });
        } else {
          this.logError('Graph analysis returned no results');
          this.results.push({ test: 'Graph Analysis', status: 'FAIL' });
        }
      }
    } catch (error: any) {
      this.logError(`Graph analysis failed: ${error.message}`);
      this.results.push({ test: 'Graph Analysis', status: 'ERROR', error: error.message });
    }
    console.log();
  }

  /**
   * Test 7: Code Generation
   */
  private async testCodeGeneration(): Promise<void> {
    console.log(`${colors.blue}Test 7: Code Generation${colors.reset}`);

    try {
      const request = {
        type: 'component' as const,
        name: 'TestButton',
        description: 'A simple button component for testing',
        specifications: {
          props: [
            { name: 'label', type: 'string' },
            { name: 'onClick', type: '() => void' }
          ]
        }
      };

      const generated = await this.codeGen.generateComponent(request);

      if (generated.code) {
        this.logSuccess('Code generated successfully');
        this.logInfo(`Generated ${generated.code.split('\n').length} lines of code`);

        // Validate the generated code
        const isValid = await this.codeGen.validateCode(generated.code);
        if (isValid) {
          this.logSuccess('Generated code is syntactically valid');
          this.results.push({ test: 'Code Generation', status: 'PASS' });
        } else {
          this.logWarning('Generated code has syntax issues');
          this.results.push({ test: 'Code Generation', status: 'PARTIAL' });
        }
      } else {
        this.logError('No code generated');
        this.results.push({ test: 'Code Generation', status: 'FAIL' });
      }
    } catch (error: any) {
      this.logError(`Code generation failed: ${error.message}`);
      this.results.push({ test: 'Code Generation', status: 'ERROR', error: error.message });
    }
    console.log();
  }

  /**
   * Print test summary
   */
  private printSummary(): void {
    console.log(`${colors.cyan}╔══════════════════════════════════════════════════════════════╗${colors.reset}`);
    console.log(`${colors.cyan}║                         Test Summary                        ║${colors.reset}`);
    console.log(`${colors.cyan}╚══════════════════════════════════════════════════════════════╝${colors.reset}\n`);

    const passed = this.results.filter(r => r.status === 'PASS').length;
    const failed = this.results.filter(r => r.status === 'FAIL').length;
    const errors = this.results.filter(r => r.status === 'ERROR').length;
    const partial = this.results.filter(r => r.status === 'PARTIAL').length;
    const skipped = this.results.filter(r => r.status === 'SKIP').length;

    this.results.forEach(result => {
      const status = this.formatStatus(result.status);
      console.log(`  ${result.test}: ${status}`);
      if (result.error) {
        console.log(`    ${colors.gray}Error: ${result.error}${colors.reset}`);
      }
    });

    console.log(`\n${colors.cyan}Results:${colors.reset}`);
    console.log(`  ${colors.green}✓ Passed: ${passed}${colors.reset}`);
    console.log(`  ${colors.red}✗ Failed: ${failed}${colors.reset}`);
    console.log(`  ${colors.yellow}⚠ Partial: ${partial}${colors.reset}`);
    console.log(`  ${colors.gray}↷ Skipped: ${skipped}${colors.reset}`);
    console.log(`  ${colors.red}⚠ Errors: ${errors}${colors.reset}`);

    const successRate = (passed / this.results.length * 100).toFixed(1);
    console.log(`\n${colors.cyan}Success Rate: ${successRate}%${colors.reset}`);

    if (passed === this.results.length) {
      console.log(`\n${colors.green}🎉 All tests passed! Phase 1 integration is ready.${colors.reset}`);
    } else if (passed > this.results.length / 2) {
      console.log(`\n${colors.yellow}⚠ Most tests passed, but some issues need attention.${colors.reset}`);
    } else {
      console.log(`\n${colors.red}❌ Multiple tests failed. Please review the integration.${colors.reset}`);
    }
  }

  private formatStatus(status: string): string {
    switch (status) {
      case 'PASS':
        return `${colors.green}✓ PASS${colors.reset}`;
      case 'FAIL':
        return `${colors.red}✗ FAIL${colors.reset}`;
      case 'ERROR':
        return `${colors.red}⚠ ERROR${colors.reset}`;
      case 'PARTIAL':
        return `${colors.yellow}⚠ PARTIAL${colors.reset}`;
      case 'SKIP':
        return `${colors.gray}↷ SKIP${colors.reset}`;
      default:
        return status;
    }
  }

  private logSuccess(message: string): void {
    console.log(`  ${colors.green}✓${colors.reset} ${message}`);
  }

  private logError(message: string): void {
    console.log(`  ${colors.red}✗${colors.reset} ${message}`);
  }

  private logWarning(message: string): void {
    console.log(`  ${colors.yellow}⚠${colors.reset} ${message}`);
  }

  private logInfo(message: string): void {
    console.log(`  ${colors.gray}ℹ${colors.reset} ${message}`);
  }
}

// Run tests
async function main() {
  const runner = new Phase1TestRunner();

  try {
    await runner.runAllTests();
  } catch (error: any) {
    console.error(`${colors.red}Fatal error running tests: ${error.message}${colors.reset}`);
    process.exit(1);
  }
}

// Execute if run directly
if (require.main === module) {
  main().catch(console.error);
}

export { Phase1TestRunner };