import { ExecutorContext } from '@nx/devkit';
import { ReactProjectGraphProcessor } from '../../graph/project-graph-processor';

export interface AnalyzeReactExecutorSchema {
  projectRoot: string;
  outputPath?: string;
}

export default async function runExecutor(
  options: AnalyzeReactExecutorSchema,
  context: ExecutorContext
) {
  const processor = new ReactProjectGraphProcessor();

  try {
    const projectName = context.projectName!;
    const projectRoot = options.projectRoot;

    console.log(`🔍 Analyzing React components in ${projectName}...`);

    const analysis = await processor.processProject(
      projectName,
      projectRoot,
      context as any
    );

    if (!analysis) {
      console.log(`ℹ️  No React components found in ${projectName}`);
      return { success: true, analysis: null };
    }

    console.log(`✅ Analysis complete for ${projectName}:`);
    console.log(`   📦 Components: ${analysis.components.length}`);
    console.log(`   🎯 Patterns: ${analysis.patterns.length}`);
    console.log(`   📊 State flows: ${analysis.dataFlows.stateFlows.length}`);
    console.log(`   🔗 Prop flows: ${analysis.dataFlows.propFlows.length}`);
    console.log(`   📱 Context flows: ${analysis.dataFlows.contextFlows.length}`);

    // Log metrics
    console.log(`   📈 Metrics:`);
    console.log(`     - Complexity: ${analysis.metrics.complexity.toFixed(2)}`);
    console.log(`     - Prop depth: ${analysis.metrics.propDepth}`);
    console.log(`     - Context usage: ${analysis.metrics.contextUsage}`);

    // Save analysis to file if outputPath specified
    if (options.outputPath) {
      const fs = require('fs');
      const path = require('path');

      // Ensure output directory exists
      const outputDir = path.dirname(options.outputPath);
      fs.mkdirSync(outputDir, { recursive: true });

      // Write analysis to file
      fs.writeFileSync(
        options.outputPath,
        JSON.stringify(analysis, null, 2)
      );
      console.log(`💾 Analysis saved to ${options.outputPath}`);
    }

    return {
      success: true,
      analysis,
    };
  } catch (error) {
    console.error(`❌ Failed to analyze React components:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}