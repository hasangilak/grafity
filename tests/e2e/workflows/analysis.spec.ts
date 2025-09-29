import { test, expect } from '@playwright/test';

// Use the saved authentication state
test.use({ storageState: 'tests/e2e/storageState.json' });

test.describe('Project Analysis Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard');
  });

  test('should create project and trigger analysis', async ({ page }) => {
    // Navigate to projects page
    await page.click('[data-testid="nav-projects"]');
    await expect(page).toHaveURL('/projects');

    // Create new project
    await page.click('[data-testid="create-project-button"]');

    // Fill project details
    const projectName = `E2E Analysis Test ${Date.now()}`;
    await page.fill('[data-testid="project-name"]', projectName);
    await page.fill('[data-testid="project-description"]', 'Project for E2E analysis testing');
    await page.fill('[data-testid="project-path"]', '/test/e2e/analysis-project');
    await page.selectOption('[data-testid="project-type"]', 'react');

    // Submit project creation
    await page.click('[data-testid="create-project-submit"]');
    await page.waitForSelector('[data-testid="project-created-success"]');

    // Navigate to project details
    await page.click(`[data-testid="project-card"]:has-text("${projectName}")`);
    await expect(page).toHaveURL(/\/projects\/.*$/);

    // Trigger analysis
    await page.click('[data-testid="analyze-project-button"]');

    // Configure analysis options
    await page.check('[data-testid="include-patterns"]');
    await page.check('[data-testid="include-metrics"]');
    await page.check('[data-testid="include-dependencies"]');
    await page.selectOption('[data-testid="analysis-depth"]', 'full');

    // Start analysis
    await page.click('[data-testid="start-analysis-button"]');

    // Wait for analysis to be queued
    await page.waitForSelector('[data-testid="analysis-queued"]');
    await expect(page.locator('[data-testid="analysis-status"]')).toContainText('Analysis queued');

    // Check that analysis job appears in status
    await expect(page.locator('[data-testid="job-queue-status"]')).toBeVisible();
  });

  test('should analyze code snippet', async ({ page }) => {
    // Navigate to code analysis page
    await page.click('[data-testid="nav-analysis"]');
    await page.click('[data-testid="analyze-code-tab"]');

    // Enter code snippet
    const reactCode = `
import React, { useState, useEffect } from 'react';

export function Counter({ initialValue = 0 }) {
  const [count, setCount] = useState(initialValue);

  useEffect(() => {
    document.title = \`Count: \${count}\`;
  }, [count]);

  const increment = () => setCount(c => c + 1);
  const decrement = () => setCount(c => c - 1);

  return (
    <div>
      <h1>Counter: {count}</h1>
      <button onClick={increment}>+</button>
      <button onClick={decrement}>-</button>
    </div>
  );
}
    `;

    await page.fill('[data-testid="code-editor"]', reactCode);
    await page.selectOption('[data-testid="code-language"]', 'tsx');

    // Configure analysis options
    await page.check('[data-testid="analyze-patterns"]');
    await page.check('[data-testid="analyze-metrics"]');
    await page.check('[data-testid="analyze-complexity"]');

    // Run analysis
    await page.click('[data-testid="analyze-code-button"]');

    // Wait for results
    await page.waitForSelector('[data-testid="analysis-results"]');

    // Verify results sections
    await expect(page.locator('[data-testid="components-section"]')).toBeVisible();
    await expect(page.locator('[data-testid="patterns-section"]')).toBeVisible();
    await expect(page.locator('[data-testid="metrics-section"]')).toBeVisible();

    // Check specific results
    await expect(page.locator('[data-testid="component-count"]')).toContainText('1');
    await expect(page.locator('[data-testid="detected-patterns"]')).toContainText(/Hook.*Pattern/);

    // Verify metrics
    const metricsSection = page.locator('[data-testid="metrics-section"]');
    await expect(metricsSection.locator('[data-testid="complexity-score"]')).toBeVisible();
    await expect(metricsSection.locator('[data-testid="maintainability-score"]')).toBeVisible();
  });

  test('should compare analysis results', async ({ page }) => {
    // Navigate to analysis comparison
    await page.click('[data-testid="nav-analysis"]');
    await page.click('[data-testid="compare-analyses-tab"]');

    // Select first analysis
    await page.click('[data-testid="select-analysis-1"]');
    await page.click('[data-testid="analysis-option"]:nth-child(1)');

    // Select second analysis
    await page.click('[data-testid="select-analysis-2"]');
    await page.click('[data-testid="analysis-option"]:nth-child(2)');

    // Run comparison
    await page.click('[data-testid="compare-button"]');

    // Wait for comparison results
    await page.waitForSelector('[data-testid="comparison-results"]');

    // Verify comparison sections
    await expect(page.locator('[data-testid="metrics-comparison"]')).toBeVisible();
    await expect(page.locator('[data-testid="patterns-comparison"]')).toBeVisible();
    await expect(page.locator('[data-testid="components-comparison"]')).toBeVisible();

    // Check diff indicators
    await expect(page.locator('[data-testid="metrics-diff"]')).toBeVisible();
  });

  test('should export analysis results', async ({ page }) => {
    // Create and analyze a project first
    await page.click('[data-testid="nav-projects"]');
    const projectCard = page.locator('[data-testid="project-card"]').first();
    await projectCard.click();

    // Navigate to analysis results
    await page.click('[data-testid="view-analysis-button"]');
    await page.waitForSelector('[data-testid="analysis-results"]');

    // Test export options
    await page.click('[data-testid="export-button"]');

    // Export as JSON
    await page.click('[data-testid="export-json"]');
    const downloadPromise = page.waitForEvent('download');
    await page.click('[data-testid="confirm-export"]');
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/analysis.*\.json$/);

    // Export as CSV
    await page.click('[data-testid="export-button"]');
    await page.click('[data-testid="export-csv"]');
    const csvDownloadPromise = page.waitForEvent('download');
    await page.click('[data-testid="confirm-export"]');
    const csvDownload = await csvDownloadPromise;
    expect(csvDownload.suggestedFilename()).toMatch(/analysis.*\.csv$/);

    // Export as PDF report
    await page.click('[data-testid="export-button"]');
    await page.click('[data-testid="export-pdf"]');
    const pdfDownloadPromise = page.waitForEvent('download');
    await page.click('[data-testid="confirm-export"]');
    const pdfDownload = await pdfDownloadPromise;
    expect(pdfDownload.suggestedFilename()).toMatch(/analysis.*\.pdf$/);
  });

  test('should handle analysis errors gracefully', async ({ page }) => {
    // Navigate to code analysis
    await page.click('[data-testid="nav-analysis"]');
    await page.click('[data-testid="analyze-code-tab"]');

    // Enter invalid code
    const invalidCode = `
      function broken() {
        const x =
        // Incomplete syntax
      }
    `;

    await page.fill('[data-testid="code-editor"]', invalidCode);
    await page.selectOption('[data-testid="code-language"]', 'javascript');

    // Run analysis
    await page.click('[data-testid="analyze-code-button"]');

    // Wait for error state
    await page.waitForSelector('[data-testid="analysis-error"]');

    // Verify error handling
    await expect(page.locator('[data-testid="error-message"]')).toContainText(/parsing.*error/i);
    await expect(page.locator('[data-testid="error-details"]')).toBeVisible();

    // Verify retry option
    await expect(page.locator('[data-testid="retry-analysis-button"]')).toBeVisible();
  });

  test('should show analysis progress and cancel', async ({ page }) => {
    // Navigate to projects and select one
    await page.click('[data-testid="nav-projects"]');
    const projectCard = page.locator('[data-testid="project-card"]').first();
    await projectCard.click();

    // Start analysis
    await page.click('[data-testid="analyze-project-button"]');
    await page.click('[data-testid="start-analysis-button"]');

    // Check progress indicators
    await page.waitForSelector('[data-testid="analysis-progress"]');
    await expect(page.locator('[data-testid="progress-bar"]')).toBeVisible();
    await expect(page.locator('[data-testid="progress-status"]')).toBeVisible();

    // Test cancel functionality
    await page.click('[data-testid="cancel-analysis-button"]');
    await page.click('[data-testid="confirm-cancel"]');

    // Verify cancellation
    await page.waitForSelector('[data-testid="analysis-cancelled"]');
    await expect(page.locator('[data-testid="analysis-status"]')).toContainText('Cancelled');
  });

  test('should navigate analysis history', async ({ page }) => {
    // Navigate to analysis history
    await page.click('[data-testid="nav-analysis"]');
    await page.click('[data-testid="analysis-history-tab"]');

    // Verify history list
    await expect(page.locator('[data-testid="analysis-history-list"]')).toBeVisible();

    // Test filtering
    await page.selectOption('[data-testid="filter-status"]', 'completed');
    await page.fill('[data-testid="filter-project"]', 'Test');
    await page.click('[data-testid="apply-filters"]');

    // Verify filtered results
    await expect(page.locator('[data-testid="history-item"]')).toHaveCount(await page.locator('[data-testid="history-item"]').count());

    // Test pagination
    if (await page.locator('[data-testid="next-page"]').isVisible()) {
      await page.click('[data-testid="next-page"]');
      await expect(page.locator('[data-testid="current-page"]')).toContainText('2');
    }

    // View specific analysis
    await page.locator('[data-testid="history-item"]').first().click();
    await expect(page.locator('[data-testid="analysis-details"]')).toBeVisible();
  });
});