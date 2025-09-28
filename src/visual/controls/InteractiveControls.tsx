import React, { useState, useCallback, memo, useRef, useEffect } from 'react';

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
  onExport: (format: 'svg' | 'png' | 'json' | 'link' | 'report') => void;
  onSearch: (query: string) => void;
  isAnimated?: boolean;
  currentLayout?: string;
  layouts?: string[];
  className?: string;
  style?: React.CSSProperties;
  // Enhanced export options
  graphData?: {
    nodes: any[];
    edges: any[];
    metadata?: any;
  };
  currentView?: {
    name: string;
    filters?: any;
    selectedNodes?: string[];
  };
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
  style = {},
  graphData,
  currentView
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

  const handleExportSelect = useCallback((format: 'svg' | 'png' | 'json' | 'link' | 'report') => {
    onExport(format);
    setIsExportMenuOpen(false);
  }, [onExport]);

  // Helper function to generate shareable link
  const generateShareableLink = useCallback(() => {
    if (!graphData || !currentView) return null;

    const shareData = {
      view: currentView,
      layout: currentLayout,
      zoom: zoom,
      timestamp: new Date().toISOString(),
      nodeCount: graphData.nodes.length,
      edgeCount: graphData.edges.length
    };

    // In a real app, this would be sent to a backend service
    const encodedData = btoa(JSON.stringify(shareData));
    const baseUrl = window.location.origin + window.location.pathname;
    return `${baseUrl}?share=${encodedData}`;
  }, [graphData, currentView, currentLayout, zoom]);

  // Helper function to generate report data
  const generateReportData = useCallback(() => {
    if (!graphData) return null;

    const now = new Date();
    return {
      title: `Graph Analysis Report - ${currentView?.name || 'Untitled View'}`,
      generatedAt: now.toISOString(),
      summary: {
        totalNodes: graphData.nodes.length,
        totalEdges: graphData.edges.length,
        selectedNodes: currentView?.selectedNodes?.length || 0,
        currentLayout: currentLayout,
        currentZoom: `${Math.round(zoom * 100)}%`
      },
      nodeBreakdown: getNodeTypeBreakdown(graphData.nodes),
      edgeBreakdown: getEdgeTypeBreakdown(graphData.edges),
      viewSettings: currentView,
      metadata: graphData.metadata
    };
  }, [graphData, currentView, currentLayout, zoom]);

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

            {/* Divider */}
            <div style={{ height: '1px', background: '#eee', margin: '4px 0' }} />

            <button
              className="export-option"
              onClick={() => {
                const link = generateShareableLink();
                if (link) {
                  navigator.clipboard.writeText(link).then(() => {
                    alert('Shareable link copied to clipboard!');
                  }).catch(() => {
                    prompt('Copy this shareable link:', link);
                  });
                }
                setIsExportMenuOpen(false);
              }}
              disabled={!graphData || !currentView}
              style={{
                display: 'block',
                width: '100%',
                padding: '8px 12px',
                border: 'none',
                background: 'white',
                textAlign: 'left',
                cursor: graphData && currentView ? 'pointer' : 'not-allowed',
                fontSize: '14px',
                opacity: graphData && currentView ? 1 : 0.5
              }}
            >
              🔗 Create Shareable Link
            </button>

            <button
              className="export-option"
              onClick={() => handleExportSelect('report')}
              disabled={!graphData}
              style={{
                display: 'block',
                width: '100%',
                padding: '8px 12px',
                border: 'none',
                background: 'white',
                textAlign: 'left',
                cursor: graphData ? 'pointer' : 'not-allowed',
                fontSize: '14px',
                opacity: graphData ? 1 : 0.5
              }}
            >
              📊 Generate Report
            </button>
          </div>
        )}
      </div>
    </div>
  );
});

InteractiveControls.displayName = 'InteractiveControls';

/**
 * Generate heat color based on intensity (0-1)
 */
function getHeatColor(intensity: number): { r: number; g: number; b: number } {
  // Clamp intensity between 0 and 1
  intensity = Math.max(0, Math.min(1, intensity));

  if (intensity < 0.5) {
    // Green to Yellow (low to medium density)
    const factor = intensity * 2; // 0 to 1
    return {
      r: Math.round(255 * factor),      // 0 to 255
      g: 255,                           // Full green
      b: 0                              // No blue
    };
  } else {
    // Yellow to Red (medium to high density)
    const factor = (intensity - 0.5) * 2; // 0 to 1
    return {
      r: 255,                           // Full red
      g: Math.round(255 * (1 - factor)), // 255 to 0
      b: 0                              // No blue
    };
  }
}

/**
 * Mini map for graph overview with density heatmap
 */
export const MiniMap: React.FC<{
  nodes: any[];
  edges: any[];
  viewBox: { x: number; y: number; width: number; height: number };
  containerSize: { width: number; height: number };
  onViewBoxChange: (viewBox: { x: number; y: number; width: number; height: number }) => void;
  showHeatmap?: boolean;
  heatmapIntensity?: number;
  className?: string;
  style?: React.CSSProperties;
}> = memo(({
  nodes,
  edges,
  viewBox,
  containerSize,
  onViewBoxChange,
  showHeatmap = false,
  heatmapIntensity = 1,
  className = '',
  style = {}
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [heatmapData, setHeatmapData] = useState<ImageData | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const miniMapWidth = 200;
  const miniMapHeight = 150;

  // Calculate scale to fit entire graph in minimap
  const graphBounds = calculateGraphBounds(nodes);
  const scaleX = miniMapWidth / graphBounds.width;
  const scaleY = miniMapHeight / graphBounds.height;
  const scale = Math.min(scaleX, scaleY);

  // Generate heatmap data
  const generateHeatmap = useCallback(() => {
    if (!showHeatmap || nodes.length === 0) {
      setHeatmapData(null);
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = miniMapWidth;
    canvas.height = miniMapHeight;

    // Create density grid
    const gridSize = 10; // Size of each grid cell
    const gridWidth = Math.ceil(miniMapWidth / gridSize);
    const gridHeight = Math.ceil(miniMapHeight / gridSize);
    const densityGrid = Array(gridHeight).fill(null).map(() => Array(gridWidth).fill(0));

    // Calculate node density for each grid cell
    nodes.forEach(node => {
      const x = (node.x - graphBounds.x) * scale;
      const y = (node.y - graphBounds.y) * scale;

      const gridX = Math.floor(x / gridSize);
      const gridY = Math.floor(y / gridSize);

      if (gridX >= 0 && gridX < gridWidth && gridY >= 0 && gridY < gridHeight) {
        densityGrid[gridY][gridX]++;
      }
    });

    // Find max density for normalization
    const maxDensity = Math.max(...densityGrid.flat());
    if (maxDensity === 0) return;

    // Create ImageData for heatmap
    const imageData = ctx.createImageData(miniMapWidth, miniMapHeight);
    const data = imageData.data;

    // Generate heatmap colors
    for (let y = 0; y < miniMapHeight; y++) {
      for (let x = 0; x < miniMapWidth; x++) {
        const gridX = Math.floor(x / gridSize);
        const gridY = Math.floor(y / gridSize);

        const density = densityGrid[gridY]?.[gridX] || 0;
        const normalizedDensity = density / maxDensity;
        const intensity = normalizedDensity * heatmapIntensity;

        const pixelIndex = (y * miniMapWidth + x) * 4;

        if (intensity > 0) {
          // Create heat color based on density
          const heatColor = getHeatColor(intensity);
          data[pixelIndex] = heatColor.r;     // Red
          data[pixelIndex + 1] = heatColor.g; // Green
          data[pixelIndex + 2] = heatColor.b; // Blue
          data[pixelIndex + 3] = Math.min(255, intensity * 200); // Alpha
        } else {
          data[pixelIndex + 3] = 0; // Transparent
        }
      }
    }

    setHeatmapData(imageData);
  }, [nodes, showHeatmap, heatmapIntensity, scale, graphBounds]);

  // Update heatmap when nodes change
  useEffect(() => {
    generateHeatmap();
  }, [generateHeatmap]);

  // Draw heatmap on canvas
  useEffect(() => {
    if (!heatmapData || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, miniMapWidth, miniMapHeight);
    ctx.putImageData(heatmapData, 0, 0);
  }, [heatmapData]);

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
      {/* Heatmap Canvas */}
      {showHeatmap && (
        <canvas
          ref={canvasRef}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none'
          }}
        />
      )}

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
              stroke={showHeatmap ? "rgba(255,255,255,0.3)" : "#ddd"}
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
              fill={showHeatmap ? "rgba(255,255,255,0.8)" : "#666"}
              stroke={showHeatmap ? "rgba(0,0,0,0.3)" : "none"}
              strokeWidth={showHeatmap ? "0.5" : "0"}
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

      {/* Heatmap Toggle */}
      <div
        style={{
          position: 'absolute',
          top: '4px',
          left: '4px',
          display: 'flex',
          gap: '4px'
        }}
      >
        <button
          onClick={() => showHeatmap && generateHeatmap()}
          style={{
            background: showHeatmap ? '#007bff' : 'rgba(255,255,255,0.8)',
            color: showHeatmap ? 'white' : '#333',
            border: '1px solid #ddd',
            borderRadius: '3px',
            padding: '2px 6px',
            fontSize: '10px',
            cursor: 'pointer'
          }}
          title={showHeatmap ? "Refresh heatmap" : "Heatmap disabled"}
        >
          🔥
        </button>
      </div>

      {/* Density Legend */}
      {showHeatmap && (
        <div
          style={{
            position: 'absolute',
            bottom: '4px',
            left: '4px',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '8px',
            color: '#666'
          }}
        >
          <span>Density:</span>
          <div
            style={{
              width: '40px',
              height: '8px',
              background: 'linear-gradient(to right, rgba(0,255,0,0.3), rgba(255,255,0,0.6), rgba(255,0,0,0.8))',
              borderRadius: '2px',
              border: '1px solid rgba(0,0,0,0.2)'
            }}
          />
        </div>
      )}
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

/**
 * Helper function to get node type breakdown
 */
function getNodeTypeBreakdown(nodes: any[]): Record<string, number> {
  return nodes.reduce((breakdown, node) => {
    const type = node.type || 'unknown';
    breakdown[type] = (breakdown[type] || 0) + 1;
    return breakdown;
  }, {} as Record<string, number>);
}

/**
 * Helper function to get edge type breakdown
 */
function getEdgeTypeBreakdown(edges: any[]): Record<string, number> {
  return edges.reduce((breakdown, edge) => {
    const type = edge.type || 'unknown';
    breakdown[type] = (breakdown[type] || 0) + 1;
    return breakdown;
  }, {} as Record<string, number>);
}