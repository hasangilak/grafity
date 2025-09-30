/**
 * Playwright MCP Helper Utilities
 * Helper functions for testing Grafity's new developer onboarding journey
 */

import { Page, expect } from '@playwright/test';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

export interface ComponentAnalysisResult {
  componentCount: number;
  components: string[];
  hooks: string[];
  contexts: string[];
}

export interface VisualizationMetrics {
  nodeCount: number;
  hasInteractivity: boolean;
  hasDetailsPanel: boolean;
  hasZoomControls: boolean;
}

/**
 * Execute an npm script and capture output
 */
export async function runNpmScript(
  scriptName: string,
  cwd?: string
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  try {
    const stdout = execSync(`npm run ${scriptName}`, {
      cwd: cwd || process.cwd(),
      encoding: 'utf-8',
      timeout: 60000, // 1 minute timeout
    });
    return { stdout, stderr: '', exitCode: 0 };
  } catch (error: any) {
    return {
      stdout: error.stdout?.toString() || '',
      stderr: error.stderr?.toString() || '',
      exitCode: error.status || 1,
    };
  }
}

/**
 * Open a generated visualization HTML file in browser
 */
export async function openGeneratedVisualization(
  page: Page,
  relativePath: string
): Promise<void> {
  const fullPath = path.join(process.cwd(), relativePath);

  if (!fs.existsSync(fullPath)) {
    throw new Error(`Visualization file not found: ${fullPath}`);
  }

  await page.goto(`file://${fullPath}`);
  await page.waitForLoadState('domcontentloaded');
}

/**
 * Verify component count in visualization
 */
export async function verifyComponentCount(
  page: Page,
  expectedCount: number,
  selector: string = '.component-node, [data-testid="component-node"]'
): Promise<void> {
  await page.waitForSelector(selector, { timeout: 5000 });
  const nodes = page.locator(selector);
  const count = await nodes.count();

  expect(count).toBe(expectedCount);
}

/**
 * Test visualization interactivity (zoom, pan, click)
 */
export async function testVisualizationInteractivity(
  page: Page
): Promise<VisualizationMetrics> {
  const metrics: VisualizationMetrics = {
    nodeCount: 0,
    hasInteractivity: false,
    hasDetailsPanel: false,
    hasZoomControls: false,
  };

  // Count nodes
  const nodeSelector = '.component-node, [data-testid="component-node"], svg circle, svg rect';
  const nodes = page.locator(nodeSelector);
  metrics.nodeCount = await nodes.count();

  // Test click interactivity
  if (metrics.nodeCount > 0) {
    try {
      await nodes.first().click({ timeout: 2000 });
      metrics.hasInteractivity = true;

      // Check if details panel appears
      const detailsPanel = page.locator(
        '.details-panel, [data-testid="details-panel"], .component-details, .info-panel'
      );
      metrics.hasDetailsPanel = await detailsPanel.isVisible({ timeout: 1000 }).catch(() => false);
    } catch (error) {
      console.warn('No click interactivity detected');
    }
  }

  // Check for zoom controls
  const zoomControls = page.locator(
    '.zoom-controls, [data-testid="zoom-controls"], button[aria-label*="zoom"]'
  );
  metrics.hasZoomControls = await zoomControls.count().then(c => c > 0);

  return metrics;
}

/**
 * Parse demo analysis console output
 */
export function parseAnalysisOutput(output: string): ComponentAnalysisResult {
  const result: ComponentAnalysisResult = {
    componentCount: 0,
    components: [],
    hooks: [],
    contexts: [],
  };

  // Extract component count
  const componentMatch = output.match(/(\d+)\s+components?\s+found/i);
  if (componentMatch) {
    result.componentCount = parseInt(componentMatch[1], 10);
  }

  // Extract component names
  const componentMatches = output.matchAll(/(?:Component|Found):\s+([A-Z][a-zA-Z0-9]+)/g);
  for (const match of componentMatches) {
    result.components.push(match[1]);
  }

  // Extract hooks
  const hookMatches = output.matchAll(/use([A-Z][a-zA-Z]+)/g);
  for (const match of hookMatches) {
    const hookName = `use${match[1]}`;
    if (!result.hooks.includes(hookName)) {
      result.hooks.push(hookName);
    }
  }

  // Extract contexts
  const contextMatches = output.matchAll(/([A-Z][a-zA-Z]+)Context/g);
  for (const match of contextMatches) {
    const contextName = `${match[1]}Context`;
    if (!result.contexts.includes(contextName)) {
      result.contexts.push(contextName);
    }
  }

  return result;
}

/**
 * Verify expected files exist in sample React app
 */
export function verifySampleAppStructure(sampleAppPath: string): {
  valid: boolean;
  missingFiles: string[];
} {
  const expectedFiles = [
    'src/App.tsx',
    'src/components/Dashboard.tsx',
    'src/components/TodoList.tsx',
    'src/contexts/UserContext.tsx',
    'src/services/apiService.ts',
  ];

  const missingFiles: string[] = [];

  for (const file of expectedFiles) {
    const filePath = path.join(sampleAppPath, file);
    if (!fs.existsSync(filePath)) {
      missingFiles.push(file);
    }
  }

  return {
    valid: missingFiles.length === 0,
    missingFiles,
  };
}

/**
 * Count React component files in a directory
 */
export function countReactFiles(directory: string): number {
  let count = 0;

  function traverse(dir: string) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);

      if (stat.isDirectory()) {
        traverse(filePath);
      } else if (file.endsWith('.tsx') || (file.endsWith('.ts') && !file.endsWith('.d.ts'))) {
        count++;
      }
    }
  }

  traverse(directory);
  return count;
}

/**
 * Wait for file to be created (useful for async generation)
 */
export async function waitForFile(
  filePath: string,
  timeoutMs: number = 10000
): Promise<boolean> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    if (fs.existsSync(filePath)) {
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  return false;
}

/**
 * Check if npm script exists in package.json
 */
export function hasNpmScript(scriptName: string, packageJsonPath?: string): boolean {
  const pkgPath = packageJsonPath || path.join(process.cwd(), 'package.json');

  if (!fs.existsSync(pkgPath)) {
    return false;
  }

  const packageJson = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  return !!packageJson.scripts?.[scriptName];
}

/**
 * Get available demo scripts
 */
export function getAvailableDemoScripts(): string[] {
  const packageJsonPath = path.join(process.cwd(), 'package.json');

  if (!fs.existsSync(packageJsonPath)) {
    return [];
  }

  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
  const scripts = packageJson.scripts || {};

  return Object.keys(scripts).filter(key => key.startsWith('demo:'));
}

/**
 * Capture screenshot with timestamp
 */
export async function captureScreenshot(
  page: Page,
  name: string,
  outputDir: string = 'test-results/screenshots'
): Promise<string> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fileName = `${name}-${timestamp}.png`;
  const outputPath = path.join(outputDir, fileName);

  // Ensure directory exists
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  await page.screenshot({ path: outputPath, fullPage: true });
  return outputPath;
}

/**
 * Extract pattern detection results from output
 */
export interface PatternResult {
  goodPatterns: string[];
  antiPatterns: string[];
  recommendations: string[];
}

export function parsePatternOutput(output: string): PatternResult {
  const result: PatternResult = {
    goodPatterns: [],
    antiPatterns: [],
    recommendations: [],
  };

  // Extract good patterns
  const goodMatches = output.matchAll(/✅\s+(.+?)(?:\n|$)/g);
  for (const match of goodMatches) {
    result.goodPatterns.push(match[1].trim());
  }

  // Extract anti-patterns
  const antiMatches = output.matchAll(/⚠️\s+(.+?)(?:\n|$)/g);
  for (const match of antiMatches) {
    result.antiPatterns.push(match[1].trim());
  }

  // Extract recommendations
  const recMatches = output.matchAll(/💡\s+(.+?)(?:\n|$)/g);
  for (const match of recMatches) {
    result.recommendations.push(match[1].trim());
  }

  return result;
}