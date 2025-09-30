import React, { useState } from 'react';
import { EdgeRelationType } from '../../core/graph-engine/types/EdgeTypes';

export interface MessageActionsProps {
  messageId: string;
  role: 'user' | 'assistant' | 'system';
  isInActiveBranch?: boolean;
  onReply: () => void;
  onBranch: () => void;
  onLinkCode: () => void;
  onLinkMessage: (targetId: string, relationType: EdgeRelationType) => void;
  onCopyContent?: () => void;
  onViewContext?: () => void;
}

/**
 * Message action buttons for reply, branch, link, etc.
 */
export const MessageActions: React.FC<MessageActionsProps> = ({
  messageId,
  role,
  isInActiveBranch = true,
  onReply,
  onBranch,
  onLinkCode,
  onLinkMessage,
  onCopyContent,
  onViewContext
}) => {
  const [showLinkMenu, setShowLinkMenu] = useState(false);

  const handleReply = () => {
    onReply();
  };

  const handleBranch = () => {
    onBranch();
  };

  const handleLinkCode = () => {
    setShowLinkMenu(false);
    onLinkCode();
  };

  const handleCopy = () => {
    onCopyContent?.();
  };

  const handleViewContext = () => {
    onViewContext?.();
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      padding: '12px',
      borderTop: '1px solid #e5e7eb',
      backgroundColor: '#f9fafb'
    }}>
      {/* Primary Actions */}
      <div style={{
        display: 'flex',
        gap: '8px',
        flexWrap: 'wrap'
      }}>
        {/* Reply button */}
        <button
          onClick={handleReply}
          disabled={!isInActiveBranch}
          title={isInActiveBranch ? 'Continue conversation from this message' : 'Switch to this branch to reply'}
          style={{
            padding: '6px 12px',
            fontSize: '13px',
            border: '1px solid #d0d7de',
            borderRadius: '6px',
            backgroundColor: 'white',
            cursor: isInActiveBranch ? 'pointer' : 'not-allowed',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            color: '#24292f',
            opacity: isInActiveBranch ? 1 : 0.5
          }}
        >
          <span>↩️</span>
          <span>Reply</span>
        </button>

        {/* Branch button */}
        <button
          onClick={handleBranch}
          title="Create a new conversation branch from this message"
          style={{
            padding: '6px 12px',
            fontSize: '13px',
            border: '1px solid #d0d7de',
            borderRadius: '6px',
            backgroundColor: 'white',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            color: '#24292f'
          }}
        >
          <span>🌿</span>
          <span>Branch</span>
        </button>

        {/* Link Code button */}
        <button
          onClick={handleLinkCode}
          title="Link this message to code files"
          style={{
            padding: '6px 12px',
            fontSize: '13px',
            border: '1px solid #d0d7de',
            borderRadius: '6px',
            backgroundColor: 'white',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            color: '#24292f'
          }}
        >
          <span>📎</span>
          <span>Link Code</span>
        </button>

        {/* View Context button */}
        {onViewContext && (
          <button
            onClick={handleViewContext}
            title="View full context for this message"
            style={{
              padding: '6px 12px',
              fontSize: '13px',
              border: '1px solid #d0d7de',
              borderRadius: '6px',
              backgroundColor: 'white',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              color: '#24292f'
            }}
          >
            <span>🔍</span>
            <span>Context</span>
          </button>
        )}
      </div>

      {/* Secondary Actions */}
      <div style={{
        display: 'flex',
        gap: '8px',
        flexWrap: 'wrap'
      }}>
        {/* Copy button */}
        {onCopyContent && (
          <button
            onClick={handleCopy}
            title="Copy message content"
            style={{
              padding: '4px 10px',
              fontSize: '12px',
              border: '1px solid #d0d7de',
              borderRadius: '4px',
              backgroundColor: 'white',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              color: '#6b7280'
            }}
          >
            <span>📋</span>
            <span>Copy</span>
          </button>
        )}

        {/* Message info */}
        <div style={{
          padding: '4px 10px',
          fontSize: '11px',
          color: '#9ca3af',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <span>ID: {messageId.substring(0, 8)}...</span>
          <span>•</span>
          <span>Role: {role}</span>
        </div>
      </div>

      {/* Help text */}
      <div style={{
        fontSize: '11px',
        color: '#9ca3af',
        fontStyle: 'italic',
        marginTop: '4px'
      }}>
        <strong>Reply</strong> continues in same branch. <strong>Branch</strong> creates alternative conversation path.
      </div>
    </div>
  );
};

MessageActions.displayName = 'MessageActions';

/**
 * Compact message action buttons for graph view
 */
export const CompactMessageActions: React.FC<{
  messageId: string;
  onReply: () => void;
  onBranch: () => void;
  onViewDetails: () => void;
}> = ({ messageId, onReply, onBranch, onViewDetails }) => {
  return (
    <div style={{
      display: 'flex',
      gap: '4px',
      padding: '4px',
      backgroundColor: 'white',
      borderRadius: '6px',
      border: '1px solid #e5e7eb',
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
    }}>
      <button
        onClick={onReply}
        title="Reply"
        style={{
          padding: '4px 8px',
          fontSize: '12px',
          border: 'none',
          borderRadius: '4px',
          backgroundColor: 'transparent',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center'
        }}
      >
        ↩️
      </button>
      <button
        onClick={onBranch}
        title="Branch"
        style={{
          padding: '4px 8px',
          fontSize: '12px',
          border: 'none',
          borderRadius: '4px',
          backgroundColor: 'transparent',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center'
        }}
      >
        🌿
      </button>
      <button
        onClick={onViewDetails}
        title="View Details"
        style={{
          padding: '4px 8px',
          fontSize: '12px',
          border: 'none',
          borderRadius: '4px',
          backgroundColor: 'transparent',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center'
        }}
      >
        📄
      </button>
    </div>
  );
};

CompactMessageActions.displayName = 'CompactMessageActions';