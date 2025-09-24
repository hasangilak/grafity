import React from 'react';
import { Box, Breadcrumbs, Link, Chip, IconButton, Tooltip } from '@mui/material';
import {
  Storage,
  Business,
  AccountTree,
  Code,
  NavigateNext,
  History,
  ViewModule
} from '@mui/icons-material';
import { GraphLevel } from '../MultiLevelGraphManager';

interface ViewTransitionControlsProps {
  currentLevel: GraphLevel;
  viewHistory: GraphLevel[];
  onNavigate: (level: GraphLevel) => void;
  isTransitioning: boolean;
}

const levelIcons = {
  system: <Storage />,
  business: <Business />,
  component: <AccountTree />,
  implementation: <Code />
};

const levelLabels = {
  system: 'System',
  business: 'Business',
  component: 'Component',
  implementation: 'Implementation'
};

const ViewTransitionControls: React.FC<ViewTransitionControlsProps> = ({
  currentLevel,
  viewHistory,
  onNavigate,
  isTransitioning
}) => {
  const uniqueHistory = viewHistory.filter((level, index) =>
    viewHistory.indexOf(level) === index
  );

  return (
    <Box
      sx={{
        px: 2,
        py: 1,
        borderTop: 1,
        borderColor: 'divider',
        backgroundColor: 'rgba(0, 0, 0, 0.02)'
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {/* Breadcrumb Navigation */}
        <Breadcrumbs
          separator={<NavigateNext fontSize="small" />}
          aria-label="view navigation"
        >
          {uniqueHistory.map((level, index) => {
            const isActive = level === currentLevel;
            const isCurrent = index === uniqueHistory.length - 1;

            return (
              <Link
                key={level}
                component="button"
                variant="body2"
                onClick={() => !isActive && !isTransitioning && onNavigate(level)}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                  textDecoration: 'none',
                  color: isActive ? 'primary.main' : 'text.secondary',
                  fontWeight: isActive ? 600 : 400,
                  cursor: isActive || isTransitioning ? 'default' : 'pointer',
                  '&:hover': {
                    color: isActive || isTransitioning ? undefined : 'primary.main'
                  },
                  border: 'none',
                  background: 'none',
                  fontSize: '0.875rem'
                }}
                disabled={isActive || isTransitioning}
              >
                {React.cloneElement(levelIcons[level], {
                  sx: { fontSize: 16 }
                })}
                {levelLabels[level]}
                {isActive && (
                  <Chip
                    size="small"
                    label="Current"
                    color="primary"
                    variant="outlined"
                    sx={{ height: 18, fontSize: '0.625rem', ml: 0.5 }}
                  />
                )}
              </Link>
            );
          })}
        </Breadcrumbs>

        {/* View Controls */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {viewHistory.length > 1 && (
            <Tooltip title="View History">
              <IconButton
                size="small"
                disabled={isTransitioning}
                onClick={() => {
                  console.log('Show view history:', viewHistory);
                }}
              >
                <History fontSize="small" />
              </IconButton>
            </Tooltip>
          )}

          <Tooltip title="View Options">
            <IconButton
              size="small"
              disabled={isTransitioning}
              onClick={() => {
                console.log('Show view options for level:', currentLevel);
              }}
            >
              <ViewModule fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Quick Jump Actions */}
      {currentLevel !== 'system' && (
        <Box sx={{ mt: 1, display: 'flex', gap: 1 }}>
          <Chip
            size="small"
            icon={<Storage />}
            label="Jump to System"
            variant="outlined"
            clickable
            disabled={isTransitioning}
            onClick={() => onNavigate('system')}
            sx={{ fontSize: '0.75rem' }}
          />
          {currentLevel !== 'business' && (
            <Chip
              size="small"
              icon={<Business />}
              label="View Business Flows"
              variant="outlined"
              clickable
              disabled={isTransitioning}
              onClick={() => onNavigate('business')}
              sx={{ fontSize: '0.75rem' }}
            />
          )}
        </Box>
      )}
    </Box>
  );
};

export default ViewTransitionControls;