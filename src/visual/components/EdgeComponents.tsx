import React, { memo, useMemo } from 'react';
import { GraphEdge } from '../../core/graph-engine/types/EdgeTypes';

export interface EdgeComponentProps {
  edge: GraphEdge;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  selected?: boolean;
  hovered?: boolean;
  animated?: boolean;
  scale?: number;
  onClick?: (edge: GraphEdge) => void;
  onDoubleClick?: (edge: GraphEdge) => void;
  onContextMenu?: (e: React.MouseEvent, edge: GraphEdge) => void;
  onMouseEnter?: (edge: GraphEdge) => void;
  onMouseLeave?: (edge: GraphEdge) => void;
}

/**
 * Base edge component wrapper
 */
export const EdgeComponent: React.FC<EdgeComponentProps> = memo(({
  edge,
  x1,
  y1,
  x2,
  y2,
  selected = false,
  hovered = false,
  animated = false,
  scale = 1,
  onClick,
  onDoubleClick,
  onContextMenu,
  onMouseEnter,
  onMouseLeave
}) => {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClick?.(edge);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDoubleClick?.(edge);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onContextMenu?.(e, edge);
  };

  const Component = useMemo(() => {
    switch (edge.type) {
      case 'imports':
      case 'exports':
        return DependencyEdge;
      case 'calls':
      case 'uses':
        return DataFlowEdge;
      case 'implements':
      case 'extends':
        return InheritanceEdge;
      case 'references':
        return ReferenceEdge;
      case 'contains':
        return ContainmentEdge;
      case 'related_to':
        return RelatedEdge;
      case 'discusses':
        return DiscussionEdge;
      default:
        return DefaultEdge;
    }
  }, [edge.type]);

  return (
    <g
      className={`edge-component edge-${edge.type} ${selected ? 'selected' : ''} ${hovered ? 'hovered' : ''}`}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
      onMouseEnter={() => onMouseEnter?.(edge)}
      onMouseLeave={() => onMouseLeave?.(edge)}
      style={{ cursor: 'pointer' }}
    >
      <Component
        edge={edge}
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        selected={selected}
        hovered={hovered}
        animated={animated}
        scale={scale}
      />
    </g>
  );
});

EdgeComponent.displayName = 'EdgeComponent';

interface EdgeDrawingProps {
  edge: GraphEdge;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  selected: boolean;
  hovered: boolean;
  animated: boolean;
  scale: number;
}

/**
 * Calculate edge path with optional curvature
 */
const calculatePath = (
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  curvature: number = 0
): string => {
  if (curvature === 0) {
    return `M ${x1} ${y1} L ${x2} ${y2}`;
  }

  const dx = x2 - x1;
  const dy = y2 - y1;
  const dr = Math.sqrt(dx * dx + dy * dy);
  const sweep = curvature > 0 ? 1 : 0;

  return `M ${x1} ${y1} A ${dr * Math.abs(curvature)} ${dr * Math.abs(curvature)} 0 0 ${sweep} ${x2} ${y2}`;
};

/**
 * Calculate arrow marker for directed edges
 */
const ArrowMarker: React.FC<{ id: string; color: string }> = ({ id, color }) => (
  <marker
    id={id}
    viewBox="0 0 10 10"
    refX="9"
    refY="5"
    markerWidth="6"
    markerHeight="6"
    orient="auto"
  >
    <path
      d="M 0 0 L 10 5 L 0 10 z"
      fill={color}
    />
  </marker>
);

/**
 * Dependency edge (imports/exports)
 */
const DependencyEdge: React.FC<EdgeDrawingProps> = memo(({
  edge,
  x1,
  y1,
  x2,
  y2,
  selected,
  hovered,
  animated,
  scale
}) => {
  const strokeWidth = (selected ? 3 : 2) * scale;
  const color = selected ? '#FFD700' : hovered ? '#4A90E2' : '#95A5A6';
  const markerId = `arrow-${edge.id}-${color.replace('#', '')}`;

  return (
    <>
      <defs>
        <ArrowMarker id={markerId} color={color} />
      </defs>

      {/* Shadow/glow effect when hovered */}
      {hovered && (
        <path
          d={calculatePath(x1, y1, x2, y2)}
          stroke={color}
          strokeWidth={strokeWidth + 4}
          fill="none"
          opacity="0.3"
          filter="url(#glow)"
        />
      )}

      {/* Main edge path */}
      <path
        d={calculatePath(x1, y1, x2, y2)}
        stroke={color}
        strokeWidth={strokeWidth}
        fill="none"
        strokeDasharray={animated ? "5 5" : undefined}
        markerEnd={`url(#${markerId})`}
      >
        {animated && (
          <animate
            attributeName="stroke-dashoffset"
            values="0;10"
            dur="1s"
            repeatCount="indefinite"
          />
        )}
      </path>

      {/* Edge label */}
      {edge.label && (
        <text
          x={(x1 + x2) / 2}
          y={(y1 + y2) / 2 - 5}
          textAnchor="middle"
          fontSize={10 * scale}
          fill={color}
          fontWeight={selected ? 'bold' : 'normal'}
        >
          {edge.label}
        </text>
      )}
    </>
  );
});

DependencyEdge.displayName = 'DependencyEdge';

/**
 * Data flow edge (calls/uses)
 */
const DataFlowEdge: React.FC<EdgeDrawingProps> = memo(({
  edge,
  x1,
  y1,
  x2,
  y2,
  selected,
  hovered,
  animated,
  scale
}) => {
  const strokeWidth = (selected ? 3 : 2) * scale;
  const color = selected ? '#FFD700' : hovered ? '#50C878' : '#27AE60';
  const markerId = `arrow-flow-${edge.id}-${color.replace('#', '')}`;

  return (
    <>
      <defs>
        <ArrowMarker id={markerId} color={color} />
        {animated && (
          <linearGradient id={`flow-gradient-${edge.id}`}>
            <stop offset="0%" stopColor={color} stopOpacity="0.1">
              <animate
                attributeName="stop-opacity"
                values="0.1;1;0.1"
                dur="2s"
                repeatCount="indefinite"
              />
            </stop>
            <stop offset="50%" stopColor={color} stopOpacity="1">
              <animate
                attributeName="stop-opacity"
                values="1;0.1;1"
                dur="2s"
                repeatCount="indefinite"
              />
            </stop>
            <stop offset="100%" stopColor={color} stopOpacity="0.1">
              <animate
                attributeName="stop-opacity"
                values="0.1;1;0.1"
                dur="2s"
                repeatCount="indefinite"
              />
            </stop>
          </linearGradient>
        )}
      </defs>

      {/* Flow animation background */}
      {animated && (
        <path
          d={calculatePath(x1, y1, x2, y2, 0.2)}
          stroke={`url(#flow-gradient-${edge.id})`}
          strokeWidth={strokeWidth + 2}
          fill="none"
          opacity="0.5"
        />
      )}

      {/* Main edge path */}
      <path
        d={calculatePath(x1, y1, x2, y2, 0.2)}
        stroke={color}
        strokeWidth={strokeWidth}
        fill="none"
        markerEnd={`url(#${markerId})`}
      />

      {/* Flow strength indicator */}
      {edge.weight && edge.weight > 1 && (
        <circle
          cx={(x1 + x2) / 2}
          cy={(y1 + y2) / 2}
          r={8 * scale}
          fill="white"
          stroke={color}
          strokeWidth={1}
        />
      )}
      {edge.weight && edge.weight > 1 && (
        <text
          x={(x1 + x2) / 2}
          y={(y1 + y2) / 2 + 3}
          textAnchor="middle"
          fontSize={8 * scale}
          fill={color}
          fontWeight="bold"
        >
          {edge.weight}
        </text>
      )}
    </>
  );
});

DataFlowEdge.displayName = 'DataFlowEdge';

/**
 * Inheritance edge (implements/extends)
 */
const InheritanceEdge: React.FC<EdgeDrawingProps> = memo(({
  edge,
  x1,
  y1,
  x2,
  y2,
  selected,
  hovered,
  animated,
  scale
}) => {
  const strokeWidth = (selected ? 3 : 2) * scale;
  const color = selected ? '#FFD700' : hovered ? '#9B59B6' : '#8E44AD';

  return (
    <>
      <defs>
        {/* Triangle marker for inheritance */}
        <marker
          id={`inherit-${edge.id}`}
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="8"
          markerHeight="8"
          orient="auto"
        >
          <path
            d="M 0 0 L 10 5 L 0 10 z"
            fill="white"
            stroke={color}
            strokeWidth="1"
          />
        </marker>
      </defs>

      {/* Main edge path */}
      <path
        d={calculatePath(x1, y1, x2, y2)}
        stroke={color}
        strokeWidth={strokeWidth}
        fill="none"
        strokeDasharray={edge.type === 'implements' ? "8 4" : undefined}
        markerEnd={`url(#inherit-${edge.id})`}
      />

      {/* Edge type label */}
      <text
        x={(x1 + x2) / 2}
        y={(y1 + y2) / 2 - 5}
        textAnchor="middle"
        fontSize={9 * scale}
        fill={color}
        fontStyle="italic"
      >
        {edge.type === 'implements' ? '<<implements>>' : '<<extends>>'}
      </text>
    </>
  );
});

InheritanceEdge.displayName = 'InheritanceEdge';

/**
 * Reference edge
 */
const ReferenceEdge: React.FC<EdgeDrawingProps> = memo(({
  edge,
  x1,
  y1,
  x2,
  y2,
  selected,
  hovered,
  animated,
  scale
}) => {
  const strokeWidth = (selected ? 2 : 1) * scale;
  const color = selected ? '#FFD700' : hovered ? '#F39C12' : '#E67E22';

  return (
    <>
      {/* Dotted reference line */}
      <path
        d={calculatePath(x1, y1, x2, y2)}
        stroke={color}
        strokeWidth={strokeWidth}
        fill="none"
        strokeDasharray="2 4"
        opacity={hovered ? 1 : 0.7}
      />

      {/* Reference indicator */}
      <circle
        cx={(x1 + x2) / 2}
        cy={(y1 + y2) / 2}
        r={3 * scale}
        fill={color}
        opacity={hovered ? 1 : 0.7}
      />
    </>
  );
});

ReferenceEdge.displayName = 'ReferenceEdge';

/**
 * Containment edge
 */
const ContainmentEdge: React.FC<EdgeDrawingProps> = memo(({
  edge,
  x1,
  y1,
  x2,
  y2,
  selected,
  hovered,
  animated,
  scale
}) => {
  const strokeWidth = (selected ? 3 : 2) * scale;
  const color = selected ? '#FFD700' : hovered ? '#3498DB' : '#2980B9';

  return (
    <>
      <defs>
        {/* Diamond marker for composition */}
        <marker
          id={`contain-${edge.id}`}
          viewBox="0 0 10 10"
          refX="5"
          refY="5"
          markerWidth="8"
          markerHeight="8"
          orient="auto"
        >
          <path
            d="M 5 0 L 10 5 L 5 10 L 0 5 z"
            fill={color}
            stroke={color}
          />
        </marker>
      </defs>

      {/* Main edge path */}
      <path
        d={calculatePath(x1, y1, x2, y2)}
        stroke={color}
        strokeWidth={strokeWidth}
        fill="none"
        markerStart={`url(#contain-${edge.id})`}
      />
    </>
  );
});

ContainmentEdge.displayName = 'ContainmentEdge';

/**
 * Related edge
 */
const RelatedEdge: React.FC<EdgeDrawingProps> = memo(({
  edge,
  x1,
  y1,
  x2,
  y2,
  selected,
  hovered,
  animated,
  scale
}) => {
  const strokeWidth = (selected ? 2 : 1.5) * scale;
  const color = selected ? '#FFD700' : hovered ? '#F5A623' : '#F39C12';

  return (
    <>
      {/* Curved relationship line */}
      <path
        d={calculatePath(x1, y1, x2, y2, 0.3)}
        stroke={color}
        strokeWidth={strokeWidth}
        fill="none"
        strokeDasharray="5 5"
        opacity={hovered ? 1 : 0.6}
      >
        {animated && (
          <animate
            attributeName="stroke-dashoffset"
            values="0;10"
            dur="2s"
            repeatCount="indefinite"
          />
        )}
      </path>

      {/* Relationship strength */}
      {edge.weight && (
        <text
          x={(x1 + x2) / 2}
          y={(y1 + y2) / 2}
          textAnchor="middle"
          fontSize={8 * scale}
          fill={color}
          opacity={hovered ? 1 : 0.8}
        >
          {Math.round(edge.weight * 100)}%
        </text>
      )}
    </>
  );
});

RelatedEdge.displayName = 'RelatedEdge';

/**
 * Discussion edge
 */
const DiscussionEdge: React.FC<EdgeDrawingProps> = memo(({
  edge,
  x1,
  y1,
  x2,
  y2,
  selected,
  hovered,
  animated,
  scale
}) => {
  const strokeWidth = (selected ? 2 : 1.5) * scale;
  const color = selected ? '#FFD700' : hovered ? '#BD10E0' : '#9B59B6';

  return (
    <>
      {/* Wavy discussion line */}
      <path
        d={calculatePath(x1, y1, x2, y2)}
        stroke={color}
        strokeWidth={strokeWidth}
        fill="none"
        strokeDasharray="3 2 1 2"
        opacity={hovered ? 1 : 0.7}
      >
        {animated && (
          <animateTransform
            attributeName="transform"
            type="translate"
            values="0 0; 0 2; 0 0"
            dur="2s"
            repeatCount="indefinite"
          />
        )}
      </path>

      {/* Message count badge */}
      {edge.metadata?.messageCount && (
        <>
          <circle
            cx={(x1 + x2) / 2}
            cy={(y1 + y2) / 2}
            r={10 * scale}
            fill="white"
            stroke={color}
            strokeWidth={1}
          />
          <text
            x={(x1 + x2) / 2}
            y={(y1 + y2) / 2 + 3}
            textAnchor="middle"
            fontSize={8 * scale}
            fill={color}
          >
            💬{edge.metadata.messageCount}
          </text>
        </>
      )}
    </>
  );
});

DiscussionEdge.displayName = 'DiscussionEdge';

/**
 * Default edge for unknown types
 */
const DefaultEdge: React.FC<EdgeDrawingProps> = memo(({
  edge,
  x1,
  y1,
  x2,
  y2,
  selected,
  hovered,
  animated,
  scale
}) => {
  const strokeWidth = (selected ? 2 : 1) * scale;
  const color = selected ? '#FFD700' : hovered ? '#95A5A6' : '#7F8C8D';

  return (
    <>
      {/* Simple line */}
      <path
        d={calculatePath(x1, y1, x2, y2)}
        stroke={color}
        strokeWidth={strokeWidth}
        fill="none"
        opacity={hovered ? 1 : 0.5}
      />

      {/* Edge label if present */}
      {edge.label && (
        <text
          x={(x1 + x2) / 2}
          y={(y1 + y2) / 2 - 5}
          textAnchor="middle"
          fontSize={9 * scale}
          fill={color}
          opacity={hovered ? 1 : 0.7}
        >
          {edge.label}
        </text>
      )}
    </>
  );
});

DefaultEdge.displayName = 'DefaultEdge';

/**
 * Edge labels component for rendering multiple labels
 */
export const EdgeLabels: React.FC<{
  edges: GraphEdge[];
  getEdgePosition: (edge: GraphEdge) => { x: number; y: number };
  scale?: number;
}> = memo(({ edges, getEdgePosition, scale = 1 }) => {
  return (
    <g className="edge-labels">
      {edges.map(edge => {
        if (!edge.label) return null;
        const pos = getEdgePosition(edge);
        return (
          <text
            key={`label-${edge.id}`}
            x={pos.x}
            y={pos.y}
            textAnchor="middle"
            fontSize={10 * scale}
            fill="#666"
            pointerEvents="none"
          >
            {edge.label}
          </text>
        );
      })}
    </g>
  );
});

EdgeLabels.displayName = 'EdgeLabels';

/**
 * Edge interaction zones for better click/hover detection
 */
export const EdgeInteractionZone: React.FC<{
  edge: GraphEdge;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  width?: number;
  onClick?: (edge: GraphEdge) => void;
  onMouseEnter?: (edge: GraphEdge) => void;
  onMouseLeave?: (edge: GraphEdge) => void;
}> = memo(({ edge, x1, y1, x2, y2, width = 10, onClick, onMouseEnter, onMouseLeave }) => {
  return (
    <path
      d={calculatePath(x1, y1, x2, y2)}
      stroke="transparent"
      strokeWidth={width}
      fill="none"
      style={{ cursor: 'pointer' }}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(edge);
      }}
      onMouseEnter={() => onMouseEnter?.(edge)}
      onMouseLeave={() => onMouseLeave?.(edge)}
    />
  );
});

EdgeInteractionZone.displayName = 'EdgeInteractionZone';