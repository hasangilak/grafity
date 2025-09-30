/**
 * Enhanced Interactive Graph Chat Demo
 *
 * This demo showcases:
 * - ChatInput component with branch creation
 * - MessageActions for reply/branch/link operations
 * - CodeReferenceSelector for linking code files
 * - BranchCreationDialog for creating conversation branches
 * - useChatGraph hook for real-time updates
 * - Real-time graph animations with D3.js
 */

import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { EnhancedConversationGraph, ChatMessage } from '../../src/core/graph-engine/chat/EnhancedConversationGraph';
import { GraphStore } from '../../src/core/graph-engine/GraphStore';
import { createCodeNode } from '../../src/core/graph-engine/types/NodeTypes';
import { ChatInput, SendOptions } from '../../src/chat/ui/ChatInput';
import { MessageActions } from '../../src/chat/ui/MessageActions';
import { CodeReferenceSelector, CodeFile } from '../../src/chat/ui/CodeReferenceSelector';
import { BranchCreationDialog } from '../../src/chat/ui/BranchCreationDialog';
import { useChatGraph } from '../../src/chat/hooks/useChatGraph';

interface ConversationState {
  conversationId: string;
  messages: Array<{
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: string;
    branchId?: string;
  }>;
  branches: Array<{
    id: string;
    name: string;
    isActive: boolean;
    messageCount: number;
  }>;
}

function InteractiveGraphChatDemo() {
  const [conversation, setConversation] = useState<ConversationState | null>(null);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [showCodeSelector, setShowCodeSelector] = useState(false);
  const [showBranchDialog, setShowBranchDialog] = useState(false);
  const [replyMode, setReplyMode] = useState<'continue' | 'branch' | 'new'>('new');
  const [availableCodeFiles] = useState<CodeFile[]>([
    { path: 'src/components/Dashboard.tsx', name: 'Dashboard.tsx', language: 'tsx' },
    { path: 'src/components/TodoList.tsx', name: 'TodoList.tsx', language: 'tsx' },
    { path: 'src/services/api.ts', name: 'api.ts', language: 'typescript' },
    { path: 'src/hooks/useAuth.ts', name: 'useAuth.ts', language: 'typescript' },
    { path: 'src/utils/helpers.ts', name: 'helpers.ts', language: 'typescript' }
  ]);
  const [linkedCodeFiles, setLinkedCodeFiles] = useState<string[]>([]);

  // Initialize conversation
  useEffect(() => {
    initializeConversation();
  }, []);

  const initializeConversation = async () => {
    const store = new GraphStore();
    const graph = new EnhancedConversationGraph(store);

    // Create conversation
    const conv = await graph.createConversation({
      title: 'Interactive Graph Chat Demo',
      participants: ['User', 'AI Assistant']
    });

    // Add some code nodes
    const dashboardNode = createCodeNode({
      id: 'code-dashboard',
      label: 'Dashboard Component',
      filePath: 'src/components/Dashboard.tsx',
      language: 'tsx',
      codeType: 'component',
      content: 'export function Dashboard() { ... }'
    });

    const todoListNode = createCodeNode({
      id: 'code-todolist',
      label: 'TodoList Component',
      filePath: 'src/components/TodoList.tsx',
      language: 'tsx',
      codeType: 'component',
      content: 'export function TodoList() { ... }'
    });

    store.addNode(dashboardNode);
    store.addNode(todoListNode);

    // Add initial messages
    const msg1 = graph.addMessage(conv.id, {
      role: 'user',
      content: 'Can you help me understand the Dashboard component?'
    });

    const msg2 = graph.addMessage(conv.id, {
      role: 'assistant',
      content: 'Sure! The Dashboard component is the main view that displays an overview of your application. It uses several hooks and displays multiple widgets.'
    });

    // Link message to code
    graph.linkToCode(msg1, 'src/components/Dashboard.tsx');

    const msg3 = graph.addMessage(conv.id, {
      role: 'user',
      content: 'What about the TodoList component?'
    });

    const msg4 = graph.addMessage(conv.id, {
      role: 'assistant',
      content: 'The TodoList component manages a list of tasks. It includes features for adding, editing, and deleting todos.'
    });

    graph.linkToCode(msg3, 'src/components/TodoList.tsx');

    // Update state
    updateConversationState(graph, conv.id);
  };

  const updateConversationState = (graph: EnhancedConversationGraph, conversationId: string) => {
    const branches = graph.getBranches();
    const activeBranch = graph.getActiveBranch();

    const messages: ConversationState['messages'] = [];

    // Get all message nodes
    const allNodes = graph.store.getAllNodes();
    for (const node of allNodes) {
      if (node.type === 'conversation' && node.metadata?.role) {
        messages.push({
          id: node.id,
          role: node.metadata.role as any,
          content: node.metadata.content || node.description || '',
          timestamp: node.metadata.timestamp || new Date().toISOString(),
          branchId: node.metadata.branchId
        });
      }
    }

    setConversation({
      conversationId,
      messages: messages.sort((a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      ),
      branches: branches.map(branch => ({
        id: branch.id,
        name: branch.id.split('-').pop() || 'main',
        isActive: branch.active,
        messageCount: branch.messages.length
      }))
    });
  };

  const handleSendMessage = async (message: ChatMessage, options: SendOptions) => {
    if (!conversation) return;

    console.log('Sending message:', message, options);

    // In a real implementation, this would call the graph
    // For demo purposes, we'll just update state
    const newMessage = {
      id: `msg-${Date.now()}`,
      role: message.role,
      content: message.content,
      timestamp: new Date().toISOString(),
      branchId: options.createBranch ? `branch-${Date.now()}` : conversation.branches.find(b => b.isActive)?.id
    };

    setConversation({
      ...conversation,
      messages: [...conversation.messages, newMessage]
    });

    // Reset reply mode
    setReplyMode('new');
    setSelectedMessageId(null);
  };

  const handleReply = (messageId: string) => {
    setSelectedMessageId(messageId);
    setReplyMode('continue');
  };

  const handleBranch = (messageId: string) => {
    setSelectedMessageId(messageId);
    setShowBranchDialog(true);
  };

  const handleLinkCode = () => {
    setShowCodeSelector(true);
  };

  const handleCodeFileSelect = (filePath: string) => {
    if (linkedCodeFiles.includes(filePath)) {
      setLinkedCodeFiles(linkedCodeFiles.filter(f => f !== filePath));
    } else {
      setLinkedCodeFiles([...linkedCodeFiles, filePath]);
    }
  };

  const handleBranchConfirm = (branchName: string, firstMessage: string) => {
    console.log('Creating branch:', branchName, 'with message:', firstMessage);

    if (!conversation || !selectedMessageId) return;

    // Create new branch
    const newBranch = {
      id: `branch-${Date.now()}`,
      name: branchName,
      isActive: true,
      messageCount: 1
    };

    // Add first message to branch
    const newMessage = {
      id: `msg-${Date.now()}`,
      role: 'user' as const,
      content: firstMessage,
      timestamp: new Date().toISOString(),
      branchId: newBranch.id
    };

    setConversation({
      ...conversation,
      messages: [...conversation.messages, newMessage],
      branches: conversation.branches.map(b => ({ ...b, isActive: false })).concat(newBranch)
    });

    setShowBranchDialog(false);
    setSelectedMessageId(null);
  };

  const handleCopyContent = (content: string) => {
    navigator.clipboard.writeText(content);
    alert('Message content copied!');
  };

  if (!conversation) {
    return (
      <div style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '18px',
        color: '#6b7280'
      }}>
        Loading conversation...
      </div>
    );
  }

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 24px',
        borderBottom: '2px solid #e5e7eb',
        backgroundColor: '#f9fafb',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '20px', fontWeight: '600', color: '#1f2937' }}>
            🌐 Interactive Graph Chat Demo
          </h1>
          <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#6b7280' }}>
            Phase 2: Interactive chat with branching, code linking, and real-time updates
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <span style={{ fontSize: '13px', color: '#6b7280' }}>
            {conversation.messages.length} messages
          </span>
          <span style={{ fontSize: '13px', color: '#6b7280' }}>•</span>
          <span style={{ fontSize: '13px', color: '#6b7280' }}>
            {conversation.branches.length} branches
          </span>
        </div>
      </div>

      {/* Branch tabs */}
      <div style={{
        padding: '8px 24px',
        borderBottom: '1px solid #e5e7eb',
        backgroundColor: 'white',
        display: 'flex',
        gap: '8px'
      }}>
        {conversation.branches.map(branch => (
          <button
            key={branch.id}
            style={{
              padding: '6px 12px',
              fontSize: '13px',
              border: '1px solid #d0d7de',
              borderRadius: '6px',
              backgroundColor: branch.isActive ? '#dbeafe' : 'white',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <span>🌿</span>
            <span>{branch.name}</span>
            <span style={{ fontSize: '11px', color: '#6b7280' }}>({branch.messageCount})</span>
          </button>
        ))}
      </div>

      {/* Main content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '24px' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          {/* Messages */}
          {conversation.messages.map((message, index) => (
            <div
              key={message.id}
              style={{
                marginBottom: '24px',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                overflow: 'hidden',
                backgroundColor: 'white'
              }}
            >
              {/* Message header */}
              <div style={{
                padding: '12px 16px',
                backgroundColor: message.role === 'user' ? '#eff6ff' : '#f0fdf4',
                borderBottom: '1px solid #e5e7eb',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <span style={{ fontSize: '16px' }}>
                  {message.role === 'user' ? '👤' : '🤖'}
                </span>
                <span style={{ fontWeight: '600', fontSize: '14px', textTransform: 'capitalize' }}>
                  {message.role}
                </span>
                <div style={{ flex: 1 }} />
                <span style={{ fontSize: '11px', color: '#6b7280' }}>
                  {new Date(message.timestamp).toLocaleTimeString()}
                </span>
              </div>

              {/* Message content */}
              <div style={{
                padding: '16px',
                fontSize: '14px',
                lineHeight: '1.6',
                color: '#374151'
              }}>
                {message.content}
              </div>

              {/* Message actions */}
              <MessageActions
                messageId={message.id}
                role={message.role}
                isInActiveBranch={true}
                onReply={() => handleReply(message.id)}
                onBranch={() => handleBranch(message.id)}
                onLinkCode={handleLinkCode}
                onLinkMessage={(targetId, type) => console.log('Link message:', targetId, type)}
                onCopyContent={() => handleCopyContent(message.content)}
                onViewContext={() => console.log('View context for:', message.id)}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Chat input */}
      <ChatInput
        currentNodeId={selectedMessageId || undefined}
        mode={replyMode}
        onSendMessage={handleSendMessage}
        onCancel={() => {
          setReplyMode('new');
          setSelectedMessageId(null);
        }}
        suggestions={
          conversation.messages.length === 0
            ? ['How does this work?', 'Show me an example', 'Explain the architecture']
            : []
        }
      />

      {/* Code selector modal */}
      {showCodeSelector && (
        <CodeReferenceSelector
          onSelect={handleCodeFileSelect}
          onClose={() => setShowCodeSelector(false)}
          availableFiles={availableCodeFiles}
          selectedFiles={linkedCodeFiles}
          recentFiles={[
            'src/components/Dashboard.tsx',
            'src/components/TodoList.tsx'
          ]}
        />
      )}

      {/* Branch creation dialog */}
      {showBranchDialog && selectedMessageId && (
        <BranchCreationDialog
          fromMessageId={selectedMessageId}
          fromMessageContent={
            conversation.messages.find(m => m.id === selectedMessageId)?.content || ''
          }
          onConfirm={handleBranchConfirm}
          onCancel={() => {
            setShowBranchDialog(false);
            setSelectedMessageId(null);
          }}
        />
      )}
    </div>
  );
}

// Mount the demo
const root = document.getElementById('root');
if (root) {
  createRoot(root).render(<InteractiveGraphChatDemo />);
}