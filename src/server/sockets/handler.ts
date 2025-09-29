import { Server as SocketIOServer, Socket } from 'socket.io';
import { SecurityManager } from '../../security/SecurityManager';
import { authenticateSocket } from '../middleware/auth';
import { AuthContext } from '../../security/types';

export interface AuthenticatedSocket extends Socket {
  user?: AuthContext;
  rooms: Set<string>;
  subscriptions: Set<string>;
}

export interface SocketEvent {
  event: string;
  data: any;
  timestamp: Date;
  userId?: string;
  socketId: string;
}

export interface RoomMessage {
  type: string;
  data: any;
  sender?: {
    id: string;
    username: string;
  };
  timestamp: Date;
}

export class WebSocketHandler {
  private io?: SocketIOServer;
  private securityManager?: SecurityManager;
  private connectedUsers = new Map<string, Set<string>>(); // userId -> Set<socketId>
  private socketUsers = new Map<string, string>(); // socketId -> userId
  private roomSubscriptions = new Map<string, Set<string>>(); // room -> Set<socketId>

  initialize(io: SocketIOServer, securityManager: SecurityManager): void {
    this.io = io;
    this.securityManager = securityManager;

    // Authentication middleware
    io.use(async (socket: AuthenticatedSocket, next) => {
      try {
        const authContext = await authenticateSocket(socket, securityManager);

        if (authContext) {
          socket.user = authContext;
          console.log(`🔌 Socket authenticated: ${authContext.user.username} (${socket.id})`);
        } else {
          console.log(`🔌 Socket connected anonymously: ${socket.id}`);
        }

        socket.rooms = new Set();
        socket.subscriptions = new Set();
        next();

      } catch (error) {
        console.error('Socket authentication error:', error);
        next(new Error('Authentication failed'));
      }
    });

    // Handle connections
    io.on('connection', (socket: AuthenticatedSocket) => {
      this.handleConnection(socket);
    });

    console.log('✅ WebSocket handler initialized');
  }

  private handleConnection(socket: AuthenticatedSocket): void {
    const userId = socket.user?.user.id;

    // Track user connections
    if (userId) {
      if (!this.connectedUsers.has(userId)) {
        this.connectedUsers.set(userId, new Set());
      }
      this.connectedUsers.get(userId)!.add(socket.id);
      this.socketUsers.set(socket.id, userId);

      // Notify user's other sessions about new connection
      this.broadcastToUser(userId, 'user:session_connected', {
        socketId: socket.id,
        timestamp: new Date(),
        userAgent: socket.handshake.headers['user-agent']
      }, socket.id);
    }

    console.log(`🔗 Socket connected: ${socket.id} (user: ${socket.user?.user.username || 'anonymous'})`);

    // Send welcome message
    socket.emit('connected', {
      socketId: socket.id,
      timestamp: new Date(),
      user: socket.user ? {
        id: socket.user.user.id,
        username: socket.user.user.username,
        roles: socket.user.user.roles
      } : null
    });

    // Handle authentication after connection (for clients that connect first)
    socket.on('authenticate', async (data) => {
      await this.handleAuthentication(socket, data);
    });

    // Handle room management
    socket.on('join_room', (data) => {
      this.handleJoinRoom(socket, data);
    });

    socket.on('leave_room', (data) => {
      this.handleLeaveRoom(socket, data);
    });

    // Handle real-time subscriptions
    socket.on('subscribe', (data) => {
      this.handleSubscribe(socket, data);
    });

    socket.on('unsubscribe', (data) => {
      this.handleUnsubscribe(socket, data);
    });

    // Handle project-specific events
    socket.on('project:subscribe', (data) => {
      this.handleProjectSubscribe(socket, data);
    });

    socket.on('project:unsubscribe', (data) => {
      this.handleProjectUnsubscribe(socket, data);
    });

    // Handle analysis events
    socket.on('analysis:start', (data) => {
      this.handleAnalysisStart(socket, data);
    });

    socket.on('analysis:cancel', (data) => {
      this.handleAnalysisCancel(socket, data);
    });

    // Handle messaging
    socket.on('message', (data) => {
      this.handleMessage(socket, data);
    });

    // Handle typing indicators
    socket.on('typing:start', (data) => {
      this.handleTypingStart(socket, data);
    });

    socket.on('typing:stop', (data) => {
      this.handleTypingStop(socket, data);
    });

    // Handle presence updates
    socket.on('presence:update', (data) => {
      this.handlePresenceUpdate(socket, data);
    });

    // Handle disconnection
    socket.on('disconnect', (reason) => {
      this.handleDisconnection(socket, reason);
    });

    // Handle ping/pong for connection health
    socket.on('ping', () => {
      socket.emit('pong', { timestamp: new Date() });
    });

    // Handle errors
    socket.on('error', (error) => {
      console.error(`Socket error (${socket.id}):`, error);
    });
  }

  private async handleAuthentication(socket: AuthenticatedSocket, data: any): Promise<void> {
    try {
      if (!this.securityManager) return;

      const { token } = data;
      if (!token) {
        socket.emit('auth:error', { error: 'Token required' });
        return;
      }

      const authContext = await this.securityManager.validateToken(token);
      if (!authContext) {
        socket.emit('auth:error', { error: 'Invalid token' });
        return;
      }

      socket.user = authContext;
      const userId = authContext.user.id;

      // Update tracking
      if (!this.connectedUsers.has(userId)) {
        this.connectedUsers.set(userId, new Set());
      }
      this.connectedUsers.get(userId)!.add(socket.id);
      this.socketUsers.set(socket.id, userId);

      socket.emit('auth:success', {
        user: {
          id: authContext.user.id,
          username: authContext.user.username,
          roles: authContext.user.roles
        }
      });

      console.log(`🔐 Socket authenticated: ${authContext.user.username} (${socket.id})`);

    } catch (error) {
      console.error('Socket authentication error:', error);
      socket.emit('auth:error', { error: 'Authentication failed' });
    }
  }

  private handleJoinRoom(socket: AuthenticatedSocket, data: any): void {
    const { room, password } = data;

    if (!room || typeof room !== 'string') {
      socket.emit('room:error', { error: 'Invalid room name' });
      return;
    }

    // Check permissions for private rooms
    if (room.startsWith('private:') && !socket.user) {
      socket.emit('room:error', { error: 'Authentication required for private rooms' });
      return;
    }

    // Project rooms require project access
    if (room.startsWith('project:')) {
      // TODO: Check project permissions
    }

    socket.join(room);
    socket.rooms.add(room);

    // Track room subscriptions
    if (!this.roomSubscriptions.has(room)) {
      this.roomSubscriptions.set(room, new Set());
    }
    this.roomSubscriptions.get(room)!.add(socket.id);

    // Notify room members
    socket.to(room).emit('room:user_joined', {
      room,
      user: socket.user ? {
        id: socket.user.user.id,
        username: socket.user.user.username
      } : { id: socket.id, username: 'Anonymous' },
      timestamp: new Date()
    });

    socket.emit('room:joined', {
      room,
      memberCount: this.roomSubscriptions.get(room)?.size || 0,
      timestamp: new Date()
    });

    console.log(`🏠 Socket ${socket.id} joined room: ${room}`);
  }

  private handleLeaveRoom(socket: AuthenticatedSocket, data: any): void {
    const { room } = data;

    if (!room || !socket.rooms.has(room)) {
      socket.emit('room:error', { error: 'Not in room' });
      return;
    }

    socket.leave(room);
    socket.rooms.delete(room);

    // Update room subscriptions
    this.roomSubscriptions.get(room)?.delete(socket.id);
    if (this.roomSubscriptions.get(room)?.size === 0) {
      this.roomSubscriptions.delete(room);
    }

    // Notify room members
    socket.to(room).emit('room:user_left', {
      room,
      user: socket.user ? {
        id: socket.user.user.id,
        username: socket.user.user.username
      } : { id: socket.id, username: 'Anonymous' },
      timestamp: new Date()
    });

    socket.emit('room:left', { room, timestamp: new Date() });

    console.log(`🚪 Socket ${socket.id} left room: ${room}`);
  }

  private handleSubscribe(socket: AuthenticatedSocket, data: any): void {
    const { subscription, filters } = data;

    if (!subscription || typeof subscription !== 'string') {
      socket.emit('subscription:error', { error: 'Invalid subscription' });
      return;
    }

    socket.subscriptions.add(subscription);
    socket.emit('subscription:active', { subscription, filters, timestamp: new Date() });

    console.log(`📡 Socket ${socket.id} subscribed to: ${subscription}`);
  }

  private handleUnsubscribe(socket: AuthenticatedSocket, data: any): void {
    const { subscription } = data;

    if (subscription) {
      socket.subscriptions.delete(subscription);
      socket.emit('subscription:inactive', { subscription, timestamp: new Date() });
    } else {
      // Unsubscribe from all
      socket.subscriptions.clear();
      socket.emit('subscription:cleared', { timestamp: new Date() });
    }

    console.log(`📡 Socket ${socket.id} unsubscribed from: ${subscription || 'all'}`);
  }

  private handleProjectSubscribe(socket: AuthenticatedSocket, data: any): void {
    const { projectId } = data;

    if (!projectId) {
      socket.emit('project:error', { error: 'Project ID required' });
      return;
    }

    // TODO: Check project permissions
    const room = `project:${projectId}`;
    socket.join(room);
    socket.rooms.add(room);

    socket.emit('project:subscribed', { projectId, timestamp: new Date() });
    console.log(`📊 Socket ${socket.id} subscribed to project: ${projectId}`);
  }

  private handleProjectUnsubscribe(socket: AuthenticatedSocket, data: any): void {
    const { projectId } = data;

    if (!projectId) return;

    const room = `project:${projectId}`;
    socket.leave(room);
    socket.rooms.delete(room);

    socket.emit('project:unsubscribed', { projectId, timestamp: new Date() });
    console.log(`📊 Socket ${socket.id} unsubscribed from project: ${projectId}`);
  }

  private handleAnalysisStart(socket: AuthenticatedSocket, data: any): void {
    if (!socket.user) {
      socket.emit('analysis:error', { error: 'Authentication required' });
      return;
    }

    // TODO: Validate analysis permissions and start analysis
    const { projectId, options } = data;

    socket.emit('analysis:started', {
      projectId,
      analysisId: `analysis_${Date.now()}`,
      timestamp: new Date()
    });
  }

  private handleAnalysisCancel(socket: AuthenticatedSocket, data: any): void {
    if (!socket.user) {
      socket.emit('analysis:error', { error: 'Authentication required' });
      return;
    }

    // TODO: Cancel analysis
    const { analysisId } = data;

    socket.emit('analysis:cancelled', { analysisId, timestamp: new Date() });
  }

  private handleMessage(socket: AuthenticatedSocket, data: any): void {
    const { room, message, type = 'text' } = data;

    if (!room || !message) {
      socket.emit('message:error', { error: 'Room and message required' });
      return;
    }

    if (!socket.rooms.has(room)) {
      socket.emit('message:error', { error: 'Not in room' });
      return;
    }

    const messageData: RoomMessage = {
      type,
      data: message,
      sender: socket.user ? {
        id: socket.user.user.id,
        username: socket.user.user.username
      } : undefined,
      timestamp: new Date()
    };

    // Broadcast to room (excluding sender)
    socket.to(room).emit('message', { room, ...messageData });

    // Confirm to sender
    socket.emit('message:sent', { room, timestamp: messageData.timestamp });
  }

  private handleTypingStart(socket: AuthenticatedSocket, data: any): void {
    const { room } = data;

    if (!room || !socket.rooms.has(room)) return;

    socket.to(room).emit('typing:start', {
      room,
      user: socket.user ? {
        id: socket.user.user.id,
        username: socket.user.user.username
      } : { id: socket.id, username: 'Anonymous' },
      timestamp: new Date()
    });
  }

  private handleTypingStop(socket: AuthenticatedSocket, data: any): void {
    const { room } = data;

    if (!room || !socket.rooms.has(room)) return;

    socket.to(room).emit('typing:stop', {
      room,
      user: socket.user ? {
        id: socket.user.user.id,
        username: socket.user.user.username
      } : { id: socket.id, username: 'Anonymous' },
      timestamp: new Date()
    });
  }

  private handlePresenceUpdate(socket: AuthenticatedSocket, data: any): void {
    const { status, activity } = data;

    if (!socket.user) return;

    // Broadcast to all user's rooms
    socket.rooms.forEach(room => {
      socket.to(room).emit('presence:update', {
        user: {
          id: socket.user!.user.id,
          username: socket.user!.user.username
        },
        status,
        activity,
        timestamp: new Date()
      });
    });
  }

  private handleDisconnection(socket: AuthenticatedSocket, reason: string): void {
    const userId = socket.user?.user.id;

    // Clean up tracking
    if (userId) {
      this.connectedUsers.get(userId)?.delete(socket.id);
      if (this.connectedUsers.get(userId)?.size === 0) {
        this.connectedUsers.delete(userId);
      }
      this.socketUsers.delete(socket.id);
    }

    // Clean up room subscriptions
    socket.rooms.forEach(room => {
      this.roomSubscriptions.get(room)?.delete(socket.id);
      if (this.roomSubscriptions.get(room)?.size === 0) {
        this.roomSubscriptions.delete(room);
      }

      // Notify room members
      socket.to(room).emit('room:user_left', {
        room,
        user: socket.user ? {
          id: socket.user.user.id,
          username: socket.user.user.username
        } : { id: socket.id, username: 'Anonymous' },
        reason,
        timestamp: new Date()
      });
    });

    console.log(`🔌 Socket disconnected: ${socket.id} (reason: ${reason}, user: ${socket.user?.user.username || 'anonymous'})`);
  }

  // Public methods for broadcasting

  broadcastToRoom(room: string, event: string, data: any): void {
    if (!this.io) return;
    this.io.to(room).emit(event, data);
  }

  broadcastToUser(userId: string, event: string, data: any, excludeSocketId?: string): void {
    if (!this.io) return;

    const userSockets = this.connectedUsers.get(userId);
    if (!userSockets) return;

    userSockets.forEach(socketId => {
      if (socketId !== excludeSocketId) {
        this.io!.to(socketId).emit(event, data);
      }
    });
  }

  broadcastToProject(projectId: string, event: string, data: any): void {
    this.broadcastToRoom(`project:${projectId}`, event, data);
  }

  broadcastAnalysisProgress(projectId: string, progress: any): void {
    this.broadcastToProject(projectId, 'analysis:progress', {
      projectId,
      ...progress,
      timestamp: new Date()
    });
  }

  broadcastPatternDetected(projectId: string, pattern: any): void {
    this.broadcastToProject(projectId, 'pattern:detected', {
      projectId,
      pattern,
      timestamp: new Date()
    });
  }

  broadcastProjectUpdate(projectId: string, update: any): void {
    this.broadcastToProject(projectId, 'project:updated', {
      projectId,
      ...update,
      timestamp: new Date()
    });
  }

  // Statistics and monitoring

  getConnectionStats() {
    return {
      totalConnections: this.io?.engine.clientsCount || 0,
      authenticatedUsers: this.connectedUsers.size,
      activeRooms: this.roomSubscriptions.size,
      roomStats: Array.from(this.roomSubscriptions.entries()).map(([room, sockets]) => ({
        room,
        memberCount: sockets.size
      }))
    };
  }

  getUserSessions(userId: string): string[] {
    return Array.from(this.connectedUsers.get(userId) || []);
  }

  isUserOnline(userId: string): boolean {
    return this.connectedUsers.has(userId);
  }

  getRoomMembers(room: string): string[] {
    return Array.from(this.roomSubscriptions.get(room) || []);
  }
}