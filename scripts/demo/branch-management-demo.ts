#!/usr/bin/env ts-node
/**
 * Branch Management Demo
 *
 * Demonstrates Task 013 features:
 * - Branch color coding and visual indicators
 * - Branch management (rename, merge, archive)
 * - Branch comparison
 * - Enhanced HTML visualization with branch legend
 */

import { GraphStore } from '../../src/core/graph-engine/GraphStore';
import { EnhancedConversationGraph } from '../../src/core/graph-engine/chat/EnhancedConversationGraph';
import { HtmlGraphGenerator } from '../../src/core/graph-engine/visualization/HtmlGraphGenerator';
import { createCodeNode } from '../../src/core/graph-engine/types/NodeTypes';
import * as path from 'path';
import * as fs from 'fs';

async function runDemo() {
  console.log('🎨 Grafity Branch Management Demo (Task 013)');
  console.log('==============================================\n');

  // 1. Create graph store
  console.log('📊 Initializing graph store...');
  const store = new GraphStore();
  const chatGraph = new EnhancedConversationGraph(store);

  // 2. Add sample code nodes
  console.log('📦 Adding code nodes from sample React app...\n');

  const dashboardNode = createCodeNode({
    id: 'code-dashboard',
    label: 'Dashboard',
    description: 'Main dashboard component',
    codeType: 'component',
    filePath: 'examples/sample-react-app/src/components/Dashboard.tsx',
    language: 'typescript',
    snippet: 'const Dashboard: React.FC = () => { ... }',
    metadata: {
      hooks: ['useState', 'useEffect'],
      complexity: 5
    }
  });

  const todoListNode = createCodeNode({
    id: 'code-todolist',
    label: 'TodoList',
    description: 'Todo list component',
    codeType: 'component',
    filePath: 'examples/sample-react-app/src/components/TodoList.tsx',
    language: 'typescript',
    metadata: {
      hooks: ['useState'],
      complexity: 3
    }
  });

  store.addNode(dashboardNode);
  store.addNode(todoListNode);

  // 3. Create conversation
  console.log('💬 Creating conversation with multiple branches...\n');

  const conversation = await chatGraph.createConversation({
    title: 'React Architecture Discussion',
    participants: ['Developer', 'AI Assistant']
  });

  console.log(`✅ Created conversation: ${conversation.label}`);
  console.log(`   Main branch: ${chatGraph.getActiveBranch()?.id}\n`);

  // 4. Main conversation thread
  console.log('📝 Main Branch:\n');

  const msg1 = chatGraph.addMessage(conversation.id, {
    role: 'user',
    content: 'Can you explain the Dashboard component architecture?',
    metadata: { timestamp: '10:00 AM' }
  });
  console.log('   👤 User: "Can you explain the Dashboard component architecture?"');

  const msg2 = chatGraph.addMessage(conversation.id, {
    role: 'assistant',
    content: 'The Dashboard uses useState and useEffect hooks. It manages state for todo items and renders child components.',
    metadata: { timestamp: '10:01 AM' }
  });
  console.log('   🤖 AI: "The Dashboard uses useState and useEffect hooks..."');
  chatGraph.linkToCode(msg2, 'examples/sample-react-app/src/components/Dashboard.tsx');

  const msg3 = chatGraph.addMessage(conversation.id, {
    role: 'user',
    content: 'What about performance optimization?',
    metadata: { timestamp: '10:02 AM' }
  });
  console.log('   👤 User: "What about performance optimization?"\n');

  // 5. Create Branch 1: Optimization Discussion
  console.log('🌿 Creating Branch 1: Optimization Discussion\n');

  const branch1Msg1 = chatGraph.createBranch(msg3, {
    role: 'assistant',
    content: 'For optimization, consider using React.memo() to prevent unnecessary re-renders of child components.',
    metadata: { timestamp: '10:03 AM' }
  }, 'Optimization Discussion');

  console.log(`   ✅ Branch created: ${chatGraph.branchStyleManager.getBranchStyle(chatGraph.getActiveBranch()?.id || '')?.name}`);
  console.log('   🤖 AI: "For optimization, consider using React.memo()..."');

  const branch1Msg2 = chatGraph.addMessage(conversation.id, {
    role: 'user',
    content: 'Can you show me an example?',
    metadata: { timestamp: '10:04 AM' }
  });
  console.log('   👤 User: "Can you show me an example?"');

  const branch1Msg3 = chatGraph.addMessage(conversation.id, {
    role: 'assistant',
    content: 'Sure! Wrap your TodoList component: export const TodoList = React.memo(({ todos }) => { ... });',
    metadata: { timestamp: '10:05 AM' }
  });
  console.log('   🤖 AI: "Sure! Wrap your TodoList component..."');
  chatGraph.linkToCode(branch1Msg3, 'examples/sample-react-app/src/components/TodoList.tsx');
  console.log('   🔗 Linked to TodoList.tsx\n');

  // 6. Switch back to main branch
  console.log('🔄 Switching back to main branch...\n');
  const mainBranchId = `${conversation.id}-main`;
  chatGraph.switchBranch(mainBranchId);

  // 7. Continue main branch
  const msg4 = chatGraph.addMessage(conversation.id, {
    role: 'assistant',
    content: 'The Dashboard also handles data fetching and error states.',
    metadata: { timestamp: '10:03 AM' }
  });
  console.log('   🤖 AI (Main Branch): "The Dashboard also handles data fetching..."\n');

  // 8. Create Branch 2: Error Handling
  console.log('🌿 Creating Branch 2: Error Handling\n');

  const branch2Msg1 = chatGraph.createBranch(msg4, {
    role: 'user',
    content: 'How should we handle errors in data fetching?',
    metadata: { timestamp: '10:06 AM' }
  }, 'Error Handling');

  console.log(`   ✅ Branch created: ${chatGraph.branchStyleManager.getBranchStyle(chatGraph.getActiveBranch()?.id || '')?.name}`);
  console.log('   👤 User: "How should we handle errors in data fetching?"');

  const branch2Msg2 = chatGraph.addMessage(conversation.id, {
    role: 'assistant',
    content: 'Use try-catch blocks in useEffect and display error messages to users. Consider using React Error Boundaries.',
    metadata: { timestamp: '10:07 AM' }
  });
  console.log('   🤖 AI: "Use try-catch blocks in useEffect..."\n');

  // 9. Display branch statistics
  console.log('📊 Branch Statistics:\n');
  const branches = chatGraph.getBranches();

  branches.forEach(branch => {
    const style = chatGraph.branchStyleManager.getBranchStyle(branch.id);
    console.log(`   ${style?.icon} ${style?.name || branch.id}`);
    console.log(`      Color: ${style?.color}`);
    console.log(`      Messages: ${branch.messages.length}`);
    console.log(`      Active: ${branch.active ? 'Yes' : 'No'}`);
    console.log('');
  });

  // 10. Test rename operation
  console.log('✏️  Testing rename operation...\n');
  const optimizationBranch = branches.find(b =>
    chatGraph.branchStyleManager.getBranchStyle(b.id)?.name === 'Optimization Discussion'
  );

  if (optimizationBranch) {
    chatGraph.renameBranch(optimizationBranch.id, 'Performance Best Practices');
    console.log(`   ✅ Renamed: "Optimization Discussion" → "Performance Best Practices"\n`);
  }

  // 11. Test branch comparison
  console.log('🔀 Testing branch comparison...\n');
  const mainBranch = chatGraph.getActiveBranch();
  const perfBranch = branches.find(b =>
    chatGraph.branchStyleManager.getBranchStyle(b.id)?.name === 'Performance Best Practices'
  );

  if (mainBranch && perfBranch) {
    const diff = chatGraph.getBranchDiff(mainBranch.id, perfBranch.id);
    console.log(`   Main Branch: ${mainBranch.messages.length} messages`);
    console.log(`   Performance Branch: ${perfBranch.messages.length} messages`);
    console.log(`   Divergence Point: ${diff.divergencePoint?.substring(0, 12)}...\n`);
  }

  // 12. Generate HTML visualization with branch colors
  console.log('🎨 Generating enhanced HTML visualization with branch colors...\n');

  const outputDir = path.join(process.cwd(), 'dist', 'visualizations');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const outputPath = path.join(outputDir, 'branch-management-demo.html');
  const htmlGenerator = new HtmlGraphGenerator(store, chatGraph.branchStyleManager);
  await htmlGenerator.generateHtml(outputPath);

  console.log(`   ✅ Visualization saved: ${outputPath}`);
  console.log('   📊 Features:');
  console.log('      - Branch color coding');
  console.log('      - Active branch highlighting (thicker stroke)');
  console.log('      - Branch legend');
  console.log('      - Branch info in tooltips');
  console.log('');

  // 13. Summary
  console.log('📈 Summary:\n');
  console.log(`   Total nodes: ${store.getStatistics().totalNodes}`);
  console.log(`   Total edges: ${store.getStatistics().totalEdges}`);
  console.log(`   Conversation branches: ${branches.length}`);
  console.log(`   Messages: ${branches.reduce((sum, b) => sum + b.messages.length, 0)}`);
  console.log('');

  console.log('✅ Demo complete! Open the HTML file to see branch visualization.\n');
  console.log(`   open ${outputPath}`);
  console.log('');

  // 14. Display color palette info
  console.log('🎨 Color Palettes Available:\n');
  const palettes = chatGraph.branchStyleManager.getAllPalettes();
  palettes.forEach(palette => {
    console.log(`   ${palette.name}`);
    console.log(`   ${palette.description}`);
    console.log(`   Colors: ${palette.colors.slice(0, 5).join(', ')} ...\n`);
  });

  console.log('💡 Try these operations:');
  console.log('   1. Rename branches: chatGraph.renameBranch(branchId, newName)');
  console.log('   2. Switch branches: chatGraph.switchBranch(branchId)');
  console.log('   3. Compare branches: chatGraph.getBranchDiff(branch1Id, branch2Id)');
  console.log('   4. Archive branches: chatGraph.archiveBranch(branchId)');
  console.log('   5. Change palette: chatGraph.branchStyleManager.setActivePalette("colorblind")');
  console.log('');
}

// Run the demo
runDemo().catch(error => {
  console.error('❌ Demo failed:', error);
  process.exit(1);
});
