import React, { useState, useMemo } from 'react';

export interface CodeFile {
  path: string;
  name: string;
  language?: string;
  lastModified?: Date;
  size?: number;
}

export interface CodeReferenceSelectorProps {
  onSelect: (filePath: string) => void;
  onClose: () => void;
  availableFiles: CodeFile[];
  selectedFiles: string[];
  recentFiles?: string[];
}

/**
 * Code file selector with search, tree view, and recent files
 */
export const CodeReferenceSelector: React.FC<CodeReferenceSelectorProps> = ({
  onSelect,
  onClose,
  availableFiles,
  selectedFiles,
  recentFiles = []
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'tree'>('list');

  // Filter files by search query
  const filteredFiles = useMemo(() => {
    if (!searchQuery.trim()) return availableFiles;

    const query = searchQuery.toLowerCase();
    return availableFiles.filter(file =>
      file.name.toLowerCase().includes(query) ||
      file.path.toLowerCase().includes(query)
    );
  }, [availableFiles, searchQuery]);

  // Build file tree structure
  const fileTree = useMemo(() => {
    const tree: Record<string, CodeFile[]> = {};

    filteredFiles.forEach(file => {
      const parts = file.path.split('/');
      const directory = parts.slice(0, -1).join('/') || '/';

      if (!tree[directory]) {
        tree[directory] = [];
      }
      tree[directory].push(file);
    });

    return tree;
  }, [filteredFiles]);

  const handleSelect = (filePath: string) => {
    onSelect(filePath);
  };

  const isSelected = (filePath: string) => selectedFiles.includes(filePath);

  const getFileIcon = (language?: string) => {
    const icons: Record<string, string> = {
      typescript: '🔷',
      javascript: '🟨',
      tsx: '⚛️',
      jsx: '⚛️',
      python: '🐍',
      java: '☕',
      go: '🐹',
      rust: '🦀',
      css: '🎨',
      html: '🌐',
      json: '📦',
      markdown: '📝'
    };
    return icons[language || ''] || '📄';
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
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
        maxWidth: '700px',
        maxHeight: '80vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <h3 style={{
            margin: 0,
            fontSize: '16px',
            fontWeight: '600',
            color: '#1f2937'
          }}>
            Link Code Files
          </h3>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '20px',
              cursor: 'pointer',
              color: '#6b7280',
              padding: '4px'
            }}
          >
            ×
          </button>
        </div>

        {/* Search and view mode */}
        <div style={{
          padding: '12px 20px',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          gap: '12px',
          alignItems: 'center'
        }}>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search files..."
            style={{
              flex: 1,
              padding: '8px 12px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              fontSize: '14px'
            }}
            autoFocus
          />
          <div style={{
            display: 'flex',
            gap: '4px',
            border: '1px solid #d1d5db',
            borderRadius: '6px',
            overflow: 'hidden'
          }}>
            <button
              onClick={() => setViewMode('list')}
              style={{
                padding: '6px 12px',
                border: 'none',
                backgroundColor: viewMode === 'list' ? '#e5e7eb' : 'white',
                cursor: 'pointer',
                fontSize: '13px'
              }}
            >
              📋 List
            </button>
            <button
              onClick={() => setViewMode('tree')}
              style={{
                padding: '6px 12px',
                border: 'none',
                backgroundColor: viewMode === 'tree' ? '#e5e7eb' : 'white',
                cursor: 'pointer',
                fontSize: '13px'
              }}
            >
              🌲 Tree
            </button>
          </div>
        </div>

        {/* Selected files count */}
        {selectedFiles.length > 0 && (
          <div style={{
            padding: '8px 20px',
            backgroundColor: '#dbeafe',
            borderBottom: '1px solid #93c5fd',
            fontSize: '13px',
            color: '#1e40af'
          }}>
            {selectedFiles.length} file{selectedFiles.length !== 1 ? 's' : ''} selected
          </div>
        )}

        {/* Recent files */}
        {recentFiles.length > 0 && !searchQuery && (
          <div style={{
            padding: '12px 20px',
            borderBottom: '1px solid #e5e7eb'
          }}>
            <div style={{
              fontSize: '12px',
              fontWeight: '600',
              color: '#6b7280',
              marginBottom: '8px'
            }}>
              Recent Files
            </div>
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '6px'
            }}>
              {recentFiles.slice(0, 5).map(filePath => {
                const file = availableFiles.find(f => f.path === filePath);
                if (!file) return null;

                return (
                  <button
                    key={filePath}
                    onClick={() => handleSelect(filePath)}
                    style={{
                      padding: '4px 10px',
                      fontSize: '12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      backgroundColor: isSelected(filePath) ? '#dbeafe' : 'white',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <span>{getFileIcon(file.language)}</span>
                    <span>{file.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* File list or tree */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '12px 20px'
        }}>
          {viewMode === 'list' ? (
            // List view
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {filteredFiles.length === 0 ? (
                <div style={{
                  padding: '40px',
                  textAlign: 'center',
                  color: '#9ca3af',
                  fontSize: '14px'
                }}>
                  {searchQuery ? 'No files found' : 'No files available'}
                </div>
              ) : (
                filteredFiles.map(file => (
                  <button
                    key={file.path}
                    onClick={() => handleSelect(file.path)}
                    style={{
                      padding: '10px 12px',
                      border: '1px solid #e5e7eb',
                      borderRadius: '6px',
                      backgroundColor: isSelected(file.path) ? '#dbeafe' : 'white',
                      cursor: 'pointer',
                      textAlign: 'left',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      transition: 'all 0.15s'
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected(file.path)) {
                        e.currentTarget.style.backgroundColor = '#f9fafb';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected(file.path)) {
                        e.currentTarget.style.backgroundColor = 'white';
                      }
                    }}
                  >
                    <span style={{ fontSize: '18px' }}>{getFileIcon(file.language)}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: '13px',
                        fontWeight: '500',
                        color: '#1f2937',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {file.name}
                      </div>
                      <div style={{
                        fontSize: '11px',
                        color: '#6b7280',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {file.path}
                      </div>
                    </div>
                    {file.size && (
                      <div style={{
                        fontSize: '11px',
                        color: '#9ca3af'
                      }}>
                        {formatFileSize(file.size)}
                      </div>
                    )}
                    {isSelected(file.path) && (
                      <span style={{ color: '#3b82f6', fontSize: '16px' }}>✓</span>
                    )}
                  </button>
                ))
              )}
            </div>
          ) : (
            // Tree view
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {Object.keys(fileTree).length === 0 ? (
                <div style={{
                  padding: '40px',
                  textAlign: 'center',
                  color: '#9ca3af',
                  fontSize: '14px'
                }}>
                  No files found
                </div>
              ) : (
                Object.entries(fileTree).map(([directory, files]) => (
                  <div key={directory}>
                    <div style={{
                      fontSize: '12px',
                      fontWeight: '600',
                      color: '#6b7280',
                      marginBottom: '4px',
                      padding: '4px 0'
                    }}>
                      📁 {directory}
                    </div>
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '2px',
                      marginLeft: '16px'
                    }}>
                      {files.map(file => (
                        <button
                          key={file.path}
                          onClick={() => handleSelect(file.path)}
                          style={{
                            padding: '6px 10px',
                            border: '1px solid #e5e7eb',
                            borderRadius: '4px',
                            backgroundColor: isSelected(file.path) ? '#dbeafe' : 'white',
                            cursor: 'pointer',
                            textAlign: 'left',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            fontSize: '13px'
                          }}
                        >
                          <span>{getFileIcon(file.language)}</span>
                          <span>{file.name}</span>
                          {isSelected(file.path) && (
                            <span style={{ marginLeft: 'auto', color: '#3b82f6' }}>✓</span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 20px',
          borderTop: '1px solid #e5e7eb',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '8px'
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              backgroundColor: 'white',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: '500'
            }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

CodeReferenceSelector.displayName = 'CodeReferenceSelector';