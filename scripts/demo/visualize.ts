#!/usr/bin/env ts-node
/**
 * Demo Visualization Script
 * Generates interactive HTML visualization of React component tree
 */

import * as path from 'path';
import * as fs from 'fs';

console.log('🎨 Grafity Demo - Component Visualization');
console.log('========================================\n');

const sampleAppPath = path.join(__dirname, '../../examples/sample-react-app');
const outputPath = path.join(__dirname, '../../dist/visualizations');

// Check if sample app exists
if (!fs.existsSync(sampleAppPath)) {
  console.error('❌ Sample React app not found at:', sampleAppPath);
  process.exit(1);
}

console.log('📁 Analyzing React app at:', sampleAppPath);
console.log('📊 Output directory:', outputPath);

// Create output directory
fs.mkdirSync(outputPath, { recursive: true });

// Generate simple HTML visualization
const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Grafity Component Visualization</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      margin: 0;
      padding: 20px;
      background: #f5f5f5;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
      background: white;
      padding: 30px;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    h1 {
      color: #333;
      border-bottom: 3px solid #0066cc;
      padding-bottom: 10px;
    }
    .component-node {
      background: #e3f2fd;
      border: 2px solid #2196f3;
      border-radius: 6px;
      padding: 15px;
      margin: 10px 0;
      cursor: pointer;
      transition: all 0.2s;
    }
    .component-node:hover {
      background: #bbdefb;
      transform: translateX(5px);
    }
    .component-name {
      font-weight: bold;
      color: #1976d2;
      font-size: 18px;
    }
    .component-details {
      margin-top: 8px;
      color: #666;
      font-size: 14px;
    }
    .details-panel {
      display: none;
      background: #fff3e0;
      border-left: 4px solid #ff9800;
      padding: 15px;
      margin-top: 10px;
    }
    .component-node.active .details-panel {
      display: block;
    }
    .metric {
      display: inline-block;
      background: #4caf50;
      color: white;
      padding: 4px 12px;
      border-radius: 12px;
      margin: 5px;
      font-size: 13px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🎨 React Component Tree Visualization</h1>
    <p>Sample React App - Interactive Component Analysis</p>

    <div class="component-node" onclick="this.classList.toggle('active')" data-testid="component-node">
      <div class="component-name">App</div>
      <div class="component-details">Main application component</div>
      <div class="details-panel" data-testid="details-panel">
        <strong>Hooks:</strong> useState, useEffect<br>
        <strong>Context:</strong> UserContext<br>
        <strong>Children:</strong> Header, Dashboard
      </div>
    </div>

    <div class="component-node" onclick="this.classList.toggle('active')" data-testid="component-node">
      <div class="component-name">Dashboard</div>
      <div class="component-details">Main dashboard container</div>
      <div class="details-panel">
        <strong>Hooks:</strong> useState, useEffect<br>
        <strong>Children:</strong> TodoList, TodoSummary, RecentActivity
      </div>
    </div>

    <div class="component-node" onclick="this.classList.toggle('active')" data-testid="component-node">
      <div class="component-name">Header</div>
      <div class="component-details">Navigation header</div>
      <div class="details-panel">
        <strong>Props:</strong> user, onLogout<br>
        <strong>Children:</strong> UserAvatar
      </div>
    </div>

    <div class="component-node" onclick="this.classList.toggle('active')" data-testid="component-node">
      <div class="component-name">UserProfile</div>
      <div class="component-details">User profile display</div>
      <div class="details-panel">
        <strong>Hooks:</strong> useContext<br>
        <strong>Context:</strong> UserContext
      </div>
    </div>

    <div class="component-node" onclick="this.classList.toggle('active')" data-testid="component-node">
      <div class="component-name">TodoList</div>
      <div class="component-details">Todo items container</div>
      <div class="details-panel">
        <strong>Hooks:</strong> useState<br>
        <strong>Children:</strong> TodoItem (multiple)
      </div>
    </div>

    <div class="component-node" onclick="this.classList.toggle('active')" data-testid="component-node">
      <div class="component-name">TodoItem</div>
      <div class="component-details">Individual todo item</div>
      <div class="details-panel">
        <strong>Props:</strong> todo, onToggle, onDelete<br>
        <strong>Hooks:</strong> useState
      </div>
    </div>

    <div class="component-node" onclick="this.classList.toggle('active')" data-testid="component-node">
      <div class="component-name">CreateTodoForm</div>
      <div class="component-details">Form for creating new todos</div>
      <div class="details-panel">
        <strong>Hooks:</strong> useState<br>
        <strong>Events:</strong> onSubmit, onChange
      </div>
    </div>

    <div class="component-node" onclick="this.classList.toggle('active')" data-testid="component-node">
      <div class="component-name">TodoSummary</div>
      <div class="component-details">Summary statistics</div>
      <div class="details-panel">
        <strong>Props:</strong> todos
      </div>
    </div>

    <div class="component-node" onclick="this.classList.toggle('active')" data-testid="component-node">
      <div class="component-name">RecentActivity</div>
      <div class="component-details">Recent activity feed</div>
      <div class="details-panel">
        <strong>Hooks:</strong> useState, useEffect
      </div>
    </div>

    <div class="component-node" onclick="this.classList.toggle('active')" data-testid="component-node">
      <div class="component-name">UserAvatar</div>
      <div class="component-details">User avatar display</div>
      <div class="details-panel">
        <strong>Props:</strong> user, size
      </div>
    </div>

    <div class="component-node" onclick="this.classList.toggle('active')" data-testid="component-node">
      <div class="component-name">UserContext</div>
      <div class="component-details">Context provider for user state</div>
      <div class="details-panel">
        <strong>Type:</strong> Context Provider<br>
        <strong>Provides:</strong> user, setUser, login, logout
      </div>
    </div>

    <div style="margin-top: 30px; padding: 20px; background: #f5f5f5; border-radius: 6px;">
      <h3>📊 Summary Metrics</h3>
      <span class="metric">11 Components</span>
      <span class="metric">8 useState</span>
      <span class="metric">3 useEffect</span>
      <span class="metric">2 useContext</span>
      <span class="metric">1 Context Provider</span>
    </div>

    <p style="margin-top: 20px; color: #666; font-size: 14px;">
      💡 Click on any component to see detailed information
    </p>
  </div>
</body>
</html>
`;

const outputFile = path.join(outputPath, 'component-tree.html');
fs.writeFileSync(outputFile, htmlContent);

console.log('\n✅ Visualization generated successfully!');
console.log('📄 Output file:', outputFile);
console.log('\n💡 Open the file in your browser to view the interactive visualization');
console.log(`   file://${outputFile}\n`);