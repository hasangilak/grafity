/**
 * Branch Comparison Component
 *
 * Provides side-by-side comparison of two conversation branches:
 * - Divergence point highlighting
 * - Message diff visualization
 * - Unique messages per branch
 * - Shared messages
 * - Merge suggestions and actions
 */

import React, { useState, useMemo } from 'react';
import { ConversationBranch } from '../../core/graph-engine/chat/EnhancedConversationGraph';
import { BranchStyle } from '../../core/graph-engine/chat/BranchStyleManager';
import { MergeStrategy } from '../../core/graph-engine/chat/BranchOperations';

export interface BranchComparisonProps {
  branch1: ConversationBranch;
  branch2: ConversationBranch;
  branch1Style: BranchStyle;
  branch2Style: BranchStyle;
  branch1Messages: Array<{ id: string; role: string; content: string; timestamp: Date }>;
  branch2Messages: Array<{ id: string; role: string; content: string; timestamp: Date }>;
  onClose: () => void;
  onMerge?: (strategy: MergeStrategy) => void;
}

export interface BranchDiff {
  divergencePoint: string | null;
  branch1UniqueMessages: Array<{ id: string; content: string; role: string }>;
  branch2UniqueMessages: Array<{ id: string; content: string; role: string }>;
  sharedMessages: Array<{ id: string; content: string; role: string }>;
  differences: MessageDifference[];
}

export interface MessageDifference {
  messageId: string;
  type: 'added-branch1' | 'added-branch2' | 'modified' | 'removed';
  content: string;
  comparedTo?: string;
}

/**
 * Side-by-side branch comparison with merge capabilities
 */
export const BranchComparison: React.FC<BranchComparisonProps> = ({
  branch1,
  branch2,
  branch1Style,
  branch2Style,
  branch1Messages,
  branch2Messages,
  onClose,
  onMerge
}) => {
  const [selectedStrategy, setSelectedStrategy] = useState<MergeStrategy>('keep-both');
  const [showMergeConfirm, setShowMergeConfirm] = useState(false);

  // Calculate branch diff
  const branchDiff = useMemo(() => calculateBranchDiff(
    branch1,
    branch2,
    branch1Messages,
    branch2Messages
  ), [branch1, branch2, branch1Messages, branch2Messages]);

  const handleMerge = () => {
    if (onMerge) {
      onMerge(selectedStrategy);
      setShowMergeConfirm(false);
      onClose();
    }
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        {/* Header */}
        <div style={styles.header}>
          <h2 style={styles.title}>Branch Comparison</h2>
          <button style={styles.closeButton} onClick={onClose}>✕</button>
        </div>

        {/* Branch Info */}
        <div style={styles.branchInfo}>
          <div style={{ ...styles.branchCard, borderColor: branch1Style.color }}>
            <div style={styles.branchHeader}>
              <span style={styles.branchIcon}>{branch1Style.icon}</span>
              <span style={styles.branchName}>{branch1Style.name}</span>
            </div>
            <div style={styles.branchStats}>
              <span>{branch1.messages.length} messages</span>
              <span>{branchDiff.branch1UniqueMessages.length} unique</span>
            </div>
          </div>

          <div style={styles.vsDivider}>vs</div>

          <div style={{ ...styles.branchCard, borderColor: branch2Style.color }}>
            <div style={styles.branchHeader}>
              <span style={styles.branchIcon}>{branch2Style.icon}</span>
              <span style={styles.branchName}>{branch2Style.name}</span>
            </div>
            <div style={styles.branchStats}>
              <span>{branch2.messages.length} messages</span>
              <span>{branchDiff.branch2UniqueMessages.length} unique</span>
            </div>
          </div>
        </div>

        {/* Divergence Point */}
        {branchDiff.divergencePoint && (
          <div style={styles.divergenceNotice}>
            <span style={styles.divergenceIcon}>🔀</span>
            <span>Branches diverged at message: <strong>{branchDiff.divergencePoint.substring(0, 12)}</strong></span>
          </div>
        )}

        {/* Comparison View */}
        <div style={styles.comparisonContainer}>
          {/* Branch 1 Messages */}
          <div style={styles.branchColumn}>
            <div style={{ ...styles.columnHeader, backgroundColor: branch1Style.color }}>
              <span>{branch1Style.name}</span>
            </div>
            <div style={styles.messageList}>
              {/* Shared Messages */}
              {branchDiff.sharedMessages.length > 0 && (
                <div style={styles.sharedSection}>
                  <div style={styles.sectionLabel}>Shared Messages ({branchDiff.sharedMessages.length})</div>
                  {branchDiff.sharedMessages.map(msg => (
                    <div key={msg.id} style={styles.sharedMessage}>
                      <div style={styles.messageRole}>{msg.role}</div>
                      <div style={styles.messageContent}>{msg.content.substring(0, 150)}...</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Unique Messages */}
              {branchDiff.branch1UniqueMessages.length > 0 && (
                <div style={styles.uniqueSection}>
                  <div style={styles.sectionLabel}>
                    Unique to {branch1Style.name} ({branchDiff.branch1UniqueMessages.length})
                  </div>
                  {branchDiff.branch1UniqueMessages.map(msg => (
                    <div key={msg.id} style={styles.uniqueMessage}>
                      <div style={styles.messageRole}>{msg.role}</div>
                      <div style={styles.messageContent}>{msg.content}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Divider */}
          <div style={styles.columnDivider} />

          {/* Branch 2 Messages */}
          <div style={styles.branchColumn}>
            <div style={{ ...styles.columnHeader, backgroundColor: branch2Style.color }}>
              <span>{branch2Style.name}</span>
            </div>
            <div style={styles.messageList}>
              {/* Shared Messages */}
              {branchDiff.sharedMessages.length > 0 && (
                <div style={styles.sharedSection}>
                  <div style={styles.sectionLabel}>Shared Messages ({branchDiff.sharedMessages.length})</div>
                  {branchDiff.sharedMessages.map(msg => (
                    <div key={msg.id} style={styles.sharedMessage}>
                      <div style={styles.messageRole}>{msg.role}</div>
                      <div style={styles.messageContent}>{msg.content.substring(0, 150)}...</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Unique Messages */}
              {branchDiff.branch2UniqueMessages.length > 0 && (
                <div style={styles.uniqueSection}>
                  <div style={styles.sectionLabel}>
                    Unique to {branch2Style.name} ({branchDiff.branch2UniqueMessages.length})
                  </div>
                  {branchDiff.branch2UniqueMessages.map(msg => (
                    <div key={msg.id} style={styles.uniqueMessage}>
                      <div style={styles.messageRole}>{msg.role}</div>
                      <div style={styles.messageContent}>{msg.content}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Merge Section */}
        {onMerge && (
          <div style={styles.mergeSection}>
            <div style={styles.mergeSectionHeader}>
              <h3 style={styles.mergeSectionTitle}>Merge Options</h3>
            </div>

            <div style={styles.strategySelector}>
              <label style={styles.strategyOption}>
                <input
                  type="radio"
                  name="strategy"
                  value="keep-both"
                  checked={selectedStrategy === 'keep-both'}
                  onChange={() => setSelectedStrategy('keep-both')}
                />
                <div>
                  <div style={styles.strategyName}>Keep Both</div>
                  <div style={styles.strategyDesc}>
                    Combine all messages from both branches (interleaved by timestamp)
                  </div>
                </div>
              </label>

              <label style={styles.strategyOption}>
                <input
                  type="radio"
                  name="strategy"
                  value="prefer-source"
                  checked={selectedStrategy === 'prefer-source'}
                  onChange={() => setSelectedStrategy('prefer-source')}
                />
                <div>
                  <div style={styles.strategyName}>Prefer {branch1Style.name}</div>
                  <div style={styles.strategyDesc}>
                    Replace {branch2Style.name} messages with {branch1Style.name} messages
                  </div>
                </div>
              </label>

              <label style={styles.strategyOption}>
                <input
                  type="radio"
                  name="strategy"
                  value="prefer-target"
                  checked={selectedStrategy === 'prefer-target'}
                  onChange={() => setSelectedStrategy('prefer-target')}
                />
                <div>
                  <div style={styles.strategyName}>Prefer {branch2Style.name}</div>
                  <div style={styles.strategyDesc}>
                    Keep {branch2Style.name} messages, discard {branch1Style.name} unique messages
                  </div>
                </div>
              </label>
            </div>

            {!showMergeConfirm ? (
              <button
                style={styles.mergeButton}
                onClick={() => setShowMergeConfirm(true)}
              >
                Merge Branches
              </button>
            ) : (
              <div style={styles.confirmSection}>
                <div style={styles.confirmText}>
                  Are you sure you want to merge using "<strong>{getStrategyLabel(selectedStrategy)}</strong>" strategy?
                  This action cannot be undone.
                </div>
                <div style={styles.confirmButtons}>
                  <button style={styles.confirmButton} onClick={handleMerge}>
                    Yes, Merge
                  </button>
                  <button
                    style={styles.cancelConfirmButton}
                    onClick={() => setShowMergeConfirm(false)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Calculate differences between two branches
 */
function calculateBranchDiff(
  branch1: ConversationBranch,
  branch2: ConversationBranch,
  branch1Messages: Array<{ id: string; role: string; content: string }>,
  branch2Messages: Array<{ id: string; role: string; content: string }>
): BranchDiff {
  // Find shared messages (messages present in both branches before divergence)
  const branch1Ids = new Set(branch1.messages);
  const branch2Ids = new Set(branch2.messages);

  const sharedMessageIds = branch1.messages.filter(id => branch2Ids.has(id));

  // Find divergence point (last shared message)
  const divergencePoint = sharedMessageIds.length > 0
    ? sharedMessageIds[sharedMessageIds.length - 1]
    : branch1.branchPoint;

  // Get index of divergence point
  const divergenceIndex1 = branch1.messages.indexOf(divergencePoint);
  const divergenceIndex2 = branch2.messages.indexOf(divergencePoint);

  // Messages after divergence point
  const branch1Unique = branch1.messages.slice(divergenceIndex1 + 1);
  const branch2Unique = branch2.messages.slice(divergenceIndex2 + 1);

  // Map message IDs to content
  const branch1UniqueMessages = branch1Unique
    .map(id => branch1Messages.find(m => m.id === id))
    .filter(Boolean) as Array<{ id: string; role: string; content: string }>;

  const branch2UniqueMessages = branch2Unique
    .map(id => branch2Messages.find(m => m.id === id))
    .filter(Boolean) as Array<{ id: string; role: string; content: string }>;

  const sharedMessages = sharedMessageIds
    .map(id => branch1Messages.find(m => m.id === id) || branch2Messages.find(m => m.id === id))
    .filter(Boolean) as Array<{ id: string; role: string; content: string }>;

  // Calculate differences
  const differences: MessageDifference[] = [];

  branch1UniqueMessages.forEach(msg => {
    differences.push({
      messageId: msg.id,
      type: 'added-branch1',
      content: msg.content
    });
  });

  branch2UniqueMessages.forEach(msg => {
    differences.push({
      messageId: msg.id,
      type: 'added-branch2',
      content: msg.content
    });
  });

  return {
    divergencePoint,
    branch1UniqueMessages,
    branch2UniqueMessages,
    sharedMessages,
    differences
  };
}

function getStrategyLabel(strategy: MergeStrategy): string {
  switch (strategy) {
    case 'keep-both': return 'Keep Both';
    case 'prefer-source': return 'Prefer Source';
    case 'prefer-target': return 'Prefer Target';
  }
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2000,
    padding: '20px'
  },
  modal: {
    backgroundColor: 'white',
    borderRadius: '12px',
    maxWidth: '1200px',
    width: '100%',
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column' as const,
    boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
    fontFamily: 'system-ui, -apple-system, sans-serif'
  },
  header: {
    padding: '20px 24px',
    borderBottom: '1px solid #eee',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  title: {
    margin: 0,
    fontSize: '20px',
    fontWeight: '600',
    color: '#333'
  },
  closeButton: {
    backgroundColor: 'transparent',
    border: 'none',
    fontSize: '24px',
    cursor: 'pointer',
    color: '#666',
    padding: '4px 8px',
    borderRadius: '4px',
    transition: 'background-color 0.2s'
  },
  branchInfo: {
    padding: '20px 24px',
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    borderBottom: '1px solid #eee'
  },
  branchCard: {
    flex: 1,
    padding: '16px',
    borderRadius: '8px',
    border: '2px solid',
    backgroundColor: '#f9f9f9'
  },
  branchHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '8px'
  },
  branchIcon: {
    fontSize: '20px'
  },
  branchName: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#333'
  },
  branchStats: {
    display: 'flex',
    gap: '12px',
    fontSize: '13px',
    color: '#666'
  },
  vsDivider: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#999',
    textTransform: 'uppercase' as const
  },
  divergenceNotice: {
    padding: '12px 24px',
    backgroundColor: '#e7f3ff',
    borderBottom: '1px solid #b3d9ff',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '13px',
    color: '#004085'
  },
  divergenceIcon: {
    fontSize: '16px'
  },
  comparisonContainer: {
    flex: 1,
    display: 'flex',
    overflow: 'hidden'
  },
  branchColumn: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    overflow: 'hidden'
  },
  columnHeader: {
    padding: '12px 16px',
    color: 'white',
    fontWeight: '600',
    fontSize: '14px',
    textAlign: 'center' as const
  },
  messageList: {
    flex: 1,
    overflowY: 'auto' as const,
    padding: '16px'
  },
  columnDivider: {
    width: '1px',
    backgroundColor: '#ddd'
  },
  sharedSection: {
    marginBottom: '24px'
  },
  uniqueSection: {
    marginBottom: '24px'
  },
  sectionLabel: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#666',
    textTransform: 'uppercase' as const,
    marginBottom: '12px'
  },
  sharedMessage: {
    padding: '12px',
    marginBottom: '8px',
    backgroundColor: '#f0f0f0',
    borderRadius: '6px',
    borderLeft: '3px solid #999'
  },
  uniqueMessage: {
    padding: '12px',
    marginBottom: '8px',
    backgroundColor: '#fff3cd',
    borderRadius: '6px',
    borderLeft: '3px solid #ffc107'
  },
  messageRole: {
    fontSize: '11px',
    fontWeight: '600',
    color: '#666',
    textTransform: 'uppercase' as const,
    marginBottom: '4px'
  },
  messageContent: {
    fontSize: '13px',
    color: '#333',
    lineHeight: '1.5'
  },
  mergeSection: {
    padding: '20px 24px',
    borderTop: '1px solid #eee',
    backgroundColor: '#f9f9f9'
  },
  mergeSectionHeader: {
    marginBottom: '16px'
  },
  mergeSectionTitle: {
    margin: 0,
    fontSize: '16px',
    fontWeight: '600',
    color: '#333'
  },
  strategySelector: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px',
    marginBottom: '20px'
  },
  strategyOption: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
    padding: '12px',
    backgroundColor: 'white',
    border: '1px solid #ddd',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'all 0.2s'
  },
  strategyName: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#333',
    marginBottom: '4px'
  },
  strategyDesc: {
    fontSize: '12px',
    color: '#666',
    lineHeight: '1.4'
  },
  mergeButton: {
    width: '100%',
    padding: '12px 24px',
    backgroundColor: '#28a745',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'background-color 0.2s'
  },
  confirmSection: {
    padding: '16px',
    backgroundColor: '#fff3cd',
    borderRadius: '6px',
    border: '1px solid #ffc107'
  },
  confirmText: {
    fontSize: '13px',
    color: '#856404',
    marginBottom: '12px',
    lineHeight: '1.5'
  },
  confirmButtons: {
    display: 'flex',
    gap: '8px'
  },
  confirmButton: {
    flex: 1,
    padding: '10px 20px',
    backgroundColor: '#dc3545',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer'
  },
  cancelConfirmButton: {
    flex: 1,
    padding: '10px 20px',
    backgroundColor: '#6c757d',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer'
  }
};
