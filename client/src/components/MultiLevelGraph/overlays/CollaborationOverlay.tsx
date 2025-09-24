import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  Avatar,
  Tooltip,
  Badge,
  IconButton,
  Typography,
  Chip,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Alert,
  Collapse
} from '@mui/material';
import {
  People,
  Psychology,
  Visibility,
  Edit,
  Comment,
  Share,
  Lock,
  LockOpen,
  NotificationImportant,
  Close
} from '@mui/icons-material';
import { GraphLevel } from '../MultiLevelGraphManager';

interface CollaborationUser {
  id: string;
  name: string;
  avatar: string;
  color: string;
  isActive: boolean;
  currentLevel: GraphLevel;
  selectedNodes: string[];
  cursor?: { x: number; y: number };
  lastActivity: Date;
}

interface CollaborationEvent {
  id: string;
  type: 'user_joined' | 'user_left' | 'selection_changed' | 'node_modified' | 'ai_suggestion' | 'conflict_detected';
  userId: string;
  timestamp: Date;
  data: any;
}

interface AICollaborator {
  id: string;
  name: string;
  status: 'active' | 'thinking' | 'suggesting' | 'idle';
  lastSuggestion?: {
    type: string;
    confidence: number;
    description: string;
  };
}

interface CollaborationOverlayProps {
  currentLevel: GraphLevel;
  selectedNodes: string[];
  onCollaborationEvent: (event: CollaborationEvent) => void;
}

const CollaborationOverlay: React.FC<CollaborationOverlayProps> = ({
  currentLevel,
  selectedNodes,
  onCollaborationEvent
}) => {
  const [users, setUsers] = useState<CollaborationUser[]>([]);
  const [aiCollaborators, setAiCollaborators] = useState<AICollaborator[]>([]);
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedUser, setSelectedUser] = useState<CollaborationUser | null>(null);
  const [conflicts, setConflicts] = useState<any[]>([]);
  const [showConflicts, setShowConflicts] = useState(true);

  // Initialize collaboration state
  useEffect(() => {
    // Simulate initial users and AI collaborators
    setUsers([
      {
        id: 'user-1',
        name: 'Alice Johnson',
        avatar: 'AJ',
        color: '#1976d2',
        isActive: true,
        currentLevel: 'component',
        selectedNodes: ['component-Header'],
        lastActivity: new Date()
      },
      {
        id: 'user-2',
        name: 'Bob Smith',
        avatar: 'BS',
        color: '#388e3c',
        isActive: true,
        currentLevel: 'system',
        selectedNodes: [],
        lastActivity: new Date()
      }
    ]);

    setAiCollaborators([
      {
        id: 'ai-architect',
        name: 'AI Architect',
        status: 'active',
        lastSuggestion: {
          type: 'optimization',
          confidence: 0.85,
          description: 'Consider using React.memo for performance optimization'
        }
      },
      {
        id: 'ai-reviewer',
        name: 'AI Code Reviewer',
        status: 'thinking'
      }
    ]);

    // Simulate some conflicts
    setConflicts([
      {
        id: 'conflict-1',
        type: 'simultaneous_edit',
        description: 'Alice and AI Architect are modifying the same component',
        severity: 'medium',
        affectedNodes: ['component-Header']
      }
    ]);
  }, []);

  // Handle user activity updates
  useEffect(() => {
    const interval = setInterval(() => {
      setUsers(prevUsers =>
        prevUsers.map(user => ({
          ...user,
          isActive: new Date().getTime() - user.lastActivity.getTime() < 30000 // 30 seconds
        }))
      );
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  // Handle selection changes
  useEffect(() => {
    if (selectedNodes.length > 0) {
      onCollaborationEvent({
        id: `selection-${Date.now()}`,
        type: 'selection_changed',
        userId: 'current-user',
        timestamp: new Date(),
        data: { selectedNodes, level: currentLevel }
      });
    }
  }, [selectedNodes, currentLevel, onCollaborationEvent]);

  const handleUserClick = useCallback((event: React.MouseEvent<HTMLElement>, user: CollaborationUser) => {
    setMenuAnchorEl(event.currentTarget);
    setSelectedUser(user);
  }, []);

  const handleCloseMenu = useCallback(() => {
    setMenuAnchorEl(null);
    setSelectedUser(null);
  }, []);

  const handleFollowUser = useCallback(() => {
    if (selectedUser) {
      onCollaborationEvent({
        id: `follow-${Date.now()}`,
        type: 'user_joined',
        userId: selectedUser.id,
        timestamp: new Date(),
        data: { action: 'follow', targetLevel: selectedUser.currentLevel }
      });
    }
    handleCloseMenu();
  }, [selectedUser, onCollaborationEvent, handleCloseMenu]);

  const handleResolveConflict = useCallback((conflictId: string) => {
    setConflicts(prev => prev.filter(c => c.id !== conflictId));
    onCollaborationEvent({
      id: `resolve-${Date.now()}`,
      type: 'conflict_detected',
      userId: 'current-user',
      timestamp: new Date(),
      data: { action: 'resolve', conflictId }
    });
  }, [onCollaborationEvent]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'success';
      case 'thinking': return 'warning';
      case 'suggesting': return 'info';
      default: return 'default';
    }
  };

  return (
    <>
      {/* Active Users */}
      <Paper
        sx={{
          position: 'absolute',
          top: 16,
          left: 16,
          p: 1.5,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          zIndex: 1000,
          minWidth: 200
        }}
      >
        <People color="primary" />
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          Collaborators
        </Typography>

        <Box sx={{ display: 'flex', gap: 0.5, ml: 1 }}>
          {users.map(user => (
            <Tooltip
              key={user.id}
              title={`${user.name} - ${user.currentLevel} level ${user.isActive ? '(active)' : '(away)'}`}
            >
              <Badge
                overlap="circular"
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                variant="dot"
                color={user.isActive ? 'success' : 'default'}
              >
                <Avatar
                  sx={{
                    width: 28,
                    height: 28,
                    bgcolor: user.color,
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                    border: user.selectedNodes.length > 0 ? 2 : 0,
                    borderColor: user.color
                  }}
                  onClick={(e) => handleUserClick(e, user)}
                >
                  {user.avatar}
                </Avatar>
              </Badge>
            </Tooltip>
          ))}

          {aiCollaborators.map(ai => (
            <Tooltip
              key={ai.id}
              title={`${ai.name} - ${ai.status}${ai.lastSuggestion ? ` (${Math.round(ai.lastSuggestion.confidence * 100)}% confident)` : ''}`}
            >
              <Badge
                overlap="circular"
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                variant="dot"
                color={getStatusColor(ai.status) as any}
              >
                <Avatar
                  sx={{
                    width: 28,
                    height: 28,
                    bgcolor: '#7b1fa2',
                    fontSize: '0.75rem'
                  }}
                >
                  <Psychology sx={{ fontSize: 16 }} />
                </Avatar>
              </Badge>
            </Tooltip>
          ))}
        </Box>
      </Paper>

      {/* Conflict Alerts */}
      <Collapse in={showConflicts && conflicts.length > 0}>
        <Paper
          sx={{
            position: 'absolute',
            top: 80,
            left: 16,
            maxWidth: 350,
            zIndex: 1000
          }}
        >
          <Box sx={{ p: 2, pb: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <NotificationImportant color="warning" />
                <Typography variant="subtitle2">
                  Collaboration Conflicts
                </Typography>
              </Box>
              <IconButton size="small" onClick={() => setShowConflicts(false)}>
                <Close />
              </IconButton>
            </Box>

            {conflicts.map(conflict => (
              <Alert
                key={conflict.id}
                severity="warning"
                sx={{ mb: 1, fontSize: '0.75rem' }}
                action={
                  <IconButton
                    size="small"
                    onClick={() => handleResolveConflict(conflict.id)}
                  >
                    <Close />
                  </IconButton>
                }
              >
                <Typography variant="caption" sx={{ fontWeight: 600 }}>
                  {conflict.type.replace('_', ' ').toUpperCase()}
                </Typography>
                <Typography variant="caption" display="block">
                  {conflict.description}
                </Typography>
                {conflict.affectedNodes.length > 0 && (
                  <Box sx={{ mt: 0.5 }}>
                    {conflict.affectedNodes.map((node: string) => (
                      <Chip
                        key={node}
                        label={node}
                        size="small"
                        variant="outlined"
                        sx={{ mr: 0.5, height: 16, fontSize: '0.625rem' }}
                      />
                    ))}
                  </Box>
                )}
              </Alert>
            ))}
          </Box>
        </Paper>
      </Collapse>

      {/* User Action Menu */}
      <Menu
        anchorEl={menuAnchorEl}
        open={Boolean(menuAnchorEl)}
        onClose={handleCloseMenu}
        transformOrigin={{ horizontal: 'left', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        {selectedUser && (
          <>
            <MenuItem disabled>
              <ListItemIcon>
                <Avatar sx={{ width: 24, height: 24, bgcolor: selectedUser.color }}>
                  {selectedUser.avatar}
                </Avatar>
              </ListItemIcon>
              <ListItemText
                primary={selectedUser.name}
                secondary={`${selectedUser.currentLevel} level`}
              />
            </MenuItem>
            <Divider />
            <MenuItem onClick={handleFollowUser}>
              <ListItemIcon>
                <Visibility />
              </ListItemIcon>
              <ListItemText primary="Follow user" />
            </MenuItem>
            <MenuItem onClick={handleCloseMenu}>
              <ListItemIcon>
                <Comment />
              </ListItemIcon>
              <ListItemText primary="Send message" />
            </MenuItem>
            <MenuItem onClick={handleCloseMenu}>
              <ListItemIcon>
                <Share />
              </ListItemIcon>
              <ListItemText primary="Share selection" />
            </MenuItem>
          </>
        )}
      </Menu>

      {/* AI Collaboration Status */}
      {aiCollaborators.some(ai => ai.status === 'suggesting') && (
        <Paper
          sx={{
            position: 'absolute',
            bottom: 16,
            right: 16,
            p: 2,
            maxWidth: 300,
            zIndex: 1000,
            bgcolor: 'rgba(123, 31, 162, 0.1)',
            border: '1px solid rgba(123, 31, 162, 0.3)'
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <Psychology color="secondary" />
            <Typography variant="subtitle2">
              AI Suggestions Available
            </Typography>
          </Box>

          {aiCollaborators
            .filter(ai => ai.lastSuggestion)
            .map(ai => (
              <Box key={ai.id} sx={{ mb: 1 }}>
                <Typography variant="caption" sx={{ fontWeight: 600 }}>
                  {ai.name}
                </Typography>
                <Typography variant="caption" display="block" color="text.secondary">
                  {ai.lastSuggestion?.description}
                </Typography>
                <Chip
                  size="small"
                  label={`${Math.round((ai.lastSuggestion?.confidence || 0) * 100)}% confidence`}
                  color="secondary"
                  variant="outlined"
                  sx={{ mt: 0.5, height: 18, fontSize: '0.625rem' }}
                />
              </Box>
            ))}
        </Paper>
      )}

      {/* Real-time Cursors */}
      {users
        .filter(user => user.cursor && user.isActive)
        .map(user => (
          <Box
            key={`cursor-${user.id}`}
            sx={{
              position: 'absolute',
              left: user.cursor!.x,
              top: user.cursor!.y,
              zIndex: 2000,
              pointerEvents: 'none',
              transform: 'translate(-2px, -2px)'
            }}
          >
            <Box
              sx={{
                width: 0,
                height: 0,
                borderLeft: `8px solid ${user.color}`,
                borderRight: '4px solid transparent',
                borderBottom: '12px solid transparent'
              }}
            />
            <Typography
              variant="caption"
              sx={{
                position: 'absolute',
                left: 10,
                top: 0,
                bgcolor: user.color,
                color: 'white',
                px: 0.5,
                py: 0.25,
                borderRadius: 0.5,
                fontSize: '0.625rem',
                whiteSpace: 'nowrap'
              }}
            >
              {user.name}
            </Typography>
          </Box>
        ))}
    </>
  );
};

export default CollaborationOverlay;