import React, { memo, useMemo } from 'react';
import {
  CodeNode,
  BusinessNode,
  DocumentNode,
  ConversationNode,
  AnyGraphNode
} from '../../core/graph-engine/types/NodeTypes';

export interface NodeComponentProps {
  node: AnyGraphNode;
  selected?: boolean;
  hovered?: boolean;
  x: number;
  y: number;
  scale?: number;
  onClick?: (node: AnyGraphNode) => void;
  onDoubleClick?: (node: AnyGraphNode) => void;
  onContextMenu?: (e: React.MouseEvent, node: AnyGraphNode) => void;
  onMouseEnter?: (node: AnyGraphNode) => void;
  onMouseLeave?: (node: AnyGraphNode) => void;
}

/**
 * Base node component wrapper
 */
export const NodeComponent: React.FC<NodeComponentProps> = memo(({
  node,
  selected = false,
  hovered = false,
  x,
  y,
  scale = 1,
  onClick,
  onDoubleClick,
  onContextMenu,
  onMouseEnter,
  onMouseLeave
}) => {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClick?.(node);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDoubleClick?.(node);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onContextMenu?.(e, node);
  };

  const Component = useMemo(() => {
    switch (node.type) {
      case 'code':
        return CodeNodeComponent;
      case 'business':
        return BusinessNodeComponent;
      case 'document':
        return DocumentNodeComponent;
      case 'conversation':
        return ConversationNodeComponent;
      default:
        return DefaultNodeComponent;
    }
  }, [node.type]);

  return (
    <g
      transform={`translate(${x}, ${y})`}
      className={`node-component node-${node.type} ${selected ? 'selected' : ''} ${hovered ? 'hovered' : ''}`}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
      onMouseEnter={() => onMouseEnter?.(node)}
      onMouseLeave={() => onMouseLeave?.(node)}
      style={{ cursor: 'pointer' }}
    >
      <Component
        node={node}
        selected={selected}
        hovered={hovered}
        scale={scale}
      />
    </g>
  );
});

NodeComponent.displayName = 'NodeComponent';

/**
 * Code node component with language icon and complexity indicator
 */
const CodeNodeComponent: React.FC<{
  node: CodeNode;
  selected: boolean;
  hovered: boolean;
  scale: number;
}> = memo(({ node, selected, hovered, scale }) => {
  const radius = 20 * scale;
  const complexity = (node.metadata?.complexity as number) || 1;
  const complexityRadius = radius + Math.log(complexity + 1) * 3;

  const languageIcons: Record<string, string> = {
    typescript: '📘',
    javascript: '📗',
    python: '🐍',
    java: '☕',
    cpp: '⚙️',
    default: '📄'
  };

  const icon = languageIcons[node.language] || languageIcons.default;

  const getCodeTypeColor = () => {
    switch (node.codeType) {
      case 'component':
        return '#4A90E2';
      case 'function':
        return '#50C878';
      case 'class':
        return '#9B59B6';
      case 'interface':
        return '#F39C12';
      default:
        return '#95A5A6';
    }
  };

  return (
    <>
      {/* Complexity ring */}
      <circle
        r={complexityRadius}
        fill="none"
        stroke={getCodeTypeColor()}
        strokeWidth="1"
        strokeDasharray="3 2"
        opacity="0.3"
      />

      {/* Main node circle */}
      <circle
        r={radius}
        fill={getCodeTypeColor()}
        stroke={selected ? '#FFD700' : '#fff'}
        strokeWidth={selected ? 3 : 2}
        filter={hovered ? 'url(#glow)' : undefined}
      />

      {/* Language icon */}
      <text
        x="0"
        y="5"
        textAnchor="middle"
        fontSize={14 * scale}
        fill="white"
      >
        {icon}
      </text>

      {/* Node label */}
      <text
        x="0"
        y={radius + 15}
        textAnchor="middle"
        fontSize={10 * scale}
        fill="#333"
        fontWeight={selected ? 'bold' : 'normal'}
      >
        {node.label.length > 20 ? node.label.substring(0, 17) + '...' : node.label}
      </text>

      {/* Code type badge */}
      <rect
        x={-25}
        y={-radius - 12}
        width={50}
        height={12}
        rx={6}
        fill={getCodeTypeColor()}
        opacity="0.8"
      />
      <text
        x="0"
        y={-radius - 3}
        textAnchor="middle"
        fontSize={8}
        fill="white"
      >
        {node.codeType.toUpperCase()}
      </text>
    </>
  );
});

CodeNodeComponent.displayName = 'CodeNodeComponent';

/**
 * Business node component with priority and status indicators
 */
const BusinessNodeComponent: React.FC<{
  node: BusinessNode;
  selected: boolean;
  hovered: boolean;
  scale: number;
}> = memo(({ node, selected, hovered, scale }) => {
  const radius = 22 * scale;

  const getPriorityColor = () => {
    switch (node.priority) {
      case 'high':
        return '#E74C3C';
      case 'medium':
        return '#F39C12';
      case 'low':
        return '#27AE60';
      default:
        return '#95A5A6';
    }
  };

  const getStatusIcon = () => {
    switch (node.status) {
      case 'todo':
        return '📋';
      case 'in-progress':
        return '🚀';
      case 'done':
        return '✅';
      case 'blocked':
        return '🚫';
      default:
        return '📌';
    }
  };

  return (
    <>
      {/* Priority ring */}
      {node.priority && (
        <circle
          r={radius + 4}
          fill="none"
          stroke={getPriorityColor()}
          strokeWidth="2"
          strokeDasharray="5 3"
        />
      )}

      {/* Main node rect (rounded) */}
      <rect
        x={-radius}
        y={-radius}
        width={radius * 2}
        height={radius * 2}
        rx={8}
        fill="#50E3C2"
        stroke={selected ? '#FFD700' : '#fff'}
        strokeWidth={selected ? 3 : 2}
        filter={hovered ? 'url(#glow)' : undefined}
      />

      {/* Business type icon */}
      <text
        x="0"
        y="5"
        textAnchor="middle"
        fontSize={16 * scale}
        fill="white"
      >
        {getStatusIcon()}
      </text>

      {/* Node label */}
      <text
        x="0"
        y={radius + 15}
        textAnchor="middle"
        fontSize={10 * scale}
        fill="#333"
        fontWeight={selected ? 'bold' : 'normal'}
      >
        {node.label.length > 25 ? node.label.substring(0, 22) + '...' : node.label}
      </text>

      {/* Priority flag */}
      {node.priority && (
        <>
          <path
            d={`M ${radius - 5} ${-radius} L ${radius + 10} ${-radius + 5} L ${radius - 5} ${-radius + 10} Z`}
            fill={getPriorityColor()}
          />
          <text
            x={radius}
            y={-radius + 7}
            textAnchor="middle"
            fontSize={8}
            fill="white"
            fontWeight="bold"
          >
            {node.priority[0].toUpperCase()}
          </text>
        </>
      )}
    </>
  );
});

BusinessNodeComponent.displayName = 'BusinessNodeComponent';

/**
 * Document node component with document icon
 */
const DocumentNodeComponent: React.FC<{
  node: DocumentNode;
  selected: boolean;
  hovered: boolean;
  scale: number;
}> = memo(({ node, selected, hovered, scale }) => {
  const radius = 18 * scale;

  const getDocTypeIcon = () => {
    switch (node.documentType) {
      case 'markdown':
        return '📝';
      case 'readme':
        return '📖';
      case 'spec':
        return '📋';
      case 'api-doc':
        return '📚';
      case 'comment':
        return '💬';
      default:
        return '📄';
    }
  };

  return (
    <>
      {/* Document shape (hexagon) */}
      <polygon
        points={`
          ${-radius},0
          ${-radius/2},${-radius * 0.866}
          ${radius/2},${-radius * 0.866}
          ${radius},0
          ${radius/2},${radius * 0.866}
          ${-radius/2},${radius * 0.866}
        `}
        fill="#F5A623"
        stroke={selected ? '#FFD700' : '#fff'}
        strokeWidth={selected ? 3 : 2}
        filter={hovered ? 'url(#glow)' : undefined}
      />

      {/* Document icon */}
      <text
        x="0"
        y="5"
        textAnchor="middle"
        fontSize={14 * scale}
        fill="white"
      >
        {getDocTypeIcon()}
      </text>

      {/* Node label */}
      <text
        x="0"
        y={radius + 15}
        textAnchor="middle"
        fontSize={10 * scale}
        fill="#333"
        fontWeight={selected ? 'bold' : 'normal'}
      >
        {node.label.length > 20 ? node.label.substring(0, 17) + '...' : node.label}
      </text>

      {/* Author avatar if available */}
      {node.author && (
        <circle
          cx={radius - 3}
          cy={-radius + 3}
          r={8}
          fill="#fff"
          stroke="#F5A623"
          strokeWidth="1"
        />
      )}
    </>
  );
});

DocumentNodeComponent.displayName = 'DocumentNodeComponent';

/**
 * Conversation node component with chat bubble
 */
const ConversationNodeComponent: React.FC<{
  node: ConversationNode;
  selected: boolean;
  hovered: boolean;
  scale: number;
}> = memo(({ node, selected, hovered, scale }) => {
  const width = 40 * scale;
  const height = 30 * scale;

  const getConversationIcon = () => {
    switch (node.conversationType) {
      case 'message':
        return '💬';
      case 'question':
        return '❓';
      case 'answer':
        return '💡';
      case 'decision':
        return '🎯';
      case 'insight':
        return '🔍';
      default:
        return '🗨️';
    }
  };

  const participantCount = node.participants?.length || 1;

  return (
    <>
      {/* Chat bubble shape */}
      <path
        d={`
          M ${-width/2} ${-height/2}
          Q ${-width/2} ${-height/2 - 5} ${-width/2 + 5} ${-height/2 - 5}
          L ${width/2 - 5} ${-height/2 - 5}
          Q ${width/2} ${-height/2 - 5} ${width/2} ${-height/2}
          L ${width/2} ${height/2 - 5}
          Q ${width/2} ${height/2} ${width/2 - 5} ${height/2}
          L ${-width/2 + 10} ${height/2}
          L ${-width/2 + 5} ${height/2 + 8}
          L ${-width/2 + 5} ${height/2}
          Q ${-width/2} ${height/2} ${-width/2} ${height/2 - 5}
          Z
        `}
        fill="#BD10E0"
        stroke={selected ? '#FFD700' : '#fff'}
        strokeWidth={selected ? 3 : 2}
        filter={hovered ? 'url(#glow)' : undefined}
      />

      {/* Conversation icon */}
      <text
        x="0"
        y="2"
        textAnchor="middle"
        fontSize={14 * scale}
        fill="white"
      >
        {getConversationIcon()}
      </text>

      {/* Node label */}
      <text
        x="0"
        y={height + 10}
        textAnchor="middle"
        fontSize={10 * scale}
        fill="#333"
        fontWeight={selected ? 'bold' : 'normal'}
      >
        {node.label.length > 20 ? node.label.substring(0, 17) + '...' : node.label}
      </text>

      {/* Participant count badge */}
      {participantCount > 1 && (
        <>
          <circle
            cx={width/2 - 5}
            cy={-height/2 + 5}
            r={8}
            fill="#fff"
            stroke="#BD10E0"
            strokeWidth="1"
          />
          <text
            x={width/2 - 5}
            y={-height/2 + 8}
            textAnchor="middle"
            fontSize={8}
            fill="#BD10E0"
            fontWeight="bold"
          >
            {participantCount}
          </text>
        </>
      )}
    </>
  );
});

ConversationNodeComponent.displayName = 'ConversationNodeComponent';

/**
 * Default node component for unknown types
 */
const DefaultNodeComponent: React.FC<{
  node: AnyGraphNode;
  selected: boolean;
  hovered: boolean;
  scale: number;
}> = memo(({ node, selected, hovered, scale }) => {
  const radius = 15 * scale;

  return (
    <>
      <circle
        r={radius}
        fill="#9B9B9B"
        stroke={selected ? '#FFD700' : '#fff'}
        strokeWidth={selected ? 3 : 2}
        filter={hovered ? 'url(#glow)' : undefined}
      />
      <text
        x="0"
        y="5"
        textAnchor="middle"
        fontSize={12 * scale}
        fill="white"
      >
        ?
      </text>
      <text
        x="0"
        y={radius + 15}
        textAnchor="middle"
        fontSize={10 * scale}
        fill="#333"
      >
        {node.label.length > 15 ? node.label.substring(0, 12) + '...' : node.label}
      </text>
    </>
  );
});

DefaultNodeComponent.displayName = 'DefaultNodeComponent';

/**
 * SVG filter definitions for node effects
 */
export const NodeFilterDefs: React.FC = () => (
  <defs>
    {/* Glow effect for hover */}
    <filter id="glow">
      <feGaussianBlur stdDeviation="3" result="coloredBlur" />
      <feMerge>
        <feMergeNode in="coloredBlur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>

    {/* Drop shadow for elevated nodes */}
    <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="3" />
      <feOffset dx="2" dy="2" result="offsetblur" />
      <feFlood floodColor="#000000" floodOpacity="0.3" />
      <feComposite in2="offsetblur" operator="in" />
      <feMerge>
        <feMergeNode />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
);