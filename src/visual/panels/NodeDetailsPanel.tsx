import React, { useState, useCallback, memo } from 'react';
import {
  AnyGraphNode,
  CodeNode,
  BusinessNode,
  DocumentNode,
  ConversationNode,
  isCodeNode,
  isBusinessNode,
  isDocumentNode,
  isConversationNode
} from '../../core/graph-engine/types/NodeTypes';

export interface NodeDetailsPanelProps {
  node: AnyGraphNode | null;
  connectedNodes?: AnyGraphNode[];
  onClose: () => void;
  onNodeClick?: (node: AnyGraphNode) => void;
  onEdit?: (node: AnyGraphNode, field: string, value: any) => void;
  isEditable?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Detailed panel for displaying and editing node information
 */
export const NodeDetailsPanel: React.FC<NodeDetailsPanelProps> = memo(({
  node,
  connectedNodes = [],
  onClose,
  onNodeClick,
  onEdit,
  isEditable = false,
  className = '',
  style = {}
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValues, setEditValues] = useState<Record<string, any>>({});

  const handleEdit = useCallback((field: string, value: any) => {
    if (!node || !onEdit) return;
    onEdit(node, field, value);
    setEditValues(prev => ({ ...prev, [field]: value }));
  }, [node, onEdit]);

  const handleEditToggle = useCallback(() => {
    if (!isEditable) return;
    setIsEditing(!isEditing);
    if (isEditing) {
      // Reset edit values when canceling
      setEditValues({});
    }
  }, [isEditable, isEditing]);

  const renderEditableField = useCallback((
    label: string,
    field: string,
    value: any,
    type: 'text' | 'textarea' | 'select' | 'number' = 'text',
    options?: string[]
  ) => {
    const currentValue = editValues[field] !== undefined ? editValues[field] : value;

    if (!isEditing) {
      return (
        <div className="field-display">
          <strong>{label}:</strong> {value || 'N/A'}
        </div>
      );
    }

    return (
      <div className="field-edit">
        <label htmlFor={field}>{label}:</label>
        {type === 'textarea' ? (
          <textarea
            id={field}
            value={currentValue || ''}
            onChange={(e) => handleEdit(field, e.target.value)}
            rows={3}
            style={{ width: '100%', resize: 'vertical' }}
          />
        ) : type === 'select' && options ? (
          <select
            id={field}
            value={currentValue || ''}
            onChange={(e) => handleEdit(field, e.target.value)}
            style={{ width: '100%' }}
          >
            {options.map(option => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        ) : type === 'number' ? (
          <input
            id={field}
            type="number"
            value={currentValue || ''}
            onChange={(e) => handleEdit(field, parseInt(e.target.value))}
            style={{ width: '100%' }}
          />
        ) : (
          <input
            id={field}
            type="text"
            value={currentValue || ''}
            onChange={(e) => handleEdit(field, e.target.value)}
            style={{ width: '100%' }}
          />
        )}
      </div>
    );
  }, [isEditing, editValues, handleEdit]);

  if (!node) {
    return (
      <div
        className={`node-details-panel no-selection ${className}`}
        style={{
          position: 'absolute',
          top: '20px',
          left: '20px',
          width: '300px',
          background: 'white',
          border: '1px solid #ddd',
          borderRadius: '8px',
          padding: '20px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          fontSize: '14px',
          ...style
        }}
      >
        <div style={{ textAlign: 'center', color: '#666' }}>
          <p>Select a node to view details</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`node-details-panel ${className}`}
      style={{
        position: 'absolute',
        top: '20px',
        left: '20px',
        width: '350px',
        maxHeight: '80vh',
        background: 'white',
        border: '1px solid #ddd',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        fontSize: '14px',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        ...style
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '15px 20px',
          borderBottom: '1px solid #eee',
          background: '#f8f9fa',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
      >
        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>
          Node Details
        </h3>
        <div style={{ display: 'flex', gap: '8px' }}>
          {isEditable && (
            <button
              onClick={handleEditToggle}
              style={{
                background: isEditing ? '#dc3545' : '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                padding: '4px 8px',
                fontSize: '12px',
                cursor: 'pointer'
              }}
            >
              {isEditing ? 'Cancel' : 'Edit'}
            </button>
          )}
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '18px',
              cursor: 'pointer',
              color: '#666'
            }}
          >
            ×
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
        {/* Basic Information */}
        <section style={{ marginBottom: '20px' }}>
          <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', fontWeight: '600', color: '#333' }}>
            Basic Information
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {renderEditableField('Label', 'label', node.label)}
            {renderEditableField('Type', 'type', node.type)}
            {renderEditableField('ID', 'id', node.id)}
            {renderEditableField('Description', 'description', node.description, 'textarea')}
          </div>
        </section>

        {/* Type-specific information */}
        {isCodeNode(node) && <CodeNodeDetails node={node} renderField={renderEditableField} />}
        {isBusinessNode(node) && <BusinessNodeDetails node={node} renderField={renderEditableField} />}
        {isDocumentNode(node) && <DocumentNodeDetails node={node} renderField={renderEditableField} />}
        {isConversationNode(node) && <ConversationNodeDetails node={node} renderField={renderEditableField} />}

        {/* Metadata */}
        <section style={{ marginBottom: '20px' }}>
          <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', fontWeight: '600', color: '#333' }}>
            Metadata
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
            <div><strong>Created:</strong> {node.metadata.createdAt?.toLocaleString() || 'Unknown'}</div>
            <div><strong>Updated:</strong> {node.metadata.updatedAt?.toLocaleString() || 'Unknown'}</div>
            <div><strong>Confidence:</strong> {node.metadata.confidence ? `${Math.round(node.metadata.confidence * 100)}%` : 'N/A'}</div>
            <div><strong>Source:</strong> {node.metadata.source || 'N/A'}</div>
            {node.metadata.tags && (
              <div>
                <strong>Tags:</strong>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
                  {node.metadata.tags.map((tag, index) => (
                    <span
                      key={index}
                      style={{
                        background: '#e9ecef',
                        padding: '2px 6px',
                        borderRadius: '3px',
                        fontSize: '11px'
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Connected Nodes */}
        {connectedNodes.length > 0 && (
          <section>
            <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', fontWeight: '600', color: '#333' }}>
              Connected Nodes ({connectedNodes.length})
            </h4>
            <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
              {connectedNodes.map(connectedNode => (
                <div
                  key={connectedNode.id}
                  onClick={() => onNodeClick?.(connectedNode)}
                  style={{
                    padding: '8px',
                    marginBottom: '4px',
                    background: '#f8f9fa',
                    borderRadius: '4px',
                    cursor: onNodeClick ? 'pointer' : 'default',
                    fontSize: '12px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <div>
                    <div style={{ fontWeight: '500' }}>{connectedNode.label}</div>
                    <div style={{ color: '#666' }}>{connectedNode.type}</div>
                  </div>
                  <div
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: getNodeTypeColor(connectedNode.type)
                    }}
                  />
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
});

NodeDetailsPanel.displayName = 'NodeDetailsPanel';

/**
 * Code node specific details
 */
const CodeNodeDetails: React.FC<{
  node: CodeNode;
  renderField: (label: string, field: string, value: any, type?: string, options?: string[]) => React.ReactNode;
}> = memo(({ node, renderField }) => (
  <section style={{ marginBottom: '20px' }}>
    <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', fontWeight: '600', color: '#333' }}>
      Code Information
    </h4>
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {renderField('Code Type', 'codeType', node.codeType, 'select', ['component', 'function', 'class', 'interface', 'type', 'variable', 'file'])}
      {renderField('Language', 'language', node.language)}
      {renderField('File Path', 'filePath', node.filePath)}
      {renderField('Line Number', 'lineNumber', node.lineNumber, 'number')}
      {renderField('Complexity', 'complexity', node.complexity, 'number')}

      {node.snippet && (
        <div>
          <strong>Code Snippet:</strong>
          <pre style={{
            background: '#f8f9fa',
            padding: '8px',
            borderRadius: '4px',
            fontSize: '11px',
            overflow: 'auto',
            maxHeight: '150px',
            margin: '4px 0 0 0'
          }}>
            {node.snippet}
          </pre>
        </div>
      )}

      {node.props && node.props.length > 0 && (
        <div>
          <strong>Props:</strong>
          <div style={{ marginTop: '4px' }}>
            {node.props.map((prop, index) => (
              <div key={index} style={{ fontSize: '12px', marginBottom: '2px' }}>
                <code>{prop.name}</code>: {prop.type} {prop.required && <span style={{ color: '#dc3545' }}>*</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {node.hooks && node.hooks.length > 0 && (
        <div>
          <strong>Hooks:</strong>
          <div style={{ marginTop: '4px' }}>
            {node.hooks.map((hook, index) => (
              <div key={index} style={{ fontSize: '12px', marginBottom: '2px' }}>
                <code>{hook.name}</code>: {hook.type}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  </section>
));

CodeNodeDetails.displayName = 'CodeNodeDetails';

/**
 * Business node specific details
 */
const BusinessNodeDetails: React.FC<{
  node: BusinessNode;
  renderField: (label: string, field: string, value: any, type?: string, options?: string[]) => React.ReactNode;
}> = memo(({ node, renderField }) => (
  <section style={{ marginBottom: '20px' }}>
    <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', fontWeight: '600', color: '#333' }}>
      Business Information
    </h4>
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {renderField('Business Type', 'businessType', node.businessType, 'select', ['feature', 'story', 'requirement', 'goal', 'metric'])}
      {renderField('Priority', 'priority', node.priority, 'select', ['high', 'medium', 'low'])}
      {renderField('Status', 'status', node.status, 'select', ['planned', 'in-progress', 'completed'])}
      {renderField('Owner', 'owner', node.owner)}
      {renderField('Value', 'value', node.value, 'number')}
      {renderField('Effort', 'effort', node.effort, 'number')}
    </div>
  </section>
));

BusinessNodeDetails.displayName = 'BusinessNodeDetails';

/**
 * Document node specific details
 */
const DocumentNodeDetails: React.FC<{
  node: DocumentNode;
  renderField: (label: string, field: string, value: any, type?: string, options?: string[]) => React.ReactNode;
}> = memo(({ node, renderField }) => (
  <section style={{ marginBottom: '20px' }}>
    <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', fontWeight: '600', color: '#333' }}>
      Document Information
    </h4>
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {renderField('Document Type', 'documentType', node.documentType, 'select', ['markdown', 'comment', 'readme', 'spec', 'api-doc'])}
      {renderField('File Path', 'filePath', node.filePath)}
      {renderField('Section', 'section', node.section)}
      {renderField('Author', 'author', node.author)}

      {node.content && (
        <div>
          <strong>Content Preview:</strong>
          <div style={{
            background: '#f8f9fa',
            padding: '8px',
            borderRadius: '4px',
            fontSize: '12px',
            maxHeight: '150px',
            overflow: 'auto',
            margin: '4px 0 0 0'
          }}>
            {node.content.length > 500 ? node.content.substring(0, 500) + '...' : node.content}
          </div>
        </div>
      )}

      {node.sections && node.sections.length > 0 && (
        <div>
          <strong>Sections:</strong>
          <div style={{ marginTop: '4px' }}>
            {node.sections.map((section, index) => (
              <div key={index} style={{ fontSize: '12px', marginBottom: '2px' }}>
                • {typeof section === 'string' ? section : section.title || `Section ${index + 1}`}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  </section>
));

DocumentNodeDetails.displayName = 'DocumentNodeDetails';

/**
 * Conversation node specific details
 */
const ConversationNodeDetails: React.FC<{
  node: ConversationNode;
  renderField: (label: string, field: string, value: any, type?: string, options?: string[]) => React.ReactNode;
}> = memo(({ node, renderField }) => (
  <section style={{ marginBottom: '20px' }}>
    <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', fontWeight: '600', color: '#333' }}>
      Conversation Information
    </h4>
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {renderField('Conversation Type', 'conversationType', node.conversationType, 'select', ['message', 'question', 'answer', 'decision', 'insight'])}
      {renderField('Participant', 'participant', node.participant)}
      {renderField('Start Time', 'startTime', node.startTime)}
      {renderField('End Time', 'endTime', node.endTime)}
      {renderField('Context', 'context', node.context, 'textarea')}

      {node.participants && node.participants.length > 0 && (
        <div>
          <strong>Participants:</strong>
          <div style={{ marginTop: '4px' }}>
            {node.participants.map((participant, index) => (
              <span
                key={index}
                style={{
                  display: 'inline-block',
                  background: '#e9ecef',
                  padding: '2px 6px',
                  borderRadius: '3px',
                  fontSize: '11px',
                  marginRight: '4px',
                  marginBottom: '2px'
                }}
              >
                {participant}
              </span>
            ))}
          </div>
        </div>
      )}

      {node.content && (
        <div>
          <strong>Content:</strong>
          <div style={{
            background: '#f8f9fa',
            padding: '8px',
            borderRadius: '4px',
            fontSize: '12px',
            maxHeight: '150px',
            overflow: 'auto',
            margin: '4px 0 0 0'
          }}>
            {node.content.length > 500 ? node.content.substring(0, 500) + '...' : node.content}
          </div>
        </div>
      )}

      {node.messages && node.messages.length > 0 && (
        <div>
          <strong>Messages ({node.messages.length}):</strong>
          <div style={{ maxHeight: '100px', overflowY: 'auto', marginTop: '4px' }}>
            {node.messages.slice(0, 5).map((message, index) => (
              <div key={index} style={{ fontSize: '11px', marginBottom: '2px', padding: '2px 0' }}>
                • {typeof message === 'string' ? message : message.content || `Message ${index + 1}`}
              </div>
            ))}
            {node.messages.length > 5 && (
              <div style={{ fontSize: '11px', color: '#666', fontStyle: 'italic' }}>
                ... and {node.messages.length - 5} more
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  </section>
));

ConversationNodeDetails.displayName = 'ConversationNodeDetails';

/**
 * Helper function to get node type color
 */
function getNodeTypeColor(type: string): string {
  switch (type) {
    case 'code':
      return '#4A90E2';
    case 'business':
      return '#50E3C2';
    case 'document':
      return '#F5A623';
    case 'conversation':
      return '#BD10E0';
    default:
      return '#9B9B9B';
  }
}