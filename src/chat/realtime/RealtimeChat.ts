import { EventEmitter } from 'events';
import { WebSocket } from 'ws';
import { MessageNode, ChatConversationNode } from '../models';
import { ChatGraphStructure } from '../models/ChatGraphStructure';

export interface RealtimeParticipant {
  id: string;
  name: string;
  role: 'host' | 'participant' | 'observer';
  status: 'online' | 'away' | 'offline';
  lastSeen: Date;
  avatar?: string;
}

export interface RealtimeMessage {
  type: 'message' | 'typing' | 'join' | 'leave' | 'cursor' | 'branch_created' | 'branch_switched';
  participantId: string;
  conversationId: string;
  data: any;
  timestamp: Date;
}

export interface RealtimeConversationState {
  conversationId: string;
  participants: Map<string, RealtimeParticipant>;
  activeBranches: Map<string, string>; // participantId -> branchId
  typingParticipants: Set<string>;
  cursorPositions: Map<string, { messageId: string; position: number }>;
  lastActivity: Date;
}

export interface RealtimeCallbacks {
  onParticipantJoined?: (participant: RealtimeParticipant) => void;
  onParticipantLeft?: (participantId: string) => void;
  onMessageReceived?: (message: MessageNode, participantId: string) => void;
  onTypingChanged?: (participantId: string, isTyping: boolean) => void;
  onBranchCreated?: (branchId: string, participantId: string) => void;
  onBranchSwitched?: (participantId: string, branchId: string) => void;
  onCursorMoved?: (participantId: string, messageId: string, position: number) => void;
  onConversationStateChanged?: (state: RealtimeConversationState) => void;
}

export class RealtimeChat extends EventEmitter {
  private ws: WebSocket | null = null;
  private isConnected = false;
  private conversationStates = new Map<string, RealtimeConversationState>();
  private callbacks: RealtimeCallbacks = {};
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private currentParticipant: RealtimeParticipant | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private typingTimeout: NodeJS.Timeout | null = null;

  constructor(
    private serverUrl: string,
    private chatGraph: ChatGraphStructure,
    callbacks: RealtimeCallbacks = {}
  ) {
    super();
    this.callbacks = callbacks;
  }

  async connect(participant: RealtimeParticipant): Promise<void> {
    try {
      this.currentParticipant = participant;
      this.ws = new WebSocket(this.serverUrl);

      this.ws.on('open', () => {
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.startHeartbeat();

        // Send join message
        this.sendMessage({
          type: 'join',
          participantId: participant.id,
          conversationId: '',
          data: participant,
          timestamp: new Date()
        });

        this.emit('connected');
      });

      this.ws.on('message', (data: Buffer) => {
        try {
          const message: RealtimeMessage = JSON.parse(data.toString());
          this.handleIncomingMessage(message);
        } catch (error) {
          console.error('Failed to parse realtime message:', error);
        }
      });

      this.ws.on('close', () => {
        this.isConnected = false;
        this.stopHeartbeat();
        this.emit('disconnected');
        this.attemptReconnect();
      });

      this.ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        this.emit('error', error);
      });

    } catch (error) {
      console.error('Failed to connect to realtime server:', error);
      throw error;
    }
  }

  disconnect(): void {
    if (this.ws && this.isConnected) {
      // Send leave message
      if (this.currentParticipant) {
        this.sendMessage({
          type: 'leave',
          participantId: this.currentParticipant.id,
          conversationId: '',
          data: {},
          timestamp: new Date()
        });
      }

      this.ws.close();
    }
    this.stopHeartbeat();
    this.isConnected = false;
  }

  joinConversation(conversationId: string): void {
    if (!this.isConnected || !this.currentParticipant) {
      throw new Error('Not connected to realtime server');
    }

    // Initialize conversation state if not exists
    if (!this.conversationStates.has(conversationId)) {
      this.conversationStates.set(conversationId, {
        conversationId,
        participants: new Map(),
        activeBranches: new Map(),
        typingParticipants: new Set(),
        cursorPositions: new Map(),
        lastActivity: new Date()
      });
    }

    // Add current participant to conversation
    const state = this.conversationStates.get(conversationId)!;
    state.participants.set(this.currentParticipant.id, this.currentParticipant);

    this.sendMessage({
      type: 'join',
      participantId: this.currentParticipant.id,
      conversationId,
      data: { action: 'join_conversation' },
      timestamp: new Date()
    });
  }

  leaveConversation(conversationId: string): void {
    if (!this.isConnected || !this.currentParticipant) return;

    const state = this.conversationStates.get(conversationId);
    if (state) {
      state.participants.delete(this.currentParticipant.id);
      state.activeBranches.delete(this.currentParticipant.id);
      state.typingParticipants.delete(this.currentParticipant.id);
      state.cursorPositions.delete(this.currentParticipant.id);
    }

    this.sendMessage({
      type: 'leave',
      participantId: this.currentParticipant.id,
      conversationId,
      data: { action: 'leave_conversation' },
      timestamp: new Date()
    });
  }

  sendChatMessage(conversationId: string, message: MessageNode): void {
    if (!this.isConnected || !this.currentParticipant) {
      throw new Error('Not connected to realtime server');
    }

    // Add message to local graph
    this.chatGraph.addMessage(conversationId, message);

    // Broadcast to other participants
    this.sendMessage({
      type: 'message',
      participantId: this.currentParticipant.id,
      conversationId,
      data: message,
      timestamp: new Date()
    });

    this.updateConversationActivity(conversationId);
  }

  setTyping(conversationId: string, isTyping: boolean): void {
    if (!this.isConnected || !this.currentParticipant) return;

    const state = this.conversationStates.get(conversationId);
    if (!state) return;

    if (isTyping) {
      state.typingParticipants.add(this.currentParticipant.id);

      // Clear existing timeout
      if (this.typingTimeout) {
        clearTimeout(this.typingTimeout);
      }

      // Auto-clear typing after 3 seconds
      this.typingTimeout = setTimeout(() => {
        this.setTyping(conversationId, false);
      }, 3000);
    } else {
      state.typingParticipants.delete(this.currentParticipant.id);
      if (this.typingTimeout) {
        clearTimeout(this.typingTimeout);
        this.typingTimeout = null;
      }
    }

    this.sendMessage({
      type: 'typing',
      participantId: this.currentParticipant.id,
      conversationId,
      data: { isTyping },
      timestamp: new Date()
    });
  }

  createBranch(conversationId: string, branchPointMessageId: string, title?: string): string | null {
    if (!this.isConnected || !this.currentParticipant) {
      throw new Error('Not connected to realtime server');
    }

    const branchId = this.chatGraph.createBranch(conversationId, branchPointMessageId, title);
    if (!branchId) return null;

    // Update participant's active branch
    const state = this.conversationStates.get(conversationId);
    if (state) {
      state.activeBranches.set(this.currentParticipant.id, branchId);
    }

    this.sendMessage({
      type: 'branch_created',
      participantId: this.currentParticipant.id,
      conversationId,
      data: { branchId, branchPointMessageId, title },
      timestamp: new Date()
    });

    this.updateConversationActivity(conversationId);
    return branchId;
  }

  switchToBranch(conversationId: string, branchId: string): void {
    if (!this.isConnected || !this.currentParticipant) return;

    const state = this.conversationStates.get(conversationId);
    if (state) {
      state.activeBranches.set(this.currentParticipant.id, branchId);
    }

    this.sendMessage({
      type: 'branch_switched',
      participantId: this.currentParticipant.id,
      conversationId,
      data: { branchId },
      timestamp: new Date()
    });
  }

  setCursorPosition(conversationId: string, messageId: string, position: number): void {
    if (!this.isConnected || !this.currentParticipant) return;

    const state = this.conversationStates.get(conversationId);
    if (state) {
      state.cursorPositions.set(this.currentParticipant.id, { messageId, position });
    }

    this.sendMessage({
      type: 'cursor',
      participantId: this.currentParticipant.id,
      conversationId,
      data: { messageId, position },
      timestamp: new Date()
    });
  }

  getConversationState(conversationId: string): RealtimeConversationState | null {
    return this.conversationStates.get(conversationId) || null;
  }

  getParticipants(conversationId: string): RealtimeParticipant[] {
    const state = this.conversationStates.get(conversationId);
    return state ? Array.from(state.participants.values()) : [];
  }

  isParticipantTyping(conversationId: string, participantId: string): boolean {
    const state = this.conversationStates.get(conversationId);
    return state ? state.typingParticipants.has(participantId) : false;
  }

  getParticipantBranch(conversationId: string, participantId: string): string | null {
    const state = this.conversationStates.get(conversationId);
    return state ? state.activeBranches.get(participantId) || null : null;
  }

  private sendMessage(message: RealtimeMessage): void {
    if (this.ws && this.isConnected) {
      this.ws.send(JSON.stringify(message));
    }
  }

  private handleIncomingMessage(message: RealtimeMessage): void {
    const { type, participantId, conversationId, data, timestamp } = message;

    switch (type) {
      case 'join':
        this.handleParticipantJoined(conversationId, data);
        break;

      case 'leave':
        this.handleParticipantLeft(conversationId, participantId);
        break;

      case 'message':
        this.handleMessageReceived(conversationId, data, participantId);
        break;

      case 'typing':
        this.handleTypingChanged(conversationId, participantId, data.isTyping);
        break;

      case 'branch_created':
        this.handleBranchCreated(conversationId, participantId, data);
        break;

      case 'branch_switched':
        this.handleBranchSwitched(conversationId, participantId, data.branchId);
        break;

      case 'cursor':
        this.handleCursorMoved(conversationId, participantId, data);
        break;
    }

    this.updateConversationActivity(conversationId);
  }

  private handleParticipantJoined(conversationId: string, participant: RealtimeParticipant): void {
    const state = this.conversationStates.get(conversationId);
    if (state) {
      state.participants.set(participant.id, participant);
      this.callbacks.onParticipantJoined?.(participant);
      this.callbacks.onConversationStateChanged?.(state);
    }
  }

  private handleParticipantLeft(conversationId: string, participantId: string): void {
    const state = this.conversationStates.get(conversationId);
    if (state) {
      state.participants.delete(participantId);
      state.activeBranches.delete(participantId);
      state.typingParticipants.delete(participantId);
      state.cursorPositions.delete(participantId);

      this.callbacks.onParticipantLeft?.(participantId);
      this.callbacks.onConversationStateChanged?.(state);
    }
  }

  private handleMessageReceived(conversationId: string, message: MessageNode, participantId: string): void {
    // Add message to local graph (if not from current participant)
    if (participantId !== this.currentParticipant?.id) {
      this.chatGraph.addMessage(conversationId, message);
    }

    this.callbacks.onMessageReceived?.(message, participantId);
  }

  private handleTypingChanged(conversationId: string, participantId: string, isTyping: boolean): void {
    const state = this.conversationStates.get(conversationId);
    if (state) {
      if (isTyping) {
        state.typingParticipants.add(participantId);
      } else {
        state.typingParticipants.delete(participantId);
      }

      this.callbacks.onTypingChanged?.(participantId, isTyping);
      this.callbacks.onConversationStateChanged?.(state);
    }
  }

  private handleBranchCreated(conversationId: string, participantId: string, data: any): void {
    const { branchId, branchPointMessageId, title } = data;

    // Create branch in local graph (if not from current participant)
    if (participantId !== this.currentParticipant?.id) {
      this.chatGraph.createBranch(conversationId, branchPointMessageId, title);
    }

    const state = this.conversationStates.get(conversationId);
    if (state) {
      state.activeBranches.set(participantId, branchId);
    }

    this.callbacks.onBranchCreated?.(branchId, participantId);
    if (state) {
      this.callbacks.onConversationStateChanged?.(state);
    }
  }

  private handleBranchSwitched(conversationId: string, participantId: string, branchId: string): void {
    const state = this.conversationStates.get(conversationId);
    if (state) {
      state.activeBranches.set(participantId, branchId);
      this.callbacks.onBranchSwitched?.(participantId, branchId);
      this.callbacks.onConversationStateChanged?.(state);
    }
  }

  private handleCursorMoved(conversationId: string, participantId: string, data: any): void {
    const { messageId, position } = data;
    const state = this.conversationStates.get(conversationId);
    if (state) {
      state.cursorPositions.set(participantId, { messageId, position });
      this.callbacks.onCursorMoved?.(participantId, messageId, position);
      this.callbacks.onConversationStateChanged?.(state);
    }
  }

  private updateConversationActivity(conversationId: string): void {
    const state = this.conversationStates.get(conversationId);
    if (state) {
      state.lastActivity = new Date();
    }
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      if (this.ws && this.isConnected) {
        this.ws.ping();
      }
    }, 30000); // 30 seconds
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private async attemptReconnect(): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Maximum reconnection attempts reached');
      this.emit('reconnect_failed');
      return;
    }

    this.reconnectAttempts++;
    console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    setTimeout(async () => {
      if (this.currentParticipant) {
        try {
          await this.connect(this.currentParticipant);
          this.emit('reconnected');
        } catch (error) {
          console.error('Reconnection failed:', error);
          this.attemptReconnect();
        }
      }
    }, this.reconnectDelay * this.reconnectAttempts);
  }
}