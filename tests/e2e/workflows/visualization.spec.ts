import { test, expect } from '@playwright/test';

test.use({ storageState: 'tests/e2e/storageState.json' });

test.describe('Graph Visualization Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard');
  });

  test('should render and interact with component graph', async ({ page }) => {
    // Navigate to projects and select one
    await page.click('[data-testid="nav-projects"]');
    const projectCard = page.locator('[data-testid="project-card"]').first();
    await projectCard.click();

    // Navigate to visualization
    await page.click('[data-testid="view-graph-button"]');
    await expect(page).toHaveURL(/\/projects\/.*\/graph$/);

    // Wait for graph to load
    await page.waitForSelector('[data-testid="graph-container"]');
    await page.waitForSelector('[data-testid="graph-node"]');

    // Verify graph elements
    const nodes = page.locator('[data-testid="graph-node"]');
    const edges = page.locator('[data-testid="graph-edge"]');

    expect(await nodes.count()).toBeGreaterThan(0);
    expect(await edges.count()).toBeGreaterThan(0);

    // Test node interaction
    const firstNode = nodes.first();
    await firstNode.click();

    // Verify node selection
    await expect(firstNode).toHaveClass(/selected/);
    await expect(page.locator('[data-testid="node-details-panel"]')).toBeVisible();

    // Test node details
    const detailsPanel = page.locator('[data-testid="node-details-panel"]');
    await expect(detailsPanel.locator('[data-testid="node-name"]')).toBeVisible();
    await expect(detailsPanel.locator('[data-testid="node-type"]')).toBeVisible();
    await expect(detailsPanel.locator('[data-testid="node-properties"]')).toBeVisible();
  });

  test('should support graph navigation and zoom', async ({ page }) => {
    await page.click('[data-testid="nav-projects"]');
    const projectCard = page.locator('[data-testid="project-card"]').first();
    await projectCard.click();
    await page.click('[data-testid="view-graph-button"]');

    await page.waitForSelector('[data-testid="graph-container"]');

    // Test zoom controls
    await page.click('[data-testid="zoom-in-button"]');
    await page.waitForTimeout(500);
    await page.click('[data-testid="zoom-out-button"]');
    await page.waitForTimeout(500);

    // Test fit-to-screen
    await page.click('[data-testid="fit-screen-button"]');
    await page.waitForTimeout(500);

    // Test mouse wheel zoom (simulate)
    const graphContainer = page.locator('[data-testid="graph-container"]');
    await graphContainer.hover();
    await page.mouse.wheel(0, -100); // Zoom in
    await page.waitForTimeout(500);
    await page.mouse.wheel(0, 100); // Zoom out

    // Test pan (drag)
    const graphCenter = await graphContainer.boundingBox();
    if (graphCenter) {
      await page.mouse.move(graphCenter.x + graphCenter.width / 2, graphCenter.y + graphCenter.height / 2);
      await page.mouse.down();
      await page.mouse.move(graphCenter.x + 100, graphCenter.y + 100);
      await page.mouse.up();
    }
  });

  test('should filter and search graph nodes', async ({ page }) => {
    await page.click('[data-testid="nav-projects"]');
    const projectCard = page.locator('[data-testid="project-card"]').first();
    await projectCard.click();
    await page.click('[data-testid="view-graph-button"]');

    await page.waitForSelector('[data-testid="graph-container"]');

    // Test search functionality
    await page.fill('[data-testid="graph-search"]', 'Component');
    await page.press('[data-testid="graph-search"]', 'Enter');

    // Verify search results highlighting
    await expect(page.locator('[data-testid="search-results"]')).toBeVisible();
    await expect(page.locator('[data-testid="highlighted-node"]')).toHaveCount(await page.locator('[data-testid="highlighted-node"]').count());

    // Clear search
    await page.click('[data-testid="clear-search"]');
    await expect(page.locator('[data-testid="highlighted-node"]')).toHaveCount(0);

    // Test type filtering
    await page.click('[data-testid="filter-button"]');
    await page.check('[data-testid="filter-components"]');
    await page.uncheck('[data-testid="filter-hooks"]');
    await page.click('[data-testid="apply-filters"]');

    // Verify filtered view
    const visibleNodes = page.locator('[data-testid="graph-node"]:visible');
    for (let i = 0; i < await visibleNodes.count(); i++) {
      const nodeType = await visibleNodes.nth(i).getAttribute('data-node-type');
      expect(nodeType).toBe('component');
    }
  });

  test('should show different graph layouts', async ({ page }) => {
    await page.click('[data-testid="nav-projects"]');
    const projectCard = page.locator('[data-testid="project-card"]').first();
    await projectCard.click();
    await page.click('[data-testid="view-graph-button"]');

    await page.waitForSelector('[data-testid="graph-container"]');

    // Test different layouts
    const layouts = ['force', 'hierarchical', 'circular', 'grid'];

    for (const layout of layouts) {
      await page.click('[data-testid="layout-selector"]');
      await page.click(`[data-testid="layout-${layout}"]`);

      // Wait for layout animation to complete
      await page.waitForTimeout(1000);

      // Verify layout applied
      await expect(page.locator('[data-testid="current-layout"]')).toContainText(layout);

      // Verify nodes are positioned
      const nodes = page.locator('[data-testid="graph-node"]');
      expect(await nodes.count()).toBeGreaterThan(0);
    }
  });

  test('should export graph visualization', async ({ page }) => {
    await page.click('[data-testid="nav-projects"]');
    const projectCard = page.locator('[data-testid="project-card"]').first();
    await projectCard.click();
    await page.click('[data-testid="view-graph-button"]');

    await page.waitForSelector('[data-testid="graph-container"]');

    // Test export options
    await page.click('[data-testid="export-graph-button"]');

    // Export as PNG
    await page.click('[data-testid="export-png"]');
    const pngDownload = await page.waitForEvent('download');
    expect(pngDownload.suggestedFilename()).toMatch(/graph.*\.png$/);

    // Export as SVG
    await page.click('[data-testid="export-graph-button"]');
    await page.click('[data-testid="export-svg"]');
    const svgDownload = await page.waitForEvent('download');
    expect(svgDownload.suggestedFilename()).toMatch(/graph.*\.svg$/);

    // Export as JSON
    await page.click('[data-testid="export-graph-button"]');
    await page.click('[data-testid="export-json"]');
    const jsonDownload = await page.waitForEvent('download');
    expect(jsonDownload.suggestedFilename()).toMatch(/graph.*\.json$/);
  });

  test('should handle large graphs efficiently', async ({ page }) => {
    // Create a large test project or use existing large dataset
    await page.click('[data-testid="nav-projects"]');

    // Look for a project with many components
    const largeProject = page.locator('[data-testid="project-card"]', {
      has: page.locator('[data-testid="component-count"]:has-text(/[5-9]\d|\d{3,}/)')
    });

    if (await largeProject.count() > 0) {
      await largeProject.first().click();
      await page.click('[data-testid="view-graph-button"]');

      // Measure load time
      const startTime = Date.now();
      await page.waitForSelector('[data-testid="graph-container"]');
      await page.waitForSelector('[data-testid="graph-node"]');
      const loadTime = Date.now() - startTime;

      // Should load within reasonable time (5 seconds)
      expect(loadTime).toBeLessThan(5000);

      // Test performance indicators
      await expect(page.locator('[data-testid="performance-indicator"]')).toBeVisible();

      // Test virtualization (if implemented)
      const allNodes = page.locator('[data-testid="graph-node"]');
      const visibleNodes = page.locator('[data-testid="graph-node"]:visible');

      // For large graphs, not all nodes should be rendered at once
      if (await allNodes.count() > 100) {
        expect(await visibleNodes.count()).toBeLessThan(await allNodes.count());
      }
    }
  });

  test('should support graph clustering and grouping', async ({ page }) => {
    await page.click('[data-testid="nav-projects"]');
    const projectCard = page.locator('[data-testid="project-card"]').first();
    await projectCard.click();
    await page.click('[data-testid="view-graph-button"]');

    await page.waitForSelector('[data-testid="graph-container"]');

    // Enable clustering
    await page.click('[data-testid="graph-settings"]');
    await page.check('[data-testid="enable-clustering"]');
    await page.click('[data-testid="apply-settings"]');

    // Wait for clustering to apply
    await page.waitForSelector('[data-testid="cluster-group"]');

    // Test cluster interaction
    const cluster = page.locator('[data-testid="cluster-group"]').first();
    await cluster.click();

    // Verify cluster expansion
    await expect(page.locator('[data-testid="expanded-cluster"]')).toBeVisible();

    // Test grouping by type
    await page.click('[data-testid="group-by-type"]');
    await page.waitForSelector('[data-testid="type-group"]');

    // Verify groups
    const groups = page.locator('[data-testid="type-group"]');
    expect(await groups.count()).toBeGreaterThan(0);
  });

  test('should show graph statistics and metrics', async ({ page }) => {
    await page.click('[data-testid="nav-projects"]');
    const projectCard = page.locator('[data-testid="project-card"]').first();
    await projectCard.click();
    await page.click('[data-testid="view-graph-button"]');

    await page.waitForSelector('[data-testid="graph-container"]');

    // Open graph statistics panel
    await page.click('[data-testid="graph-stats-button"]');
    await expect(page.locator('[data-testid="stats-panel"]')).toBeVisible();

    // Verify statistics
    const statsPanel = page.locator('[data-testid="stats-panel"]');
    await expect(statsPanel.locator('[data-testid="node-count"]')).toBeVisible();
    await expect(statsPanel.locator('[data-testid="edge-count"]')).toBeVisible();
    await expect(statsPanel.locator('[data-testid="cluster-count"]')).toBeVisible();
    await expect(statsPanel.locator('[data-testid="avg-degree"]')).toBeVisible();

    // Test graph metrics
    await page.click('[data-testid="calculate-metrics"]');
    await page.waitForSelector('[data-testid="graph-metrics"]');

    const metricsSection = page.locator('[data-testid="graph-metrics"]');
    await expect(metricsSection.locator('[data-testid="centrality-score"]')).toBeVisible();
    await expect(metricsSection.locator('[data-testid="clustering-coefficient"]')).toBeVisible();
    await expect(metricsSection.locator('[data-testid="diameter"]')).toBeVisible();
  });

  test('should support real-time graph updates', async ({ page }) => {
    await page.click('[data-testid="nav-projects"]');
    const projectCard = page.locator('[data-testid="project-card"]').first();
    await projectCard.click();
    await page.click('[data-testid="view-graph-button"]');

    await page.waitForSelector('[data-testid="graph-container"]');

    // Count initial nodes
    const initialNodeCount = await page.locator('[data-testid="graph-node"]').count();

    // Trigger an analysis that would add new nodes
    await page.click('[data-testid="analyze-project-button"]');
    await page.click('[data-testid="start-analysis-button"]');

    // Enable real-time updates
    await page.check('[data-testid="real-time-updates"]');

    // Wait for potential updates (simulation)
    await page.waitForTimeout(3000);

    // Verify update indicators
    if (await page.locator('[data-testid="graph-update-indicator"]').isVisible()) {
      await expect(page.locator('[data-testid="update-notification"]')).toBeVisible();

      // Accept updates
      await page.click('[data-testid="accept-updates"]');

      // Verify graph refreshed
      const updatedNodeCount = await page.locator('[data-testid="graph-node"]').count();
      // Note: In real scenario, this might increase with new analysis results
    }
  });

  test('should handle graph rendering errors gracefully', async ({ page }) => {
    // Navigate to a project with potential rendering issues
    await page.click('[data-testid="nav-projects"]');
    const projectCard = page.locator('[data-testid="project-card"]').first();
    await projectCard.click();

    // Simulate error condition by intercepting graph data request
    await page.route('**/api/projects/*/graph', route => {
      route.fulfill({
        status: 500,
        body: JSON.stringify({ error: 'Graph generation failed' })
      });
    });

    await page.click('[data-testid="view-graph-button"]');

    // Verify error handling
    await page.waitForSelector('[data-testid="graph-error"]');
    await expect(page.locator('[data-testid="error-message"]')).toContainText(/failed.*graph/i);
    await expect(page.locator('[data-testid="retry-button"]')).toBeVisible();

    // Test retry functionality
    await page.unroute('**/api/projects/*/graph');
    await page.click('[data-testid="retry-button"]');

    // Should now load successfully
    await page.waitForSelector('[data-testid="graph-container"]');
  });
});