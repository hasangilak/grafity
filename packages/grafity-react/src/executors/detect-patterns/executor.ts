import { ExecutorContext } from '@nx/devkit';
import { ReactProjectGraphProcessor } from '../../graph/project-graph-processor';
import { ReactPatternAnalyzer } from '../../analyzers';

export interface DetectPatternsExecutorSchema {
  projectRoot: string;
  outputPath: string;
  format?: 'json' | 'markdown' | 'html';
}

export default async function runExecutor(
  options: DetectPatternsExecutorSchema,
  context: ExecutorContext
) {
  const processor = new ReactProjectGraphProcessor();
  const patternAnalyzer = new ReactPatternAnalyzer();

  try {
    const projectName = context.projectName!;
    const projectRoot = options.projectRoot;
    const format = options.format || 'markdown';

    console.log(`🔍 Detecting React patterns in ${projectName}...`);

    const analysis = await processor.processProject(
      projectName,
      projectRoot,
      context as any
    );

    if (!analysis) {
      console.log(`ℹ️  No React components found in ${projectName}`);
      return { success: true };
    }

    const patterns = analysis.patterns;
    const goodPatterns = patterns.filter(p => p.type === 'pattern');
    const antiPatterns = patterns.filter(p => p.type === 'anti-pattern');

    console.log(`✅ Pattern detection complete for ${projectName}:`);
    console.log(`   ✨ Good patterns: ${goodPatterns.length}`);
    console.log(`   ⚠️  Anti-patterns: ${antiPatterns.length}`);

    // Generate report in requested format
    let outputContent: string;
    let fileName: string;

    switch (format) {
      case 'json':
        outputContent = JSON.stringify({
          project: projectName,
          summary: {
            totalPatterns: patterns.length,
            goodPatterns: goodPatterns.length,
            antiPatterns: antiPatterns.length,
          },
          patterns: patterns,
        }, null, 2);
        fileName = 'patterns.json';
        break;

      case 'html':
        outputContent = generateHTMLReport(patterns, projectName);
        fileName = 'patterns.html';
        break;

      case 'markdown':
      default:
        outputContent = patternAnalyzer.generatePatternReport(patterns);
        fileName = 'patterns.md';
        break;
    }

    // Save pattern report
    const fs = require('fs');
    const path = require('path');

    const outputDir = path.dirname(options.outputPath);
    fs.mkdirSync(outputDir, { recursive: true });

    fs.writeFileSync(options.outputPath, outputContent);

    console.log(`💾 Pattern report saved to ${options.outputPath}`);

    return {
      success: true,
      patterns: {
        total: patterns.length,
        good: goodPatterns.length,
        antiPatterns: antiPatterns.length,
      },
      outputPath: options.outputPath,
    };
  } catch (error) {
    console.error(`❌ Failed to detect patterns:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function generateHTMLReport(patterns: any[], projectName: string): string {
  const goodPatterns = patterns.filter(p => p.type === 'pattern');
  const antiPatterns = patterns.filter(p => p.type === 'anti-pattern');

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>React Pattern Analysis - ${projectName}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 40px;
            background-color: #f8f9fa;
            line-height: 1.6;
            color: #333;
        }

        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 12px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.1);
            overflow: hidden;
        }

        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 40px;
            text-align: center;
        }

        .header h1 {
            margin: 0;
            font-size: 2.5em;
            font-weight: 300;
        }

        .header p {
            margin: 10px 0 0 0;
            opacity: 0.9;
            font-size: 1.1em;
        }

        .summary {
            display: flex;
            padding: 40px;
            background: #f8f9fa;
            justify-content: space-around;
        }

        .summary-item {
            text-align: center;
            padding: 20px;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            min-width: 120px;
        }

        .summary-value {
            font-size: 2.5em;
            font-weight: bold;
            margin-bottom: 5px;
        }

        .summary-value.good { color: #28a745; }
        .summary-value.warning { color: #ffc107; }
        .summary-value.danger { color: #dc3545; }

        .summary-label {
            color: #6c757d;
            font-size: 0.9em;
            text-transform: uppercase;
            font-weight: 500;
        }

        .content {
            padding: 40px;
        }

        .section {
            margin-bottom: 50px;
        }

        .section h2 {
            font-size: 1.8em;
            margin-bottom: 30px;
            padding-bottom: 15px;
            border-bottom: 3px solid #e9ecef;
        }

        .section.anti-patterns h2 {
            border-bottom-color: #dc3545;
            color: #dc3545;
        }

        .section.good-patterns h2 {
            border-bottom-color: #28a745;
            color: #28a745;
        }

        .pattern-card {
            background: white;
            border: 1px solid #e9ecef;
            border-radius: 8px;
            margin-bottom: 20px;
            overflow: hidden;
            box-shadow: 0 2px 5px rgba(0,0,0,0.05);
        }

        .pattern-header {
            padding: 20px;
            background: #f8f9fa;
            border-bottom: 1px solid #e9ecef;
        }

        .pattern-header h3 {
            margin: 0;
            font-size: 1.3em;
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .confidence-badge {
            background: #17a2b8;
            color: white;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 0.8em;
            font-weight: 500;
        }

        .pattern-body {
            padding: 20px;
        }

        .pattern-description {
            margin-bottom: 15px;
            font-size: 1.1em;
        }

        .pattern-location {
            background: #f8f9fa;
            padding: 10px 15px;
            border-radius: 6px;
            font-family: 'Monaco', 'Consolas', monospace;
            font-size: 0.9em;
            margin-bottom: 15px;
            color: #495057;
        }

        .suggestions {
            margin-top: 20px;
        }

        .suggestions h4 {
            margin: 0 0 10px 0;
            color: #495057;
            font-size: 1em;
        }

        .suggestions ul {
            margin: 0;
            padding-left: 20px;
        }

        .suggestions li {
            margin-bottom: 8px;
            color: #6c757d;
        }

        .no-patterns {
            text-align: center;
            padding: 60px 20px;
            color: #6c757d;
        }

        .no-patterns .icon {
            font-size: 4em;
            margin-bottom: 20px;
        }

        @media (max-width: 768px) {
            body { padding: 20px; }
            .header { padding: 30px 20px; }
            .summary { flex-direction: column; gap: 20px; }
            .content { padding: 30px 20px; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>React Pattern Analysis</h1>
            <p>Project: <strong>${projectName}</strong></p>
        </div>

        <div class="summary">
            <div class="summary-item">
                <div class="summary-value">${patterns.length}</div>
                <div class="summary-label">Total Patterns</div>
            </div>
            <div class="summary-item">
                <div class="summary-value good">${goodPatterns.length}</div>
                <div class="summary-label">Good Patterns</div>
            </div>
            <div class="summary-item">
                <div class="summary-value danger">${antiPatterns.length}</div>
                <div class="summary-label">Anti-Patterns</div>
            </div>
        </div>

        <div class="content">
            ${antiPatterns.length > 0 ? `
            <div class="section anti-patterns">
                <h2>⚠️ Anti-patterns (Issues to Address)</h2>
                ${antiPatterns.map(pattern => `
                <div class="pattern-card">
                    <div class="pattern-header">
                        <h3>
                            ${pattern.name}
                            <span class="confidence-badge">${Math.round(pattern.confidence * 100)}% confidence</span>
                        </h3>
                    </div>
                    <div class="pattern-body">
                        <div class="pattern-description">${pattern.description}</div>
                        <div class="pattern-location">📍 ${pattern.components.join(', ')}</div>
                        ${pattern.suggestions && pattern.suggestions.length > 0 ? `
                        <div class="suggestions">
                            <h4>💡 Suggestions:</h4>
                            <ul>
                                ${pattern.suggestions.map(suggestion => `<li>${suggestion}</li>`).join('')}
                            </ul>
                        </div>
                        ` : ''}
                    </div>
                </div>
                `).join('')}
            </div>
            ` : ''}

            ${goodPatterns.length > 0 ? `
            <div class="section good-patterns">
                <h2>✅ Good Patterns (Well-implemented)</h2>
                ${goodPatterns.map(pattern => `
                <div class="pattern-card">
                    <div class="pattern-header">
                        <h3>
                            ${pattern.name}
                            <span class="confidence-badge">${Math.round(pattern.confidence * 100)}% confidence</span>
                        </h3>
                    </div>
                    <div class="pattern-body">
                        <div class="pattern-description">${pattern.description}</div>
                        <div class="pattern-location">📍 ${pattern.components.join(', ')}</div>
                        ${pattern.suggestions && pattern.suggestions.length > 0 ? `
                        <div class="suggestions">
                            <h4>🚀 Recommendations:</h4>
                            <ul>
                                ${pattern.suggestions.map(suggestion => `<li>${suggestion}</li>`).join('')}
                            </ul>
                        </div>
                        ` : ''}
                    </div>
                </div>
                `).join('')}
            </div>
            ` : ''}

            ${patterns.length === 0 ? `
            <div class="no-patterns">
                <div class="icon">🔍</div>
                <h3>No patterns detected</h3>
                <p>Either no React components were found, or the components don't match our pattern detection criteria.</p>
            </div>
            ` : ''}
        </div>
    </div>
</body>
</html>`;
}