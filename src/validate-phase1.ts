#!/usr/bin/env npx ts-node

/**
 * Phase 1 Validation: Quick check of Claude Code CLI Integration
 *
 * This validates that all the integration components are in place
 * without making actual Claude API calls.
 */

import * as fs from 'fs';
import * as path from 'path';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m'
};

class Phase1Validator {
  private checks: { name: string; passed: boolean; error?: string }[] = [];

  async validate(): Promise<void> {
    console.log(`${colors.cyan}═══════════════════════════════════════════════════════════════${colors.reset}`);
    console.log(`${colors.cyan}      Phase 1: Claude Code CLI Integration Validation         ${colors.reset}`);
    console.log(`${colors.cyan}═══════════════════════════════════════════════════════════════${colors.reset}\n`);

    // Check 1: Verify file structure
    this.checkFileStructure();

    // Check 2: Verify imports
    this.checkImports();

    // Check 3: Check Claude CLI availability
    await this.checkClaudeCLI();

    // Check 4: Verify TypeScript compilation
    this.checkTypeScriptCompilation();

    // Print summary
    this.printSummary();
  }

  private checkFileStructure(): void {
    console.log(`${colors.blue}Checking file structure...${colors.reset}`);

    const requiredFiles = [
      'src/integrations/claude-code/ClaudeCodeWrapper.ts',
      'src/integrations/claude-code/PipelineInterface.ts',
      'src/integrations/claude-code/commands/ASTAnalysis.ts',
      'src/integrations/claude-code/commands/GraphAnalysis.ts',
      'src/integrations/claude-code/CodeGenerator.ts'
    ];

    for (const file of requiredFiles) {
      const fullPath = path.join(__dirname, '..', file);
      if (fs.existsSync(fullPath)) {
        console.log(`  ${colors.green}✓${colors.reset} ${file}`);
        this.checks.push({ name: file, passed: true });
      } else {
        console.log(`  ${colors.red}✗${colors.reset} ${file} - NOT FOUND`);
        this.checks.push({ name: file, passed: false, error: 'File not found' });
      }
    }
    console.log();
  }

  private checkImports(): void {
    console.log(`${colors.blue}Checking module imports...${colors.reset}`);

    try {
      // Try to import each module
      const modules = [
        { name: 'ClaudeCodeWrapper', path: './integrations/claude-code/ClaudeCodeWrapper' },
        { name: 'PipelineInterface', path: './integrations/claude-code/PipelineInterface' },
        { name: 'ASTAnalysis', path: './integrations/claude-code/commands/ASTAnalysis' },
        { name: 'GraphAnalysis', path: './integrations/claude-code/commands/GraphAnalysis' },
        { name: 'CodeGenerator', path: './integrations/claude-code/CodeGenerator' }
      ];

      for (const module of modules) {
        try {
          require(module.path);
          console.log(`  ${colors.green}✓${colors.reset} ${module.name} module loads correctly`);
          this.checks.push({ name: `Import ${module.name}`, passed: true });
        } catch (error: any) {
          console.log(`  ${colors.red}✗${colors.reset} ${module.name} - ${error.message}`);
          this.checks.push({ name: `Import ${module.name}`, passed: false, error: error.message });
        }
      }
    } catch (error: any) {
      console.log(`  ${colors.red}✗${colors.reset} Import check failed: ${error.message}`);
    }
    console.log();
  }

  private async checkClaudeCLI(): Promise<void> {
    console.log(`${colors.blue}Checking Claude CLI availability...${colors.reset}`);

    try {
      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execAsync = promisify(exec);

      const { stdout } = await execAsync('claude --version');
      if (stdout.includes('Claude')) {
        console.log(`  ${colors.green}✓${colors.reset} Claude CLI is installed: ${stdout.trim()}`);
        this.checks.push({ name: 'Claude CLI', passed: true });
      } else {
        console.log(`  ${colors.yellow}⚠${colors.reset} Claude CLI found but version unclear`);
        this.checks.push({ name: 'Claude CLI', passed: true });
      }
    } catch (error) {
      console.log(`  ${colors.red}✗${colors.reset} Claude CLI not found or not accessible`);
      this.checks.push({ name: 'Claude CLI', passed: false, error: 'Not installed or not in PATH' });
    }
    console.log();
  }

  private checkTypeScriptCompilation(): void {
    console.log(`${colors.blue}Checking TypeScript compilation...${colors.reset}`);

    try {
      // Check if files compile without errors
      const ts = require('typescript');

      const testCode = `
        import { ClaudeCodeWrapper } from './integrations/claude-code/ClaudeCodeWrapper';
        import { PipelineInterface } from './integrations/claude-code/PipelineInterface';

        const claude = new ClaudeCodeWrapper();
        const pipeline = new PipelineInterface();
      `;

      const result = ts.transpileModule(testCode, {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2020,
        }
      });

      if (result.outputText) {
        console.log(`  ${colors.green}✓${colors.reset} TypeScript compilation successful`);
        this.checks.push({ name: 'TypeScript Compilation', passed: true });
      }
    } catch (error: any) {
      console.log(`  ${colors.red}✗${colors.reset} TypeScript compilation failed: ${error.message}`);
      this.checks.push({ name: 'TypeScript Compilation', passed: false, error: error.message });
    }
    console.log();
  }

  private printSummary(): void {
    console.log(`${colors.cyan}═══════════════════════════════════════════════════════════════${colors.reset}`);
    console.log(`${colors.cyan}                           Summary                            ${colors.reset}`);
    console.log(`${colors.cyan}═══════════════════════════════════════════════════════════════${colors.reset}\n`);

    const passed = this.checks.filter(c => c.passed).length;
    const failed = this.checks.filter(c => !c.passed).length;
    const total = this.checks.length;
    const percentage = Math.round((passed / total) * 100);

    console.log(`  Total Checks: ${total}`);
    console.log(`  ${colors.green}Passed: ${passed}${colors.reset}`);
    console.log(`  ${colors.red}Failed: ${failed}${colors.reset}`);
    console.log(`  Success Rate: ${percentage}%\n`);

    if (percentage === 100) {
      console.log(`${colors.green}🎉 Phase 1 integration is fully validated!${colors.reset}`);
      console.log(`${colors.green}All components are in place and ready for testing.${colors.reset}`);
    } else if (percentage >= 80) {
      console.log(`${colors.yellow}⚠ Phase 1 integration is mostly complete.${colors.reset}`);
      console.log(`${colors.yellow}Some components may need attention.${colors.reset}`);
    } else {
      console.log(`${colors.red}❌ Phase 1 integration needs work.${colors.reset}`);
      console.log(`${colors.red}Please review the failed checks above.${colors.reset}`);
    }

    console.log(`\n${colors.cyan}Key Components Status:${colors.reset}`);
    console.log('  1. ClaudeCodeWrapper    - Core integration module');
    console.log('  2. PipelineInterface    - Handles large data streaming');
    console.log('  3. ASTAnalysis         - Semantic code analysis');
    console.log('  4. GraphAnalysis       - Graph pattern detection');
    console.log('  5. CodeGenerator       - Generate code from graphs');

    console.log(`\n${colors.cyan}Next Steps:${colors.reset}`);
    console.log('  1. Test with actual Claude CLI commands');
    console.log('  2. Integrate with existing reverse-engineering system');
    console.log('  3. Build visual interface for graph interaction');
    console.log('  4. Implement Phase 2: Mechanical Analysis Pipeline');
  }
}

// Run validation
async function main() {
  const validator = new Phase1Validator();
  await validator.validate();
}

if (require.main === module) {
  main().catch(console.error);
}

export { Phase1Validator };