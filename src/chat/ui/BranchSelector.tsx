/**
 * Branch Selector Component
 *
 * Provides UI for:
 * - Viewing all conversation branches
 * - Switching between branches
 * - Branch operations (rename, merge, archive)
 * - Visual branch indicators (color, icon)
 */

import React, { useState, useRef, useEffect } from 'react';
import { ConversationBranch } from '../../core/graph-engine/chat/EnhancedConversationGraph';
import { BranchStyle } from '../../core/graph-engine/chat/BranchStyleManager';

export interface BranchSelectorProps {
  branches: ConversationBranch[];
  branchStyles: Map<string, BranchStyle>;
  activeBranchId: string;
  onSwitchBranch: (branchId: string) => void;
  onRenameBranch?: (branchId: string, newName: string) => void;
  onMergeBranches?: (sourceId: string, targetId: string) => void;
  onArchiveBranch?: (branchId: string) => void;
  onCompareBranches?: (branch1Id: string, branch2Id: string) => void;
  disabled?: boolean;
}

export interface BranchListItem {
  id: string;
  name: string;
  messageCount: number;
  branchPoint: string;
  isActive: boolean;
  color: string;
  icon: string;
  pattern: string;
}

/**
 * Branch selector dropdown with operations menu
 */
export const BranchSelector: React.FC<BranchSelectorProps> = ({
  branches,
  branchStyles,
  activeBranchId,
  onSwitchBranch,
  onRenameBranch,
  onMergeBranches,
  onArchiveBranch,
  onCompareBranches,
  disabled = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeMenuBranchId, setActiveMenuBranchId] = useState<string | null>(null);
  const [renamingBranchId, setRenamingBranchId] = useState<string | null>(null);
  const [newBranchName, setNewBranchName] = useState('');
  const [mergingBranchId, setMergingBranchId] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setActiveMenuBranchId(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const activeBranch = branches.find(b => b.id === activeBranchId);
  const activeStyle = branchStyles.get(activeBranchId);

  const handleSwitchBranch = (branchId: string) => {
    onSwitchBranch(branchId);
    setIsOpen(false);
  };

  const handleRename = (branchId: string) => {
    setRenamingBranchId(branchId);
    const style = branchStyles.get(branchId);
    setNewBranchName(style?.name || '');
    setActiveMenuBranchId(null);
  };

  const submitRename = () => {
    if (renamingBranchId && newBranchName.trim() && onRenameBranch) {
      onRenameBranch(renamingBranchId, newBranchName.trim());
      setRenamingBranchId(null);
      setNewBranchName('');
    }
  };

  const handleMerge = (sourceBranchId: string) => {
    setMergingBranchId(sourceBranchId);
    setActiveMenuBranchId(null);
  };

  const submitMerge = (targetBranchId: string) => {
    if (mergingBranchId && onMergeBranches) {
      onMergeBranches(mergingBranchId, targetBranchId);
      setMergingBranchId(null);
    }
  };

  const handleArchive = (branchId: string) => {
    if (onArchiveBranch) {
      onArchiveBranch(branchId);
      setActiveMenuBranchId(null);
    }
  };

  const handleCompare = (branchId: string) => {
    if (onCompareBranches && activeBranchId !== branchId) {
      onCompareBranches(activeBranchId, branchId);
      setActiveMenuBranchId(null);
      setIsOpen(false);
    }
  };

  return (
    <div style={styles.container} ref={dropdownRef}>
      {/* Current Branch Display */}
      <button
        style={{
          ...styles.currentBranch,
          ...(disabled ? styles.disabled : {}),
          borderColor: activeStyle?.color || '#999'
        }}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
      >
        <div style={styles.branchInfo}>
          <span style={{ ...styles.branchIcon, color: activeStyle?.color }}>
            {activeStyle?.icon || '🌿'}
          </span>
          <div style={styles.branchDetails}>
            <span style={styles.branchName}>{activeStyle?.name || 'Main Branch'}</span>
            <span style={styles.branchMeta}>
              {activeBranch?.messages.length || 0} messages
            </span>
          </div>
        </div>
        <span style={styles.dropdownArrow}>{isOpen ? '▲' : '▼'}</span>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div style={styles.dropdown}>
          <div style={styles.dropdownHeader}>
            <span style={styles.dropdownTitle}>All Branches</span>
            <span style={styles.branchCount}>{branches.length}</span>
          </div>

          <div style={styles.branchList}>
            {branches.map(branch => {
              const style = branchStyles.get(branch.id);
              const isActive = branch.id === activeBranchId;
              const isMerging = mergingBranchId !== null && branch.id !== mergingBranchId;

              return (
                <div key={branch.id} style={styles.branchItem}>
                  {renamingBranchId === branch.id ? (
                    /* Rename Input */
                    <div style={styles.renameContainer}>
                      <input
                        type="text"
                        value={newBranchName}
                        onChange={(e) => setNewBranchName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') submitRename();
                          if (e.key === 'Escape') setRenamingBranchId(null);
                        }}
                        style={styles.renameInput}
                        placeholder="Branch name..."
                        autoFocus
                      />
                      <button onClick={submitRename} style={styles.renameButton}>✓</button>
                      <button
                        onClick={() => setRenamingBranchId(null)}
                        style={{ ...styles.renameButton, ...styles.cancelButton }}
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    /* Branch Item */
                    <>
                      <div
                        style={{
                          ...styles.branchItemContent,
                          ...(isActive ? styles.activeBranchItem : {}),
                          ...(isMerging ? { cursor: 'pointer', backgroundColor: '#f0f0f0' } : {})
                        }}
                        onClick={() => {
                          if (isMerging) {
                            submitMerge(branch.id);
                          } else {
                            handleSwitchBranch(branch.id);
                          }
                        }}
                      >
                        <div
                          style={{
                            ...styles.colorIndicator,
                            backgroundColor: style?.color || '#999',
                            borderStyle: style?.pattern || 'solid'
                          }}
                        />
                        <span style={styles.branchIcon}>{style?.icon || '🌿'}</span>
                        <div style={styles.branchDetails}>
                          <span style={styles.branchName}>
                            {style?.name || branch.id}
                            {isActive && <span style={styles.activeLabel}> (active)</span>}
                          </span>
                          <span style={styles.branchMeta}>
                            {branch.messages.length} messages
                            {branch.branchPoint && ` • from ${branch.branchPoint.substring(0, 8)}`}
                          </span>
                        </div>
                        {isMerging && (
                          <span style={styles.mergeHint}>Click to merge here</span>
                        )}
                      </div>

                      {/* Branch Actions Menu */}
                      {!isMerging && (
                        <div style={styles.actionsContainer}>
                          <button
                            style={styles.actionsButton}
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveMenuBranchId(
                                activeMenuBranchId === branch.id ? null : branch.id
                              );
                            }}
                          >
                            ⋮
                          </button>

                          {activeMenuBranchId === branch.id && (
                            <div style={styles.actionsMenu}>
                              {onRenameBranch && (
                                <button
                                  style={styles.actionItem}
                                  onClick={() => handleRename(branch.id)}
                                >
                                  ✏️ Rename
                                </button>
                              )}
                              {onCompareBranches && branch.id !== activeBranchId && (
                                <button
                                  style={styles.actionItem}
                                  onClick={() => handleCompare(branch.id)}
                                >
                                  🔀 Compare
                                </button>
                              )}
                              {onMergeBranches && branch.id !== activeBranchId && (
                                <button
                                  style={styles.actionItem}
                                  onClick={() => handleMerge(branch.id)}
                                >
                                  🔗 Merge into...
                                </button>
                              )}
                              {onArchiveBranch && !isActive && (
                                <button
                                  style={{ ...styles.actionItem, ...styles.dangerAction }}
                                  onClick={() => handleArchive(branch.id)}
                                >
                                  📦 Archive
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>

          {mergingBranchId && (
            <div style={styles.mergeNotice}>
              Select a branch to merge <strong>{branchStyles.get(mergingBranchId)?.name}</strong> into
              <button
                style={styles.cancelMergeButton}
                onClick={() => setMergingBranchId(null)}
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'relative',
    width: '300px',
    fontFamily: 'system-ui, -apple-system, sans-serif'
  },
  currentBranch: {
    width: '100%',
    padding: '12px 16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'white',
    border: '2px solid #ddd',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    transition: 'all 0.2s',
    outline: 'none'
  },
  disabled: {
    opacity: 0.6,
    cursor: 'not-allowed'
  },
  branchInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  branchIcon: {
    fontSize: '20px'
  },
  branchDetails: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'flex-start'
  },
  branchName: {
    fontWeight: '600',
    color: '#333'
  },
  branchMeta: {
    fontSize: '12px',
    color: '#666'
  },
  dropdownArrow: {
    fontSize: '12px',
    color: '#666'
  },
  dropdown: {
    position: 'absolute' as const,
    top: 'calc(100% + 4px)',
    left: 0,
    right: 0,
    backgroundColor: 'white',
    border: '1px solid #ddd',
    borderRadius: '8px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
    maxHeight: '400px',
    overflow: 'hidden',
    zIndex: 1000
  },
  dropdownHeader: {
    padding: '12px 16px',
    borderBottom: '1px solid #eee',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  dropdownTitle: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#666',
    textTransform: 'uppercase' as const
  },
  branchCount: {
    fontSize: '12px',
    color: '#999',
    backgroundColor: '#f0f0f0',
    padding: '2px 8px',
    borderRadius: '12px'
  },
  branchList: {
    maxHeight: '340px',
    overflowY: 'auto' as const
  },
  branchItem: {
    display: 'flex',
    alignItems: 'center',
    borderBottom: '1px solid #f0f0f0',
    position: 'relative' as const
  },
  branchItemContent: {
    flex: 1,
    padding: '12px 16px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    cursor: 'pointer',
    transition: 'background-color 0.2s'
  },
  activeBranchItem: {
    backgroundColor: '#f8f8f8'
  },
  colorIndicator: {
    width: '4px',
    height: '32px',
    borderRadius: '2px',
    flexShrink: 0
  },
  activeLabel: {
    fontSize: '11px',
    color: '#666',
    fontWeight: 'normal' as const
  },
  actionsContainer: {
    position: 'relative' as const,
    marginRight: '8px'
  },
  actionsButton: {
    padding: '4px 8px',
    backgroundColor: 'transparent',
    border: 'none',
    cursor: 'pointer',
    fontSize: '18px',
    color: '#666',
    borderRadius: '4px',
    transition: 'background-color 0.2s'
  },
  actionsMenu: {
    position: 'absolute' as const,
    right: 0,
    top: '100%',
    backgroundColor: 'white',
    border: '1px solid #ddd',
    borderRadius: '6px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
    minWidth: '150px',
    zIndex: 1001
  },
  actionItem: {
    width: '100%',
    padding: '8px 12px',
    backgroundColor: 'transparent',
    border: 'none',
    textAlign: 'left' as const,
    cursor: 'pointer',
    fontSize: '13px',
    color: '#333',
    display: 'block',
    transition: 'background-color 0.2s'
  },
  dangerAction: {
    color: '#dc3545'
  },
  renameContainer: {
    flex: 1,
    padding: '8px 16px',
    display: 'flex',
    gap: '4px'
  },
  renameInput: {
    flex: 1,
    padding: '6px 8px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '13px',
    outline: 'none'
  },
  renameButton: {
    padding: '4px 12px',
    backgroundColor: '#28a745',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px'
  },
  cancelButton: {
    backgroundColor: '#6c757d'
  },
  mergeNotice: {
    padding: '12px 16px',
    backgroundColor: '#e7f3ff',
    borderTop: '1px solid #b3d9ff',
    fontSize: '13px',
    color: '#004085',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  cancelMergeButton: {
    padding: '4px 12px',
    backgroundColor: '#6c757d',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px'
  },
  mergeHint: {
    fontSize: '11px',
    color: '#007bff',
    fontWeight: '600' as const,
    marginLeft: 'auto'
  }
};
