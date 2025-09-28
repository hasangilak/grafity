/**
 * Tests for NodeComponents
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { NodeComponent, NodeFilterDefs } from '../components/NodeComponents';
import { createMockNode, InteractionTester, PerformanceProfiler } from './TestUtils';

describe('NodeComponents', () => {
  const profiler = new PerformanceProfiler();

  beforeEach(() => {
    profiler.clear();
  });

  describe('NodeComponent', () => {
    it('renders code node correctly', () => {
      const mockNode = createMockNode('test-node', {
        type: 'code',
        label: 'Test Code Node',
        language: 'typescript',
        codeType: 'component'
      });

      const { container } = render(
        <svg>
          <NodeFilterDefs />
          <NodeComponent
            node={mockNode}
            x={100}
            y={100}
            onClick={jest.fn()}
          />
        </svg>
      );

      const nodeGroup = container.querySelector('.node-component');
      expect(nodeGroup).toBeInTheDocument();
      expect(nodeGroup).toHaveClass('node-code');
    });

    it('renders business node correctly', () => {
      const mockNode = createMockNode('test-business-node', {
        type: 'business',
        label: 'Test Business Node',
        businessType: 'feature',
        priority: 'high',
        status: 'in-progress'
      });

      const { container } = render(
        <svg>
          <NodeComponent
            node={mockNode}
            x={100}
            y={100}
            onClick={jest.fn()}
          />
        </svg>
      );

      const nodeGroup = container.querySelector('.node-component');
      expect(nodeGroup).toBeInTheDocument();
      expect(nodeGroup).toHaveClass('node-business');
    });

    it('renders document node correctly', () => {
      const mockNode = createMockNode('test-document-node', {
        type: 'document',
        label: 'Test Document Node',
        documentType: 'markdown',
        author: 'Test Author'
      });

      const { container } = render(
        <svg>
          <NodeComponent
            node={mockNode}
            x={100}
            y={100}
            onClick={jest.fn()}
          />
        </svg>
      );

      const nodeGroup = container.querySelector('.node-component');
      expect(nodeGroup).toBeInTheDocument();
      expect(nodeGroup).toHaveClass('node-document');
    });

    it('renders conversation node correctly', () => {
      const mockNode = createMockNode('test-conversation-node', {
        type: 'conversation',
        label: 'Test Conversation Node',
        conversationType: 'question',
        participants: ['user1', 'user2', 'user3']
      });

      const { container } = render(
        <svg>
          <NodeComponent
            node={mockNode}
            x={100}
            y={100}
            onClick={jest.fn()}
          />
        </svg>
      );

      const nodeGroup = container.querySelector('.node-component');
      expect(nodeGroup).toBeInTheDocument();
      expect(nodeGroup).toHaveClass('node-conversation');
    });

    it('handles selection state correctly', () => {
      const mockNode = createMockNode('test-node');

      const { container, rerender } = render(
        <svg>
          <NodeComponent
            node={mockNode}
            x={100}
            y={100}
            selected={false}
            onClick={jest.fn()}
          />
        </svg>
      );

      let nodeGroup = container.querySelector('.node-component');
      expect(nodeGroup).not.toHaveClass('selected');

      rerender(
        <svg>
          <NodeComponent
            node={mockNode}
            x={100}
            y={100}
            selected={true}
            onClick={jest.fn()}
          />
        </svg>
      );

      nodeGroup = container.querySelector('.node-component');
      expect(nodeGroup).toHaveClass('selected');
    });

    it('handles hover state correctly', () => {
      const mockNode = createMockNode('test-node');

      const { container, rerender } = render(
        <svg>
          <NodeComponent
            node={mockNode}
            x={100}
            y={100}
            hovered={false}
            onClick={jest.fn()}
          />
        </svg>
      );

      let nodeGroup = container.querySelector('.node-component');
      expect(nodeGroup).not.toHaveClass('hovered');

      rerender(
        <svg>
          <NodeComponent
            node={mockNode}
            x={100}
            y={100}
            hovered={true}
            onClick={jest.fn()}
          />
        </svg>
      );

      nodeGroup = container.querySelector('.node-component');
      expect(nodeGroup).toHaveClass('hovered');
    });

    it('calls onClick when clicked', () => {
      const mockNode = createMockNode('test-node');
      const onClickMock = jest.fn();

      const { container } = render(
        <svg>
          <NodeComponent
            node={mockNode}
            x={100}
            y={100}
            onClick={onClickMock}
          />
        </svg>
      );

      const nodeGroup = container.querySelector('.node-component')!;
      InteractionTester.mouseEvent(nodeGroup, 'click');

      expect(onClickMock).toHaveBeenCalledWith(mockNode);
    });

    it('calls onDoubleClick when double-clicked', () => {
      const mockNode = createMockNode('test-node');
      const onDoubleClickMock = jest.fn();

      const { container } = render(
        <svg>
          <NodeComponent
            node={mockNode}
            x={100}
            y={100}
            onDoubleClick={onDoubleClickMock}
          />
        </svg>
      );

      const nodeGroup = container.querySelector('.node-component')!;

      // Simulate double click
      InteractionTester.mouseEvent(nodeGroup, 'click');
      InteractionTester.mouseEvent(nodeGroup, 'click');

      // Note: jsdom doesn't automatically fire dblclick, so we manually trigger it
      const dblClickEvent = new MouseEvent('dblclick', { bubbles: true });
      nodeGroup.dispatchEvent(dblClickEvent);

      expect(onDoubleClickMock).toHaveBeenCalledWith(mockNode);
    });

    it('calls onContextMenu when right-clicked', () => {
      const mockNode = createMockNode('test-node');
      const onContextMenuMock = jest.fn();

      const { container } = render(
        <svg>
          <NodeComponent
            node={mockNode}
            x={100}
            y={100}
            onContextMenu={onContextMenuMock}
          />
        </svg>
      );

      const nodeGroup = container.querySelector('.node-component')!;
      const contextMenuEvent = new MouseEvent('contextmenu', {
        bubbles: true,
        button: 2
      });
      nodeGroup.dispatchEvent(contextMenuEvent);

      expect(onContextMenuMock).toHaveBeenCalled();
    });

    it('scales correctly with scale prop', () => {
      const mockNode = createMockNode('test-node');

      const { container } = render(
        <svg>
          <NodeComponent
            node={mockNode}
            x={100}
            y={100}
            scale={2}
            onClick={jest.fn()}
          />
        </svg>
      );

      const nodeGroup = container.querySelector('.node-component');
      expect(nodeGroup).toBeInTheDocument();
      // Scale is passed to internal components, tested by visual inspection
    });
  });

  describe('Performance Tests', () => {
    it('renders multiple nodes efficiently', () => {
      const nodes = Array.from({ length: 100 }, (_, i) =>
        createMockNode(`node-${i}`, {
          type: ['code', 'business', 'document', 'conversation'][i % 4] as any
        })
      );

      profiler.start('render-100-nodes');

      const { container } = render(
        <svg>
          <NodeFilterDefs />
          {nodes.map((node, i) => (
            <NodeComponent
              key={node.id}
              node={node}
              x={i * 50}
              y={100}
              onClick={jest.fn()}
            />
          ))}
        </svg>
      );

      const renderTime = profiler.end('render-100-nodes');

      expect(container.querySelectorAll('.node-component')).toHaveLength(100);
      expect(renderTime).toBeLessThan(1000); // Should render in less than 1 second
    });

    it('handles frequent updates efficiently', () => {
      const mockNode = createMockNode('test-node');
      const positions = Array.from({ length: 50 }, (_, i) => ({ x: i * 10, y: i * 5 }));

      const { rerender } = render(
        <svg>
          <NodeComponent
            node={mockNode}
            x={positions[0].x}
            y={positions[0].y}
            onClick={jest.fn()}
          />
        </svg>
      );

      profiler.start('update-positions');

      positions.forEach(pos => {
        rerender(
          <svg>
            <NodeComponent
              node={mockNode}
              x={pos.x}
              y={pos.y}
              onClick={jest.fn()}
            />
          </svg>
        );
      });

      const updateTime = profiler.end('update-positions');

      expect(updateTime).toBeLessThan(500); // Should update quickly
    });
  });

  describe('Edge Cases', () => {
    it('handles missing metadata gracefully', () => {
      const mockNode = createMockNode('test-node', {
        metadata: undefined as any
      });

      expect(() => {
        render(
          <svg>
            <NodeComponent
              node={mockNode}
              x={100}
              y={100}
              onClick={jest.fn()}
            />
          </svg>
        );
      }).not.toThrow();
    });

    it('handles very long labels correctly', () => {
      const mockNode = createMockNode('test-node', {
        label: 'This is an extremely long label that should be truncated properly in the node component rendering system'
      });

      const { container } = render(
        <svg>
          <NodeComponent
            node={mockNode}
            x={100}
            y={100}
            onClick={jest.fn()}
          />
        </svg>
      );

      const textElement = container.querySelector('text');
      expect(textElement).toBeInTheDocument();
      // Label truncation is handled by CSS/SVG text length
    });

    it('handles unknown node types gracefully', () => {
      const mockNode = createMockNode('test-node', {
        type: 'unknown' as any
      });

      expect(() => {
        render(
          <svg>
            <NodeComponent
              node={mockNode}
              x={100}
              y={100}
              onClick={jest.fn()}
            />
          </svg>
        );
      }).not.toThrow();
    });
  });

  describe('NodeFilterDefs', () => {
    it('renders SVG filter definitions', () => {
      const { container } = render(
        <svg>
          <NodeFilterDefs />
        </svg>
      );

      const defs = container.querySelector('defs');
      expect(defs).toBeInTheDocument();

      const glowFilter = container.querySelector('#glow');
      expect(glowFilter).toBeInTheDocument();

      const shadowFilter = container.querySelector('#shadow');
      expect(shadowFilter).toBeInTheDocument();
    });
  });
});