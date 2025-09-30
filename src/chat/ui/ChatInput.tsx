import React, { useState, useRef, useEffect, KeyboardEvent } from 'react';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata?: Record<string, any>;
}

export interface SendOptions {
  createBranch: boolean;
  linkToCode?: string[];
  metadata?: Record<string, any>;
}

export interface ChatInputProps {
  currentNodeId?: string;      // Node to reply to
  branchId?: string;            // Current branch
  mode?: 'continue' | 'branch' | 'new';
  disabled?: boolean;
  placeholder?: string;
  onSendMessage: (message: ChatMessage, options: SendOptions) => void;
  onCancel?: () => void;
  suggestions?: string[];
  showMarkdownPreview?: boolean;
}

/**
 * Interactive chat input component with branch creation, code linking, and markdown preview
 */
export const ChatInput: React.FC<ChatInputProps> = ({
  currentNodeId,
  branchId,
  mode = 'continue',
  disabled = false,
  placeholder = 'Ask a question or describe what you need help with...',
  onSendMessage,
  onCancel,
  suggestions = [],
  showMarkdownPreview = false
}) => {
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [linkedCodeFiles, setLinkedCodeFiles] = useState<string[]>([]);
  const [createBranch, setCreateBranch] = useState(mode === 'branch');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-expand textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [inputMessage]);

  // Focus on mount
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }, []);

  const handleSendMessage = async () => {
    const trimmed = inputMessage.trim();
    if (!trimmed || isLoading) return;

    setIsLoading(true);

    try {
      const message: ChatMessage = {
        role: 'user',
        content: trimmed,
        metadata: {
          branchId,
          replyTo: currentNodeId,
          timestamp: new Date().toISOString()
        }
      };

      const options: SendOptions = {
        createBranch,
        linkToCode: linkedCodeFiles.length > 0 ? linkedCodeFiles : undefined,
        metadata: {
          mode
        }
      };

      await onSendMessage(message, options);

      // Clear input
      setInputMessage('');
      setLinkedCodeFiles([]);
      setCreateBranch(mode === 'branch');
    } catch (error) {
      console.error('Failed to send message:', error);
      alert('Failed to send message. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Send on Ctrl+Enter or Cmd+Enter
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleCancel = () => {
    setInputMessage('');
    setLinkedCodeFiles([]);
    setCreateBranch(false);
    onCancel?.();
  };

  const handleAddCodeFile = (filePath: string) => {
    if (!linkedCodeFiles.includes(filePath)) {
      setLinkedCodeFiles([...linkedCodeFiles, filePath]);
    }
  };

  const handleRemoveCodeFile = (filePath: string) => {
    setLinkedCodeFiles(linkedCodeFiles.filter(f => f !== filePath));
  };

  const charCount = inputMessage.length;
  const showCharCount = charCount > 500; // Show count when approaching limit

  return (
    <div style={{
      borderTop: '1px solid #e1e5e9',
      backgroundColor: '#f8f9fa',
      padding: '16px',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px'
    }}>
      {/* Mode indicator */}
      {(mode !== 'new' && currentNodeId) && (
        <div style={{
          fontSize: '12px',
          color: '#6b7280',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <span>
            {mode === 'branch' ? '🌿 Creating new branch' : '↩️ Replying to message'}
          </span>
          {onCancel && (
            <button
              onClick={handleCancel}
              style={{
                padding: '2px 6px',
                fontSize: '11px',
                border: '1px solid #d0d7de',
                borderRadius: '4px',
                backgroundColor: 'white',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
          )}
        </div>
      )}

      {/* Linked code files */}
      {linkedCodeFiles.length > 0 && (
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '6px'
        }}>
          {linkedCodeFiles.map(filePath => (
            <div
              key={filePath}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 8px',
                fontSize: '12px',
                backgroundColor: '#dbeafe',
                border: '1px solid #93c5fd',
                borderRadius: '6px'
              }}
            >
              <span>📄 {filePath.split('/').pop()}</span>
              <button
                onClick={() => handleRemoveCodeFile(filePath)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '0',
                  fontSize: '14px',
                  color: '#3b82f6'
                }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Suggestions */}
      {suggestions.length > 0 && !inputMessage && (
        <div style={{
          display: 'flex',
          gap: '6px',
          flexWrap: 'wrap'
        }}>
          {suggestions.map((suggestion, index) => (
            <button
              key={index}
              onClick={() => setInputMessage(suggestion)}
              style={{
                padding: '4px 8px',
                fontSize: '12px',
                border: '1px solid #d0d7de',
                borderRadius: '12px',
                backgroundColor: '#f6f8fa',
                cursor: 'pointer',
                color: '#24292f'
              }}
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}

      {/* Markdown preview toggle */}
      {showMarkdownPreview && (
        <div style={{
          display: 'flex',
          gap: '8px',
          fontSize: '12px'
        }}>
          <button
            onClick={() => setShowPreview(false)}
            style={{
              padding: '4px 8px',
              border: '1px solid #d0d7de',
              borderRadius: '6px',
              backgroundColor: !showPreview ? '#0969da' : 'white',
              color: !showPreview ? 'white' : '#24292f',
              cursor: 'pointer'
            }}
          >
            Write
          </button>
          <button
            onClick={() => setShowPreview(true)}
            style={{
              padding: '4px 8px',
              border: '1px solid #d0d7de',
              borderRadius: '6px',
              backgroundColor: showPreview ? '#0969da' : 'white',
              color: showPreview ? 'white' : '#24292f',
              cursor: 'pointer'
            }}
          >
            Preview
          </button>
        </div>
      )}

      {/* Input area or preview */}
      {!showPreview ? (
        <textarea
          ref={textareaRef}
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          style={{
            width: '100%',
            padding: '12px',
            border: '1px solid #d0d7de',
            borderRadius: '8px',
            resize: 'none',
            minHeight: '60px',
            maxHeight: '200px',
            fontSize: '14px',
            fontFamily: 'inherit',
            backgroundColor: disabled ? '#f6f8fa' : 'white'
          }}
          disabled={isLoading || disabled}
        />
      ) : (
        <div style={{
          padding: '12px',
          border: '1px solid #d0d7de',
          borderRadius: '8px',
          minHeight: '60px',
          backgroundColor: '#f6f8fa',
          fontSize: '14px',
          whiteSpace: 'pre-wrap'
        }}>
          {inputMessage || <span style={{ color: '#9ca3af' }}>Nothing to preview</span>}
        </div>
      )}

      {/* Action bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
      }}>
        {/* Branch toggle */}
        <label style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: '12px',
          color: '#6b7280',
          cursor: 'pointer'
        }}>
          <input
            type="checkbox"
            checked={createBranch}
            onChange={(e) => setCreateBranch(e.target.checked)}
            disabled={isLoading}
          />
          <span>Create new branch</span>
        </label>

        <div style={{ flex: 1 }} />

        {/* Character count */}
        {showCharCount && (
          <span style={{
            fontSize: '11px',
            color: charCount > 1000 ? '#dc2626' : '#6b7280'
          }}>
            {charCount} characters
          </span>
        )}

        {/* Send button */}
        <button
          onClick={handleSendMessage}
          disabled={!inputMessage.trim() || isLoading || disabled}
          style={{
            padding: '8px 20px',
            backgroundColor: inputMessage.trim() && !isLoading && !disabled ? '#0969da' : '#9ca3af',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: inputMessage.trim() && !isLoading && !disabled ? 'pointer' : 'not-allowed',
            fontSize: '13px',
            fontWeight: '500',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          {isLoading ? '⌛ Sending...' : createBranch ? '🌿 Create & Send' : 'Send'}
          <span style={{ fontSize: '10px', opacity: 0.8 }}>⌘↵</span>
        </button>
      </div>

      {/* Help text */}
      <div style={{
        fontSize: '11px',
        color: '#9ca3af',
        fontStyle: 'italic'
      }}>
        Press Ctrl+Enter (Cmd+Enter on Mac) to send
      </div>
    </div>
  );
};

ChatInput.displayName = 'ChatInput';