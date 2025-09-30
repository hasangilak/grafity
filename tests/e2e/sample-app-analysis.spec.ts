import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

test.describe('Grafity Sample React App Analysis', () => {
  const sampleAppPath = path.join(__dirname, '../../examples/sample-react-app');
  const srcPath = path.join(sampleAppPath, 'src');

  test('should find all React component files', () => {
    expect(fs.existsSync(sampleAppPath)).toBeTruthy();
    expect(fs.existsSync(srcPath)).toBeTruthy();

    const componentFiles: string[] = [];

    function findFiles(dir: string) {
      const files = fs.readdirSync(dir);
      files.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
          findFiles(filePath);
        } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
          componentFiles.push(filePath);
        }
      });
    }

    findFiles(srcPath);

    expect(componentFiles.length).toBe(13);
  });

  test('should have expected component structure', () => {
    const componentsDir = path.join(srcPath, 'components');
    const contextDir = path.join(srcPath, 'contexts');
    const servicesDir = path.join(srcPath, 'services');

    expect(fs.existsSync(componentsDir)).toBeTruthy();
    expect(fs.existsSync(contextDir)).toBeTruthy();
    expect(fs.existsSync(servicesDir)).toBeTruthy();

    // Check for key components
    expect(fs.existsSync(path.join(componentsDir, 'Dashboard.tsx'))).toBeTruthy();
    expect(fs.existsSync(path.join(componentsDir, 'TodoList.tsx'))).toBeTruthy();
    expect(fs.existsSync(path.join(contextDir, 'UserContext.tsx'))).toBeTruthy();
  });

  test('should detect useState hook usage', () => {
    const dashboardPath = path.join(srcPath, 'components/Dashboard.tsx');
    const content = fs.readFileSync(dashboardPath, 'utf-8');

    expect(content).toContain('useState');
  });

  test('should detect useEffect hook usage', () => {
    const dashboardPath = path.join(srcPath, 'components/Dashboard.tsx');
    const content = fs.readFileSync(dashboardPath, 'utf-8');

    expect(content).toContain('useEffect');
  });

  test('should detect useContext hook usage', () => {
    const contextPath = path.join(srcPath, 'contexts/UserContext.tsx');
    const content = fs.readFileSync(contextPath, 'utf-8');

    // UserContext uses useContext internally
    expect(content).toContain('useContext');
  });

  test('should have UserContext provider', () => {
    const contextPath = path.join(srcPath, 'contexts/UserContext.tsx');
    const content = fs.readFileSync(contextPath, 'utf-8');

    expect(content).toContain('createContext');
    expect(content).toContain('UserContext');
  });

  test('should have API service', () => {
    const apiPath = path.join(srcPath, 'services/apiService.ts');
    const content = fs.readFileSync(apiPath, 'utf-8');

    expect(content).toContain('export');
  });
});

test.describe('Grafity Nx MCP Integration', () => {
  test('should have valid Nx workspace', () => {
    const nxJsonPath = path.join(__dirname, '../../nx.json');
    expect(fs.existsSync(nxJsonPath)).toBeTruthy();

    const nxJson = JSON.parse(fs.readFileSync(nxJsonPath, 'utf-8'));
    expect(nxJson.targetDefaults).toBeDefined();
  });

  test('should have grafity-react plugin package', () => {
    const pluginPath = path.join(__dirname, '../../packages/grafity-react');
    expect(fs.existsSync(pluginPath)).toBeTruthy();

    const packageJsonPath = path.join(pluginPath, 'package.json');
    expect(fs.existsSync(packageJsonPath)).toBeTruthy();

    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    expect(packageJson.name).toBe('@grafity/nx-react');
  });
});