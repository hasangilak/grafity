/**
 * Context panel component for displaying conversation context and related nodes
 */

import React, { useState, useCallback, memo, useMemo } from 'react';
import { ExtractedContext, CodeContext, DocumentContext } from '../context/ContextExtractor';
import { AnyGraphNode, CodeNode, DocumentNode, BusinessNode } from '../../core/graph-engine/types/NodeTypes';

export interface ContextPanelProps {
  context: ExtractedContext;
  selectedMessageId?: string | null;
  onNodeSelect: (nodeId: string) => void;
  onToggleCollapse: () => void;
  className?: string;
  style?: React.CSSProperties;
}

export interface ContextSection {
  id: string;
  title: string;
  items: ContextItem[];
  isExpanded: boolean;
  priority: 'high' | 'medium' | 'low';
}

export interface ContextItem {
  id: string;
  type: 'code' | 'document' | 'business' | 'topic' | 'reference';
  title: string;
  subtitle?: string;
  description?: string;
  relevanceScore: number;
  isActive: boolean;
  metadata?: any;
}

/**
 * Context panel showing relevant nodes, files, and information
 */
export const ContextPanel: React.FC<ContextPanelProps> = memo(({
  context,
  selectedMessageId,
  onNodeSelect,
  onToggleCollapse,
  className = '',
  style = {}
}) => {
  // State
  const [activeTab, setActiveTab] = useState<'context' | 'code' | 'docs' | 'insights'>('context');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['relevant-nodes', 'code-context', 'documents'])
  );
  const [searchQuery, setSearchQuery] = useState('');

  // Memoized context sections
  const contextSections = useMemo(() => buildContextSections(context), [context]);
  const filteredSections = useMemo(() =>
    searchQuery ? filterSections(contextSections, searchQuery) : contextSections,
    [contextSections, searchQuery]
  );

  // Event handlers
  const handleNodeClick = useCallback((nodeId: string) => {
    onNodeSelect(nodeId);
  }, [onNodeSelect]);

  const toggleSection = useCallback((sectionId: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(sectionId)) {
      newExpanded.delete(sectionId);
    } else {
      newExpanded.add(sectionId);
    }
    setExpandedSections(newExpanded);
  }, [expandedSections]);

  const renderContextItem = useCallback((item: ContextItem) => {
    return (
      <div
        key={item.id}
        style={{
          padding: '8px 12px',
          margin: '2px 0',
          backgroundColor: item.isActive ? '#eff6ff' : 'white',
          border: '1px solid #e5e7eb',
          borderRadius: '6px',
          cursor: 'pointer',
          transition: 'all 0.2s ease'
        }}
        onClick={() => handleNodeClick(item.id)}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = item.isActive ? '#dbeafe' : '#f9fafb';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = item.isActive ? '#eff6ff' : 'white';
        }}
      >
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'between'
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: '12px',
              fontWeight: '500',
              color: '#1f2937',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}>
              {getItemIcon(item.type)} {item.title}
            </div>
            {item.subtitle && (
              <div style={{
                fontSize: '10px',
                color: '#6b7280',
                marginTop: '2px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}>
                {item.subtitle}
              </div>
            )}
            {item.description && (
              <div style={{
                fontSize: '10px',
                color: '#4b5563',
                marginTop: '4px',
                lineHeight: '1.3'
              }}>
                {item.description}
              </div>
            )}
          </div>

          {/* Relevance score */}
          <div style={{
            marginLeft: '8px',
            flexShrink: 0
          }}>
            <div
              style={{
                width: '32px',
                height: '4px',
                backgroundColor: '#e5e7eb',
                borderRadius: '2px',
                overflow: 'hidden'
              }}
            >
              <div
                style={{
                  width: `${item.relevanceScore * 100}%`,
                  height: '100%',
                  backgroundColor: getRelevanceColor(item.relevanceScore),
                  transition: 'width 0.3s ease'
                }}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }, [handleNodeClick]);

  const renderContextSection = useCallback((section: ContextSection) => {
    const isExpanded = expandedSections.has(section.id);

    return (
      <div key={section.id} style={{ marginBottom: '12px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'between',
            padding: '8px 4px',
            cursor: 'pointer',
            borderRadius: '4px'
          }}
          onClick={() => toggleSection(section.id)}
        >
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <span style={{
              fontSize: '12px',
              transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s ease'
            }}>
              ▶
            </span>
            <span style={{
              fontSize: '13px',
              fontWeight: '600',
              color: '#1f2937'
            }}>
              {section.title}
            </span>
            <span style={{
              fontSize: '10px',
              color: '#6b7280',
              backgroundColor: '#f3f4f6',
              padding: '2px 6px',
              borderRadius: '8px'
            }}>
              {section.items.length}
            </span>
          </div>

          <div
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: getPriorityColor(section.priority)
            }}
          />
        </div>

        {isExpanded && (
          <div style={{ marginTop: '4px' }}>
            {section.items.map(item => renderContextItem(item))}
          </div>
        )}
      </div>
    );
  }, [expandedSections, toggleSection, renderContextItem]);

  return (
    <div
      className={`context-panel ${className}`}
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
            Context
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
            title="Collapse panel"
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
          {[
            { id: 'context', label: 'All' },
            { id: 'code', label: 'Code' },
            { id: 'docs', label: 'Docs' },
            { id: 'insights', label: 'Insights' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              style={{
                flex: 1,
                padding: '6px 8px',
                border: 'none',
                borderRadius: '4px',
                fontSize: '11px',
                cursor: 'pointer',
                backgroundColor: activeTab === tab.id ? 'white' : 'transparent',
                color: activeTab === tab.id ? '#1f2937' : '#6b7280',
                fontWeight: activeTab === tab.id ? '500' : '400'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div style={{ marginTop: '8px' }}>
          <input
            type="text"
            placeholder="Search context..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '6px 8px',
              border: '1px solid #d1d5db',
              borderRadius: '4px',
              fontSize: '11px'
            }}
          />
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '8px' }}>
        {/* Context Score */}
        <div style={{
          padding: '8px',
          backgroundColor: 'white',
          borderRadius: '6px',
          marginBottom: '8px',
          border: '1px solid #e5e7eb'
        }}>
          <div style={{
            fontSize: '11px',
            color: '#6b7280',
            marginBottom: '4px'
          }}>
            Context Quality
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <div
              style={{
                flex: 1,
                height: '6px',
                backgroundColor: '#e5e7eb',
                borderRadius: '3px',
                overflow: 'hidden'
              }}
            >
              <div
                style={{
                  width: `${context.contextScore * 100}%`,
                  height: '100%',
                  backgroundColor: getRelevanceColor(context.contextScore),
                  transition: 'width 0.3s ease'
                }}
              />
            </div>
            <span style={{
              fontSize: '11px',
              fontWeight: '500',
              color: '#1f2937'
            }}>
              {Math.round(context.contextScore * 100)}%
            </span>
          </div>
        </div>

        {/* Context sections based on active tab */}
        {activeTab === 'context' && (
          <div>
            {filteredSections.map(section => renderContextSection(section))}
          </div>
        )}

        {activeTab === 'code' && (
          <div>
            <CodeContextView context={context.codeContext} onNodeSelect={onNodeSelect} />
          </div>
        )}

        {activeTab === 'docs' && (
          <div>
            <DocumentContextView context={context.documentContext} onNodeSelect={onNodeSelect} />
          </div>
        )}

        {activeTab === 'insights' && (
          <div>
            <ContextInsightsView context={context} />
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
        {context.relevantNodes.length} nodes • {context.extractionMetadata.processingTime}ms
      </div>
    </div>
  );
});

ContextPanel.displayName = 'ContextPanel';

/**
 * Sub-components
 */
const CodeContextView: React.FC<{
  context: CodeContext;
  onNodeSelect: (nodeId: string) => void;
}> = memo(({ context, onNodeSelect }) => {
  return (
    <div>
      {/* Active files */}
      {context.activeFiles.length > 0 && (
        <div style={{ marginBottom: '12px' }}>
          <h4 style={{
            margin: '0 0 6px 0',
            fontSize: '12px',
            fontWeight: '600',
            color: '#1f2937'
          }}>
            Active Files
          </h4>
          {context.activeFiles.map((file, index) => (
            <div
              key={index}
              style={{
                padding: '6px 8px',
                backgroundColor: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: '4px',
                marginBottom: '2px',
                fontSize: '11px',
                fontFamily: 'monospace'
              }}
            >
              {file}
            </div>
          ))}
        </div>
      )}

      {/* Code patterns */}
      {context.codePatterns.length > 0 && (
        <div style={{ marginBottom: '12px' }}>
          <h4 style={{
            margin: '0 0 6px 0',
            fontSize: '12px',
            fontWeight: '600',
            color: '#1f2937'
          }}>
            Detected Patterns
          </h4>
          {context.codePatterns.map((pattern, index) => (
            <div
              key={index}
              style={{
                padding: '6px 8px',
                backgroundColor: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: '4px',
                marginBottom: '2px'
              }}
            >
              <div style={{
                fontSize: '11px',
                fontWeight: '500',
                color: '#1f2937'
              }}>
                {pattern.pattern}
              </div>
              <div style={{
                fontSize: '10px',
                color: '#6b7280'
              }}>
                {pattern.files.length} files • {Math.round(pattern.confidence * 100)}% confidence
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

const DocumentContextView: React.FC<{
  context: DocumentContext;
  onNodeSelect: (nodeId: string) => void;
}> = memo(({ context, onNodeSelect }) => {
  return (
    <div>
      {/* Relevant sections */}
      {context.relevantSections.length > 0 && (
        <div style={{ marginBottom: '12px' }}>
          <h4 style={{
            margin: '0 0 6px 0',
            fontSize: '12px',
            fontWeight: '600',
            color: '#1f2937'
          }}>
            Relevant Sections
          </h4>
          {context.relevantSections.map((section, index) => (
            <div
              key={index}
              style={{
                padding: '6px 8px',
                backgroundColor: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: '4px',
                marginBottom: '4px',
                cursor: 'pointer'
              }}
              onClick={() => onNodeSelect(section.documentId)}
            >
              <div style={{
                fontSize: '11px',
                fontWeight: '500',
                color: '#1f2937'
              }}>
                {section.sectionTitle}
              </div>
              <div style={{
                fontSize: '10px',
                color: '#4b5563',
                marginTop: '2px',
                lineHeight: '1.3'
              }}>
                {section.content.substring(0, 100)}...
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

const ContextInsightsView: React.FC<{
  context: ExtractedContext;
}> = memo(({ context }) => {
  return (
    <div>
      {/* Graph structure insights */}
      <div style={{ marginBottom: '12px' }}>
        <h4 style={{
          margin: '0 0 6px 0',
          fontSize: '12px',
          fontWeight: '600',
          color: '#1f2937'
        }}>
          Graph Structure
        </h4>
        <div style={{
          padding: '8px',
          backgroundColor: 'white',
          border: '1px solid #e5e7eb',
          borderRadius: '4px'
        }}>
          <div style={{ fontSize: '10px', marginBottom: '4px' }}>
            <strong>Central Nodes:</strong> {context.contextGraph.centralNodes.length}
          </div>
          <div style={{ fontSize: '10px', marginBottom: '4px' }}>
            <strong>Clusters:</strong> {context.contextGraph.clusters.length}
          </div>
          <div style={{ fontSize: '10px' }}>
            <strong>Pathways:</strong> {context.contextGraph.pathways.length}
          </div>
        </div>
      </div>

      {/* Processing metadata */}
      <div>
        <h4 style={{
          margin: '0 0 6px 0',
          fontSize: '12px',
          fontWeight: '600',
          color: '#1f2937'
        }}>
          Processing Info
        </h4>
        <div style={{
          padding: '8px',
          backgroundColor: 'white',
          border: '1px solid #e5e7eb',
          borderRadius: '4px'
        }}>
          <div style={{ fontSize: '10px', marginBottom: '4px' }}>
            <strong>Method:</strong> {context.extractionMetadata.extractionMethod}
          </div>
          <div style={{ fontSize: '10px', marginBottom: '4px' }}>
            <strong>Time:</strong> {context.extractionMetadata.processingTime}ms
          </div>
          <div style={{ fontSize: '10px' }}>
            <strong>Nodes Evaluated:</strong> {context.extractionMetadata.totalNodesEvaluated}
          </div>
        </div>
      </div>
    </div>
  );
});

/**
 * Helper functions
 */
function buildContextSections(context: ExtractedContext): ContextSection[] {
  const sections: ContextSection[] = [];

  // Relevant nodes section
  if (context.relevantNodes.length > 0) {
    sections.push({
      id: 'relevant-nodes',
      title: 'Relevant Nodes',
      priority: 'high',
      isExpanded: true,
      items: context.relevantNodes.map(node => ({
        id: node.id,
        type: node.type === 'code' ? 'code' : node.type === 'document' ? 'document' : 'business',
        title: node.label,
        subtitle: getNodeSubtitle(node),
        description: node.description,
        relevanceScore: context.relevanceScores.get(node.id) || 0.5,
        isActive: false
      }))
    });
  }

  // Code files section
  if (context.referencedFiles.length > 0) {
    sections.push({
      id: 'code-files',
      title: 'Code Files',
      priority: 'high',
      isExpanded: true,
      items: context.referencedFiles.map(node => ({
        id: node.id,
        type: 'code',
        title: getFileName(node.filePath),
        subtitle: node.filePath,
        description: `${node.codeType} • ${node.language}`,
        relevanceScore: context.relevanceScores.get(node.id) || 0.5,
        isActive: false
      }))
    });
  }

  // Documents section
  if (context.relatedDocuments.length > 0) {
    sections.push({
      id: 'documents',
      title: 'Documentation',
      priority: 'medium',
      isExpanded: true,
      items: context.relatedDocuments.map(node => ({
        id: node.id,
        type: 'document',
        title: node.label,
        subtitle: node.filePath,
        description: node.documentType,
        relevanceScore: context.relevanceScores.get(node.id) || 0.5,
        isActive: false
      }))
    });
  }

  return sections;
}

function filterSections(sections: ContextSection[], query: string): ContextSection[] {
  const lowerQuery = query.toLowerCase();

  return sections
    .map(section => ({
      ...section,
      items: section.items.filter(item =>
        item.title.toLowerCase().includes(lowerQuery) ||
        item.subtitle?.toLowerCase().includes(lowerQuery) ||
        item.description?.toLowerCase().includes(lowerQuery)
      )
    }))
    .filter(section => section.items.length > 0);
}

function getItemIcon(type: string): string {
  const icons = {
    code: '📄',
    document: '📚',
    business: '💼',
    topic: '🏷️',
    reference: '🔗'
  };
  return icons[type] || '📄';
}

function getRelevanceColor(score: number): string {
  if (score >= 0.8) return '#10b981';
  if (score >= 0.6) return '#f59e0b';
  if (score >= 0.4) return '#ef4444';
  return '#6b7280';
}

function getPriorityColor(priority: string): string {
  const colors = {
    high: '#ef4444',
    medium: '#f59e0b',
    low: '#10b981'
  };
  return colors[priority] || '#6b7280';
}

function getNodeSubtitle(node: AnyGraphNode): string {
  if (node.type === 'code') {
    const codeNode = node as CodeNode;
    return codeNode.filePath;
  }
  if (node.type === 'document') {
    const docNode = node as DocumentNode;
    return docNode.filePath || docNode.documentType || '';
  }
  if (node.type === 'business') {
    const bizNode = node as BusinessNode;
    return bizNode.businessType;
  }
  return '';
}

function getFileName(filePath: string): string {
  return filePath.split('/').pop() || filePath;
}