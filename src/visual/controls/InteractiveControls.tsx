import React, { useState, useCallback, memo } from 'react';

export interface InteractiveControlsProps {
  zoom: number;
  minZoom?: number;
  maxZoom?: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  onFitToScreen: () => void;
  onLayoutChange: (layout: string) => void;
  onToggleAnimation: () => void;
  onExport: (format: 'svg' | 'png' | 'json') => void;
  onSearch: (query: string) => void;
  isAnimated?: boolean;
  currentLayout?: string;
  layouts?: string[];
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Interactive controls for graph manipulation
 */
export const InteractiveControls: React.FC<InteractiveControlsProps> = memo(({
  zoom,
  minZoom = 0.1,
  maxZoom = 10,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  onFitToScreen,
  onLayoutChange,
  onToggleAnimation,
  onExport,
  onSearch,
  isAnimated = false,
  currentLayout = 'forceDirected',
  layouts = ['forceDirected', 'hierarchical', 'circular', 'grid', 'radial', 'tree'],
  className = '',
  style = {}
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isLayoutMenuOpen, setIsLayoutMenuOpen] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);

  const handleSearchSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    onSearch(searchQuery);
  }, [searchQuery, onSearch]);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    onSearch(query); // Live search
  }, [onSearch]);

  const handleLayoutSelect = useCallback((layout: string) => {
    onLayoutChange(layout);
    setIsLayoutMenuOpen(false);
  }, [onLayoutChange]);

  const handleExportSelect = useCallback((format: 'svg' | 'png' | 'json') => {
    onExport(format);
    setIsExportMenuOpen(false);
  }, [onExport]);

  const zoomPercentage = Math.round(zoom * 100);

  return (
    <div
      className={`interactive-controls ${className}`}
      style={{
        position: 'absolute',
        top: '20px',
        right: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        zIndex: 1000,
        ...style
      }}
    >
      {/* Search Bar */}
      <div className="control-group search-group">
        <button
          className="control-button search-toggle"
          onClick={() => setIsSearchOpen(!isSearchOpen)}
          title="Search"
          style={{
            padding: '8px',
            background: 'white',
            border: '1px solid #ddd',
            borderRadius: '4px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '5px'
          }}
        >
          🔍 Search
        </button>

        {isSearchOpen && (
          <form
            onSubmit={handleSearchSubmit}
            style={{
              position: 'absolute',
              top: '40px',
              right: '0',
              background: 'white',
              border: '1px solid #ddd',
              borderRadius: '4px',
              padding: '10px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
            }}
          >
            <input
              type="text"
              value={searchQuery}
              onChange={handleSearchChange}
              placeholder="Search nodes..."
              autoFocus
              style={{
                width: '200px',
                padding: '5px',
                border: '1px solid #ddd',
                borderRadius: '3px'
              }}
            />
          </form>
        )}
      </div>

      {/* Zoom Controls */}
      <div
        className="control-group zoom-controls"
        style={{
          display: 'flex',
          flexDirection: 'column',
          background: 'white',
          border: '1px solid #ddd',
          borderRadius: '4px',
          overflow: 'hidden'
        }}
      >
        <button
          className="control-button zoom-in"
          onClick={onZoomIn}
          disabled={zoom >= maxZoom}
          title="Zoom In"
          style={{
            padding: '8px',
            border: 'none',
            borderBottom: '1px solid #ddd',
            background: zoom >= maxZoom ? '#f5f5f5' : 'white',
            cursor: zoom >= maxZoom ? 'not-allowed' : 'pointer'
          }}
        >
          ➕
        </button>

        <button
          className="control-button zoom-percentage"
          onClick={onZoomReset}
          title="Reset Zoom"
          style={{
            padding: '8px',
            border: 'none',
            borderBottom: '1px solid #ddd',
            background: 'white',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: 'bold'
          }}
        >
          {zoomPercentage}%
        </button>

        <button
          className="control-button zoom-out"
          onClick={onZoomOut}
          disabled={zoom <= minZoom}
          title="Zoom Out"
          style={{
            padding: '8px',
            border: 'none',
            borderBottom: '1px solid #ddd',
            background: zoom <= minZoom ? '#f5f5f5' : 'white',
            cursor: zoom <= minZoom ? 'not-allowed' : 'pointer'
          }}
        >
          ➖
        </button>

        <button
          className="control-button fit-screen"
          onClick={onFitToScreen}
          title="Fit to Screen"
          style={{
            padding: '8px',
            border: 'none',
            background: 'white',
            cursor: 'pointer'
          }}
        >
          ⬚
        </button>
      </div>

      {/* Layout Selector */}
      <div className="control-group layout-controls">
        <button
          className="control-button layout-selector"
          onClick={() => setIsLayoutMenuOpen(!isLayoutMenuOpen)}
          title="Change Layout"
          style={{
            padding: '8px',
            background: 'white',
            border: '1px solid #ddd',
            borderRadius: '4px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '5px'
          }}
        >
          📊 {currentLayout}
        </button>

        {isLayoutMenuOpen && (
          <div
            className="layout-menu"
            style={{
              position: 'absolute',
              top: '40px',
              right: '0',
              background: 'white',
              border: '1px solid #ddd',
              borderRadius: '4px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              minWidth: '150px'
            }}
          >
            {layouts.map(layout => (
              <button
                key={layout}
                className={`layout-option ${layout === currentLayout ? 'active' : ''}`}
                onClick={() => handleLayoutSelect(layout)}
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '8px 12px',
                  border: 'none',
                  background: layout === currentLayout ? '#e3f2fd' : 'white',
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                {layout}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Animation Toggle */}
      <button
        className="control-button animation-toggle"
        onClick={onToggleAnimation}
        title={isAnimated ? "Disable Animation" : "Enable Animation"}
        style={{
          padding: '8px',
          background: isAnimated ? '#4CAF50' : 'white',
          color: isAnimated ? 'white' : 'black',
          border: '1px solid #ddd',
          borderRadius: '4px',
          cursor: 'pointer'
        }}
      >
        {isAnimated ? '⏸️' : '▶️'} Animation
      </button>

      {/* Export Options */}
      <div className="control-group export-controls">
        <button
          className="control-button export-selector"
          onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
          title="Export Graph"
          style={{
            padding: '8px',
            background: 'white',
            border: '1px solid #ddd',
            borderRadius: '4px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '5px'
          }}
        >
          💾 Export
        </button>

        {isExportMenuOpen && (
          <div
            className="export-menu"
            style={{
              position: 'absolute',
              top: '40px',
              right: '0',
              background: 'white',
              border: '1px solid #ddd',
              borderRadius: '4px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              minWidth: '120px'
            }}
          >
            <button
              className="export-option"
              onClick={() => handleExportSelect('svg')}
              style={{
                display: 'block',
                width: '100%',
                padding: '8px 12px',
                border: 'none',
                background: 'white',
                textAlign: 'left',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              Export as SVG
            </button>
            <button
              className="export-option"
              onClick={() => handleExportSelect('png')}
              style={{
                display: 'block',
                width: '100%',
                padding: '8px 12px',
                border: 'none',
                background: 'white',
                textAlign: 'left',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              Export as PNG
            </button>
            <button
              className="export-option"
              onClick={() => handleExportSelect('json')}
              style={{
                display: 'block',
                width: '100%',
                padding: '8px 12px',
                border: 'none',
                background: 'white',
                textAlign: 'left',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              Export as JSON
            </button>
          </div>
        )}
      </div>
    </div>
  );
});

InteractiveControls.displayName = 'InteractiveControls';

/**
 * Mini map for graph overview
 */
export const MiniMap: React.FC<{
  nodes: any[];
  edges: any[];
  viewBox: { x: number; y: number; width: number; height: number };
  containerSize: { width: number; height: number };
  onViewBoxChange: (viewBox: { x: number; y: number; width: number; height: number }) => void;
  className?: string;
  style?: React.CSSProperties;
}> = memo(({
  nodes,
  edges,
  viewBox,
  containerSize,
  onViewBoxChange,
  className = '',
  style = {}
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const miniMapWidth = 200;
  const miniMapHeight = 150;

  // Calculate scale to fit entire graph in minimap
  const graphBounds = calculateGraphBounds(nodes);
  const scaleX = miniMapWidth / graphBounds.width;
  const scaleY = miniMapHeight / graphBounds.height;
  const scale = Math.min(scaleX, scaleY);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({
      x: e.clientX - viewBox.x * scale,
      y: e.clientY - viewBox.y * scale
    });
  }, [viewBox, scale]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;

    const newX = (e.clientX - dragStart.x) / scale;
    const newY = (e.clientY - dragStart.y) / scale;

    onViewBoxChange({
      ...viewBox,
      x: newX,
      y: newY
    });
  }, [isDragging, dragStart, scale, viewBox, onViewBoxChange]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  return (
    <div
      className={`minimap ${className}`}
      style={{
        position: 'absolute',
        bottom: '20px',
        right: '20px',
        width: miniMapWidth,
        height: miniMapHeight,
        background: 'white',
        border: '1px solid #ddd',
        borderRadius: '4px',
        overflow: 'hidden',
        ...style
      }}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <svg width={miniMapWidth} height={miniMapHeight}>
        <g transform={`scale(${scale})`}>
          {/* Render simplified edges */}
          {edges.map(edge => (
            <line
              key={edge.id}
              x1={edge.source.x}
              y1={edge.source.y}
              x2={edge.target.x}
              y2={edge.target.y}
              stroke="#ddd"
              strokeWidth="1"
            />
          ))}

          {/* Render simplified nodes */}
          {nodes.map(node => (
            <circle
              key={node.id}
              cx={node.x}
              cy={node.y}
              r="3"
              fill="#666"
            />
          ))}
        </g>

        {/* Viewport indicator */}
        <rect
          x={viewBox.x * scale}
          y={viewBox.y * scale}
          width={viewBox.width * scale}
          height={viewBox.height * scale}
          fill="rgba(66, 133, 244, 0.2)"
          stroke="rgba(66, 133, 244, 0.8)"
          strokeWidth="2"
          style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
          onMouseDown={handleMouseDown}
        />
      </svg>
    </div>
  );
});

MiniMap.displayName = 'MiniMap';

/**
 * Helper function to calculate graph bounds
 */
function calculateGraphBounds(nodes: any[]): { x: number; y: number; width: number; height: number } {
  if (nodes.length === 0) {
    return { x: 0, y: 0, width: 100, height: 100 };
  }

  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;

  nodes.forEach(node => {
    minX = Math.min(minX, node.x || 0);
    maxX = Math.max(maxX, node.x || 0);
    minY = Math.min(minY, node.y || 0);
    maxY = Math.max(maxY, node.y || 0);
  });

  return {
    x: minX,
    y: minY,
    width: maxX - minX || 100,
    height: maxY - minY || 100
  };
}

/**
 * Keyboard shortcuts handler
 */
export const useKeyboardShortcuts = (actions: {
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onZoomReset?: () => void;
  onFitToScreen?: () => void;
  onToggleAnimation?: () => void;
  onDelete?: () => void;
  onSelectAll?: () => void;
  onCopy?: () => void;
  onPaste?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
}) => {
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check for modifier keys
      const isCtrlOrCmd = e.ctrlKey || e.metaKey;
      const isShift = e.shiftKey;

      // Zoom shortcuts
      if (isCtrlOrCmd && e.key === '=') {
        e.preventDefault();
        actions.onZoomIn?.();
      } else if (isCtrlOrCmd && e.key === '-') {
        e.preventDefault();
        actions.onZoomOut?.();
      } else if (isCtrlOrCmd && e.key === '0') {
        e.preventDefault();
        actions.onZoomReset?.();
      }

      // Fit to screen
      if (e.key === 'f' && !isCtrlOrCmd) {
        e.preventDefault();
        actions.onFitToScreen?.();
      }

      // Animation toggle
      if (e.key === ' ' && !isCtrlOrCmd) {
        e.preventDefault();
        actions.onToggleAnimation?.();
      }

      // Selection and editing
      if (isCtrlOrCmd && e.key === 'a') {
        e.preventDefault();
        actions.onSelectAll?.();
      }
      if (isCtrlOrCmd && e.key === 'c') {
        e.preventDefault();
        actions.onCopy?.();
      }
      if (isCtrlOrCmd && e.key === 'v') {
        e.preventDefault();
        actions.onPaste?.();
      }
      if (isCtrlOrCmd && e.key === 'z') {
        e.preventDefault();
        if (isShift) {
          actions.onRedo?.();
        } else {
          actions.onUndo?.();
        }
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        actions.onDelete?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [actions]);
};