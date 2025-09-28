/**
 * Main graph-based chat interface component
 */

import React, { useState, useEffect, useCallback, useRef, memo } from 'react';
import * as d3 from 'd3';
import { ChatConversationNode } from '../models/ConversationNode';
import { MessageNode } from '../models/MessageNode';
import { ConversationNavigator } from './ConversationNavigator';
import { ContextPanel } from './ContextPanel';
import { MessageBubbleNode } from './MessageBubbleNode';
import { ExtractedContext } from '../context/ContextExtractor';
import { ChatGraphStructure } from '../models/ChatGraphStructure';

export interface GraphChatInterfaceProps {
  conversation: ChatConversationNode;
  chatGraph: ChatGraphStructure;
  onSendMessage: (message: string) => void;
  onMessageClick: (messageId: string) => void;
  onNodeSelect: (nodeId: string) => void;
  currentContext?: ExtractedContext;
  isLoading?: boolean;
  suggestions?: string[];
  className?: string;
  style?: React.CSSProperties;
}

export interface ChatViewport {
  x: number;
  y: number;
  scale: number;
}

export interface ChatLayoutNode extends MessageNode {
  x: number;
  y: number;
  fx?: number;
  fy?: number;
  vx?: number;
  vy?: number;
}

export interface ChatLayoutEdge {
  id: string;
  source: ChatLayoutNode;
  target: ChatLayoutNode;
  type: 'follows' | 'responds' | 'branches';
  strength: number;
}

/**
 * Graph-based chat interface using D3.js for visualization
 */
export const GraphChatInterface: React.FC<GraphChatInterfaceProps> = memo(({
  conversation,
  chatGraph,
  onSendMessage,
  onMessageClick,
  onNodeSelect,
  currentContext,
  isLoading = false,
  suggestions = [],
  className = '',
  style = {}
}) => {
  // State
  const [viewport, setViewport] = useState<ChatViewport>({ x: 0, y: 0, scale: 1 });
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [layoutNodes, setLayoutNodes] = useState<ChatLayoutNode[]>([]);
  const [layoutEdges, setLayoutEdges] = useState<ChatLayoutEdge[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isContextPanelOpen, setIsContextPanelOpen] = useState(true);
  const [isNavigatorOpen, setIsNavigatorOpen] = useState(true);

  // Refs
  const svgRef = useRef<SVGSVGElement>(null);
  const simulationRef = useRef<d3.Simulation<ChatLayoutNode, ChatLayoutEdge> | null>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);

  // Dimensions
  const width = 800;
  const height = 600;

  /**
   * Initialize D3 simulation and layout
   */
  useEffect(() => {
    if (!svgRef.current) return;

    // Prepare nodes and edges for D3 layout
    const nodes = prepareLayoutNodes(conversation);
    const edges = prepareLayoutEdges(conversation, nodes);

    setLayoutNodes(nodes);
    setLayoutEdges(edges);

    // Initialize D3 simulation
    const simulation = d3.forceSimulation<ChatLayoutNode>(nodes)
      .force('link', d3.forceLink<ChatLayoutNode, ChatLayoutEdge>(edges)
        .id(d => d.id)
        .distance(100)
        .strength(0.8)
      )
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(40))
      .force('x', d3.forceX(width / 2).strength(0.1))
      .force('y', d3.forceY(height / 2).strength(0.1));

    // Set up conversation flow forces
    simulation.force('conversationFlow', createConversationFlowForce(nodes, edges));

    simulationRef.current = simulation;

    // Initialize zoom
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 3])
      .on('zoom', (event) => {
        const { x, y, k } = event.transform;
        setViewport({ x, y, scale: k });
      });

    d3.select(svgRef.current).call(zoom);
    zoomRef.current = zoom;

    return () => {
      simulation.stop();
    };
  }, [conversation.messages, width, height]);

  /**
   * Update layout when messages change
   */
  useEffect(() => {
    if (!simulationRef.current) return;

    const nodes = prepareLayoutNodes(conversation);
    const edges = prepareLayoutEdges(conversation, nodes);

    setLayoutNodes(nodes);
    setLayoutEdges(edges);

    // Update simulation
    const simulation = simulationRef.current;
    simulation.nodes(nodes);
    simulation.force('link', d3.forceLink<ChatLayoutNode, ChatLayoutEdge>(edges)
      .id(d => d.id)
      .distance(100)
      .strength(0.8)
    );

    simulation.alpha(0.3).restart();
  }, [conversation.messages]);

  /**
   * Handle message sending
   */
  const handleSendMessage = useCallback(() => {
    if (inputMessage.trim()) {
      onSendMessage(inputMessage.trim());
      setInputMessage('');
    }
  }, [inputMessage, onSendMessage]);

  /**
   * Handle message node click
   */
  const handleMessageClick = useCallback((messageId: string) => {
    setSelectedMessageId(messageId);
    onMessageClick(messageId);
  }, [onMessageClick]);

  /**
   * Handle keyboard shortcuts
   */
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  }, [handleSendMessage]);

  /**
   * Handle zoom controls
   */
  const handleZoomIn = useCallback(() => {
    if (zoomRef.current && svgRef.current) {
      d3.select(svgRef.current).transition().call(
        zoomRef.current.scaleBy, 1.5
      );
    }
  }, []);

  const handleZoomOut = useCallback(() => {
    if (zoomRef.current && svgRef.current) {
      d3.select(svgRef.current).transition().call(
        zoomRef.current.scaleBy, 0.67
      );
    }
  }, []);

  const handleZoomReset = useCallback(() => {
    if (zoomRef.current && svgRef.current) {
      d3.select(svgRef.current).transition().call(
        zoomRef.current.transform,
        d3.zoomIdentity
      );
    }
  }, []);

  /**
   * Center view on a specific message
   */
  const centerOnMessage = useCallback((messageId: string) => {
    const message = layoutNodes.find(n => n.id === messageId);
    if (message && zoomRef.current && svgRef.current) {
      const transform = d3.zoomIdentity
        .translate(width / 2 - message.x, height / 2 - message.y)
        .scale(1);

      d3.select(svgRef.current).transition().duration(750).call(
        zoomRef.current.transform,
        transform
      );
    }
  }, [layoutNodes, width, height]);

  return (
    <div
      className={`graph-chat-interface ${className}`}
      style={{
        display: 'flex',
        height: '100vh',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        ...style
      }}
    >
      {/* Conversation Navigator */}
      {isNavigatorOpen && (
        <div style={{
          width: '300px',
          borderRight: '1px solid #e1e5e9',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <ConversationNavigator
            conversation={conversation}
            selectedMessageId={selectedMessageId}
            onMessageSelect={handleMessageClick}
            onCenterMessage={centerOnMessage}
            onToggleCollapse={() => setIsNavigatorOpen(false)}
          />
        </div>
      )}

      {/* Main Graph View */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        position: 'relative'
      }}>
        {/* Toolbar */}
        <div style={{
          padding: '12px',
          borderBottom: '1px solid #e1e5e9',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          backgroundColor: '#f8f9fa'
        }}>
          {!isNavigatorOpen && (
            <button
              onClick={() => setIsNavigatorOpen(true)}
              style={{
                padding: '6px 12px',
                border: '1px solid #d0d7de',
                borderRadius: '6px',
                backgroundColor: 'white',
                cursor: 'pointer'
              }}
            >
              ☰ Navigator
            </button>
          )}

          <div style={{ flex: 1 }} />

          {/* Zoom Controls */}
          <div style={{ display: 'flex', gap: '4px' }}>
            <button onClick={handleZoomIn} style={zoomButtonStyle}>+</button>
            <button onClick={handleZoomReset} style={zoomButtonStyle}>⌂</button>
            <button onClick={handleZoomOut} style={zoomButtonStyle}>−</button>
          </div>

          <button
            onClick={() => setIsContextPanelOpen(!isContextPanelOpen)}
            style={{
              padding: '6px 12px',
              border: '1px solid #d0d7de',
              borderRadius: '6px',
              backgroundColor: isContextPanelOpen ? '#dbeafe' : 'white',
              cursor: 'pointer'
            }}
          >
            Context
          </button>
        </div>

        {/* Graph SVG */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          <svg
            ref={svgRef}
            width={width}
            height={height}
            style={{
              width: '100%',
              height: '100%',
              cursor: 'grab'
            }}
          >
            <defs>
              {/* Arrow markers for edges */}
              <marker
                id="arrow"
                viewBox="0 -5 10 10"
                refX="8"
                refY="0"
                markerWidth="4"
                markerHeight="4"
                orient="auto"
              >
                <path d="M0,-5L10,0L0,5" fill="#6b7280" />
              </marker>
            </defs>

            <g transform={`translate(${viewport.x}, ${viewport.y}) scale(${viewport.scale})`}>
              {/* Render edges */}
              {layoutEdges.map(edge => (
                <g key={edge.id}>
                  <line
                    x1={edge.source.x}
                    y1={edge.source.y}
                    x2={edge.target.x}
                    y2={edge.target.y}
                    stroke={getEdgeColor(edge.type)}
                    strokeWidth={edge.type === 'responds' ? 2 : 1}
                    strokeDasharray={edge.type === 'branches' ? '5,5' : 'none'}
                    markerEnd="url(#arrow)"
                    opacity={0.7}
                  />
                </g>
              ))}

              {/* Render message nodes */}
              {layoutNodes.map(node => (
                <MessageBubbleNode
                  key={node.id}
                  message={node}
                  isSelected={selectedMessageId === node.id}
                  onClick={() => handleMessageClick(node.id)}
                  scale={viewport.scale}
                />
              ))}
            </g>
          </svg>

          {/* Loading overlay */}
          {isLoading && (
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(255, 255, 255, 0.8)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '18px',
              color: '#6b7280'
            }}>
              Generating response...
            </div>
          )}
        </div>

        {/* Message Input */}
        <div style={{
          padding: '16px',
          borderTop: '1px solid #e1e5e9',
          backgroundColor: 'white'
        }}>
          {/* Suggestions */}
          {suggestions.length > 0 && (
            <div style={{
              marginBottom: '12px',
              display: 'flex',
              gap: '8px',
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

          {/* Input area */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <textarea
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question or describe what you need help with..."
              style={{
                flex: 1,
                padding: '12px',
                border: '1px solid #d0d7de',
                borderRadius: '8px',
                resize: 'none',
                minHeight: '60px',
                fontSize: '14px',
                fontFamily: 'inherit'
              }}
              disabled={isLoading}
            />
            <button
              onClick={handleSendMessage}
              disabled={!inputMessage.trim() || isLoading}
              style={{
                padding: '12px 24px',
                backgroundColor: inputMessage.trim() && !isLoading ? '#0969da' : '#6b7280',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: inputMessage.trim() && !isLoading ? 'pointer' : 'not-allowed',
                fontSize: '14px',
                fontWeight: '500'
              }}
            >
              Send
            </button>
          </div>
        </div>
      </div>

      {/* Context Panel */}
      {isContextPanelOpen && currentContext && (
        <div style={{
          width: '350px',
          borderLeft: '1px solid #e1e5e9',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <ContextPanel
            context={currentContext}
            selectedMessageId={selectedMessageId}
            onNodeSelect={onNodeSelect}
            onToggleCollapse={() => setIsContextPanelOpen(false)}
          />
        </div>
      )}
    </div>
  );
});

GraphChatInterface.displayName = 'GraphChatInterface';

/**
 * Helper functions
 */
function prepareLayoutNodes(conversation: ChatConversationNode): ChatLayoutNode[] {
  return Array.from(conversation.messages.values()).map(message => ({
    ...message,
    x: Math.random() * 400 + 200,
    y: Math.random() * 300 + 150
  }));
}

function prepareLayoutEdges(
  conversation: ChatConversationNode,
  nodes: ChatLayoutNode[]
): ChatLayoutEdge[] {
  const edges: ChatLayoutEdge[] = [];
  const nodeMap = new Map(nodes.map(n => [n.id, n]));

  for (const node of nodes) {
    // Create follow edge to parent
    if (node.parentMessageId) {
      const parent = nodeMap.get(node.parentMessageId);
      if (parent) {
        edges.push({
          id: `${parent.id}-follows-${node.id}`,
          source: parent,
          target: node,
          type: 'follows',
          strength: 1.0
        });

        // Create response edge for user-assistant pairs
        if (parent.role === 'user' && node.role === 'assistant') {
          edges.push({
            id: `${node.id}-responds-${parent.id}`,
            source: node,
            target: parent,
            type: 'responds',
            strength: 0.8
          });
        }
      }
    }

    // Create branch edges for multiple children
    if (node.childMessageIds.length > 1) {
      for (const childId of node.childMessageIds) {
        const child = nodeMap.get(childId);
        if (child) {
          edges.push({
            id: `${node.id}-branches-${child.id}`,
            source: node,
            target: child,
            type: 'branches',
            strength: 0.6
          });
        }
      }
    }
  }

  return edges;
}

function createConversationFlowForce(
  nodes: ChatLayoutNode[],
  edges: ChatLayoutEdge[]
): d3.Force<ChatLayoutNode, undefined> {
  return (alpha: number) => {
    // Apply vertical flow to conversation sequence
    for (const node of nodes) {
      if (node.parentMessageId) {
        const parent = nodes.find(n => n.id === node.parentMessageId);
        if (parent) {
          // Pull child nodes down from parent
          const dy = parent.y + 80 - node.y;
          node.vy = (node.vy || 0) + dy * alpha * 0.1;
        }
      }
    }

    // Separate branches horizontally
    const branchNodes = nodes.filter(n => n.childMessageIds.length > 1);
    for (const branchNode of branchNodes) {
      const children = nodes.filter(n => n.parentMessageId === branchNode.id);
      children.forEach((child, index) => {
        const targetX = branchNode.x + (index - (children.length - 1) / 2) * 120;
        const dx = targetX - child.x;
        child.vx = (child.vx || 0) + dx * alpha * 0.1;
      });
    }
  };
}

function getEdgeColor(type: 'follows' | 'responds' | 'branches'): string {
  const colors = {
    follows: '#6b7280',
    responds: '#10b981',
    branches: '#f59e0b'
  };
  return colors[type];
}

const zoomButtonStyle: React.CSSProperties = {
  width: '32px',
  height: '32px',
  border: '1px solid #d0d7de',
  borderRadius: '6px',
  backgroundColor: 'white',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '16px',
  fontWeight: 'bold'
};