import { chromium, FullConfig } from '@playwright/test';
import { promises as fs } from 'fs';

async function globalTeardown(config: FullConfig) {
  console.log('🧹 Starting global E2E test teardown...');

  const browser = await chromium.launch();
  const context = await browser.newContext({
    storageState: 'tests/e2e/storageState.json'
  });
  const page = await context.newPage();

  try {
    // Clean up test data
    await cleanupTestData(page);

    // Clean up test user if in CI environment
    if (process.env.CI) {
      await cleanupTestUser(page);
    }

    console.log('✅ Test data cleaned up');

  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    // Don't throw error to avoid failing the test suite
  } finally {
    await browser.close();
  }

  try {
    // Remove authentication state file
    await fs.unlink('tests/e2e/storageState.json');
    console.log('✅ Authentication state cleaned up');
  } catch (error) {
    // File might not exist, ignore error
  }

  console.log('✅ Global E2E test teardown completed');
}

async function cleanupTestData(page: any) {
  try {
    // Navigate to projects page
    await page.goto('/projects');

    // Find and delete test projects
    const testProjectNames = [
      'E2E Test Project - React',
      'E2E Test Project - Vue'
    ];

    for (const projectName of testProjectNames) {
      try {
        // Find project by name
        const projectCard = page.locator(`[data-testid="project-card"]`, {
          has: page.locator('text=' + projectName)
        });

        if (await projectCard.count() > 0) {
          // Click delete button
          await projectCard.locator('[data-testid="delete-project-button"]').click();

          // Confirm deletion
          await page.click('[data-testid="confirm-delete-button"]');

          // Wait for deletion to complete
          await page.waitForSelector('[data-testid="project-deleted-success"]');

          console.log(`✅ Deleted test project: ${projectName}`);
        }
      } catch (error) {
        console.log(`ℹ️ Could not delete project ${projectName}: ${error.message}`);
      }
    }

    // Clean up any test analyses
    await cleanupTestAnalyses(page);

    // Clean up any test patterns
    await cleanupTestPatterns(page);

  } catch (error) {
    console.error('Error during test data cleanup:', error);
  }
}

async function cleanupTestAnalyses(page: any) {
  try {
    await page.goto('/analysis');

    // Delete any analyses created during tests
    const testAnalyses = page.locator('[data-testid="analysis-item"]', {
      has: page.locator('text=/E2E.*Test/')
    });

    const count = await testAnalyses.count();
    for (let i = 0; i < count; i++) {
      try {
        await testAnalyses.nth(i).locator('[data-testid="delete-analysis-button"]').click();
        await page.click('[data-testid="confirm-delete-button"]');
        await page.waitForTimeout(1000); // Wait for deletion
      } catch (error) {
        // Continue if individual deletion fails
      }
    }

    console.log(`✅ Cleaned up ${count} test analyses`);
  } catch (error) {
    console.log('ℹ️ Analysis cleanup skipped:', error.message);
  }
}

async function cleanupTestPatterns(page: any) {
  try {
    await page.goto('/patterns');

    // Delete any custom patterns created during tests
    const testPatterns = page.locator('[data-testid="pattern-item"]', {
      has: page.locator('text=/E2E.*Test/')
    });

    const count = await testPatterns.count();
    for (let i = 0; i < count; i++) {
      try {
        await testPatterns.nth(i).locator('[data-testid="delete-pattern-button"]').click();
        await page.click('[data-testid="confirm-delete-button"]');
        await page.waitForTimeout(1000); // Wait for deletion
      } catch (error) {
        // Continue if individual deletion fails
      }
    }

    console.log(`✅ Cleaned up ${count} test patterns`);
  } catch (error) {
    console.log('ℹ️ Pattern cleanup skipped:', error.message);
  }
}

async function cleanupTestUser(page: any) {
  try {
    // Navigate to user settings
    await page.goto('/settings');

    // Delete test user account
    await page.click('[data-testid="delete-account-button"]');

    // Confirm deletion
    await page.fill('[data-testid="confirm-username"]', 'e2e-test-user');
    await page.click('[data-testid="confirm-delete-account-button"]');

    console.log('✅ Test user account deleted');
  } catch (error) {
    console.log('ℹ️ Test user cleanup skipped:', error.message);
  }
}

export default globalTeardown;