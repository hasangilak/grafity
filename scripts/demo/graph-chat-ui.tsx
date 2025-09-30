/**
 * React UI demo for graph-based chat
 */

import React, { useState, useCallback, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { GraphChatInterface } from '../../src/chat/ui/GraphChatInterface';
import { EnhancedConversationGraph } from '../../src/core/graph-engine/chat/EnhancedConversationGraph';
import { GraphStore } from '../../src/core/graph-engine/GraphStore';
import { ChatConversationNode } from '../../src/chat/models/ConversationNode';
import { MessageNode } from '../../src/chat/models/MessageNode';
import { ExtractedContext } from '../../src/chat/context/ContextExtractor';
import { CodeNode, createCodeNode } from '../../src/core/graph-engine/types/NodeTypes';

/**
 * Main demo application component
 */
function GraphChatDemo() {
  const [chatGraph, setChatGraph] = useState<EnhancedConversationGraph | null>(null);
  const [conversation, setConversation] = useState<ChatConversationNode | null>(null);
  const [currentContext, setCurrentContext] = useState<ExtractedContext | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Initialize graph and conversation
  useEffect(() => {
    initializeDemo();
  }, []);

  const initializeDemo = async () => {
    console.log('🚀 Initializing Graph Chat Demo...\n');

    // Create graph store and chat graph
    const store = new GraphStore();
    const graph = new EnhancedConversationGraph(store);

    // Add code nodes from sample React app
    const dashboardNode = createCodeNode({
      id: 'code-dashboard',
      filePath: 'examples/sample-react-app/src/components/Dashboard.tsx',
      label: 'Dashboard',
      description: 'Main dashboard component with hooks',
      metadata: {
        language: 'typescript',
        codeType: 'component',
        hooks: ['useState', 'useEffect']
      }
    });

    const todoListNode = createCodeNode({
      id: 'code-todolist',
      filePath: 'examples/sample-react-app/src/components/TodoList.tsx',
      label: 'TodoList',
      description: 'Todo list component',
      metadata: {
        language: 'typescript',
        codeType: 'component'
      }
    });

    store.addNode(dashboardNode);
    store.addNode(todoListNode);

    // Create conversation
    const conv = await graph.createConversation({
      title: 'Discussing React Component Architecture',
      participants: ['Developer', 'AI Assistant']
    });

    console.log(`✅ Created conversation: ${conv.label}`);

    // Add messages
    const msg1 = graph.addMessage(conv.id, {
      role: 'user',
      content: 'How does the Dashboard component work in our sample app?',
      metadata: { timestamp: new Date().toISOString() }
    });

    const msg2 = graph.addMessage(conv.id, {
      role: 'assistant',
      content: 'The Dashboard component (examples/sample-react-app/src/components/Dashboard.tsx) uses useState and useEffect hooks. It manages the main dashboard state and renders child components like TodoList and TodoSummary.',
      metadata: { timestamp: new Date().toISOString() }
    });

    // Link to code
    graph.linkToCode(msg2, 'examples/sample-react-app/src/components/Dashboard.tsx');
    graph.linkBidirectional(msg1, msg2, 'discusses', {
      topic: 'Dashboard component',
      strength: 0.9
    });

    const msg3 = graph.addMessage(conv.id, {
      role: 'user',
      content: 'What about the TodoList component?'
    });

    const msg4 = graph.addMessage(conv.id, {
      role: 'assistant',
      content: 'TodoList manages a collection of todo items with useState. It renders TodoItem components for each todo and handles CRUD operations.'
    });

    graph.linkToCode(msg4, 'examples/sample-react-app/src/components/TodoList.tsx');

    // Create branches
    const branch1Msg = graph.createBranch(msg2, {
      role: 'user',
      content: 'Tell me more about the hooks used in Dashboard...'
    });

    graph.addMessage(conv.id, {
      role: 'assistant',
      content: 'useState manages: todos, filter, loading state. useEffect handles: initial data fetch, updates on filter changes.'
    });

    // Create another branch
    graph.switchBranch(graph.getActiveBranchId() || `${conv.id}-main`);

    const branch2Msg = graph.createBranch(msg2, {
      role: 'user',
      content: 'What props does the Dashboard accept?'
    });

    graph.addMessage(conv.id, {
      role: 'assistant',
      content: 'Dashboard accepts: user (User object), onLogout (function), theme (string).'
    });

    console.log('✅ Demo data created successfully!\n');

    // Convert to ChatConversationNode format for GraphChatInterface
    const chatConv: ChatConversationNode = convertToConversation(store, conv.id, graph);

    setChatGraph(graph);
    setConversation(chatConv);
  };

  const handleSendMessage = useCallback(async (message: string) => {
    if (!chatGraph || !conversation) return;

    setIsLoading(true);

    try {
      // Add user message
      const messageId = chatGraph.addMessage(conversation.id, {
        role: 'user',
        content: message,
        metadata: { timestamp: new Date().toISOString() }
      });

      // Simulate AI response
      setTimeout(() => {
        chatGraph.addMessage(conversation.id, {
          role: 'assistant',
          content: `I understand you're asking about: "${message}". Let me help you with that...`,
          metadata: { timestamp: new Date().toISOString() }
        });

        // Refresh conversation
        const updatedConv = convertToConversation(
          chatGraph.store,
          conversation.id,
          chatGraph
        );
        setConversation(updatedConv);
        setIsLoading(false);
      }, 1000);
    } catch (error) {
      console.error('Error sending message:', error);
      setIsLoading(false);
    }
  }, [chatGraph, conversation]);

  const handleMessageClick = useCallback((messageId: string) => {
    console.log('Message clicked:', messageId);

    if (!chatGraph) return;

    // Build context for message
    const context = chatGraph.buildContext(messageId);
    const metadata = chatGraph.getMessageMetadata(messageId);

    console.log('Context:', context);
    console.log('Metadata:', metadata);

    // TODO: Convert to ExtractedContext format for ContextPanel
    // For now, just log it
  }, [chatGraph]);

  const handleNodeSelect = useCallback((nodeId: string) => {
    console.log('Node selected:', nodeId);
  }, []);

  if (!conversation || !chatGraph) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        fontSize: '18px',
        color: '#6b7280'
      }}>
        Loading Graph Chat Demo...
      </div>
    );
  }

  return (
    <GraphChatInterface
      conversation={conversation}
      chatGraph={chatGraph as any} // Type compatibility
      onSendMessage={handleSendMessage}
      onMessageClick={handleMessageClick}
      onNodeSelect={handleNodeSelect}
      currentContext={currentContext}
      isLoading={isLoading}
      suggestions={[
        'Explain the component lifecycle',
        'Show me the prop types',
        'What patterns are used here?'
      ]}
    />
  );
}

/**
 * Convert EnhancedConversationGraph data to ChatConversationNode format
 */
function convertToConversation(
  store: GraphStore,
  conversationId: string,
  graph: EnhancedConversationGraph
): ChatConversationNode {
  const convNode = store.getNode(conversationId);
  if (!convNode) throw new Error('Conversation not found');

  // Get all message nodes
  const edges = store.getAllEdges();
  const messageEdges = edges.filter(e =>
    e.source === conversationId &&
    e.type === 'relates_to' &&
    e.metadata?.relationship === 'contains'
  );

  const messages = new Map<string, MessageNode>();

  for (const edge of messageEdges) {
    const msgNode = store.getNode(edge.target);
    if (msgNode) {
      const metadata = graph.getMessageMetadata(msgNode.id);

      const messageNode: MessageNode = {
        id: msgNode.id,
        type: 'conversation',
        label: `Message from ${metadata?.role || 'unknown'}`,
        description: msgNode.description || '',
        content: graph.getMessageContent(msgNode.id),
        role: metadata?.role || 'user',
        startTime: metadata?.timestamp || new Date().toISOString(),
        endTime: metadata?.timestamp || new Date().toISOString(),
        parentMessageId: findParentMessage(store, msgNode.id),
        childMessageIds: findChildMessages(store, msgNode.id),
        messageIndex: messages.size + 1,
        branchId: metadata?.branch.id,
        metadata: {
          timestamp: metadata?.timestamp,
          branch: metadata?.branch.name,
          ...msgNode.metadata
        }
      };

      messages.set(msgNode.id, messageNode);
    }
  }

  // Get branches
  const branches = new Map();
  for (const branch of graph.getBranches()) {
    branches.set(branch.id, {
      id: branch.id,
      name: branch.id.split('-').pop() || 'main',
      parentMessageId: branch.parentMessageId,
      messageIds: branch.messages,
      createdAt: new Date(),
      isActive: branch.active
    });
  }

  return {
    id: conversationId,
    type: 'conversation',
    label: convNode.label,
    description: convNode.description || '',
    messages,
    branches,
    activeBranchId: graph.getActiveBranchId() || `${conversationId}-main`,
    participants: convNode.metadata?.participants || [],
    startTime: convNode.metadata?.createdAt?.toISOString() || new Date().toISOString(),
    endTime: new Date().toISOString(),
    metadata: convNode.metadata || {}
  };
}

/**
 * Find parent message ID
 */
function findParentMessage(store: GraphStore, messageId: string): string | undefined {
  const edges = store.getAllEdges();
  const parentEdge = edges.find(e =>
    e.target === messageId &&
    (e.type === 'follows' || e.type === 'responds' || e.type === 'responds_to')
  );
  return parentEdge?.source;
}

/**
 * Find child message IDs
 */
function findChildMessages(store: GraphStore, messageId: string): string[] {
  const edges = store.getAllEdges();
  const childEdges = edges.filter(e =>
    e.source === messageId &&
    (e.type === 'follows' || e.type === 'responds' || e.type === 'responds_to')
  );
  return childEdges.map(e => e.target);
}

/**
 * Render the demo
 */
const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <GraphChatDemo />
  </React.StrictMode>
);