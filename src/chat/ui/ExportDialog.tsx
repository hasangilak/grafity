/**
 * Export Dialog Component
 *
 * Modal dialog for exporting conversations with:
 * - Format selection (Markdown, JSON, HTML)
 * - Branch filtering (all, active, selected)
 * - Options (include code, include metadata)
 * - Preview pane
 * - Download, copy, and shareable link generation
 */

import React, { useState, useEffect } from 'react';
import { ExportOptions } from '../../core/graph-engine/chat/ConversationExporter';

export interface ExportDialogProps {
  conversationId: string;
  conversationTitle: string;
  availableBranches: Array<{ id: string; name: string; isActive: boolean }>;
  onExport: (options: ExportOptions) => string;
  onGenerateLink?: (conversationId: string) => string;
  onClose: () => void;
}

export const ExportDialog: React.FC<ExportDialogProps> = ({
  conversationId,
  conversationTitle,
  availableBranches,
  onExport,
  onGenerateLink,
  onClose
}) => {
  const [format, setFormat] = useState<'markdown' | 'json' | 'html'>('markdown');
  const [includeCode, setIncludeCode] = useState(true);
  const [includeBranches, setIncludeBranches] = useState<'all' | 'active' | 'selected'>('all');
  const [selectedBranchIds, setSelectedBranchIds] = useState<string[]>([]);
  const [includeMetadata, setIncludeMetadata] = useState(true);
  const [preview, setPreview] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [shareableLink, setShareableLink] = useState('');
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle');

  // Generate preview when options change
  useEffect(() => {
    if (showPreview) {
      generatePreview();
    }
  }, [format, includeCode, includeBranches, selectedBranchIds, includeMetadata, showPreview]);

  const generatePreview = () => {
    try {
      const options: ExportOptions = {
        format,
        includeCode,
        includeBranches,
        selectedBranchIds: includeBranches === 'selected' ? selectedBranchIds : undefined,
        includeMetadata
      };

      const exported = onExport(options);

      // Truncate preview for large exports
      const maxPreviewLength = 5000;
      if (exported.length > maxPreviewLength) {
        setPreview(exported.substring(0, maxPreviewLength) + '\n\n... (truncated, full content available on download)');
      } else {
        setPreview(exported);
      }
    } catch (error) {
      setPreview(`Error generating preview: ${error}`);
    }
  };

  const handleDownload = () => {
    setIsGenerating(true);

    try {
      const options: ExportOptions = {
        format,
        includeCode,
        includeBranches,
        selectedBranchIds: includeBranches === 'selected' ? selectedBranchIds : undefined,
        includeMetadata
      };

      const exported = onExport(options);

      // Create blob and download
      const mimeTypes = {
        markdown: 'text/markdown',
        json: 'application/json',
        html: 'text/html'
      };

      const extensions = {
        markdown: 'md',
        json: 'json',
        html: 'html'
      };

      const blob = new Blob([exported], { type: mimeTypes[format] });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${conversationTitle.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.${extensions[format]}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export error:', error);
      alert(`Export failed: ${error}`);
    }

    setIsGenerating(false);
  };

  const handleCopyToClipboard = async () => {
    try {
      const options: ExportOptions = {
        format,
        includeCode,
        includeBranches,
        selectedBranchIds: includeBranches === 'selected' ? selectedBranchIds : undefined,
        includeMetadata
      };

      const exported = onExport(options);
      await navigator.clipboard.writeText(exported);
      setCopyStatus('copied');
      setTimeout(() => setCopyStatus('idle'), 2000);
    } catch (error) {
      console.error('Copy error:', error);
      setCopyStatus('error');
      setTimeout(() => setCopyStatus('idle'), 2000);
    }
  };

  const handleGenerateLink = () => {
    if (onGenerateLink) {
      const link = onGenerateLink(conversationId);
      setShareableLink(link);
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareableLink);
      setCopyStatus('copied');
      setTimeout(() => setCopyStatus('idle'), 2000);
    } catch (error) {
      console.error('Copy link error:', error);
      setCopyStatus('error');
      setTimeout(() => setCopyStatus('idle'), 2000);
    }
  };

  const toggleBranchSelection = (branchId: string) => {
    setSelectedBranchIds(prev =>
      prev.includes(branchId)
        ? prev.filter(id => id !== branchId)
        : [...prev, branchId]
    );
  };

  const getFormatDescription = (fmt: string): string => {
    switch (fmt) {
      case 'markdown':
        return 'Human-readable format for documentation';
      case 'json':
        return 'Structured data for programmatic access';
      case 'html':
        return 'Styled, shareable web format';
      default:
        return '';
    }
  };

  const getFormatIcon = (fmt: string): string => {
    switch (fmt) {
      case 'markdown':
        return '📝';
      case 'json':
        return '📋';
      case 'html':
        return '🌐';
      default:
        return '📄';
    }
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.dialog} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={styles.header}>
          <h2 style={styles.title}>📤 Export Conversation</h2>
          <button style={styles.closeButton} onClick={onClose}>✕</button>
        </div>

        {/* Content */}
        <div style={styles.content}>
          {/* Conversation Info */}
          <div style={styles.infoSection}>
            <div style={styles.infoLabel}>Exporting:</div>
            <div style={styles.infoValue}>{conversationTitle}</div>
          </div>

          {/* Format Selection */}
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>Export Format</h3>
            <div style={styles.formatOptions}>
              {(['markdown', 'json', 'html'] as const).map(fmt => (
                <label key={fmt} style={styles.formatOption}>
                  <input
                    type="radio"
                    name="format"
                    value={fmt}
                    checked={format === fmt}
                    onChange={() => setFormat(fmt)}
                    style={styles.radio}
                  />
                  <div style={styles.formatLabel}>
                    <span style={styles.formatIcon}>{getFormatIcon(fmt)}</span>
                    <div>
                      <div style={styles.formatName}>{fmt.toUpperCase()}</div>
                      <div style={styles.formatDesc}>{getFormatDescription(fmt)}</div>
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Branch Selection */}
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>Include Branches</h3>
            <div style={styles.branchOptions}>
              <label style={styles.radioLabel}>
                <input
                  type="radio"
                  name="branches"
                  value="all"
                  checked={includeBranches === 'all'}
                  onChange={() => setIncludeBranches('all')}
                />
                All branches ({availableBranches.length})
              </label>
              <label style={styles.radioLabel}>
                <input
                  type="radio"
                  name="branches"
                  value="active"
                  checked={includeBranches === 'active'}
                  onChange={() => setIncludeBranches('active')}
                />
                Active branch only
              </label>
              <label style={styles.radioLabel}>
                <input
                  type="radio"
                  name="branches"
                  value="selected"
                  checked={includeBranches === 'selected'}
                  onChange={() => setIncludeBranches('selected')}
                />
                Selected branches
              </label>
            </div>

            {/* Custom Branch Selection */}
            {includeBranches === 'selected' && (
              <div style={styles.branchList}>
                {availableBranches.map(branch => (
                  <label key={branch.id} style={styles.branchLabel}>
                    <input
                      type="checkbox"
                      checked={selectedBranchIds.includes(branch.id)}
                      onChange={() => toggleBranchSelection(branch.id)}
                    />
                    {branch.name}
                    {branch.isActive && <span style={styles.activeBadge}>Active</span>}
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Options */}
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>Options</h3>
            <div style={styles.checkboxGroup}>
              <label style={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={includeCode}
                  onChange={(e) => setIncludeCode(e.target.checked)}
                />
                Include code file references
              </label>
              <label style={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={includeMetadata}
                  onChange={(e) => setIncludeMetadata(e.target.checked)}
                />
                Include metadata (timestamps, participants)
              </label>
            </div>
          </div>

          {/* Preview */}
          <div style={styles.section}>
            <div style={styles.previewHeader}>
              <h3 style={styles.sectionTitle}>Preview</h3>
              <button
                style={styles.previewButton}
                onClick={() => {
                  setShowPreview(!showPreview);
                  if (!showPreview) generatePreview();
                }}
              >
                {showPreview ? '▼ Hide' : '▶ Show'}
              </button>
            </div>

            {showPreview && (
              <div style={styles.previewPane}>
                <pre style={styles.previewContent}>{preview}</pre>
              </div>
            )}
          </div>

          {/* Shareable Link */}
          {onGenerateLink && (
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>Shareable Link</h3>
              <div style={styles.linkSection}>
                <button style={styles.generateLinkButton} onClick={handleGenerateLink}>
                  🔗 Generate Link
                </button>
                {shareableLink && (
                  <div style={styles.linkDisplay}>
                    <input
                      type="text"
                      value={shareableLink}
                      readOnly
                      style={styles.linkInput}
                    />
                    <button style={styles.copyLinkButton} onClick={handleCopyLink}>
                      {copyStatus === 'copied' ? '✓ Copied' : '📋 Copy'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={styles.footer}>
          <button style={styles.cancelButton} onClick={onClose}>
            Cancel
          </button>
          <div style={styles.actionButtons}>
            <button
              style={styles.copyButton}
              onClick={handleCopyToClipboard}
              disabled={isGenerating}
            >
              {copyStatus === 'copied' ? '✓ Copied!' : copyStatus === 'error' ? '✗ Error' : '📋 Copy'}
            </button>
            <button
              style={styles.downloadButton}
              onClick={handleDownload}
              disabled={isGenerating}
            >
              {isGenerating ? '⏳ Exporting...' : '⬇️ Download'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

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
    zIndex: 1000
  },
  dialog: {
    backgroundColor: 'white',
    borderRadius: '12px',
    width: '90%',
    maxWidth: '700px',
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
    background: 'transparent',
    border: 'none',
    fontSize: '28px',
    cursor: 'pointer',
    color: '#666',
    padding: '4px 8px',
    borderRadius: '4px'
  },
  content: {
    flex: 1,
    overflowY: 'auto' as const,
    padding: '24px'
  },
  infoSection: {
    marginBottom: '24px',
    padding: '12px 16px',
    backgroundColor: '#f9f9f9',
    borderRadius: '6px',
    borderLeft: '3px solid #2196F3'
  },
  infoLabel: {
    fontSize: '12px',
    color: '#666',
    marginBottom: '4px',
    fontWeight: '600'
  },
  infoValue: {
    fontSize: '16px',
    color: '#333',
    fontWeight: '600'
  },
  section: {
    marginBottom: '24px'
  },
  sectionTitle: {
    margin: '0 0 12px 0',
    fontSize: '15px',
    fontWeight: '600',
    color: '#333'
  },
  formatOptions: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px'
  },
  formatOption: {
    display: 'flex',
    alignItems: 'center',
    padding: '12px',
    border: '2px solid #ddd',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'all 0.2s'
  },
  radio: {
    marginRight: '12px',
    cursor: 'pointer'
  },
  formatLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    flex: 1
  },
  formatIcon: {
    fontSize: '24px'
  },
  formatName: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#333'
  },
  formatDesc: {
    fontSize: '12px',
    color: '#999',
    marginTop: '2px'
  },
  branchOptions: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px'
  },
  radioLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '14px',
    color: '#333',
    cursor: 'pointer'
  },
  branchList: {
    marginTop: '12px',
    marginLeft: '24px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '6px',
    padding: '12px',
    backgroundColor: '#f9f9f9',
    borderRadius: '6px'
  },
  branchLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '13px',
    color: '#333',
    cursor: 'pointer'
  },
  activeBadge: {
    marginLeft: '8px',
    fontSize: '11px',
    backgroundColor: '#4CAF50',
    color: 'white',
    padding: '2px 8px',
    borderRadius: '10px',
    fontWeight: '600'
  },
  checkboxGroup: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '10px'
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '14px',
    color: '#333',
    cursor: 'pointer'
  },
  previewHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px'
  },
  previewButton: {
    padding: '6px 12px',
    backgroundColor: '#f0f0f0',
    border: 'none',
    borderRadius: '4px',
    fontSize: '13px',
    cursor: 'pointer',
    fontWeight: '600'
  },
  previewPane: {
    backgroundColor: '#f5f5f5',
    border: '1px solid #ddd',
    borderRadius: '6px',
    maxHeight: '300px',
    overflowY: 'auto' as const
  },
  previewContent: {
    padding: '16px',
    margin: 0,
    fontSize: '12px',
    fontFamily: 'Monaco, Consolas, monospace',
    lineHeight: '1.5',
    whiteSpace: 'pre-wrap' as const,
    wordWrap: 'break-word' as const
  },
  linkSection: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px'
  },
  generateLinkButton: {
    padding: '10px 16px',
    backgroundColor: '#9C27B0',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    cursor: 'pointer',
    fontWeight: '600'
  },
  linkDisplay: {
    display: 'flex',
    gap: '8px'
  },
  linkInput: {
    flex: 1,
    padding: '8px 12px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '13px',
    fontFamily: 'Monaco, Consolas, monospace',
    backgroundColor: '#f9f9f9'
  },
  copyLinkButton: {
    padding: '8px 16px',
    backgroundColor: '#2196F3',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    fontSize: '13px',
    cursor: 'pointer',
    fontWeight: '600',
    whiteSpace: 'nowrap' as const
  },
  footer: {
    padding: '16px 24px',
    borderTop: '1px solid #eee',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  cancelButton: {
    padding: '10px 20px',
    backgroundColor: 'transparent',
    color: '#666',
    border: '1px solid #ddd',
    borderRadius: '6px',
    fontSize: '14px',
    cursor: 'pointer',
    fontWeight: '600'
  },
  actionButtons: {
    display: 'flex',
    gap: '12px'
  },
  copyButton: {
    padding: '10px 20px',
    backgroundColor: '#4CAF50',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    cursor: 'pointer',
    fontWeight: '600',
    minWidth: '100px'
  },
  downloadButton: {
    padding: '10px 20px',
    backgroundColor: '#2196F3',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    cursor: 'pointer',
    fontWeight: '600',
    minWidth: '120px'
  }
};
