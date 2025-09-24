import React from 'react';
import {
  Box,
  Paper,
  IconButton,
  Tooltip,
  Divider,
  Badge,
  ButtonGroup
} from '@mui/material';
import {
  Undo,
  Redo,
  ContentCopy,
  Delete,
  Save,
  Preview,
  Palette,
  ZoomIn,
  ZoomOut,
  CenterFocusStrong,
  AutoAwesome,
  Share,
  DownloadForOffline
} from '@mui/icons-material';

interface ArchitectureToolbarProps {
  onUndo: () => void;
  onRedo: () => void;
  onCopy: () => void;
  onDelete: () => void;
  onSave: () => void;
  onTogglePreview: () => void;
  onTogglePalette: () => void;
  canUndo: boolean;
  canRedo: boolean;
  selectedCount: number;
}

const ArchitectureToolbar: React.FC<ArchitectureToolbarProps> = ({
  onUndo,
  onRedo,
  onCopy,
  onDelete,
  onSave,
  onTogglePreview,
  onTogglePalette,
  canUndo,
  canRedo,
  selectedCount
}) => {
  return (
    <Paper
      sx={{
        position: 'absolute',
        top: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        p: 1,
        zIndex: 1000,
        boxShadow: 3,
        borderRadius: 2
      }}
    >
      {/* Edit Actions */}
      <ButtonGroup size="small" variant="outlined">
        <Tooltip title="Undo (Ctrl+Z)">
          <span>
            <IconButton onClick={onUndo} disabled={!canUndo} size="small">
              <Undo />
            </IconButton>
          </span>
        </Tooltip>

        <Tooltip title="Redo (Ctrl+Shift+Z)">
          <span>
            <IconButton onClick={onRedo} disabled={!canRedo} size="small">
              <Redo />
            </IconButton>
          </span>
        </Tooltip>
      </ButtonGroup>

      <Divider orientation="vertical" flexItem />

      {/* Selection Actions */}
      <ButtonGroup size="small" variant="outlined">
        <Tooltip title={`Copy (Ctrl+C) - ${selectedCount} selected`}>
          <span>
            <Badge badgeContent={selectedCount > 0 ? selectedCount : null} color="primary">
              <IconButton onClick={onCopy} disabled={selectedCount === 0} size="small">
                <ContentCopy />
              </IconButton>
            </Badge>
          </span>
        </Tooltip>

        <Tooltip title="Delete (Del)">
          <span>
            <IconButton
              onClick={onDelete}
              disabled={selectedCount === 0}
              size="small"
              color={selectedCount > 0 ? 'error' : 'default'}
            >
              <Delete />
            </IconButton>
          </span>
        </Tooltip>
      </ButtonGroup>

      <Divider orientation="vertical" flexItem />

      {/* View Controls */}
      <ButtonGroup size="small" variant="outlined">
        <Tooltip title="Toggle Component Palette">
          <IconButton onClick={onTogglePalette} size="small">
            <Palette />
          </IconButton>
        </Tooltip>

        <Tooltip title="Toggle Live Preview">
          <IconButton onClick={onTogglePreview} size="small" color="primary">
            <Preview />
          </IconButton>
        </Tooltip>

        <Tooltip title="Zoom to Fit">
          <IconButton onClick={() => console.log('Zoom to fit')} size="small">
            <CenterFocusStrong />
          </IconButton>
        </Tooltip>
      </ButtonGroup>

      <Divider orientation="vertical" flexItem />

      {/* AI Actions */}
      <ButtonGroup size="small" variant="outlined">
        <Tooltip title="AI Suggestions">
          <IconButton onClick={() => console.log('AI suggestions')} size="small" color="secondary">
            <AutoAwesome />
          </IconButton>
        </Tooltip>
      </ButtonGroup>

      <Divider orientation="vertical" flexItem />

      {/* Save & Export */}
      <ButtonGroup size="small" variant="outlined">
        <Tooltip title="Save Architecture (Ctrl+S)">
          <IconButton onClick={onSave} size="small" color="success">
            <Save />
          </IconButton>
        </Tooltip>

        <Tooltip title="Share">
          <IconButton onClick={() => console.log('Share architecture')} size="small">
            <Share />
          </IconButton>
        </Tooltip>

        <Tooltip title="Export">
          <IconButton onClick={() => console.log('Export architecture')} size="small">
            <DownloadForOffline />
          </IconButton>
        </Tooltip>
      </ButtonGroup>
    </Paper>
  );
};

export default ArchitectureToolbar;