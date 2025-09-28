import { MechanicalPipeline } from './MechanicalPipeline';
import { CodeGraphBuilder } from '../graph-engine/builders/CodeGraphBuilder';
import { GraphStore } from '../graph-engine/GraphStore';
import { HtmlGraphGenerator } from '../graph-engine/visualization/HtmlGraphGenerator';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as chalk from 'chalk';

export interface VisualizationOptions {
  outputDir?: string;
  openInBrowser?: boolean;
  generateStats?: boolean;
  generateScreenshot?: boolean;
}

/**
 * Pipeline that combines mechanical analysis with graph visualization
 */
export class GraphVisualizationPipeline {
  private mechanicalPipeline: MechanicalPipeline;
  private options: VisualizationOptions;

  constructor(options: VisualizationOptions = {}) {
    this.options = {
      outputDir: 'dist/graph-visualization',
      openInBrowser: true,
      generateStats: true,
      ...options
    };

    this.mechanicalPipeline = new MechanicalPipeline({
      useCache: true,
      parallel: true
    });
  }

  /**
   * Run the complete pipeline: analyze → build graph → visualize
   */
  async run(): Promise<void> {
    console.log(chalk.cyan.bold('\n🚀 Starting Graph Visualization Pipeline\n'));

    try {
      // Step 1: Run mechanical analysis
      console.log(chalk.blue('Step 1: Running mechanical analysis...'));
      const analysisResult = await this.mechanicalPipeline.analyze();
      console.log(chalk.green(`✓ Analysis complete: ${analysisResult.metrics.totalFiles} files analyzed`));

      // Step 2: Build graph from analysis
      console.log(chalk.blue('\nStep 2: Building graph from analysis...'));
      const graphBuilder = new CodeGraphBuilder();
      const graphStore = await graphBuilder.build(analysisResult);
      const stats = graphStore.getStatistics();
      console.log(chalk.green(`✓ Graph built: ${stats.totalNodes} nodes, ${stats.totalEdges} edges`));

      // Step 3: Validate graph
      console.log(chalk.blue('\nStep 3: Validating graph...'));
      const validation = graphStore.validate();
      if (!validation.valid) {
        console.warn(chalk.yellow('⚠ Graph validation warnings:'));
        validation.errors.forEach(err => console.warn(chalk.yellow(`  - ${err}`)));
      } else {
        console.log(chalk.green('✓ Graph validation passed'));
      }

      // Step 4: Generate visualization
      console.log(chalk.blue('\nStep 4: Generating visualization...'));
      await this.generateVisualization(graphStore);

      // Step 5: Generate statistics
      if (this.options.generateStats) {
        console.log(chalk.blue('\nStep 5: Generating statistics...'));
        await this.generateStatistics(graphStore, analysisResult.patterns);
      }

      // Step 6: Open in browser
      if (this.options.openInBrowser) {
        await this.openInBrowser();
      }

      console.log(chalk.green.bold('\n✨ Graph visualization pipeline complete!'));
      this.printSummary(stats);

    } catch (error: any) {
      console.error(chalk.red.bold('\n❌ Pipeline failed:'));
      console.error(chalk.red(error.message));
      throw error;
    }
  }

  /**
   * Generate HTML visualization
   */
  private async generateVisualization(store: GraphStore): Promise<void> {
    // Ensure output directory exists
    await fs.mkdir(this.options.outputDir!, { recursive: true });

    // Generate main HTML visualization
    const htmlGenerator = new HtmlGraphGenerator(store);
    const htmlPath = path.join(this.options.outputDir!, 'graph-visualization.html');
    await htmlGenerator.generateHtml(htmlPath);

    // Save raw graph data
    const dataPath = path.join(this.options.outputDir!, 'graph-data.json');
    await fs.writeFile(dataPath, JSON.stringify(store.toJSON(), null, 2));

    console.log(chalk.green(`✓ Visualization generated: ${htmlPath}`));
  }

  /**
   * Generate statistics report
   */
  private async generateStatistics(store: GraphStore, patterns: any): Promise<void> {
    const stats = store.getStatistics();

    // Analyze graph structure
    const codeNodes = store.getNodesByType('code');
    const components = codeNodes.filter(n => 'codeType' in n && n.codeType === 'component');
    const functions = codeNodes.filter(n => 'codeType' in n && n.codeType === 'function');
    const files = codeNodes.filter(n => 'codeType' in n && n.codeType === 'file');

    const report = {
      summary: {
        totalNodes: stats.totalNodes,
        totalEdges: stats.totalEdges,
        bidirectionalEdges: stats.bidirectionalEdges,
        averageDegree: stats.averageOutDegree.toFixed(2)
      },
      nodeBreakdown: {
        ...stats.nodesByType,
        codeDetails: {
          components: components.length,
          functions: functions.length,
          files: files.length
        }
      },
      edgeBreakdown: stats.edgesByType,
      topComponents: components
        .map(c => ({
          name: c.label,
          connections: store.getConnectedNodes(c.id).length
        }))
        .sort((a, b) => b.connections - a.connections)
        .slice(0, 10),
      patterns: {
        score: patterns.score,
        good: patterns.summary.good,
        bad: patterns.summary.bad
      },
      timestamp: new Date().toISOString()
    };

    const statsPath = path.join(this.options.outputDir!, 'graph-stats.json');
    await fs.writeFile(statsPath, JSON.stringify(report, null, 2));

    // Generate markdown report
    const markdownReport = this.generateMarkdownReport(report);
    const reportPath = path.join(this.options.outputDir!, 'graph-report.md');
    await fs.writeFile(reportPath, markdownReport);

    console.log(chalk.green(`✓ Statistics generated: ${statsPath}`));
  }

  /**
   * Generate markdown report
   */
  private generateMarkdownReport(report: any): string {
    return `# Graph Analysis Report

Generated: ${report.timestamp}

## Summary

- **Total Nodes**: ${report.summary.totalNodes}
- **Total Edges**: ${report.summary.totalEdges}
- **Bi-directional Edges**: ${report.summary.bidirectionalEdges}
- **Average Degree**: ${report.summary.averageDegree}

## Node Breakdown

### By Type
${Object.entries(report.nodeBreakdown)
  .filter(([key]) => key !== 'codeDetails')
  .map(([type, count]) => `- **${type}**: ${count}`)
  .join('\\n')}

### Code Details
- **Components**: ${report.nodeBreakdown.codeDetails.components}
- **Functions**: ${report.nodeBreakdown.codeDetails.functions}
- **Files**: ${report.nodeBreakdown.codeDetails.files}

## Top Connected Components

${report.topComponents
  .map((c: any, i: number) => `${i + 1}. **${c.name}** - ${c.connections} connections`)
  .join('\\n')}

## Code Quality

- **Pattern Score**: ${report.patterns.score}/100
- **Good Patterns**: ${report.patterns.good}
- **Bad Patterns**: ${report.patterns.bad}

## Edge Types

${Object.entries(report.edgeBreakdown)
  .sort((a: any, b: any) => b[1] - a[1])
  .map(([type, count]) => `- **${type}**: ${count}`)
  .join('\\n')}
`;
  }

  /**
   * Open visualization in browser
   */
  private async openInBrowser(): Promise<void> {
    const htmlPath = path.join(this.options.outputDir!, 'graph-visualization.html');
    const absolutePath = path.resolve(htmlPath);

    // Determine the command based on OS
    const platform = process.platform;
    let command: string;

    if (platform === 'darwin') {
      command = `open "${absolutePath}"`;
    } else if (platform === 'win32') {
      command = `start "${absolutePath}"`;
    } else {
      command = `xdg-open "${absolutePath}"`;
    }

    try {
      const { exec } = await import('child_process');
      exec(command, (error) => {
        if (error) {
          console.warn(chalk.yellow(`⚠ Could not open browser automatically. Please open: ${absolutePath}`));
        } else {
          console.log(chalk.green(`✓ Opened in browser: ${absolutePath}`));
        }
      });
    } catch {
      console.log(chalk.yellow(`Please open in browser: ${absolutePath}`));
    }
  }

  /**
   * Print summary
   */
  private printSummary(stats: any): void {
    console.log(chalk.cyan('\\n📊 Graph Summary:'));
    console.log(chalk.white('─'.repeat(50)));
    console.log(chalk.white(`  Total Nodes:         ${chalk.bold(stats.totalNodes)}`));
    console.log(chalk.white(`  Total Edges:         ${chalk.bold(stats.totalEdges)}`));
    console.log(chalk.white(`  Bi-directional:      ${chalk.bold(stats.bidirectionalEdges)}`));
    console.log(chalk.white('\\n  Node Types:'));
    Object.entries(stats.nodesByType).forEach(([type, count]) => {
      const emoji = this.getNodeEmoji(type);
      console.log(chalk.white(`    ${emoji} ${type}: ${chalk.bold(count)}`));
    });
    console.log(chalk.white('\\n  Output:'));
    console.log(chalk.white(`    📁 ${this.options.outputDir}/`));
    console.log(chalk.white(`    ├── 🌐 graph-visualization.html`));
    console.log(chalk.white(`    ├── 📊 graph-data.json`));
    console.log(chalk.white(`    ├── 📈 graph-stats.json`));
    console.log(chalk.white(`    └── 📄 graph-report.md`));
  }

  private getNodeEmoji(type: string): string {
    switch (type) {
      case 'code': return '🔧';
      case 'business': return '💼';
      case 'document': return '📄';
      case 'conversation': return '💬';
      default: return '📦';
    }
  }
}