/**
 * Conversation navigator component for browsing message history and branches
 */

import React, { useState, useCallback, memo, useMemo } from 'react';
import { ChatConversationNode } from '../models/ConversationNode';
import { MessageNode, MessageBranch, getConversationPath, getBranchPaths } from '../models/MessageNode';

export interface ConversationNavigatorProps {
  conversation: ChatConversationNode;
  selectedMessageId?: string | null;
  onMessageSelect: (messageId: string) => void;
  onCenterMessage: (messageId: string) => void;
  onToggleCollapse: () => void;
  className?: string;
  style?: React.CSSProperties;
}

export interface MessageTreeNode {
  message: MessageNode;
  children: MessageTreeNode[];
  depth: number;
  branchId?: string;
  isActive: boolean;
}

export interface ConversationBranch {
  id: string;
  title: string;
  messageCount: number;
  lastActivity: Date;
  isActive: boolean;
}

/**
 * Navigation component for conversation tree and branches
 */
export const ConversationNavigator: React.FC<ConversationNavigatorProps> = memo(({
  conversation,
  selectedMessageId,
  onMessageSelect,
  onCenterMessage,
  onToggleCollapse,
  className = '',
  style = {}
}) => {
  // State
  const [activeTab, setActiveTab] = useState<'timeline' | 'branches' | 'search'>('timeline');
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [showDetails, setShowDetails] = useState(false);

  // Memoized data
  const messageTree = useMemo(() => buildMessageTree(conversation), [conversation]);
  const branches = useMemo(() => getBranchInfo(conversation), [conversation]);
  const searchResults = useMemo(() =>
    searchQuery ? searchMessages(conversation, searchQuery) : [],
    [conversation, searchQuery]
  );

  // Event handlers
  const handleMessageClick = useCallback((messageId: string) => {
    onMessageSelect(messageId);
  }, [onMessageSelect]);

  const handleCenterClick = useCallback((messageId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    onCenterMessage(messageId);
  }, [onCenterMessage]);

  const toggleExpanded = useCallback((nodeId: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId);
    } else {
      newExpanded.add(nodeId);
    }
    setExpandedNodes(newExpanded);
  }, [expandedNodes]);

  const renderMessageTreeNode = useCallback((node: MessageTreeNode): React.ReactNode => {
    const isSelected = selectedMessageId === node.message.id;
    const isExpanded = expandedNodes.has(node.message.id);
    const hasChildren = node.children.length > 0;

    return (
      <div key={node.message.id} style={{ marginLeft: `${node.depth * 16}px` }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '6px 8px',
            cursor: 'pointer',
            backgroundColor: isSelected ? '#dbeafe' : 'transparent',
            borderRadius: '4px',
            margin: '2px 0',
            border: isSelected ? '1px solid #3b82f6' : '1px solid transparent'
          }}
          onClick={() => handleMessageClick(node.message.id)}
        >
          {/* Expand/Collapse button */}
          {hasChildren && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleExpanded(node.message.id);
              }}
              style={{
                width: '16px',
                height: '16px',
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: '4px'
              }}
            >
              {isExpanded ? '▼' : '▶'}
            </button>
          )}

          {/* Role indicator */}
          <div
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: getRoleColor(node.message.role),
              marginRight: '8px',
              flexShrink: 0
            }}
          />

          {/* Message preview */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: '12px',
              fontWeight: isSelected ? '600' : '400',
              color: '#1f2937',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}>
              {getMessagePreview(node.message)}
            </div>
            {showDetails && (
              <div style={{
                fontSize: '10px',
                color: '#6b7280',
                marginTop: '2px'
              }}>
                #{node.message.messageIndex} • {formatTime(node.message.startTime)}
              </div>
            )}
          </div>

          {/* Actions */}
          <div style={{
            display: 'flex',
            gap: '4px',
            opacity: isSelected ? 1 : 0,
            transition: 'opacity 0.2s'
          }}>
            <button
              onClick={(e) => handleCenterClick(node.message.id, e)}
              style={{
                padding: '2px 4px',
                border: '1px solid #d1d5db',
                borderRadius: '3px',
                backgroundColor: 'white',
                fontSize: '10px',
                cursor: 'pointer'
              }}
              title="Center in view"
            >
              ⌖
            </button>
          </div>
        </div>

        {/* Children */}
        {hasChildren && isExpanded && (
          <div>
            {node.children.map(child => renderMessageTreeNode(child))}
          </div>
        )}
      </div>
    );
  }, [selectedMessageId, expandedNodes, showDetails, handleMessageClick, handleCenterClick, toggleExpanded]);

  return (
    <div
      className={`conversation-navigator ${className}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: '#f8f9fa',
        ...style
      }}
    >
      {/* Header */}
      <div style={{
        padding: '12px',
        borderBottom: '1px solid #e5e7eb',
        backgroundColor: 'white'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'between',
          marginBottom: '8px'
        }}>
          <h3 style={{
            margin: 0,
            fontSize: '14px',
            fontWeight: '600',
            color: '#1f2937',
            flex: 1
          }}>
            {conversation.label}
          </h3>
          <button
            onClick={onToggleCollapse}
            style={{
              padding: '4px',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontSize: '12px',
              color: '#6b7280'
            }}
            title="Collapse navigator"
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div style={{
          display: 'flex',
          gap: '2px',
          backgroundColor: '#f3f4f6',
          borderRadius: '6px',
          padding: '2px'
        }}>
          {['timeline', 'branches', 'search'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              style={{
                flex: 1,
                padding: '6px 8px',
                border: 'none',
                borderRadius: '4px',
                fontSize: '12px',
                cursor: 'pointer',
                backgroundColor: activeTab === tab ? 'white' : 'transparent',
                color: activeTab === tab ? '#1f2937' : '#6b7280',
                fontWeight: activeTab === tab ? '500' : '400'
              }}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {/* Timeline Tab */}
        {activeTab === 'timeline' && (
          <div style={{ flex: 1, overflow: 'auto', padding: '8px' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'between',
              marginBottom: '8px'
            }}>
              <span style={{
                fontSize: '12px',
                color: '#6b7280'
              }}>
                {conversation.metadata.totalMessages} messages
              </span>
              <button
                onClick={() => setShowDetails(!showDetails)}
                style={{
                  padding: '2px 6px',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  backgroundColor: 'white',
                  fontSize: '10px',
                  cursor: 'pointer'
                }}
              >
                {showDetails ? 'Less' : 'More'}
              </button>
            </div>

            {messageTree.map(node => renderMessageTreeNode(node))}
          </div>
        )}

        {/* Branches Tab */}
        {activeTab === 'branches' && (
          <div style={{ flex: 1, overflow: 'auto', padding: '8px' }}>
            <div style={{
              fontSize: '12px',
              color: '#6b7280',
              marginBottom: '8px'
            }}>
              {branches.length} branches
            </div>

            {branches.map(branch => (
              <div
                key={branch.id}
                style={{
                  padding: '8px',
                  margin: '4px 0',
                  backgroundColor: branch.isActive ? '#dbeafe' : 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              >
                <div style={{
                  fontSize: '12px',
                  fontWeight: '500',
                  color: '#1f2937',
                  marginBottom: '2px'
                }}>
                  {branch.title}
                </div>
                <div style={{
                  fontSize: '10px',
                  color: '#6b7280'
                }}>
                  {branch.messageCount} messages • {formatTime(branch.lastActivity.toISOString())}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Search Tab */}
        {activeTab === 'search' && (
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '8px' }}>
              <input
                type="text"
                placeholder="Search messages..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '6px 8px',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  fontSize: '12px'
                }}
              />
            </div>

            <div style={{ flex: 1, overflow: 'auto', padding: '0 8px 8px' }}>
              {searchResults.length === 0 && searchQuery && (
                <div style={{
                  textAlign: 'center',
                  color: '#6b7280',
                  fontSize: '12px',
                  marginTop: '20px'
                }}>
                  No messages found
                </div>
              )}

              {searchResults.map(result => (
                <div
                  key={result.message.id}
                  style={{
                    padding: '8px',
                    margin: '4px 0',
                    backgroundColor: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                  onClick={() => handleMessageClick(result.message.id)}
                >
                  <div style={{
                    fontSize: '11px',
                    color: '#1f2937',
                    marginBottom: '4px'
                  }}>
                    <span style={{
                      fontWeight: '500',
                      color: getRoleColor(result.message.role)
                    }}>
                      {result.message.role}
                    </span>
                    {' '}#{result.message.messageIndex}
                  </div>
                  <div
                    style={{
                      fontSize: '10px',
                      color: '#4b5563',
                      lineHeight: '1.4'
                    }}
                    dangerouslySetInnerHTML={{ __html: result.highlightedText }}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{
        padding: '8px 12px',
        borderTop: '1px solid #e5e7eb',
        backgroundColor: 'white',
        fontSize: '10px',
        color: '#6b7280'
      }}>
        Last updated: {formatTime(conversation.metadata.updatedAt?.toISOString() || '')}
      </div>
    </div>
  );
});

ConversationNavigator.displayName = 'ConversationNavigator';

/**
 * Helper functions
 */
function buildMessageTree(conversation: ChatConversationNode): MessageTreeNode[] {
  const messages = Array.from(conversation.messages.values());
  const messageMap = new Map(messages.map(m => [m.id, m]));
  const roots: MessageTreeNode[] = [];
  const nodeMap = new Map<string, MessageTreeNode>();

  // Create all nodes
  for (const message of messages) {
    const node: MessageTreeNode = {
      message,
      children: [],
      depth: 0,
      isActive: true // This would be determined by branch logic
    };
    nodeMap.set(message.id, node);
  }

  // Build tree structure
  for (const message of messages) {
    const node = nodeMap.get(message.id)!;

    if (message.parentMessageId) {
      const parent = nodeMap.get(message.parentMessageId);
      if (parent) {
        parent.children.push(node);
        node.depth = parent.depth + 1;
      }
    } else {
      roots.push(node);
    }
  }

  // Sort children by message index
  for (const node of nodeMap.values()) {
    node.children.sort((a, b) => a.message.messageIndex - b.message.messageIndex);
  }

  return roots.sort((a, b) => a.message.messageIndex - b.message.messageIndex);
}

function getBranchInfo(conversation: ChatConversationNode): ConversationBranch[] {
  return Array.from(conversation.branches.values()).map(branch => ({
    id: branch.id,
    title: branch.title || 'Untitled Branch',
    messageCount: branch.messageIds.length,
    lastActivity: branch.created, // Would be last message time in practice
    isActive: branch.isActive
  }));
}

function searchMessages(conversation: ChatConversationNode, query: string): Array<{
  message: MessageNode;
  highlightedText: string;
}> {
  const messages = Array.from(conversation.messages.values());
  const lowerQuery = query.toLowerCase();
  const results: Array<{ message: MessageNode; highlightedText: string }> = [];

  for (const message of messages) {
    const content = message.content.toLowerCase();
    const index = content.indexOf(lowerQuery);

    if (index !== -1) {
      // Create highlighted text
      const start = Math.max(0, index - 30);
      const end = Math.min(message.content.length, index + query.length + 30);
      let excerpt = message.content.substring(start, end);

      if (start > 0) excerpt = '...' + excerpt;
      if (end < message.content.length) excerpt = excerpt + '...';

      // Highlight the match
      const highlightedText = excerpt.replace(
        new RegExp(escapeRegExp(query), 'gi'),
        match => `<mark style="background-color: #fbbf24; padding: 1px 2px; border-radius: 2px;">${match}</mark>`
      );

      results.push({
        message,
        highlightedText
      });
    }
  }

  return results.sort((a, b) => b.message.messageIndex - a.message.messageIndex);
}

function getMessagePreview(message: MessageNode): string {
  let preview = message.content.replace(/\s+/g, ' ').trim();

  // Remove code blocks
  preview = preview.replace(/```[\s\S]*?```/g, '[code block]');
  preview = preview.replace(/`[^`]+`/g, '[code]');

  if (preview.length > 40) {
    preview = preview.substring(0, 37) + '...';
  }

  return preview || '[Empty message]';
}

function getRoleColor(role: string): string {
  const colors = {
    user: '#3b82f6',
    assistant: '#10b981',
    system: '#6b7280'
  };
  return colors[role as keyof typeof colors] || '#6b7280';
}

function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMinutes < 1) {
    return 'now';
  } else if (diffMinutes < 60) {
    return `${diffMinutes}m`;
  } else if (diffHours < 24) {
    return `${diffHours}h`;
  } else if (diffDays < 7) {
    return `${diffDays}d`;
  } else {
    return date.toLocaleDateString();
  }
}

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}