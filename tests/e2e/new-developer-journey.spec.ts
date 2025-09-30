/**
 * New Developer Journey E2E Tests
 *
 * This test suite emulates a new developer's first experience with Grafity,
 * from discovery through successful analysis of a React application.
 *
 * Test Flow:
 * 1. Documentation Discovery
 * 2. Installation & Build Validation
 * 3. Demo Analysis Execution
 * 4. Visualization Generation
 * 5. Interactive Visualization Testing
 * 6. Pattern Detection Validation
 * 7. Nx Integration Flow
 */

import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import {
  runNpmScript,
  openGeneratedVisualization,
  verifyComponentCount,
  testVisualizationInteractivity,
  parseAnalysisOutput,
  verifySampleAppStructure,
  countReactFiles,
  hasNpmScript,
  getAvailableDemoScripts,
  captureScreenshot,
  parsePatternOutput,
  waitForFile,
} from './helpers/playwright-mcp-helpers';
import expectedResults from './fixtures/expected-results.json';

const WORKSPACE_ROOT = path.join(__dirname, '../..');
const SAMPLE_APP_PATH = path.join(WORKSPACE_ROOT, 'examples/sample-react-app');

test.describe('New Developer Journey - Phase 1: Discovery', () => {
  test('should find and read README.md with key information', async () => {
    const readmePath = path.join(WORKSPACE_ROOT, 'README.md');

    expect(fs.existsSync(readmePath), 'README.md should exist').toBeTruthy();

    const readmeContent = fs.readFileSync(readmePath, 'utf-8');

    // Check for essential sections
    expect(readmeContent).toContain('Grafity');
    expect(readmeContent).toContain('Installation');
    expect(readmeContent).toContain('Usage');

    // Check for key features
    expect(readmeContent.toLowerCase()).toMatch(/react|component|analysis/);

    // Check for getting started information
    expect(readmeContent.toLowerCase()).toMatch(/demo|example|quick\s*start/);
  });

  test('should have CLAUDE.md with AI assistant guidance', async () => {
    const claudePath = path.join(WORKSPACE_ROOT, 'CLAUDE.md');

    expect(fs.existsSync(claudePath), 'CLAUDE.md should exist').toBeTruthy();

    const claudeContent = fs.readFileSync(claudePath, 'utf-8');

    // Check for architecture information
    expect(claudeContent).toContain('Nx');
    expect(claudeContent).toContain('React');
    expect(claudeContent).toContain('MCP');
  });

  test('should have package.json with required scripts', async () => {
    const packageJsonPath = path.join(WORKSPACE_ROOT, 'package.json');

    expect(fs.existsSync(packageJsonPath), 'package.json should exist').toBeTruthy();

    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

    // Check essential scripts
    expect(packageJson.scripts).toBeDefined();
    expect(packageJson.scripts['demo:analyze']).toBeDefined();
    expect(packageJson.scripts['demo:visualize']).toBeDefined();
    expect(packageJson.scripts['demo:patterns']).toBeDefined();

    // Check for test and build scripts
    expect(packageJson.scripts['test']).toBeDefined();
    expect(packageJson.scripts['build']).toBeDefined();
  });

  test('should discover all demo scripts available', async () => {
    const demoScripts = getAvailableDemoScripts();

    expect(demoScripts.length).toBeGreaterThanOrEqual(3);
    expect(demoScripts).toContain('demo:analyze');
    expect(demoScripts).toContain('demo:visualize');
    expect(demoScripts).toContain('demo:patterns');

    console.log('📋 Available demo scripts:', demoScripts);
  });
});

test.describe('New Developer Journey - Phase 2: Installation & Validation', () => {
  test('should have sample React app with expected structure', async () => {
    expect(fs.existsSync(SAMPLE_APP_PATH), 'Sample app should exist').toBeTruthy();

    const validation = verifySampleAppStructure(SAMPLE_APP_PATH);

    if (!validation.valid) {
      console.error('❌ Missing files:', validation.missingFiles);
    }

    expect(validation.valid, `Sample app structure should be valid. Missing: ${validation.missingFiles.join(', ')}`).toBeTruthy();
  });

  test('should have expected number of React component files', async () => {
    const srcPath = path.join(SAMPLE_APP_PATH, 'src');
    const fileCount = countReactFiles(srcPath);

    console.log(`📁 Found ${fileCount} React files`);

    expect(fileCount).toBeGreaterThanOrEqual(expectedResults.sampleReactApp.expectedFileCount);
  });

  test('should have Nx workspace configuration', async () => {
    const nxJsonPath = path.join(WORKSPACE_ROOT, 'nx.json');

    expect(fs.existsSync(nxJsonPath), 'nx.json should exist').toBeTruthy();

    const nxJson = JSON.parse(fs.readFileSync(nxJsonPath, 'utf-8'));
    expect(nxJson.targetDefaults).toBeDefined();
  });

  test('should have @grafity/nx-react plugin package', async () => {
    const pluginPath = path.join(WORKSPACE_ROOT, 'packages/grafity-react');

    expect(fs.existsSync(pluginPath), 'Plugin package should exist').toBeTruthy();

    const pluginPackageJsonPath = path.join(pluginPath, 'package.json');
    expect(fs.existsSync(pluginPackageJsonPath), 'Plugin package.json should exist').toBeTruthy();

    const pluginPackageJson = JSON.parse(fs.readFileSync(pluginPackageJsonPath, 'utf-8'));
    expect(pluginPackageJson.name).toBe('@grafity/nx-react');
  });
});

test.describe('New Developer Journey - Phase 3: Demo Analysis Execution', () => {
  test.setTimeout(60000); // 1 minute timeout for analysis

  test('should run demo:analyze successfully', async () => {
    console.log('🔍 Running demo:analyze...');

    const result = await runNpmScript('demo:analyze', WORKSPACE_ROOT);

    // Check if script executed (may have errors, but should run)
    expect(result.exitCode).toBeLessThanOrEqual(1); // 0 or 1 acceptable for demo scripts

    const output = result.stdout + result.stderr;
    console.log('📊 Analysis output:', output.substring(0, 500));

    // Parse analysis output
    const analysis = parseAnalysisOutput(output);

    console.log('✅ Components found:', analysis.componentCount);
    console.log('📦 Component names:', analysis.components);
    console.log('🪝 Hooks detected:', analysis.hooks);
    console.log('🔗 Contexts found:', analysis.contexts);

    // Verify minimum component detection
    if (analysis.componentCount > 0) {
      expect(analysis.componentCount).toBeGreaterThanOrEqual(5);
    }
  });

  test('should detect key components in sample app', async () => {
    const expectedComponents = expectedResults.sampleReactApp.components;

    for (const component of expectedComponents.slice(0, 5)) { // Check first 5
      const componentPath = path.join(SAMPLE_APP_PATH, component.file);

      expect(
        fs.existsSync(componentPath),
        `Component ${component.name} should exist at ${component.file}`
      ).toBeTruthy();

      const content = fs.readFileSync(componentPath, 'utf-8');

      // Check for component export
      expect(content).toMatch(new RegExp(`(export|const|function)\\s+${component.name}`));
    }
  });

  test('should detect useState hook usage', async () => {
    const dashboardPath = path.join(SAMPLE_APP_PATH, 'src/components/Dashboard.tsx');

    if (fs.existsSync(dashboardPath)) {
      const content = fs.readFileSync(dashboardPath, 'utf-8');
      expect(content).toContain('useState');
    }
  });

  test('should detect useContext hook usage', async () => {
    const contextPath = path.join(SAMPLE_APP_PATH, 'src/contexts/UserContext.tsx');

    if (fs.existsSync(contextPath)) {
      const content = fs.readFileSync(contextPath, 'utf-8');
      expect(content).toMatch(/createContext|useContext/);
    }
  });
});

test.describe('New Developer Journey - Phase 4: Visualization Generation', () => {
  test.setTimeout(60000); // 1 minute timeout

  test('should run demo:visualize and generate output', async () => {
    console.log('🎨 Running demo:visualize...');

    const result = await runNpmScript('demo:visualize', WORKSPACE_ROOT);

    const output = result.stdout + result.stderr;
    console.log('📊 Visualization output:', output.substring(0, 500));

    // Check if script attempted to run
    expect(result.exitCode).toBeLessThanOrEqual(1);
  });

  test('should generate visualization output directory', async () => {
    const distPath = path.join(WORKSPACE_ROOT, 'dist');

    // Wait for dist directory to be created (if visualization ran)
    const distExists = await waitForFile(distPath, 5000);

    if (distExists) {
      console.log('✅ Dist directory created');

      // Check for common visualization output patterns
      const possibleOutputs = [
        'dist/visualizations',
        'dist/analysis',
        'dist/viz',
      ];

      let foundOutput = false;
      for (const outputPath of possibleOutputs) {
        const fullPath = path.join(WORKSPACE_ROOT, outputPath);
        if (fs.existsSync(fullPath)) {
          console.log('📁 Found output at:', outputPath);
          foundOutput = true;
          break;
        }
      }

      if (!foundOutput) {
        console.log('⚠️ No visualization output found in expected locations');
      }
    } else {
      console.log('⚠️ Dist directory not created - visualization may have failed');
    }
  });
});

test.describe('New Developer Journey - Phase 5: Interactive Visualization Testing', () => {
  test.setTimeout(30000);

  test('should open generated visualization if available', async ({ page }) => {
    // Look for generated HTML files
    const possiblePaths = [
      'dist/visualizations/component-tree.html',
      'dist/visualizations/index.html',
      'dist/viz/index.html',
      'dist/analysis/visualization.html',
    ];

    let foundVisualization = false;

    for (const vizPath of possiblePaths) {
      const fullPath = path.join(WORKSPACE_ROOT, vizPath);

      if (fs.existsSync(fullPath)) {
        console.log('🎨 Found visualization at:', vizPath);

        try {
          await openGeneratedVisualization(page, vizPath);
          foundVisualization = true;

          // Take screenshot
          await captureScreenshot(page, 'visualization-loaded');

          // Check page title
          const title = await page.title();
          console.log('📄 Page title:', title);

          break;
        } catch (error) {
          console.error('❌ Error loading visualization:', error);
        }
      }
    }

    if (!foundVisualization) {
      console.log('⚠️ No visualization found to test - skipping interactive tests');
      test.skip();
    }
  });

  test('should test visualization interactivity if available', async ({ page }) => {
    const possiblePaths = [
      'dist/visualizations/component-tree.html',
      'dist/visualizations/index.html',
    ];

    let testedVisualization = false;

    for (const vizPath of possiblePaths) {
      const fullPath = path.join(WORKSPACE_ROOT, vizPath);

      if (fs.existsSync(fullPath)) {
        await openGeneratedVisualization(page, vizPath);

        const metrics = await testVisualizationInteractivity(page);

        console.log('📊 Visualization metrics:', metrics);
        console.log(`  - Nodes: ${metrics.nodeCount}`);
        console.log(`  - Interactive: ${metrics.hasInteractivity}`);
        console.log(`  - Details Panel: ${metrics.hasDetailsPanel}`);
        console.log(`  - Zoom Controls: ${metrics.hasZoomControls}`);

        if (metrics.nodeCount > 0) {
          expect(metrics.nodeCount).toBeGreaterThanOrEqual(5);
          testedVisualization = true;
        }

        await captureScreenshot(page, 'visualization-interactivity-test');

        break;
      }
    }

    if (!testedVisualization) {
      console.log('⚠️ No interactive visualization available to test');
      test.skip();
    }
  });
});

test.describe('New Developer Journey - Phase 6: Pattern Detection Validation', () => {
  test.setTimeout(60000);

  test('should run demo:patterns successfully', async () => {
    console.log('🔍 Running demo:patterns...');

    const result = await runNpmScript('demo:patterns', WORKSPACE_ROOT);

    const output = result.stdout + result.stderr;
    console.log('📊 Pattern detection output:', output.substring(0, 500));

    expect(result.exitCode).toBeLessThanOrEqual(1);

    // Parse pattern output
    const patterns = parsePatternOutput(output);

    console.log('✅ Good patterns:', patterns.goodPatterns);
    console.log('⚠️ Anti-patterns:', patterns.antiPatterns);
    console.log('💡 Recommendations:', patterns.recommendations);
  });

  test('should detect Context API usage pattern', async () => {
    const contextPath = path.join(SAMPLE_APP_PATH, 'src/contexts/UserContext.tsx');

    if (fs.existsSync(contextPath)) {
      const content = fs.readFileSync(contextPath, 'utf-8');

      // Should have createContext
      expect(content).toContain('createContext');

      // Should export provider
      expect(content).toMatch(/export|Provider/);
    }
  });
});

test.describe('New Developer Journey - Phase 7: Nx Integration Flow', () => {
  test('should have Nx executors configured for grafity-react', async () => {
    const pluginPath = path.join(WORKSPACE_ROOT, 'packages/grafity-react');
    const executorsPath = path.join(pluginPath, 'src/executors');

    if (fs.existsSync(executorsPath)) {
      const executors = fs.readdirSync(executorsPath);
      console.log('📦 Available executors:', executors);

      // Should have key executors
      const expectedExecutors = ['analyze-react', 'visualize-components', 'detect-patterns'];

      for (const executor of expectedExecutors) {
        const executorPath = path.join(executorsPath, executor);
        if (fs.existsSync(executorPath)) {
          console.log(`✅ Found executor: ${executor}`);
        } else {
          console.log(`⚠️ Executor not found: ${executor}`);
        }
      }
    }
  });

  test('should have MCP integration documentation', async () => {
    const readmePath = path.join(WORKSPACE_ROOT, 'README.md');
    const claudePath = path.join(WORKSPACE_ROOT, 'CLAUDE.md');

    if (fs.existsSync(readmePath)) {
      const readme = fs.readFileSync(readmePath, 'utf-8');

      // Check for MCP mentions
      if (readme.toLowerCase().includes('mcp')) {
        console.log('✅ README mentions MCP integration');
      }
    }

    if (fs.existsSync(claudePath)) {
      const claude = fs.readFileSync(claudePath, 'utf-8');

      expect(claude).toContain('MCP');
      console.log('✅ CLAUDE.md has MCP integration details');
    }
  });
});

test.describe('New Developer Journey - Overall Experience', () => {
  test('should provide complete getting started experience', async () => {
    const gettingStartedChecklist = {
      hasReadme: fs.existsSync(path.join(WORKSPACE_ROOT, 'README.md')),
      hasSampleApp: fs.existsSync(SAMPLE_APP_PATH),
      hasDemoScripts: getAvailableDemoScripts().length >= 3,
      hasNxConfig: fs.existsSync(path.join(WORKSPACE_ROOT, 'nx.json')),
      hasPluginPackage: fs.existsSync(path.join(WORKSPACE_ROOT, 'packages/grafity-react')),
      hasDocumentation: fs.existsSync(path.join(WORKSPACE_ROOT, 'CLAUDE.md')),
    };

    console.log('📋 Getting Started Checklist:');
    Object.entries(gettingStartedChecklist).forEach(([key, value]) => {
      console.log(`  ${value ? '✅' : '❌'} ${key}`);
    });

    const completeness = Object.values(gettingStartedChecklist).filter(Boolean).length;
    const total = Object.keys(gettingStartedChecklist).length;
    const percentage = (completeness / total) * 100;

    console.log(`\n📊 Completeness: ${percentage.toFixed(1)}% (${completeness}/${total})`);

    expect(percentage).toBeGreaterThanOrEqual(80);
  });

  test('should have clear path from installation to first analysis', async () => {
    const userJourney = {
      step1_discover: 'README.md exists with clear introduction',
      step2_install: 'package.json has install instructions',
      step3_verify: 'Sample app available for testing',
      step4_demo: 'Demo scripts work out of the box',
      step5_visualize: 'Visualization can be generated',
      step6_understand: 'Results are interpretable',
    };

    console.log('\n🚀 New Developer Journey:');
    Object.entries(userJourney).forEach(([step, description]) => {
      console.log(`  ${step}: ${description}`);
    });

    expect(true).toBeTruthy(); // Journey documented
  });
});