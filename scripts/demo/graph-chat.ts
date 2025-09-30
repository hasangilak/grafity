#!/usr/bin/env ts-node
/**
 * Graph Chat Demo
 *
 * Demonstrates conversation as a visual graph with:
 * - Real-time message nodes
 * - Bidirectional connections
 * - Code/doc linking
 * - Conversation branching
 */

import { GraphStore } from '../../src/core/graph-engine/GraphStore';
import { EnhancedConversationGraph } from '../../src/core/graph-engine/chat/EnhancedConversationGraph';
import { HtmlGraphGenerator } from '../../src/core/graph-engine/visualization/HtmlGraphGenerator';
import { createCodeNode } from '../../src/core/graph-engine/types/NodeTypes';
import * as path from 'path';
import * as fs from 'fs';

async function runDemo() {
  console.log('🎨 Grafity Graph Chat Demo');
  console.log('===========================\n');

  // 1. Create graph store
  console.log('📊 Initializing graph store...');
  const store = new GraphStore();
  const chatGraph = new EnhancedConversationGraph(store);

  // 2. Add sample code nodes (from our React sample app)
  console.log('📦 Adding code nodes from sample React app...');

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
  console.log('💬 Creating sample conversation...\n');

  const conversation = await chatGraph.createConversation({
    title: 'Discussing React Component Architecture',
    participants: ['Developer', 'AI Assistant']
  });

  console.log(`✅ Created conversation: ${conversation.label}`);
  console.log(`   ID: ${conversation.id}\n`);

  // 4. Main conversation thread
  console.log('📝 Main Conversation Thread:\n');

  const msg1 = chatGraph.addMessage(conversation.id, {
    role: 'user',
    content: 'How does the Dashboard component work in our sample app?',
    metadata: { timestamp: '10:00 AM' }
  });
  console.log('   👤 User: "How does the Dashboard component work in our sample app?"');

  const msg2 = chatGraph.addMessage(conversation.id, {
    role: 'assistant',
    content: 'The Dashboard component (examples/sample-react-app/src/components/Dashboard.tsx) uses useState and useEffect hooks. It manages the main dashboard state and renders child components like TodoList and TodoSummary.',
    metadata: { timestamp: '10:00 AM' }
  });
  console.log('   🤖 AI: "The Dashboard component uses useState and useEffect hooks..."');

  // Link to code
  chatGraph.linkToCode(msg2, 'examples/sample-react-app/src/components/Dashboard.tsx');
  console.log('   🔗 Linked to Dashboard.tsx (bidirectional)\n');

  // Create bidirectional connection between messages
  chatGraph.linkBidirectional(msg1, msg2, 'discusses', {
    topic: 'Dashboard component',
    strength: 0.9
  });

  const msg3 = chatGraph.addMessage(conversation.id, {
    role: 'user',
    content: 'What about the TodoList component?'
  });
  console.log('   👤 User: "What about the TodoList component?"');

  const msg4 = chatGraph.addMessage(conversation.id, {
    role: 'assistant',
    content: 'TodoList manages a collection of todo items with useState. It renders TodoItem components for each todo and handles CRUD operations.'
  });
  console.log('   🤖 AI: "TodoList manages a collection of todo items..."\n');

  chatGraph.linkToCode(msg4, 'examples/sample-react-app/src/components/TodoList.tsx');

  // 5. Create branches
  console.log('🌳 Creating conversation branches:\n');

  // Branch 1: Explore hooks
  const branch1Msg = chatGraph.createBranch(msg2, {
    role: 'user',
    content: 'Tell me more about the hooks it uses - specifically useState and useEffect'
  });
  console.log('   ↗️  Branch 1 from msg2: "Tell me more about the hooks..."');

  chatGraph.addMessage(conversation.id, {
    role: 'assistant',
    content: 'useState manages: todos, filter, and loading states. useEffect handles: initial data fetch, todo updates, and filter changes.'
  });
  console.log('   🤖 AI: "useState manages: todos, filter..."');

  // Branch 2: Explore props
  const branch2Msg = chatGraph.createBranch(msg2, {
    role: 'user',
    content: 'What props does the Dashboard component accept?'
  });
  console.log('   ↗️  Branch 2 from msg2: "What props does the Dashboard accept?"');

  chatGraph.addMessage(conversation.id, {
    role: 'assistant',
    content: 'Dashboard accepts: user (User object) and onLogout (callback function).'
  });
  console.log('   🤖 AI: "Dashboard accepts: user (User object)..."\n');

  // 6. Create bidirectional topic connections
  chatGraph.linkBidirectional(msg2, msg4, 'relates_to', {
    topic: 'component relationships',
    strength: 0.7
  });

  // 7. Generate statistics
  const stats = store.getStatistics();
  console.log('📊 Graph Statistics:');
  console.log(`   Nodes: ${stats.totalNodes}`);
  console.log(`   Edges: ${stats.totalEdges}`);
  console.log(`   Bidirectional Edges: ${stats.bidirectionalEdges}`);
  console.log(`   Conversation Nodes: ${stats.nodesByType.conversation || 0}`);
  console.log(`   Code Nodes: ${stats.nodesByType.code || 0}\n`);

  // 8. Generate visualization
  console.log('🎨 Generating interactive graph visualization...');

  const outputDir = path.join(process.cwd(), 'dist/visualizations');
  fs.mkdirSync(outputDir, { recursive: true });

  const outputPath = path.join(outputDir, 'graph-chat-demo.html');
  const generator = new HtmlGraphGenerator(store);
  await generator.generateHtml(outputPath);

  console.log(`✅ Visualization generated: ${outputPath}\n`);

  // 9. Show branches
  const branches = chatGraph.getBranches();
  console.log('🌳 Conversation Branches:');
  for (const branch of branches) {
    console.log(`   - ${branch.id}: ${branch.messages.length} messages`);
    console.log(`     Branch point: ${branch.branchPoint}`);
    console.log(`     Active: ${branch.active ? '✅' : '❌'}`);
  }

  console.log('\n✅ Demo complete!');
  console.log('\n💡 Features demonstrated:');
  console.log('   ✓ Conversation as visual graph');
  console.log('   ✓ Bidirectional message connections');
  console.log('   ✓ Conversation branching (2 branches)');
  console.log('   ✓ Code linking (Dashboard.tsx, TodoList.tsx)');
  console.log('   ✓ Interactive navigation');
  console.log('   ✓ Topic-based relationships\n');

  console.log('🌐 Open the visualization:');
  console.log(`   file://${outputPath}`);
  console.log('\n   Or run: open ${outputPath}\n');
}

runDemo().catch(error => {
  console.error('❌ Error running demo:', error);
  process.exit(1);
});