/**
 * Code Context Panel Component
 *
 * Aggregates and displays all code files referenced in a conversation:
 * - File tree view
 * - Syntax-highlighted code snippets
 * - Links to messages that reference each file
 * - Download all files as ZIP
 */

import React, { useState, useEffect } from 'react';
import { GraphStore } from '../../core/graph-engine/GraphStore';

export interface CodeContextPanelProps {
  store: GraphStore;
  conversationId?: string;
  branchId?: string;
  messageId?: string;
  onMessageClick?: (messageId: string) => void;
}

export interface CodeFile {
  path: string;
  language: string;
  snippets: CodeSnippet[];
}

export interface CodeSnippet {
  startLine?: number;
  endLine?: number;
  code: string;
  linkedMessages: Array<{
    id: string;
    role: string;
    timestamp: Date;
  }>;
}

export interface CodeContext {
  files: CodeFile[];
  totalFiles: number;
  totalMessages: number;
}

export const CodeContextPanel: React.FC<CodeContextPanelProps> = ({
  store,
  conversationId,
  branchId,
  messageId,
  onMessageClick
}) => {
  const [codeContext, setCodeContext] = useState<CodeContext | null>(null);
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'tree' | 'list'>('list');

  useEffect(() => {
    const context = aggregateCodeContext();
    setCodeContext(context);
  }, [conversationId, branchId, messageId, store]);

  const aggregateCodeContext = (): CodeContext => {
    const filesMap = new Map<string, CodeFile>();
    const edges = store.getAllEdges();

    // Find all code reference edges
    const codeEdges = edges.filter((edge: any) => edge.type === 'references');

    for (const edge of codeEdges) {
      const edgeTyped = edge as any;
      const messageNode = store.getNode(edgeTyped.source);
      const codeNode = store.getNode(edgeTyped.target);

      if (!messageNode || !codeNode) continue;

      // Filter by message if specified
      if (messageId && edgeTyped.source !== messageId) continue;

      // Filter by conversation if specified
      if (conversationId && (messageNode as any).metadata?.conversationId !== conversationId) {
        continue;
      }

      // Filter by branch if specified
      if (branchId && (messageNode as any).metadata?.branchId !== branchId) {
        continue;
      }

      const filePath = (codeNode as any).filePath || (codeNode as any).id;
      const language = (codeNode as any).language || detectLanguage(filePath);
      const code = (codeNode as any).content || (codeNode as any).snippet || '';

      let file = filesMap.get(filePath);
      if (!file) {
        file = {
          path: filePath,
          language,
          snippets: []
        };
        filesMap.set(filePath, file);
      }

      // Check if snippet already exists
      const existingSnippet = file.snippets.find(s => s.code === code);

      if (existingSnippet) {
        existingSnippet.linkedMessages.push({
          id: edgeTyped.source,
          role: (messageNode as any).metadata?.role || 'unknown',
          timestamp: (messageNode as any).timestamp || new Date()
        });
      } else {
        file.snippets.push({
          code,
          linkedMessages: [{
            id: edgeTyped.source,
            role: (messageNode as any).metadata?.role || 'unknown',
            timestamp: (messageNode as any).timestamp || new Date()
          }]
        });
      }
    }

    const files = Array.from(filesMap.values());
    const totalMessages = new Set(
      files.flatMap(f => f.snippets.flatMap(s => s.linkedMessages.map(m => m.id)))
    ).size;

    return {
      files,
      totalFiles: files.length,
      totalMessages
    };
  };

  const toggleFileExpansion = (filePath: string) => {
    setExpandedFiles(prev => {
      const newSet = new Set(prev);
      if (newSet.has(filePath)) {
        newSet.delete(filePath);
      } else {
        newSet.add(filePath);
      }
      return newSet;
    });
  };

  const handleDownloadAll = () => {
    if (!codeContext) return;

    // Create a simple text bundle (in real implementation, use JSZip)
    let bundle = '# Code Context Bundle\n\n';

    for (const file of codeContext.files) {
      bundle += `## ${file.path}\n\n`;
      for (const snippet of file.snippets) {
        bundle += '```' + file.language + '\n';
        bundle += snippet.code + '\n';
        bundle += '```\n\n';
        bundle += `Referenced by ${snippet.linkedMessages.length} message(s)\n\n`;
      }
      bundle += '\n---\n\n';
    }

    // Create download
    const blob = new Blob([bundle], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'code-context-bundle.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  const getFileIcon = (language: string): string => {
    const icons: Record<string, string> = {
      typescript: '🔷',
      javascript: '🟨',
      tsx: '⚛️',
      jsx: '⚛️',
      python: '🐍',
      java: '☕',
      go: '🐹',
      rust: '🦀',
      php: '🐘',
      ruby: '💎',
      css: '🎨',
      html: '🌐',
      json: '📋',
      markdown: '📝'
    };
    return icons[language.toLowerCase()] || '📄';
  };

  if (!codeContext || codeContext.files.length === 0) {
    return (
      <div style={styles.panel}>
        <div style={styles.header}>
          <h2 style={styles.title}>📄 Code Context</h2>
        </div>
        <div style={styles.emptyState}>
          <p>No code files referenced in this {messageId ? 'message' : 'conversation'}</p>
          <p style={styles.emptyHint}>
            Link code files to messages to see them here
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.panel}>
      {/* Header */}
      <div style={styles.header}>
        <h2 style={styles.title}>📄 Code Context</h2>
        <div style={styles.headerActions}>
          <button
            style={styles.viewModeButton}
            onClick={() => setViewMode(viewMode === 'list' ? 'tree' : 'list')}
          >
            {viewMode === 'list' ? '🌳 Tree' : '📋 List'}
          </button>
          <button style={styles.downloadButton} onClick={handleDownloadAll}>
            ⬇️ Download All
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={styles.stats}>
        <span style={styles.stat}>
          {codeContext.totalFiles} file{codeContext.totalFiles !== 1 ? 's' : ''}
        </span>
        <span style={styles.stat}>
          {codeContext.totalMessages} message{codeContext.totalMessages !== 1 ? 's' : ''}
        </span>
      </div>

      {/* File List */}
      <div style={styles.fileList}>
        {codeContext.files.map(file => {
          const isExpanded = expandedFiles.has(file.path);

          return (
            <div key={file.path} style={styles.fileItem}>
              <div
                style={styles.fileHeader}
                onClick={() => toggleFileExpansion(file.path)}
              >
                <span style={styles.expandIcon}>{isExpanded ? '▼' : '▶'}</span>
                <span style={styles.fileIcon}>{getFileIcon(file.language)}</span>
                <span style={styles.fileName}>{getFileName(file.path)}</span>
                <span style={styles.filePath}>{getFilePath(file.path)}</span>
                <span style={styles.snippetCount}>
                  {file.snippets.length} snippet{file.snippets.length !== 1 ? 's' : ''}
                </span>
              </div>

              {isExpanded && (
                <div style={styles.fileContent}>
                  {file.snippets.map((snippet, index) => (
                    <div key={index} style={styles.snippet}>
                      <div style={styles.snippetHeader}>
                        <span style={styles.snippetLabel}>Code Snippet {index + 1}</span>
                        <span style={styles.snippetMeta}>
                          {snippet.linkedMessages.length} message{snippet.linkedMessages.length !== 1 ? 's' : ''}
                        </span>
                      </div>

                      <pre style={styles.codeBlock}>
                        <code>{snippet.code || '(empty)'}</code>
                      </pre>

                      <div style={styles.linkedMessages}>
                        <div style={styles.linkedMessagesLabel}>Referenced by:</div>
                        {snippet.linkedMessages.map(msg => (
                          <button
                            key={msg.id}
                            style={styles.messageLink}
                            onClick={() => onMessageClick?.(msg.id)}
                          >
                            {msg.role === 'user' ? '👤' : '🤖'} {msg.role}
                            <span style={styles.messageLinkTime}>
                              {new Date(msg.timestamp).toLocaleTimeString()}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

function detectLanguage(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase();
  const langMap: Record<string, string> = {
    ts: 'typescript',
    tsx: 'tsx',
    js: 'javascript',
    jsx: 'jsx',
    py: 'python',
    java: 'java',
    go: 'go',
    rs: 'rust',
    php: 'php',
    rb: 'ruby',
    css: 'css',
    html: 'html',
    json: 'json',
    md: 'markdown'
  };
  return langMap[ext || ''] || 'text';
}

function getFileName(path: string): string {
  return path.split('/').pop() || path;
}

function getFilePath(path: string): string {
  const parts = path.split('/');
  return parts.slice(0, -1).join('/') || '/';
}

const styles: Record<string, React.CSSProperties> = {
  panel: {
    width: '500px',
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
  headerActions: {
    display: 'flex',
    gap: '8px'
  },
  viewModeButton: {
    padding: '6px 12px',
    backgroundColor: '#f0f0f0',
    border: 'none',
    borderRadius: '4px',
    fontSize: '13px',
    cursor: 'pointer'
  },
  downloadButton: {
    padding: '6px 12px',
    backgroundColor: '#2196F3',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    fontSize: '13px',
    cursor: 'pointer'
  },
  stats: {
    padding: '12px 20px',
    backgroundColor: '#f9f9f9',
    borderBottom: '1px solid #eee',
    display: 'flex',
    gap: '20px'
  },
  stat: {
    fontSize: '13px',
    color: '#666',
    fontWeight: '600'
  },
  fileList: {
    flex: 1,
    overflowY: 'auto' as const
  },
  fileItem: {
    borderBottom: '1px solid #eee'
  },
  fileHeader: {
    padding: '12px 20px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    cursor: 'pointer',
    transition: 'background-color 0.2s'
  },
  expandIcon: {
    fontSize: '12px',
    color: '#999',
    width: '16px'
  },
  fileIcon: {
    fontSize: '18px'
  },
  fileName: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#333'
  },
  filePath: {
    fontSize: '12px',
    color: '#999',
    flex: 1
  },
  snippetCount: {
    fontSize: '11px',
    color: '#666',
    backgroundColor: '#e0e0e0',
    padding: '2px 8px',
    borderRadius: '10px'
  },
  fileContent: {
    backgroundColor: '#fafafa',
    padding: '12px 20px'
  },
  snippet: {
    marginBottom: '16px',
    backgroundColor: 'white',
    borderRadius: '6px',
    padding: '12px',
    border: '1px solid #eee'
  },
  snippetHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '8px'
  },
  snippetLabel: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#666'
  },
  snippetMeta: {
    fontSize: '11px',
    color: '#999'
  },
  codeBlock: {
    backgroundColor: '#f5f5f5',
    padding: '12px',
    borderRadius: '4px',
    fontSize: '13px',
    fontFamily: 'Monaco, Consolas, monospace',
    overflow: 'auto' as const,
    maxHeight: '300px',
    margin: '0 0 12px 0'
  },
  linkedMessages: {
    marginTop: '12px'
  },
  linkedMessagesLabel: {
    fontSize: '11px',
    color: '#666',
    marginBottom: '6px'
  },
  messageLink: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    padding: '6px 10px',
    marginBottom: '4px',
    backgroundColor: '#f0f0f0',
    border: 'none',
    borderRadius: '4px',
    fontSize: '12px',
    color: '#333',
    cursor: 'pointer',
    textAlign: 'left' as const
  },
  messageLinkTime: {
    fontSize: '11px',
    color: '#999'
  },
  emptyState: {
    padding: '40px 20px',
    textAlign: 'center' as const,
    color: '#666'
  },
  emptyHint: {
    fontSize: '13px',
    color: '#999',
    marginTop: '8px'
  }
};
