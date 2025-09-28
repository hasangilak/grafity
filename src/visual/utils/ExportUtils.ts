/**
 * Advanced Export Utilities for Graph Visualization
 * Handles report generation, shareable links, and various export formats
 */

export interface ReportData {
  title: string;
  generatedAt: string;
  summary: {
    totalNodes: number;
    totalEdges: number;
    selectedNodes: number;
    currentLayout: string;
    currentZoom: string;
  };
  nodeBreakdown: Record<string, number>;
  edgeBreakdown: Record<string, number>;
  viewSettings?: any;
  metadata?: any;
}

export interface ShareableData {
  view: any;
  layout: string;
  zoom: number;
  timestamp: string;
  nodeCount: number;
  edgeCount: number;
}

/**
 * Generate HTML report from graph data
 */
export function generateHTMLReport(reportData: ReportData): string {
  const {
    title,
    generatedAt,
    summary,
    nodeBreakdown,
    edgeBreakdown,
    viewSettings,
    metadata
  } = reportData;

  const date = new Date(generatedAt).toLocaleString();

  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            line-height: 1.6;
            color: #333;
        }
        .header {
            text-align: center;
            border-bottom: 2px solid #007bff;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }
        .summary {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 30px;
        }
        .metric {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            border-bottom: 1px solid #dee2e6;
        }
        .metric:last-child {
            border-bottom: none;
        }
        .breakdown {
            margin-bottom: 30px;
        }
        .breakdown h3 {
            color: #007bff;
            border-bottom: 1px solid #dee2e6;
            padding-bottom: 8px;
        }
        .chart-container {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
            margin-top: 15px;
        }
        .chart-bar {
            background: #007bff;
            color: white;
            padding: 8px 12px;
            border-radius: 4px;
            font-size: 12px;
            white-space: nowrap;
        }
        .metadata {
            background: #e9ecef;
            padding: 15px;
            border-radius: 4px;
            font-family: monospace;
            font-size: 12px;
        }
        .footer {
            text-align: center;
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #dee2e6;
            color: #6c757d;
            font-size: 12px;
        }
        @media print {
            body { max-width: none; margin: 0; }
            .chart-container { page-break-inside: avoid; }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>${title}</h1>
        <p>Generated on ${date}</p>
    </div>

    <div class="summary">
        <h2>Summary</h2>
        <div class="metric">
            <span><strong>Total Nodes:</strong></span>
            <span>${summary.totalNodes}</span>
        </div>
        <div class="metric">
            <span><strong>Total Edges:</strong></span>
            <span>${summary.totalEdges}</span>
        </div>
        <div class="metric">
            <span><strong>Selected Nodes:</strong></span>
            <span>${summary.selectedNodes}</span>
        </div>
        <div class="metric">
            <span><strong>Current Layout:</strong></span>
            <span>${summary.currentLayout}</span>
        </div>
        <div class="metric">
            <span><strong>Current Zoom:</strong></span>
            <span>${summary.currentZoom}</span>
        </div>
    </div>

    <div class="breakdown">
        <h3>Node Type Distribution</h3>
        <div class="chart-container">
            ${Object.entries(nodeBreakdown).map(([type, count]) =>
                `<div class="chart-bar">${type}: ${count}</div>`
            ).join('')}
        </div>
    </div>

    <div class="breakdown">
        <h3>Edge Type Distribution</h3>
        <div class="chart-container">
            ${Object.entries(edgeBreakdown).map(([type, count]) =>
                `<div class="chart-bar">${type}: ${count}</div>`
            ).join('')}
        </div>
    </div>

    ${viewSettings ? `
    <div class="breakdown">
        <h3>View Settings</h3>
        <div class="metadata">
            <strong>View Name:</strong> ${viewSettings.name || 'Untitled'}<br>
            ${viewSettings.filters ? `<strong>Active Filters:</strong> ${JSON.stringify(viewSettings.filters, null, 2)}<br>` : ''}
            ${viewSettings.selectedNodes ? `<strong>Selected Nodes:</strong> ${viewSettings.selectedNodes.length} nodes<br>` : ''}
        </div>
    </div>
    ` : ''}

    ${metadata ? `
    <div class="breakdown">
        <h3>Additional Metadata</h3>
        <div class="metadata">
            ${JSON.stringify(metadata, null, 2)}
        </div>
    </div>
    ` : ''}

    <div class="footer">
        <p>Generated by Grafity Graph Visualization Tool</p>
        <p>This report provides an overview of the current graph state and analysis.</p>
    </div>
</body>
</html>`;
}

/**
 * Generate PDF-ready HTML report
 */
export function generatePDFReport(reportData: ReportData): string {
  // Similar to HTML report but optimized for PDF generation
  const htmlReport = generateHTMLReport(reportData);

  // Add PDF-specific styles
  return htmlReport.replace(
    '</style>',
    `
        @media print {
            body {
                max-width: none;
                margin: 0;
                font-size: 12pt;
            }
            .chart-container {
                page-break-inside: avoid;
            }
            .breakdown {
                page-break-inside: avoid;
                margin-bottom: 20pt;
            }
            .header {
                page-break-after: avoid;
            }
        }
    </style>`
  );
}

/**
 * Generate CSV report
 */
export function generateCSVReport(reportData: ReportData): string {
  const { summary, nodeBreakdown, edgeBreakdown } = reportData;

  let csv = 'Report Section,Metric,Value\n';

  // Summary data
  csv += `Summary,Total Nodes,${summary.totalNodes}\n`;
  csv += `Summary,Total Edges,${summary.totalEdges}\n`;
  csv += `Summary,Selected Nodes,${summary.selectedNodes}\n`;
  csv += `Summary,Current Layout,${summary.currentLayout}\n`;
  csv += `Summary,Current Zoom,${summary.currentZoom}\n`;

  // Node breakdown
  Object.entries(nodeBreakdown).forEach(([type, count]) => {
    csv += `Node Types,${type},${count}\n`;
  });

  // Edge breakdown
  Object.entries(edgeBreakdown).forEach(([type, count]) => {
    csv += `Edge Types,${type},${count}\n`;
  });

  return csv;
}

/**
 * Generate markdown report
 */
export function generateMarkdownReport(reportData: ReportData): string {
  const {
    title,
    generatedAt,
    summary,
    nodeBreakdown,
    edgeBreakdown,
    viewSettings
  } = reportData;

  const date = new Date(generatedAt).toLocaleString();

  let markdown = `# ${title}\n\n`;
  markdown += `*Generated on ${date}*\n\n`;

  // Summary
  markdown += `## Summary\n\n`;
  markdown += `| Metric | Value |\n`;
  markdown += `|--------|-------|\n`;
  markdown += `| Total Nodes | ${summary.totalNodes} |\n`;
  markdown += `| Total Edges | ${summary.totalEdges} |\n`;
  markdown += `| Selected Nodes | ${summary.selectedNodes} |\n`;
  markdown += `| Current Layout | ${summary.currentLayout} |\n`;
  markdown += `| Current Zoom | ${summary.currentZoom} |\n\n`;

  // Node breakdown
  markdown += `## Node Type Distribution\n\n`;
  markdown += `| Type | Count |\n`;
  markdown += `|------|-------|\n`;
  Object.entries(nodeBreakdown).forEach(([type, count]) => {
    markdown += `| ${type} | ${count} |\n`;
  });
  markdown += `\n`;

  // Edge breakdown
  markdown += `## Edge Type Distribution\n\n`;
  markdown += `| Type | Count |\n`;
  markdown += `|------|-------|\n`;
  Object.entries(edgeBreakdown).forEach(([type, count]) => {
    markdown += `| ${type} | ${count} |\n`;
  });
  markdown += `\n`;

  // View settings
  if (viewSettings) {
    markdown += `## View Settings\n\n`;
    markdown += `- **View Name:** ${viewSettings.name || 'Untitled'}\n`;
    if (viewSettings.selectedNodes) {
      markdown += `- **Selected Nodes:** ${viewSettings.selectedNodes.length} nodes\n`;
    }
    if (viewSettings.filters) {
      markdown += `- **Active Filters:**\n\`\`\`json\n${JSON.stringify(viewSettings.filters, null, 2)}\n\`\`\`\n`;
    }
  }

  markdown += `\n---\n*Generated by Grafity Graph Visualization Tool*\n`;

  return markdown;
}

/**
 * Download file helper
 */
export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Clean up the URL object
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

/**
 * Generate shareable link
 */
export function generateShareableLink(shareData: ShareableData, baseUrl?: string): string {
  const encodedData = btoa(JSON.stringify(shareData));
  const url = baseUrl || (typeof window !== 'undefined' ? window.location.origin + window.location.pathname : '');
  return `${url}?share=${encodedData}`;
}

/**
 * Parse shareable link
 */
export function parseShareableLink(url: string): ShareableData | null {
  try {
    const urlObj = new URL(url);
    const shareParam = urlObj.searchParams.get('share');

    if (!shareParam) return null;

    const decodedData = atob(shareParam);
    return JSON.parse(decodedData) as ShareableData;
  } catch (error) {
    console.error('Failed to parse shareable link:', error);
    return null;
  }
}

/**
 * Export manager class
 */
export class ExportManager {
  private reportData: ReportData | null = null;

  constructor(reportData?: ReportData) {
    this.reportData = reportData;
  }

  setReportData(data: ReportData): void {
    this.reportData = data;
  }

  exportAsHTML(): void {
    if (!this.reportData) throw new Error('No report data available');

    const html = generateHTMLReport(this.reportData);
    const timestamp = new Date().toISOString().split('T')[0];
    downloadFile(html, `graph-report-${timestamp}.html`, 'text/html');
  }

  exportAsMarkdown(): void {
    if (!this.reportData) throw new Error('No report data available');

    const markdown = generateMarkdownReport(this.reportData);
    const timestamp = new Date().toISOString().split('T')[0];
    downloadFile(markdown, `graph-report-${timestamp}.md`, 'text/markdown');
  }

  exportAsCSV(): void {
    if (!this.reportData) throw new Error('No report data available');

    const csv = generateCSVReport(this.reportData);
    const timestamp = new Date().toISOString().split('T')[0];
    downloadFile(csv, `graph-report-${timestamp}.csv`, 'text/csv');
  }

  exportAsJSON(): void {
    if (!this.reportData) throw new Error('No report data available');

    const json = JSON.stringify(this.reportData, null, 2);
    const timestamp = new Date().toISOString().split('T')[0];
    downloadFile(json, `graph-report-${timestamp}.json`, 'application/json');
  }

  openPrintDialog(): void {
    if (!this.reportData) throw new Error('No report data available');

    const html = generatePDFReport(this.reportData);
    const printWindow = window.open('', '_blank');

    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();

      // Wait for content to load, then print
      printWindow.onload = () => {
        setTimeout(() => {
          printWindow.print();
        }, 500);
      };
    }
  }

  createShareableLink(shareData: ShareableData, baseUrl?: string): string {
    return generateShareableLink(shareData, baseUrl);
  }

  copyShareableLink(shareData: ShareableData, baseUrl?: string): Promise<void> {
    const link = this.createShareableLink(shareData, baseUrl);

    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(link);
    } else {
      // Fallback for older browsers
      return new Promise((resolve, reject) => {
        const textArea = document.createElement('textarea');
        textArea.value = link;
        document.body.appendChild(textArea);
        textArea.select();

        try {
          document.execCommand('copy');
          resolve();
        } catch (error) {
          reject(error);
        } finally {
          document.body.removeChild(textArea);
        }
      });
    }
  }
}

/**
 * React hook for export functionality
 */
import { useCallback, useState } from 'react';

export interface UseExportOptions {
  onSuccess?: (format: string) => void;
  onError?: (error: Error) => void;
}

export const useExport = (options: UseExportOptions = {}) => {
  const [isExporting, setIsExporting] = useState(false);
  const [exportManager] = useState(() => new ExportManager());

  const exportReport = useCallback(async (
    format: 'html' | 'markdown' | 'csv' | 'json' | 'print',
    reportData: ReportData
  ) => {
    setIsExporting(true);

    try {
      exportManager.setReportData(reportData);

      switch (format) {
        case 'html':
          exportManager.exportAsHTML();
          break;
        case 'markdown':
          exportManager.exportAsMarkdown();
          break;
        case 'csv':
          exportManager.exportAsCSV();
          break;
        case 'json':
          exportManager.exportAsJSON();
          break;
        case 'print':
          exportManager.openPrintDialog();
          break;
        default:
          throw new Error(`Unsupported format: ${format}`);
      }

      options.onSuccess?.(format);
    } catch (error) {
      options.onError?.(error as Error);
    } finally {
      setIsExporting(false);
    }
  }, [exportManager, options]);

  const createShareableLink = useCallback(async (
    shareData: ShareableData,
    baseUrl?: string
  ): Promise<string> => {
    try {
      const link = exportManager.createShareableLink(shareData, baseUrl);
      await exportManager.copyShareableLink(shareData, baseUrl);
      return link;
    } catch (error) {
      options.onError?.(error as Error);
      throw error;
    }
  }, [exportManager, options]);

  return {
    exportReport,
    createShareableLink,
    isExporting,
    exportManager
  };
};