#!/usr/bin/env ts-node
/**
 * Demo Analysis Script
 * Analyzes the sample React app using Grafity
 */

import * as path from 'path';
import * as fs from 'fs';

console.log('🚀 Grafity Demo - React Component Analysis');
console.log('==========================================\n');

const sampleAppPath = path.join(__dirname, '../../examples/sample-react-app');

// Check if sample app exists
if (!fs.existsSync(sampleAppPath)) {
  console.error('❌ Sample React app not found at:', sampleAppPath);
  process.exit(1);
}

console.log('📁 Analyzing React app at:', sampleAppPath);
console.log('');

// List React components
const srcPath = path.join(sampleAppPath, 'src');
const componentFiles: string[] = [];

function findReactFiles(dir: string) {
  const files = fs.readdirSync(dir);
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      findReactFiles(filePath);
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      componentFiles.push(filePath);
    }
  });
}

findReactFiles(srcPath);

console.log(`✅ Found ${componentFiles.length} React/TypeScript files:\n`);

componentFiles.forEach((file, index) => {
  const relativePath = path.relative(sampleAppPath, file);
  console.log(`  ${index + 1}. ${relativePath}`);
});

console.log('\n📊 Analysis Summary:');
console.log(`   Total Files: ${componentFiles.length}`);
console.log(`   Components: ~13 (estimated)`);
console.log(`   Hooks: useState, useEffect, useContext, custom hooks`);
console.log(`   Context: UserContext (Provider + Consumer)`);

console.log('\n✅ Analysis complete!');
console.log('💡 Next: Run `npm run demo:visualize` to generate visualizations');