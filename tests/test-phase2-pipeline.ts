#!/usr/bin/env npx ts-node

import { MechanicalPipeline } from '../src/core/pipeline/MechanicalPipeline';
import * as chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Test the complete Phase 2 Mechanical Analysis Pipeline
 */
async function testPipeline() {
  console.log(chalk.cyan.bold('\n🔧 Testing Phase 2: Mechanical Analysis Pipeline\n'));

  const pipeline = new MechanicalPipeline({
    useCache: true,
    parallel: true,
    includeNodeModules: false,
    progressCallback: (progress) => {
      console.log(chalk.gray(`  ▶ ${progress.message}`));
    }
  });

  // Listen for events
  pipeline.on('error', (error) => {
    console.error(chalk.red('Pipeline Error:'), error);
  });

  pipeline.on('cache-hit', (key) => {
    console.log(chalk.yellow(`  ⚡ Cache hit: ${key}`));
  });

  try {
    console.log(chalk.blue('Starting mechanical analysis...'));
    const startTime = Date.now();

    const result = await pipeline.analyze();

    const duration = Date.now() - startTime;
    console.log(chalk.green(`\n✅ Analysis completed in ${duration}ms\n`));

    // Display results
    console.log(chalk.cyan.bold('📊 Analysis Results:'));
    console.log(chalk.white('─'.repeat(50)));

    // Project Graph
    console.log(chalk.magenta('\n📦 Project Graph:'));
    console.log(`  • Projects: ${result.projectGraph.nodes.filter(n => n.type === 'project').length}`);
    console.log(`  • Dependencies: ${result.projectGraph.edges.length}`);
    console.log(`  • Clusters: ${result.projectGraph.clusters?.length || 0}`);

    // Components
    console.log(chalk.magenta('\n⚛️  React Components:'));
    console.log(`  • Total: ${result.components.length}`);
    console.log(`  • Functional: ${result.components.filter(c => c.type === 'functional' || c.type === 'arrow').length}`);
    console.log(`  • Class: ${result.components.filter(c => c.type === 'class').length}`);
    console.log(`  • With Hooks: ${result.components.filter(c => c.hooks.length > 0).length}`);

    if (result.components.length > 0) {
      console.log(chalk.gray('\n  Components found:'));
      result.components.slice(0, 10).forEach(comp => {
        const hooks = comp.hooks.length > 0 ? ` (${comp.hooks.length} hooks)` : '';
        const exported = comp.isExported ? ' ✓' : '';
        console.log(chalk.gray(`    - ${comp.name}${hooks}${exported}`));
      });
      if (result.components.length > 10) {
        console.log(chalk.gray(`    ... and ${result.components.length - 10} more`));
      }
    }

    // Functions
    console.log(chalk.magenta('\n🔧 Functions:'));
    console.log(`  • Total: ${result.functions.length}`);
    console.log(`  • Async: ${result.functions.filter(f => f.isAsync).length}`);
    console.log(`  • Exported: ${result.functions.filter(f => f.isExported).length}`);
    console.log(`  • Average Complexity: ${
      result.functions.length > 0
        ? (result.functions.reduce((sum, f) => sum + f.complexity, 0) / result.functions.length).toFixed(2)
        : 0
    }`);

    // Imports/Exports
    console.log(chalk.magenta('\n📤 Imports & Exports:'));
    console.log(`  • Imports: ${result.imports.length}`);
    console.log(`  • Exports: ${result.exports.length}`);
    console.log(`  • Dynamic Imports: ${result.imports.filter(i => i.isDynamic).length}`);
    console.log(`  • Type-only Imports: ${result.imports.filter(i => i.isTypeOnly).length}`);

    // Types
    console.log(chalk.magenta('\n📝 Types:'));
    console.log(`  • Interfaces: ${result.types.filter(t => t.kind === 'interface').length}`);
    console.log(`  • Type Aliases: ${result.types.filter(t => t.kind === 'type').length}`);
    console.log(`  • Classes: ${result.types.filter(t => t.kind === 'class').length}`);
    console.log(`  • Enums: ${result.types.filter(t => t.kind === 'enum').length}`);

    // Data Flow
    console.log(chalk.magenta('\n🌊 Data Flow:'));
    const totalNodes = result.dataFlow.reduce((sum, graph) => sum + graph.nodes.length, 0);
    const totalEdges = result.dataFlow.reduce((sum, graph) => sum + graph.edges.length, 0);
    console.log(`  • Graphs: ${result.dataFlow.length}`);
    console.log(`  • Total Nodes: ${totalNodes}`);
    console.log(`  • Total Edges: ${totalEdges}`);

    // Patterns
    console.log(chalk.magenta('\n🎯 Pattern Detection:'));
    console.log(`  • Score: ${result.patterns.score}/100`);
    console.log(`  • Good Patterns: ${chalk.green(result.patterns.summary.good)}`);
    console.log(`  • Bad Patterns: ${chalk.red(result.patterns.summary.bad)}`);
    console.log(`  • Neutral: ${result.patterns.summary.neutral}`);

    if (result.patterns.patterns.length > 0) {
      console.log(chalk.gray('\n  Patterns detected:'));
      result.patterns.patterns.slice(0, 5).forEach(pattern => {
        const icon = pattern.type === 'good' ? '✅' :
                    pattern.type === 'bad' ? '❌' : '➖';
        console.log(chalk.gray(`    ${icon} ${pattern.name} (${Math.round(pattern.confidence * 100)}%)`));
        if (pattern.suggestion) {
          console.log(chalk.gray(`       → ${pattern.suggestion}`));
        }
      });
      if (result.patterns.patterns.length > 5) {
        console.log(chalk.gray(`    ... and ${result.patterns.patterns.length - 5} more`));
      }
    }

    // Metrics
    console.log(chalk.magenta('\n📈 Performance Metrics:'));
    console.log(`  • Files Analyzed: ${result.metrics.totalFiles}`);
    console.log(`  • Analysis Time: ${result.metrics.analysisTime}ms`);
    console.log(`  • Files/Second: ${(result.metrics.totalFiles / (result.metrics.analysisTime / 1000)).toFixed(2)}`);

    // Save results to file
    const outputPath = path.join(process.cwd(), 'phase2-analysis-results.json');
    fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
    console.log(chalk.green(`\n💾 Results saved to: ${outputPath}`));

    // Test specific sample app components if available
    console.log(chalk.cyan.bold('\n🧪 Validating Sample App Analysis:'));
    console.log(chalk.white('─'.repeat(50)));

    const expectedComponents = [
      'App', 'Dashboard', 'Header', 'UserProfile', 'UserAvatar',
      'TodoList', 'TodoItem', 'CreateTodoForm', 'TodoSummary',
      'RecentActivity', 'UserProvider'
    ];

    const foundComponents = result.components.map(c => c.name);
    let validationScore = 0;

    expectedComponents.forEach(expected => {
      const found = foundComponents.some(name => name.includes(expected));
      if (found) {
        console.log(chalk.green(`  ✅ Found: ${expected}`));
        validationScore++;
      } else {
        console.log(chalk.yellow(`  ⚠️  Missing: ${expected}`));
      }
    });

    const validationPercentage = (validationScore / expectedComponents.length) * 100;
    console.log(chalk.bold(`\n  Validation Score: ${validationScore}/${expectedComponents.length} (${validationPercentage.toFixed(0)}%)`));

    if (validationPercentage >= 80) {
      console.log(chalk.green.bold('\n🎉 Phase 2 Pipeline Test PASSED!'));
    } else if (validationPercentage >= 60) {
      console.log(chalk.yellow.bold('\n⚠️  Phase 2 Pipeline Test PARTIALLY PASSED'));
    } else {
      console.log(chalk.red.bold('\n❌ Phase 2 Pipeline Test FAILED'));
    }

  } catch (error: any) {
    console.error(chalk.red.bold('\n❌ Pipeline test failed:'));
    console.error(chalk.red(error.message));
    console.error(error.stack);
    process.exit(1);
  }
}

// Run test
testPipeline().catch(console.error);