import React, { useState, useEffect } from 'react';

export interface BranchCreationDialogProps {
  fromMessageId: string;
  fromMessageContent: string;
  onConfirm: (branchName: string, firstMessage: string) => void;
  onCancel: () => void;
}

/**
 * Dialog for creating a new conversation branch
 */
export const BranchCreationDialog: React.FC<BranchCreationDialogProps> = ({
  fromMessageId,
  fromMessageContent,
  onConfirm,
  onCancel
}) => {
  const [branchName, setBranchName] = useState('');
  const [firstMessage, setFirstMessage] = useState('');

  // Auto-generate branch name from message content
  useEffect(() => {
    const generateBranchName = (content: string): string => {
      // Extract first meaningful sentence
      const words = content
        .replace(/[^\w\s]/g, '')
        .split(/\s+/)
        .filter(w => w.length > 3)
        .slice(0, 3);

      if (words.length === 0) {
        return `branch-${Date.now()}`;
      }

      return words.join('-').toLowerCase();
    };

    const generated = generateBranchName(fromMessageContent);
    setBranchName(generated);
  }, [fromMessageContent]);

  const handleConfirm = () => {
    if (!firstMessage.trim()) {
      alert('Please enter a message for the new branch');
      return;
    }

    onConfirm(branchName || `branch-${Date.now()}`, firstMessage.trim());
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleConfirm();
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        width: '90%',
        maxWidth: '600px',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: '20px',
          borderBottom: '1px solid #e5e7eb'
        }}>
          <h3 style={{
            margin: 0,
            fontSize: '18px',
            fontWeight: '600',
            color: '#1f2937',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <span>🌿</span>
            <span>Create New Branch</span>
          </h3>
          <p style={{
            margin: '8px 0 0 0',
            fontSize: '13px',
            color: '#6b7280'
          }}>
            Start a new conversation path from this message. The original conversation will remain unchanged.
          </p>
        </div>

        {/* Branch point preview */}
        <div style={{
          padding: '16px 20px',
          backgroundColor: '#f9fafb',
          borderBottom: '1px solid #e5e7eb'
        }}>
          <div style={{
            fontSize: '12px',
            fontWeight: '600',
            color: '#6b7280',
            marginBottom: '6px'
          }}>
            Branching from:
          </div>
          <div style={{
            padding: '10px 12px',
            backgroundColor: 'white',
            border: '1px solid #d1d5db',
            borderRadius: '6px',
            fontSize: '13px',
            color: '#374151',
            maxHeight: '80px',
            overflow: 'auto'
          }}>
            {fromMessageContent.length > 200
              ? fromMessageContent.substring(0, 200) + '...'
              : fromMessageContent}
          </div>
        </div>

        {/* Form */}
        <div style={{
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}>
          {/* Branch name input */}
          <div>
            <label style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: '500',
              color: '#374151',
              marginBottom: '6px'
            }}>
              Branch Name (optional)
            </label>
            <input
              type="text"
              value={branchName}
              onChange={(e) => setBranchName(e.target.value)}
              placeholder="e.g., alternative-approach, deep-dive, exploration"
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px',
                fontFamily: 'inherit'
              }}
            />
            <div style={{
              fontSize: '11px',
              color: '#9ca3af',
              marginTop: '4px'
            }}>
              Leave empty for auto-generated name
            </div>
          </div>

          {/* First message input */}
          <div>
            <label style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: '500',
              color: '#374151',
              marginBottom: '6px'
            }}>
              First Message <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <textarea
              value={firstMessage}
              onChange={(e) => setFirstMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="What would you like to explore in this branch?"
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px',
                fontFamily: 'inherit',
                resize: 'vertical',
                minHeight: '100px'
              }}
              autoFocus
            />
            <div style={{
              fontSize: '11px',
              color: '#9ca3af',
              marginTop: '4px'
            }}>
              Press Ctrl+Enter (Cmd+Enter on Mac) to create
            </div>
          </div>

          {/* Visual branch indicator */}
          <div style={{
            padding: '12px',
            backgroundColor: '#fef3c7',
            border: '1px solid #fbbf24',
            borderRadius: '6px',
            fontSize: '12px',
            color: '#92400e',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '8px'
          }}>
            <span style={{ fontSize: '16px' }}>💡</span>
            <div>
              <strong>Branch Preview:</strong><br />
              Original message → <strong>🌿 {branchName || 'New Branch'}</strong> → Your message
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 20px',
          borderTop: '1px solid #e5e7eb',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '12px',
          backgroundColor: '#f9fafb'
        }}>
          <button
            onClick={onCancel}
            style={{
              padding: '8px 16px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              backgroundColor: 'white',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              color: '#374151'
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!firstMessage.trim()}
            style={{
              padding: '8px 20px',
              border: 'none',
              borderRadius: '6px',
              backgroundColor: firstMessage.trim() ? '#0969da' : '#9ca3af',
              color: 'white',
              cursor: firstMessage.trim() ? 'pointer' : 'not-allowed',
              fontSize: '14px',
              fontWeight: '500',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <span>🌿</span>
            <span>Create Branch</span>
          </button>
        </div>
      </div>
    </div>
  );
};

BranchCreationDialog.displayName = 'BranchCreationDialog';