import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { Node, Edge } from 'reactflow';
import { GraphLevel } from '../MultiLevelGraphManager';

interface CollaborationState {
  isConnected: boolean;
  sessionId: string | null;
  users: CollaborationUser[];
  currentUser: CollaborationUser | null;
  conflicts: ConflictData[];
  aiCollaborators: AICollaboratorState[];
}

interface CollaborationUser {
  id: string;
  name: string;
  avatar: string;
  color: string;
  currentLevel: GraphLevel;
  selectedNodes: string[];
  cursor: { x: number; y: number } | null;
  isActive: boolean;
  lastActivity: Date;
}

interface ConflictData {
  id: string;
  type: 'simultaneous_edit' | 'selection_conflict' | 'version_mismatch';
  description: string;
  severity: 'low' | 'medium' | 'high';
  affectedNodes: string[];
  involvedUsers: string[];
  timestamp: Date;
  autoResolvable: boolean;
}

interface AICollaboratorState {
  id: string;
  name: string;
  type: 'architect' | 'reviewer' | 'optimizer' | 'security';
  status: 'idle' | 'analyzing' | 'suggesting' | 'implementing';
  currentSuggestion: AISuggestion | null;
  confidence: number;
  lastActivity: Date;
}

interface AISuggestion {
  id: string;
  type: 'refactor' | 'optimize' | 'security' | 'pattern' | 'business';
  title: string;
  description: string;
  affectedNodes: string[];
  codeChanges: any[];
  confidence: number;
  reasoning: string;
}

interface CollaborationMessage {
  type: 'user_join' | 'user_leave' | 'selection_change' | 'node_update' | 'cursor_move' | 'ai_suggestion' | 'conflict_detected' | 'conflict_resolved';
  userId: string;
  sessionId: string;
  timestamp: Date;
  data: any;
}

interface RealTimeCollaborationContextType {
  state: CollaborationState;
  connect: (userId: string, userName: string) => void;
  disconnect: () => void;
  updateSelection: (selectedNodes: string[], level: GraphLevel) => void;
  updateCursor: (x: number, y: number) => void;
  sendNodeUpdate: (nodes: Node[], edges: Edge[]) => void;
  resolveConflict: (conflictId: string, resolution: any) => void;
  requestAIAssistance: (context: any) => void;
  sendMessage: (message: CollaborationMessage) => void;
}

const RealTimeCollaborationContext = createContext<RealTimeCollaborationContextType | null>(null);

export const useRealTimeCollaboration = () => {
  const context = useContext(RealTimeCollaborationContext);
  if (!context) {
    throw new Error('useRealTimeCollaboration must be used within a RealTimeCollaborationProvider');
  }
  return context;
};

interface RealTimeCollaborationProviderProps {
  children: React.ReactNode;
  websocketUrl?: string;
  enableAI?: boolean;
}

export const RealTimeCollaborationProvider: React.FC<RealTimeCollaborationProviderProps> = ({
  children,
  websocketUrl = 'ws://localhost:3001/api/realtime',
  enableAI = true
}) => {
  const [state, setState] = useState<CollaborationState>({
    isConnected: false,
    sessionId: null,
    users: [],
    currentUser: null,
    conflicts: [],
    aiCollaborators: []
  });

  const wsRef = useRef<WebSocket | null>(null);
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize AI collaborators
  useEffect(() => {
    if (enableAI) {
      setState(prev => ({
        ...prev,
        aiCollaborators: [
          {
            id: 'ai-architect',
            name: 'AI Architect',
            type: 'architect',
            status: 'idle',
            currentSuggestion: null,
            confidence: 0,
            lastActivity: new Date()
          },
          {
            id: 'ai-reviewer',
            name: 'AI Code Reviewer',
            type: 'reviewer',
            status: 'idle',
            currentSuggestion: null,
            confidence: 0,
            lastActivity: new Date()
          },
          {
            id: 'ai-optimizer',
            name: 'AI Optimizer',
            type: 'optimizer',
            status: 'idle',
            currentSuggestion: null,
            confidence: 0,
            lastActivity: new Date()
          }
        ]
      }));
    }
  }, [enableAI]);

  // WebSocket connection management
  const connect = useCallback((userId: string, userName: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      disconnect();
    }

    try {
      wsRef.current = new WebSocket(websocketUrl);

      wsRef.current.onopen = () => {
        console.log('WebSocket connected');
        setState(prev => ({ ...prev, isConnected: true }));

        // Send join message
        const joinMessage: CollaborationMessage = {
          type: 'user_join',
          userId,
          sessionId: generateSessionId(),
          timestamp: new Date(),
          data: { userName, avatar: generateAvatar(userName) }
        };

        wsRef.current?.send(JSON.stringify(joinMessage));

        // Start heartbeat
        heartbeatRef.current = setInterval(() => {
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'ping' }));
          }
        }, 30000);
      };

      wsRef.current.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as CollaborationMessage;
          handleMessage(message);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      wsRef.current.onclose = (event) => {
        console.log('WebSocket closed:', event.code, event.reason);
        setState(prev => ({ ...prev, isConnected: false }));

        if (heartbeatRef.current) {
          clearInterval(heartbeatRef.current);
          heartbeatRef.current = null;
        }

        // Attempt reconnection if not intentionally closed
        if (event.code !== 1000) {
          reconnectTimeoutRef.current = setTimeout(() => {
            connect(userId, userName);
          }, 5000);
        }
      };

      wsRef.current.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
    }
  }, [websocketUrl]);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close(1000, 'User disconnected');
      wsRef.current = null;
    }

    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    setState(prev => ({ ...prev, isConnected: false, sessionId: null }));
  }, []);

  // Message handling
  const handleMessage = useCallback((message: CollaborationMessage) => {
    switch (message.type) {
      case 'user_join':
        handleUserJoin(message);
        break;
      case 'user_leave':
        handleUserLeave(message);
        break;
      case 'selection_change':
        handleSelectionChange(message);
        break;
      case 'cursor_move':
        handleCursorMove(message);
        break;
      case 'node_update':
        handleNodeUpdate(message);
        break;
      case 'ai_suggestion':
        handleAISuggestion(message);
        break;
      case 'conflict_detected':
        handleConflictDetected(message);
        break;
      case 'conflict_resolved':
        handleConflictResolved(message);
        break;
      default:
        console.log('Unknown message type:', message.type);
    }
  }, []);

  const handleUserJoin = (message: CollaborationMessage) => {
    const newUser: CollaborationUser = {
      id: message.userId,
      name: message.data.userName,
      avatar: message.data.avatar,
      color: generateUserColor(message.userId),
      currentLevel: 'component',
      selectedNodes: [],
      cursor: null,
      isActive: true,
      lastActivity: new Date()
    };

    setState(prev => ({
      ...prev,
      users: [...prev.users.filter(u => u.id !== message.userId), newUser],
      sessionId: message.sessionId
    }));
  };

  const handleUserLeave = (message: CollaborationMessage) => {
    setState(prev => ({
      ...prev,
      users: prev.users.filter(u => u.id !== message.userId)
    }));
  };

  const handleSelectionChange = (message: CollaborationMessage) => {
    setState(prev => ({
      ...prev,
      users: prev.users.map(user =>
        user.id === message.userId
          ? {
              ...user,
              selectedNodes: message.data.selectedNodes,
              currentLevel: message.data.level,
              lastActivity: new Date()
            }
          : user
      )
    }));

    // Check for selection conflicts
    detectSelectionConflicts(message);
  };

  const handleCursorMove = (message: CollaborationMessage) => {
    setState(prev => ({
      ...prev,
      users: prev.users.map(user =>
        user.id === message.userId
          ? { ...user, cursor: message.data.cursor, lastActivity: new Date() }
          : user
      )
    }));
  };

  const handleNodeUpdate = (message: CollaborationMessage) => {
    // Handle real-time node updates from other users
    console.log('Node update received:', message.data);

    // Check for simultaneous edit conflicts
    detectEditConflicts(message);
  };

  const handleAISuggestion = (message: CollaborationMessage) => {
    const { aiId, suggestion } = message.data;

    setState(prev => ({
      ...prev,
      aiCollaborators: prev.aiCollaborators.map(ai =>
        ai.id === aiId
          ? {
              ...ai,
              status: 'suggesting',
              currentSuggestion: suggestion,
              confidence: suggestion.confidence,
              lastActivity: new Date()
            }
          : ai
      )
    }));
  };

  const handleConflictDetected = (message: CollaborationMessage) => {
    const conflict: ConflictData = {
      id: message.data.conflictId,
      type: message.data.conflictType,
      description: message.data.description,
      severity: message.data.severity,
      affectedNodes: message.data.affectedNodes,
      involvedUsers: message.data.involvedUsers,
      timestamp: new Date(),
      autoResolvable: message.data.autoResolvable
    };

    setState(prev => ({
      ...prev,
      conflicts: [...prev.conflicts, conflict]
    }));
  };

  const handleConflictResolved = (message: CollaborationMessage) => {
    setState(prev => ({
      ...prev,
      conflicts: prev.conflicts.filter(c => c.id !== message.data.conflictId)
    }));
  };

  // Conflict detection
  const detectSelectionConflicts = (message: CollaborationMessage) => {
    const overlappingSelections = state.users.filter(user =>
      user.id !== message.userId &&
      user.selectedNodes.some(node => message.data.selectedNodes.includes(node))
    );

    if (overlappingSelections.length > 0) {
      // Don't create conflict for harmless selection overlaps
      console.log('Selection overlap detected, but not creating conflict');
    }
  };

  const detectEditConflicts = (message: CollaborationMessage) => {
    // This would implement more sophisticated conflict detection
    // based on the current editing state and incoming changes
    console.log('Checking for edit conflicts...');
  };

  // Public API methods
  const updateSelection = useCallback((selectedNodes: string[], level: GraphLevel) => {
    if (wsRef.current?.readyState === WebSocket.OPEN && state.currentUser) {
      const message: CollaborationMessage = {
        type: 'selection_change',
        userId: state.currentUser.id,
        sessionId: state.sessionId!,
        timestamp: new Date(),
        data: { selectedNodes, level }
      };

      wsRef.current.send(JSON.stringify(message));
    }
  }, [state.currentUser, state.sessionId]);

  const updateCursor = useCallback((x: number, y: number) => {
    if (wsRef.current?.readyState === WebSocket.OPEN && state.currentUser) {
      const message: CollaborationMessage = {
        type: 'cursor_move',
        userId: state.currentUser.id,
        sessionId: state.sessionId!,
        timestamp: new Date(),
        data: { cursor: { x, y } }
      };

      wsRef.current.send(JSON.stringify(message));
    }
  }, [state.currentUser, state.sessionId]);

  const sendNodeUpdate = useCallback((nodes: Node[], edges: Edge[]) => {
    if (wsRef.current?.readyState === WebSocket.OPEN && state.currentUser) {
      const message: CollaborationMessage = {
        type: 'node_update',
        userId: state.currentUser.id,
        sessionId: state.sessionId!,
        timestamp: new Date(),
        data: { nodes, edges }
      };

      wsRef.current.send(JSON.stringify(message));
    }
  }, [state.currentUser, state.sessionId]);

  const resolveConflict = useCallback((conflictId: string, resolution: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN && state.currentUser) {
      const message: CollaborationMessage = {
        type: 'conflict_resolved',
        userId: state.currentUser.id,
        sessionId: state.sessionId!,
        timestamp: new Date(),
        data: { conflictId, resolution }
      };

      wsRef.current.send(JSON.stringify(message));
    }
  }, [state.currentUser, state.sessionId]);

  const requestAIAssistance = useCallback((context: any) => {
    // Simulate AI assistance request
    setTimeout(() => {
      const aiSuggestion: AISuggestion = {
        id: `suggestion-${Date.now()}`,
        type: 'optimize',
        title: 'Performance Optimization',
        description: 'Consider memoizing this component to improve render performance',
        affectedNodes: context.selectedNodes || [],
        codeChanges: [],
        confidence: 0.85,
        reasoning: 'High re-render frequency detected in this component tree'
      };

      handleAISuggestion({
        type: 'ai_suggestion',
        userId: 'ai-optimizer',
        sessionId: state.sessionId!,
        timestamp: new Date(),
        data: { aiId: 'ai-optimizer', suggestion: aiSuggestion }
      });
    }, 2000);
  }, [state.sessionId]);

  const sendMessage = useCallback((message: CollaborationMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  const contextValue: RealTimeCollaborationContextType = {
    state,
    connect,
    disconnect,
    updateSelection,
    updateCursor,
    sendNodeUpdate,
    resolveConflict,
    requestAIAssistance,
    sendMessage
  };

  return (
    <RealTimeCollaborationContext.Provider value={contextValue}>
      {children}
    </RealTimeCollaborationContext.Provider>
  );
};

// Helper functions
function generateSessionId(): string {
  return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function generateAvatar(userName: string): string {
  return userName
    .split(' ')
    .map(name => name.charAt(0).toUpperCase())
    .join('')
    .slice(0, 2);
}

function generateUserColor(userId: string): string {
  const colors = [
    '#1976d2', '#388e3c', '#f57c00', '#7b1fa2', '#c2185b',
    '#00acc1', '#5e35b1', '#fb8c00', '#43a047', '#8e24aa'
  ];

  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }

  return colors[Math.abs(hash) % colors.length];
}

export default RealTimeCollaborationProvider;