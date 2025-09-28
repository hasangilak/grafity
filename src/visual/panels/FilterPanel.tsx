import React, { useState, useCallback, memo, useMemo } from 'react';
import { AnyGraphNode } from '../../core/graph-engine/types/NodeTypes';
import { GraphEdge } from '../../core/graph-engine/types/EdgeTypes';

export interface FilterCriteria {
  nodeTypes: Set<string>;
  edgeTypes: Set<string>;
  searchQuery: string;
  minComplexity?: number;
  maxComplexity?: number;
  priorities?: Set<string>;
  statuses?: Set<string>;
  languages?: Set<string>;
  dateRange?: {
    start: Date;
    end: Date;
  };
  customFilters?: Map<string, any>;
}

export interface FilterPanelProps {
  nodes: AnyGraphNode[];
  edges: GraphEdge[];
  filters: FilterCriteria;
  onFiltersChange: (filters: FilterCriteria) => void;
  onApply: () => void;
  onReset: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Filter panel for graph visualization
 */
export const FilterPanel: React.FC<FilterPanelProps> = memo(({
  nodes,
  edges,
  filters,
  onFiltersChange,
  onApply,
  onReset,
  isCollapsed = false,
  onToggleCollapse,
  className = '',
  style = {}
}) => {
  const [localFilters, setLocalFilters] = useState<FilterCriteria>(filters);
  const [activeTab, setActiveTab] = useState<'nodes' | 'edges' | 'advanced'>('nodes');

  // Extract available options from data
  const availableOptions = useMemo(() => {
    const nodeTypes = new Set<string>();
    const edgeTypes = new Set<string>();
    const languages = new Set<string>();
    const priorities = new Set<string>();
    const statuses = new Set<string>();
    let minComplexity = Infinity;
    let maxComplexity = -Infinity;

    nodes.forEach(node => {
      nodeTypes.add(node.type);

      if ('language' in node && node.language) {
        languages.add(node.language);
      }

      if ('priority' in node && node.priority) {
        priorities.add(node.priority);
      }

      if ('status' in node && node.status) {
        statuses.add(node.status);
      }

      if (node.metadata?.complexity) {
        const complexity = node.metadata.complexity as number;
        minComplexity = Math.min(minComplexity, complexity);
        maxComplexity = Math.max(maxComplexity, complexity);
      }
    });

    edges.forEach(edge => {
      edgeTypes.add(edge.type);
    });

    return {
      nodeTypes: Array.from(nodeTypes),
      edgeTypes: Array.from(edgeTypes),
      languages: Array.from(languages),
      priorities: Array.from(priorities),
      statuses: Array.from(statuses),
      complexityRange: {
        min: minComplexity === Infinity ? 0 : minComplexity,
        max: maxComplexity === -Infinity ? 100 : maxComplexity
      }
    };
  }, [nodes, edges]);

  const handleNodeTypeToggle = useCallback((type: string) => {
    const newNodeTypes = new Set(localFilters.nodeTypes);
    if (newNodeTypes.has(type)) {
      newNodeTypes.delete(type);
    } else {
      newNodeTypes.add(type);
    }
    setLocalFilters({
      ...localFilters,
      nodeTypes: newNodeTypes
    });
  }, [localFilters]);

  const handleEdgeTypeToggle = useCallback((type: string) => {
    const newEdgeTypes = new Set(localFilters.edgeTypes);
    if (newEdgeTypes.has(type)) {
      newEdgeTypes.delete(type);
    } else {
      newEdgeTypes.add(type);
    }
    setLocalFilters({
      ...localFilters,
      edgeTypes: newEdgeTypes
    });
  }, [localFilters]);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalFilters({
      ...localFilters,
      searchQuery: e.target.value
    });
  }, [localFilters]);

  const handleComplexityChange = useCallback((field: 'min' | 'max', value: string) => {
    const numValue = value === '' ? undefined : Number(value);
    setLocalFilters({
      ...localFilters,
      minComplexity: field === 'min' ? numValue : localFilters.minComplexity,
      maxComplexity: field === 'max' ? numValue : localFilters.maxComplexity
    });
  }, [localFilters]);

  const handleApply = useCallback(() => {
    onFiltersChange(localFilters);
    onApply();
  }, [localFilters, onFiltersChange, onApply]);

  const handleReset = useCallback(() => {
    const defaultFilters: FilterCriteria = {
      nodeTypes: new Set(availableOptions.nodeTypes),
      edgeTypes: new Set(availableOptions.edgeTypes),
      searchQuery: '',
      minComplexity: undefined,
      maxComplexity: undefined,
      priorities: new Set(availableOptions.priorities),
      statuses: new Set(availableOptions.statuses),
      languages: new Set(availableOptions.languages)
    };
    setLocalFilters(defaultFilters);
    onFiltersChange(defaultFilters);
    onReset();
  }, [availableOptions, onFiltersChange, onReset]);

  const getActiveFilterCount = useCallback(() => {
    let count = 0;

    // Count deselected node types
    if (localFilters.nodeTypes.size < availableOptions.nodeTypes.length) {
      count += availableOptions.nodeTypes.length - localFilters.nodeTypes.size;
    }

    // Count deselected edge types
    if (localFilters.edgeTypes.size < availableOptions.edgeTypes.length) {
      count += availableOptions.edgeTypes.length - localFilters.edgeTypes.size;
    }

    // Other filters
    if (localFilters.searchQuery) count++;
    if (localFilters.minComplexity !== undefined) count++;
    if (localFilters.maxComplexity !== undefined) count++;

    return count;
  }, [localFilters, availableOptions]);

  if (isCollapsed) {
    return (
      <div
        className={`filter-panel collapsed ${className}`}
        style={{
          position: 'absolute',
          left: '20px',
          top: '20px',
          background: 'white',
          border: '1px solid #ddd',
          borderRadius: '4px',
          padding: '10px',
          cursor: 'pointer',
          ...style
        }}
        onClick={onToggleCollapse}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span>🔧 Filters</span>
          {getActiveFilterCount() > 0 && (
            <span
              style={{
                background: '#4285f4',
                color: 'white',
                borderRadius: '12px',
                padding: '2px 8px',
                fontSize: '12px'
              }}
            >
              {getActiveFilterCount()}
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`filter-panel expanded ${className}`}
      style={{
        position: 'absolute',
        left: '20px',
        top: '20px',
        width: '280px',
        background: 'white',
        border: '1px solid #ddd',
        borderRadius: '4px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        ...style
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px',
          borderBottom: '1px solid #eee'
        }}
      >
        <h3 style={{ margin: 0, fontSize: '16px' }}>Filters</h3>
        <button
          onClick={onToggleCollapse}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: '20px'
          }}
        >
          ×
        </button>
      </div>

      {/* Search */}
      <div style={{ padding: '12px', borderBottom: '1px solid #eee' }}>
        <input
          type="text"
          placeholder="Search nodes..."
          value={localFilters.searchQuery}
          onChange={handleSearchChange}
          style={{
            width: '100%',
            padding: '8px',
            border: '1px solid #ddd',
            borderRadius: '4px',
            fontSize: '14px'
          }}
        />
      </div>

      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          borderBottom: '1px solid #eee'
        }}
      >
        <button
          className={`tab ${activeTab === 'nodes' ? 'active' : ''}`}
          onClick={() => setActiveTab('nodes')}
          style={{
            flex: 1,
            padding: '10px',
            border: 'none',
            background: activeTab === 'nodes' ? '#f5f5f5' : 'white',
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          Nodes
        </button>
        <button
          className={`tab ${activeTab === 'edges' ? 'active' : ''}`}
          onClick={() => setActiveTab('edges')}
          style={{
            flex: 1,
            padding: '10px',
            border: 'none',
            borderLeft: '1px solid #eee',
            borderRight: '1px solid #eee',
            background: activeTab === 'edges' ? '#f5f5f5' : 'white',
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          Edges
        </button>
        <button
          className={`tab ${activeTab === 'advanced' ? 'active' : ''}`}
          onClick={() => setActiveTab('advanced')}
          style={{
            flex: 1,
            padding: '10px',
            border: 'none',
            background: activeTab === 'advanced' ? '#f5f5f5' : 'white',
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          Advanced
        </button>
      </div>

      {/* Tab Content */}
      <div
        style={{
          padding: '12px',
          maxHeight: '400px',
          overflowY: 'auto'
        }}
      >
        {activeTab === 'nodes' && (
          <div className="node-filters">
            <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#666' }}>
              Node Types
            </h4>
            {availableOptions.nodeTypes.map(type => (
              <label
                key={type}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  marginBottom: '8px',
                  cursor: 'pointer'
                }}
              >
                <input
                  type="checkbox"
                  checked={localFilters.nodeTypes.has(type)}
                  onChange={() => handleNodeTypeToggle(type)}
                  style={{ marginRight: '8px' }}
                />
                <span style={{ fontSize: '14px' }}>
                  {getNodeTypeIcon(type)} {type}
                </span>
                <span
                  style={{
                    marginLeft: 'auto',
                    fontSize: '12px',
                    color: '#999'
                  }}
                >
                  {nodes.filter(n => n.type === type).length}
                </span>
              </label>
            ))}

            {availableOptions.languages.length > 0 && (
              <>
                <h4 style={{ margin: '20px 0 10px 0', fontSize: '14px', color: '#666' }}>
                  Languages
                </h4>
                {availableOptions.languages.map(lang => (
                  <label
                    key={lang}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      marginBottom: '8px',
                      cursor: 'pointer'
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={localFilters.languages?.has(lang) ?? true}
                      onChange={() => {
                        const newLanguages = new Set(localFilters.languages || availableOptions.languages);
                        if (newLanguages.has(lang)) {
                          newLanguages.delete(lang);
                        } else {
                          newLanguages.add(lang);
                        }
                        setLocalFilters({
                          ...localFilters,
                          languages: newLanguages
                        });
                      }}
                      style={{ marginRight: '8px' }}
                    />
                    <span style={{ fontSize: '14px' }}>{lang}</span>
                  </label>
                ))}
              </>
            )}
          </div>
        )}

        {activeTab === 'edges' && (
          <div className="edge-filters">
            <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#666' }}>
              Edge Types
            </h4>
            {availableOptions.edgeTypes.map(type => (
              <label
                key={type}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  marginBottom: '8px',
                  cursor: 'pointer'
                }}
              >
                <input
                  type="checkbox"
                  checked={localFilters.edgeTypes.has(type)}
                  onChange={() => handleEdgeTypeToggle(type)}
                  style={{ marginRight: '8px' }}
                />
                <span style={{ fontSize: '14px' }}>
                  {getEdgeTypeIcon(type)} {type}
                </span>
                <span
                  style={{
                    marginLeft: 'auto',
                    fontSize: '12px',
                    color: '#999'
                  }}
                >
                  {edges.filter(e => e.type === type).length}
                </span>
              </label>
            ))}
          </div>
        )}

        {activeTab === 'advanced' && (
          <div className="advanced-filters">
            <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#666' }}>
              Complexity Range
            </h4>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
              <input
                type="number"
                placeholder="Min"
                value={localFilters.minComplexity || ''}
                onChange={(e) => handleComplexityChange('min', e.target.value)}
                style={{
                  flex: 1,
                  padding: '6px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '14px'
                }}
              />
              <span style={{ alignSelf: 'center' }}>-</span>
              <input
                type="number"
                placeholder="Max"
                value={localFilters.maxComplexity || ''}
                onChange={(e) => handleComplexityChange('max', e.target.value)}
                style={{
                  flex: 1,
                  padding: '6px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '14px'
                }}
              />
            </div>

            {availableOptions.priorities.length > 0 && (
              <>
                <h4 style={{ margin: '20px 0 10px 0', fontSize: '14px', color: '#666' }}>
                  Priorities
                </h4>
                {availableOptions.priorities.map(priority => (
                  <label
                    key={priority}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      marginBottom: '8px',
                      cursor: 'pointer'
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={localFilters.priorities?.has(priority) ?? true}
                      onChange={() => {
                        const newPriorities = new Set(localFilters.priorities || availableOptions.priorities);
                        if (newPriorities.has(priority)) {
                          newPriorities.delete(priority);
                        } else {
                          newPriorities.add(priority);
                        }
                        setLocalFilters({
                          ...localFilters,
                          priorities: newPriorities
                        });
                      }}
                      style={{ marginRight: '8px' }}
                    />
                    <span style={{ fontSize: '14px' }}>
                      {getPriorityIcon(priority)} {priority}
                    </span>
                  </label>
                ))}
              </>
            )}

            {availableOptions.statuses.length > 0 && (
              <>
                <h4 style={{ margin: '20px 0 10px 0', fontSize: '14px', color: '#666' }}>
                  Status
                </h4>
                {availableOptions.statuses.map(status => (
                  <label
                    key={status}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      marginBottom: '8px',
                      cursor: 'pointer'
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={localFilters.statuses?.has(status) ?? true}
                      onChange={() => {
                        const newStatuses = new Set(localFilters.statuses || availableOptions.statuses);
                        if (newStatuses.has(status)) {
                          newStatuses.delete(status);
                        } else {
                          newStatuses.add(status);
                        }
                        setLocalFilters({
                          ...localFilters,
                          statuses: newStatuses
                        });
                      }}
                      style={{ marginRight: '8px' }}
                    />
                    <span style={{ fontSize: '14px' }}>
                      {getStatusIcon(status)} {status}
                    </span>
                  </label>
                ))}
              </>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      <div
        style={{
          display: 'flex',
          gap: '10px',
          padding: '12px',
          borderTop: '1px solid #eee'
        }}
      >
        <button
          onClick={handleReset}
          style={{
            flex: 1,
            padding: '8px',
            border: '1px solid #ddd',
            borderRadius: '4px',
            background: 'white',
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          Reset
        </button>
        <button
          onClick={handleApply}
          style={{
            flex: 1,
            padding: '8px',
            border: 'none',
            borderRadius: '4px',
            background: '#4285f4',
            color: 'white',
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          Apply Filters
        </button>
      </div>
    </div>
  );
});

FilterPanel.displayName = 'FilterPanel';

// Helper functions for icons
function getNodeTypeIcon(type: string): string {
  switch (type) {
    case 'code': return '📦';
    case 'business': return '📈';
    case 'document': return '📄';
    case 'conversation': return '💬';
    default: return '⚪';
  }
}

function getEdgeTypeIcon(type: string): string {
  switch (type) {
    case 'imports':
    case 'exports': return '🔗';
    case 'calls':
    case 'uses': return '➡️';
    case 'implements':
    case 'extends': return '🔺';
    case 'references': return '📌';
    case 'contains': return '📦';
    case 'related_to': return '🔄';
    case 'discusses': return '💭';
    default: return '➖';
  }
}

function getPriorityIcon(priority: string): string {
  switch (priority) {
    case 'high': return '🔴';
    case 'medium': return '🟡';
    case 'low': return '🟢';
    default: return '⚪';
  }
}

function getStatusIcon(status: string): string {
  switch (status) {
    case 'todo': return '📋';
    case 'in-progress': return '🚀';
    case 'done': return '✅';
    case 'blocked': return '🚫';
    default: return '📌';
  }
}

/**
 * Apply filters to nodes and edges
 */
export function applyFilters(
  nodes: AnyGraphNode[],
  edges: GraphEdge[],
  filters: FilterCriteria
): { filteredNodes: AnyGraphNode[]; filteredEdges: GraphEdge[] } {
  // Filter nodes
  let filteredNodes = nodes.filter(node => {
    // Check node type
    if (!filters.nodeTypes.has(node.type)) return false;

    // Check search query
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      if (
        !node.label.toLowerCase().includes(query) &&
        !node.id.toLowerCase().includes(query)
      ) {
        return false;
      }
    }

    // Check complexity
    if (node.metadata?.complexity) {
      const complexity = node.metadata.complexity as number;
      if (filters.minComplexity !== undefined && complexity < filters.minComplexity) {
        return false;
      }
      if (filters.maxComplexity !== undefined && complexity > filters.maxComplexity) {
        return false;
      }
    }

    // Check language
    if ('language' in node && node.language) {
      if (filters.languages && !filters.languages.has(node.language)) {
        return false;
      }
    }

    // Check priority
    if ('priority' in node && node.priority) {
      if (filters.priorities && !filters.priorities.has(node.priority)) {
        return false;
      }
    }

    // Check status
    if ('status' in node && node.status) {
      if (filters.statuses && !filters.statuses.has(node.status)) {
        return false;
      }
    }

    return true;
  });

  // Create set of filtered node IDs
  const filteredNodeIds = new Set(filteredNodes.map(n => n.id));

  // Filter edges
  const filteredEdges = edges.filter(edge => {
    // Check edge type
    if (!filters.edgeTypes.has(edge.type)) return false;

    // Only include edges where both nodes are in filtered set
    return filteredNodeIds.has(edge.source) && filteredNodeIds.has(edge.target);
  });

  return { filteredNodes, filteredEdges };
}