import { chromium, FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting global E2E test setup...');

  // Start browser for authentication setup
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Navigate to login page
    await page.goto('/login');

    // Create test user if needed
    await setupTestUser(page);

    // Perform login and save authentication state
    await page.fill('[data-testid="username"]', 'e2e-test-user');
    await page.fill('[data-testid="password"]', 'e2e-test-password');
    await page.click('[data-testid="login-button"]');

    // Wait for successful login
    await page.waitForURL('/dashboard');

    // Save signed-in state to 'storageState.json'
    await context.storageState({ path: 'tests/e2e/storageState.json' });

    console.log('✅ Authentication state saved');

    // Setup test data
    await setupTestData(page);

    console.log('✅ Test data initialized');

  } catch (error) {
    console.error('❌ Global setup failed:', error);
    throw error;
  } finally {
    await browser.close();
  }

  console.log('✅ Global E2E test setup completed');
}

async function setupTestUser(page: any) {
  try {
    // Check if test user already exists
    const userExists = await checkUserExists('e2e-test-user');

    if (!userExists) {
      // Navigate to registration page
      await page.goto('/register');

      // Fill registration form
      await page.fill('[data-testid="username"]', 'e2e-test-user');
      await page.fill('[data-testid="email"]', 'e2e-test@example.com');
      await page.fill('[data-testid="password"]', 'e2e-test-password');
      await page.fill('[data-testid="confirm-password"]', 'e2e-test-password');

      // Submit registration
      await page.click('[data-testid="register-button"]');

      // Wait for success
      await page.waitForURL('/dashboard');

      console.log('✅ Test user created');
    } else {
      console.log('✅ Test user already exists');
    }
  } catch (error) {
    console.log('ℹ️ Test user setup skipped (may already exist)');
  }
}

async function setupTestData(page: any) {
  // Create test projects
  const testProjects = [
    {
      name: 'E2E Test Project - React',
      description: 'React project for E2E testing',
      path: '/test/e2e/react-project',
      type: 'react'
    },
    {
      name: 'E2E Test Project - Vue',
      description: 'Vue project for E2E testing',
      path: '/test/e2e/vue-project',
      type: 'vue'
    }
  ];

  for (const project of testProjects) {
    try {
      // Navigate to projects page
      await page.goto('/projects');

      // Click create project button
      await page.click('[data-testid="create-project-button"]');

      // Fill project form
      await page.fill('[data-testid="project-name"]', project.name);
      await page.fill('[data-testid="project-description"]', project.description);
      await page.fill('[data-testid="project-path"]', project.path);
      await page.selectOption('[data-testid="project-type"]', project.type);

      // Submit form
      await page.click('[data-testid="create-project-submit"]');

      // Wait for success
      await page.waitForSelector('[data-testid="project-created-success"]');

      console.log(`✅ Created test project: ${project.name}`);
    } catch (error) {
      console.log(`ℹ️ Skipped creating project ${project.name} (may already exist)`);
    }
  }
}

async function checkUserExists(username: string): Promise<boolean> {
  // This would typically make an API call to check if user exists
  // For now, we'll assume false to allow setup
  return false;
}

export default globalSetup;