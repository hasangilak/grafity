import React, { useState, useCallback, useRef, useEffect, memo } from 'react';
import { AnyGraphNode } from '../../core/graph-engine/types/NodeTypes';

export type ViewType = 'overview' | 'detail' | 'focus' | 'comparison' | 'timeline' | 'custom';

export interface ViewState {
  id: string;
  type: ViewType;
  name: string;
  description?: string;

  // View-specific data
  selectedNodes?: string[];
  focusNode?: string;
  filters?: Record<string, any>;
  layout?: string;
  zoom?: number;
  center?: { x: number; y: number };

  // Metadata
  createdAt: Date;
  lastAccessedAt: Date;
  isTemporary?: boolean;
}

export interface ViewManagerProps {
  currentView: ViewState;
  availableViews: ViewState[];
  onViewChange: (view: ViewState) => void;
  onViewCreate: (view: Omit<ViewState, 'id' | 'createdAt' | 'lastAccessedAt'>) => void;
  onViewUpdate: (viewId: string, updates: Partial<ViewState>) => void;
  onViewDelete: (viewId: string) => void;
  enableTransitions?: boolean;
  transitionDuration?: number;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Multi-Level View Manager for graph navigation
 */
export const ViewManager: React.FC<ViewManagerProps> = memo(({
  currentView,
  availableViews,
  onViewChange,
  onViewCreate,
  onViewUpdate,
  onViewDelete,
  enableTransitions = true,
  transitionDuration = 300,
  className = '',
  style = {}
}) => {
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [showViewSelector, setShowViewSelector] = useState(false);
  const [showCreateView, setShowCreateView] = useState(false);
  const [breadcrumbs, setBreadcrumbs] = useState<ViewState[]>([]);
  const transitionTimeoutRef = useRef<NodeJS.Timeout>();

  // Update breadcrumbs when view changes
  useEffect(() => {
    setBreadcrumbs(prev => {
      const existingIndex = prev.findIndex(v => v.id === currentView.id);
      if (existingIndex >= 0) {
        // If view exists in breadcrumbs, truncate to that point
        return prev.slice(0, existingIndex + 1);
      } else {
        // Add new view to breadcrumbs (limit to 5 items)
        const newBreadcrumbs = [...prev, currentView];
        return newBreadcrumbs.slice(-5);
      }
    });
  }, [currentView]);

  const handleViewChange = useCallback((newView: ViewState) => {
    if (newView.id === currentView.id) return;

    if (enableTransitions) {
      setIsTransitioning(true);

      // Clear existing timeout
      if (transitionTimeoutRef.current) {
        clearTimeout(transitionTimeoutRef.current);
      }

      // Start transition
      transitionTimeoutRef.current = setTimeout(() => {
        onViewChange(newView);
        setIsTransitioning(false);
      }, transitionDuration / 2);
    } else {
      onViewChange(newView);
    }

    setShowViewSelector(false);
  }, [currentView.id, enableTransitions, onViewChange, transitionDuration]);

  const handleBreadcrumbClick = useCallback((view: ViewState, index: number) => {
    handleViewChange(view);
    setBreadcrumbs(prev => prev.slice(0, index + 1));
  }, [handleViewChange]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (transitionTimeoutRef.current) {
        clearTimeout(transitionTimeoutRef.current);
      }
    };
  }, []);

  const getViewIcon = (viewType: ViewType): string => {
    switch (viewType) {
      case 'overview': return '🌐';
      case 'detail': return '🔍';
      case 'focus': return '🎯';
      case 'comparison': return '⚖️';
      case 'timeline': return '📅';
      case 'custom': return '⚙️';
      default: return '📊';
    }
  };

  const getViewTypeLabel = (viewType: ViewType): string => {
    switch (viewType) {
      case 'overview': return 'Overview';
      case 'detail': return 'Detail';
      case 'focus': return 'Focus';
      case 'comparison': return 'Comparison';
      case 'timeline': return 'Timeline';
      case 'custom': return 'Custom';
      default: return 'Unknown';
    }
  };

  return (
    <div
      className={`view-manager ${className}`}
      style={{
        position: 'absolute',
        top: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '10px',
        zIndex: 1000,
        ...style
      }}
    >
      {/* Breadcrumb Navigation */}
      {breadcrumbs.length > 1 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'white',
            padding: '8px 16px',
            borderRadius: '20px',
            border: '1px solid #ddd',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            fontSize: '12px'
          }}
        >
          {breadcrumbs.map((view, index) => (
            <React.Fragment key={view.id}>
              <button
                onClick={() => handleBreadcrumbClick(view, index)}
                style={{
                  background: view.id === currentView.id ? '#007bff' : 'transparent',
                  color: view.id === currentView.id ? 'white' : '#666',
                  border: 'none',
                  borderRadius: '12px',
                  padding: '4px 8px',
                  fontSize: '11px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <span>{getViewIcon(view.type)}</span>
                <span>{view.name}</span>
              </button>
              {index < breadcrumbs.length - 1 && (
                <span style={{ color: '#ccc' }}>›</span>
              )}
            </React.Fragment>
          ))}
        </div>
      )}

      {/* Current View Display */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          background: 'white',
          padding: '12px 20px',
          borderRadius: '25px',
          border: '1px solid #ddd',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          opacity: isTransitioning ? 0.7 : 1,
          transition: enableTransitions ? `opacity ${transitionDuration}ms ease-in-out` : 'none'
        }}
      >
        {/* Current View Info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '18px' }}>{getViewIcon(currentView.type)}</span>
          <div>
            <div style={{ fontSize: '14px', fontWeight: '600' }}>{currentView.name}</div>
            <div style={{ fontSize: '11px', color: '#666' }}>
              {getViewTypeLabel(currentView.type)}
              {currentView.selectedNodes && ` • ${currentView.selectedNodes.length} selected`}
            </div>
          </div>
        </div>

        {/* View Controls */}
        <div style={{ display: 'flex', gap: '8px' }}>
          {/* View Selector Button */}
          <button
            onClick={() => setShowViewSelector(!showViewSelector)}
            style={{
              background: showViewSelector ? '#e9ecef' : 'transparent',
              border: '1px solid #ddd',
              borderRadius: '6px',
              padding: '6px 10px',
              fontSize: '12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            📋 Views ({availableViews.length})
          </button>

          {/* Create View Button */}
          <button
            onClick={() => setShowCreateView(!showCreateView)}
            style={{
              background: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              padding: '6px 10px',
              fontSize: '12px',
              cursor: 'pointer'
            }}
          >
            + Create
          </button>
        </div>
      </div>

      {/* View Selector Dropdown */}
      {showViewSelector && (
        <ViewSelectorDropdown
          views={availableViews}
          currentView={currentView}
          onViewSelect={handleViewChange}
          onViewDelete={onViewDelete}
          onClose={() => setShowViewSelector(false)}
          getViewIcon={getViewIcon}
          getViewTypeLabel={getViewTypeLabel}
        />
      )}

      {/* Create View Modal */}
      {showCreateView && (
        <CreateViewModal
          onCreateView={(viewData) => {
            onViewCreate(viewData);
            setShowCreateView(false);
          }}
          onClose={() => setShowCreateView(false)}
          getViewIcon={getViewIcon}
        />
      )}

      {/* Transition Overlay */}
      {isTransitioning && enableTransitions && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(255, 255, 255, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            backdropFilter: 'blur(2px)'
          }}
        >
          <div style={{ fontSize: '24px', animation: 'pulse 1s infinite' }}>
            🔄 Transitioning...
          </div>
        </div>
      )}
    </div>
  );
});

ViewManager.displayName = 'ViewManager';

/**
 * View Selector Dropdown Component
 */
const ViewSelectorDropdown: React.FC<{
  views: ViewState[];
  currentView: ViewState;
  onViewSelect: (view: ViewState) => void;
  onViewDelete: (viewId: string) => void;
  onClose: () => void;
  getViewIcon: (type: ViewType) => string;
  getViewTypeLabel: (type: ViewType) => string;
}> = memo(({
  views,
  currentView,
  onViewSelect,
  onViewDelete,
  onClose,
  getViewIcon,
  getViewTypeLabel
}) => {
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const groupedViews = views.reduce((groups, view) => {
    const group = groups[view.type] || [];
    group.push(view);
    groups[view.type] = group;
    return groups;
  }, {} as Record<ViewType, ViewState[]>);

  return (
    <div
      ref={dropdownRef}
      style={{
        position: 'absolute',
        top: '100%',
        left: '0',
        right: '0',
        background: 'white',
        border: '1px solid #ddd',
        borderRadius: '8px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
        maxHeight: '400px',
        overflowY: 'auto',
        zIndex: 1001
      }}
    >
      {Object.entries(groupedViews).map(([type, typeViews]) => (
        <div key={type}>
          <div
            style={{
              padding: '8px 16px',
              background: '#f8f9fa',
              borderBottom: '1px solid #eee',
              fontSize: '12px',
              fontWeight: '600',
              color: '#666'
            }}
          >
            {getViewTypeLabel(type as ViewType)} ({typeViews.length})
          </div>
          {typeViews.map(view => (
            <div
              key={view.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 16px',
                borderBottom: '1px solid #f0f0f0',
                cursor: 'pointer',
                background: view.id === currentView.id ? '#e7f3ff' : 'transparent'
              }}
              onClick={() => onViewSelect(view)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                <span>{getViewIcon(view.type)}</span>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: view.id === currentView.id ? '600' : 'normal' }}>
                    {view.name}
                  </div>
                  {view.description && (
                    <div style={{ fontSize: '11px', color: '#666' }}>
                      {view.description}
                    </div>
                  )}
                  <div style={{ fontSize: '10px', color: '#999' }}>
                    Last accessed: {view.lastAccessedAt.toLocaleDateString()}
                  </div>
                </div>
              </div>

              {!view.isTemporary && view.id !== currentView.id && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onViewDelete(view.id);
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#dc3545',
                    cursor: 'pointer',
                    padding: '4px',
                    fontSize: '12px'
                  }}
                >
                  🗑️
                </button>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
});

ViewSelectorDropdown.displayName = 'ViewSelectorDropdown';

/**
 * Create View Modal Component
 */
const CreateViewModal: React.FC<{
  onCreateView: (view: Omit<ViewState, 'id' | 'createdAt' | 'lastAccessedAt'>) => void;
  onClose: () => void;
  getViewIcon: (type: ViewType) => string;
}> = memo(({ onCreateView, onClose, getViewIcon }) => {
  const [viewData, setViewData] = useState({
    name: '',
    type: 'custom' as ViewType,
    description: '',
    isTemporary: false
  });

  const modalRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!viewData.name.trim()) return;

    onCreateView(viewData);
  };

  const viewTypes: { type: ViewType; label: string; description: string }[] = [
    { type: 'overview', label: 'Overview', description: 'High-level view of the entire graph' },
    { type: 'detail', label: 'Detail', description: 'Focused view with detailed information' },
    { type: 'focus', label: 'Focus', description: 'Centered on specific nodes or relationships' },
    { type: 'comparison', label: 'Comparison', description: 'Side-by-side comparison of elements' },
    { type: 'timeline', label: 'Timeline', description: 'Chronological view of changes' },
    { type: 'custom', label: 'Custom', description: 'Custom configured view' }
  ];

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000
      }}
    >
      <div
        ref={modalRef}
        style={{
          background: 'white',
          borderRadius: '12px',
          padding: '24px',
          width: '400px',
          maxWidth: '90vw',
          boxShadow: '0 20px 40px rgba(0,0,0,0.15)'
        }}
      >
        <h3 style={{ margin: '0 0 20px 0', fontSize: '18px', fontWeight: '600' }}>
          Create New View
        </h3>

        <form onSubmit={handleSubmit}>
          {/* View Name */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500' }}>
              View Name
            </label>
            <input
              type="text"
              value={viewData.name}
              onChange={(e) => setViewData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Enter view name..."
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #ddd',
                borderRadius: '6px',
                fontSize: '14px'
              }}
              autoFocus
            />
          </div>

          {/* View Type */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500' }}>
              View Type
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
              {viewTypes.map(({ type, label, description }) => (
                <label
                  key={type}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px',
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    background: viewData.type === type ? '#e7f3ff' : 'transparent'
                  }}
                >
                  <input
                    type="radio"
                    name="viewType"
                    value={type}
                    checked={viewData.type === type}
                    onChange={(e) => setViewData(prev => ({ ...prev, type: e.target.value as ViewType }))}
                    style={{ margin: 0 }}
                  />
                  <span>{getViewIcon(type)}</span>
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: '500' }}>{label}</div>
                    <div style={{ fontSize: '10px', color: '#666' }}>{description}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Description */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500' }}>
              Description (Optional)
            </label>
            <textarea
              value={viewData.description}
              onChange={(e) => setViewData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Describe this view..."
              rows={3}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #ddd',
                borderRadius: '6px',
                fontSize: '14px',
                resize: 'vertical'
              }}
            />
          </div>

          {/* Temporary View Checkbox */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
              <input
                type="checkbox"
                checked={viewData.isTemporary}
                onChange={(e) => setViewData(prev => ({ ...prev, isTemporary: e.target.checked }))}
              />
              Temporary view (will be automatically deleted)
            </label>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '8px 16px',
                border: '1px solid #ddd',
                borderRadius: '6px',
                background: 'white',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!viewData.name.trim()}
              style={{
                padding: '8px 16px',
                border: 'none',
                borderRadius: '6px',
                background: viewData.name.trim() ? '#007bff' : '#ccc',
                color: 'white',
                cursor: viewData.name.trim() ? 'pointer' : 'not-allowed',
                fontSize: '14px'
              }}
            >
              Create View
            </button>
          </div>
        </form>
      </div>
    </div>
  );
});

CreateViewModal.displayName = 'CreateViewModal';

/**
 * View state management hooks
 */
export const useViewManager = (initialView: ViewState) => {
  const [views, setViews] = useState<ViewState[]>([initialView]);
  const [currentView, setCurrentView] = useState<ViewState>(initialView);

  const createView = useCallback((viewData: Omit<ViewState, 'id' | 'createdAt' | 'lastAccessedAt'>) => {
    const newView: ViewState = {
      ...viewData,
      id: `view-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date(),
      lastAccessedAt: new Date()
    };

    setViews(prev => [...prev, newView]);
    return newView;
  }, []);

  const updateView = useCallback((viewId: string, updates: Partial<ViewState>) => {
    setViews(prev => prev.map(view =>
      view.id === viewId
        ? { ...view, ...updates, lastAccessedAt: new Date() }
        : view
    ));

    if (viewId === currentView.id) {
      setCurrentView(prev => ({ ...prev, ...updates, lastAccessedAt: new Date() }));
    }
  }, [currentView.id]);

  const deleteView = useCallback((viewId: string) => {
    setViews(prev => prev.filter(view => view.id !== viewId));

    if (viewId === currentView.id && views.length > 1) {
      const remainingViews = views.filter(view => view.id !== viewId);
      setCurrentView(remainingViews[0]);
    }
  }, [currentView.id, views]);

  const changeView = useCallback((view: ViewState) => {
    setCurrentView({ ...view, lastAccessedAt: new Date() });
    updateView(view.id, { lastAccessedAt: new Date() });
  }, [updateView]);

  return {
    views,
    currentView,
    createView,
    updateView,
    deleteView,
    changeView
  };
};