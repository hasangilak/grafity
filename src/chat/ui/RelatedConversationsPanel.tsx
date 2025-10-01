/**
 * Related Conversations Panel Component
 *
 * Displays conversations related to the current one with:
 * - Similarity scores
 * - Shared topics and code files
 * - Navigation to related conversations
 */

import React from 'react';
import { RelatedConversation } from '../../core/graph-engine/chat/RelatedConversationsFinder';

export interface RelatedConversationsPanelProps {
  currentConversationId: string;
  relatedConversations: RelatedConversation[];
  onNavigate: (conversationId: string) => void;
  onClose?: () => void;
}

export const RelatedConversationsPanel: React.FC<RelatedConversationsPanelProps> = ({
  currentConversationId,
  relatedConversations,
  onNavigate,
  onClose
}) => {
  const getSimilarityColor = (similarity: number): string => {
    if (similarity >= 0.7) return '#4CAF50';  // Green
    if (similarity >= 0.5) return '#FF9800';  // Orange
    return '#9E9E9E';  // Grey
  };

  const getSimilarityLabel = (similarity: number): string => {
    if (similarity >= 0.7) return 'High';
    if (similarity >= 0.5) return 'Medium';
    return 'Low';
  };

  return (
    <div style={styles.panel}>
      {/* Header */}
      <div style={styles.header}>
        <h2 style={styles.title}>🔗 Related Conversations</h2>
        {onClose && (
          <button style={styles.closeButton} onClick={onClose}>✕</button>
        )}
      </div>

      {/* Empty State */}
      {relatedConversations.length === 0 && (
        <div style={styles.emptyState}>
          <p>No related conversations found</p>
          <p style={styles.emptyHint}>
            As you create more conversations with similar topics or code references,
            they'll appear here
          </p>
        </div>
      )}

      {/* Conversations List */}
      {relatedConversations.length > 0 && (
        <div style={styles.conversationsList}>
          {relatedConversations.map(conv => (
            <div
              key={conv.id}
              style={styles.conversationItem}
              onClick={() => onNavigate(conv.id)}
            >
              {/* Title */}
              <div style={styles.conversationHeader}>
                <h3 style={styles.conversationTitle}>{conv.title}</h3>
                <div style={styles.similarityBadge}>
                  <div
                    style={{
                      ...styles.similarityBar,
                      width: `${conv.similarity * 100}%`,
                      backgroundColor: getSimilarityColor(conv.similarity)
                    }}
                  />
                  <span
                    style={{
                      ...styles.similarityLabel,
                      color: getSimilarityColor(conv.similarity)
                    }}
                  >
                    {Math.round(conv.similarity * 100)}%
                  </span>
                </div>
              </div>

              {/* Metadata */}
              <div style={styles.conversationMeta}>
                <span style={styles.metaItem}>
                  💬 {conv.messageCount} message{conv.messageCount !== 1 ? 's' : ''}
                </span>
                <span style={styles.metaItem}>
                  🕒 {new Date(conv.lastUpdated).toLocaleDateString()}
                </span>
              </div>

              {/* Shared Topics */}
              {conv.sharedTopics.length > 0 && (
                <div style={styles.sharedSection}>
                  <div style={styles.sharedLabel}>🏷️ Shared Topics:</div>
                  <div style={styles.tagList}>
                    {conv.sharedTopics.slice(0, 5).map(topic => (
                      <span key={topic} style={styles.tag}>
                        {topic}
                      </span>
                    ))}
                    {conv.sharedTopics.length > 5 && (
                      <span style={styles.moreTag}>
                        +{conv.sharedTopics.length - 5} more
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Shared Code Files */}
              {conv.sharedCodeFiles.length > 0 && (
                <div style={styles.sharedSection}>
                  <div style={styles.sharedLabel}>📄 Shared Code Files:</div>
                  <div style={styles.fileList}>
                    {conv.sharedCodeFiles.slice(0, 3).map(file => (
                      <div key={file} style={styles.fileName}>
                        {getFileName(file)}
                      </div>
                    ))}
                    {conv.sharedCodeFiles.length > 3 && (
                      <div style={styles.moreFiles}>
                        +{conv.sharedCodeFiles.length - 3} more file
                        {conv.sharedCodeFiles.length - 3 !== 1 ? 's' : ''}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div style={styles.actions}>
                <button
                  style={styles.actionButton}
                  onClick={(e) => {
                    e.stopPropagation();
                    onNavigate(conv.id);
                  }}
                >
                  Open →
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      {relatedConversations.length > 0 && (
        <div style={styles.footer}>
          <span style={styles.footerText}>
            Showing {relatedConversations.length} related conversation
            {relatedConversations.length !== 1 ? 's' : ''}
          </span>
        </div>
      )}
    </div>
  );
};

function getFileName(path: string): string {
  return path.split('/').pop() || path;
}

const styles: Record<string, React.CSSProperties> = {
  panel: {
    width: '350px',
    height: '100vh',
    backgroundColor: 'white',
    borderLeft: '1px solid #ddd',
    display: 'flex',
    flexDirection: 'column' as const,
    fontFamily: 'system-ui, -apple-system, sans-serif'
  },
  header: {
    padding: '16px 20px',
    borderBottom: '1px solid #eee',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  title: {
    margin: 0,
    fontSize: '18px',
    fontWeight: '600',
    color: '#333'
  },
  closeButton: {
    background: 'transparent',
    border: 'none',
    fontSize: '24px',
    cursor: 'pointer',
    color: '#666',
    padding: '4px 8px',
    borderRadius: '4px'
  },
  emptyState: {
    padding: '40px 20px',
    textAlign: 'center' as const,
    color: '#666'
  },
  emptyHint: {
    fontSize: '13px',
    color: '#999',
    marginTop: '12px',
    lineHeight: '1.5'
  },
  conversationsList: {
    flex: 1,
    overflowY: 'auto' as const,
    padding: '12px'
  },
  conversationItem: {
    padding: '16px',
    marginBottom: '12px',
    backgroundColor: '#f9f9f9',
    borderRadius: '8px',
    border: '1px solid #eee',
    cursor: 'pointer',
    transition: 'all 0.2s'
  },
  conversationHeader: {
    marginBottom: '12px'
  },
  conversationTitle: {
    margin: '0 0 8px 0',
    fontSize: '15px',
    fontWeight: '600',
    color: '#333',
    lineHeight: '1.4'
  },
  similarityBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  similarityBar: {
    flex: 1,
    height: '6px',
    backgroundColor: '#e0e0e0',
    borderRadius: '3px',
    position: 'relative' as const,
    overflow: 'hidden' as const
  },
  similarityLabel: {
    fontSize: '12px',
    fontWeight: '600',
    minWidth: '40px',
    textAlign: 'right' as const
  },
  conversationMeta: {
    display: 'flex',
    gap: '16px',
    marginBottom: '12px',
    flexWrap: 'wrap' as const
  },
  metaItem: {
    fontSize: '12px',
    color: '#999'
  },
  sharedSection: {
    marginBottom: '12px'
  },
  sharedLabel: {
    fontSize: '11px',
    fontWeight: '600',
    color: '#666',
    marginBottom: '6px'
  },
  tagList: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '4px'
  },
  tag: {
    display: 'inline-block',
    padding: '3px 8px',
    backgroundColor: '#e7f3ff',
    color: '#2196F3',
    fontSize: '11px',
    borderRadius: '12px',
    fontWeight: '500'
  },
  moreTag: {
    display: 'inline-block',
    padding: '3px 8px',
    backgroundColor: '#f0f0f0',
    color: '#666',
    fontSize: '11px',
    borderRadius: '12px',
    fontStyle: 'italic' as const
  },
  fileList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px'
  },
  fileName: {
    fontSize: '11px',
    color: '#666',
    backgroundColor: '#f0f0f0',
    padding: '4px 8px',
    borderRadius: '4px',
    fontFamily: 'Monaco, Consolas, monospace'
  },
  moreFiles: {
    fontSize: '11px',
    color: '#999',
    fontStyle: 'italic' as const,
    padding: '4px 8px'
  },
  actions: {
    marginTop: '12px',
    display: 'flex',
    justifyContent: 'flex-end'
  },
  actionButton: {
    padding: '6px 12px',
    backgroundColor: '#2196F3',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    fontSize: '12px',
    cursor: 'pointer',
    fontWeight: '600',
    transition: 'background-color 0.2s'
  },
  footer: {
    padding: '12px 20px',
    borderTop: '1px solid #eee',
    backgroundColor: '#f9f9f9'
  },
  footerText: {
    fontSize: '12px',
    color: '#666'
  }
};
