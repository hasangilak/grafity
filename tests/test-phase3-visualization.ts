#!/usr/bin/env npx ts-node

import { GraphVisualizationPipeline } from '../src/core/pipeline/GraphVisualizationPipeline';
import * as chalk from 'chalk';
import * as path from 'path';

/**
 * Test the Phase 3 Graph Engine with Visualization
 */
async function testGraphVisualization() {
  console.log(chalk.cyan.bold('\n🎨 Testing Phase 3: Graph Engine with Visualization\n'));
  console.log(chalk.gray('This will:'));
  console.log(chalk.gray('  1. Run Phase 2 mechanical analysis on the codebase'));
  console.log(chalk.gray('  2. Build a graph from the analysis results'));
  console.log(chalk.gray('  3. Generate an interactive HTML visualization'));
  console.log(chalk.gray('  4. Open the visualization in your browser\n'));

  const startTime = Date.now();

  try {
    // Create visualization pipeline
    const pipeline = new GraphVisualizationPipeline({
      outputDir: path.join(process.cwd(), 'dist/graph-visualization'),
      openInBrowser: true,
      generateStats: true
    });

    // Run the complete pipeline
    await pipeline.run();

    const duration = Date.now() - startTime;
    console.log(chalk.green.bold(`\n✅ Graph visualization test completed in ${(duration / 1000).toFixed(2)}s`));

    console.log(chalk.cyan('\n📍 Next Steps:'));
    console.log(chalk.white('  1. Check your browser for the interactive graph'));
    console.log(chalk.white('  2. Try dragging nodes to reorganize the layout'));
    console.log(chalk.white('  3. Click on nodes to focus on their connections'));
    console.log(chalk.white('  4. Use the filters to explore different node types'));
    console.log(chalk.white('  5. Search for specific components or functions\n'));

  } catch (error: any) {
    console.error(chalk.red.bold('\n❌ Test failed:'));
    console.error(chalk.red(error.message));
    if (error.stack) {
      console.error(chalk.gray(error.stack));
    }
    process.exit(1);
  }
}

// Run the test
testGraphVisualization().catch(console.error);