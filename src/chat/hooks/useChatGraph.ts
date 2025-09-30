import { useState, useCallback, useEffect } from 'react';
import { EnhancedConversationGraph, ChatMessage } from '../../core/graph-engine/chat/EnhancedConversationGraph';
import { GraphStore } from '../../core/graph-engine/GraphStore';
import { EdgeRelationType } from '../../core/graph-engine/types/EdgeTypes';

export interface SendOptions {
  createBranch: boolean;
  linkToCode?: string[];
  metadata?: Record<string, any>;
}

export interface UseChatGraphOptions {
  conversationId: string;
  onError?: (error: Error) => void;
  onMessageAdded?: (messageId: string) => void;
  onBranchCreated?: (branchId: string) => void;
}

export interface UseChatGraphReturn {
  graph: EnhancedConversationGraph;
  store: GraphStore;
  sendMessage: (content: string, options: SendOptions, replyToId?: string) => Promise<string>;
  createBranch: (fromMessageId: string, content: string, branchName?: string) => Promise<string>;
  linkCode: (messageId: string, filePath: string) => Promise<void>;
  linkMessages: (msg1: string, msg2: string, type: EdgeRelationType, metadata?: any) => void;
  switchBranch: (branchId: string) => void;
  refreshGraph: () => Promise<void>;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Hook for managing graph-based chat with real-time updates
 */
export function useChatGraph(options: UseChatGraphOptions): UseChatGraphReturn {
  const { conversationId, onError, onMessageAdded, onBranchCreated } = options;

  const [graph] = useState(() => {
    const store = new GraphStore();
    return new EnhancedConversationGraph(store);
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Subscribe to graph updates
  useEffect(() => {
    const subscription = graph.subscribeToUpdates((update) => {
      console.log('Graph update:', update);

      if (update.type === 'message_added') {
        onMessageAdded?.(update.messageId);
      } else if (update.type === 'branch_created') {
        onBranchCreated?.(update.branchId);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [graph, onMessageAdded, onBranchCreated]);

  /**
   * Send a new message to the conversation
   * Supports optimistic updates and error rollback
   */
  const sendMessage = useCallback(async (
    content: string,
    options: SendOptions,
    replyToId?: string
  ): Promise<string> => {
    setIsLoading(true);
    setError(null);

    try {
      const message: ChatMessage = {
        role: 'user',
        content,
        timestamp: new Date().toISOString(),
        metadata: {
          ...options.metadata,
          replyTo: replyToId
        }
      };

      let messageId: string;

      if (options.createBranch && replyToId) {
        // Create new branch
        messageId = graph.createBranch(replyToId, message);
      } else {
        // Add to current branch
        messageId = graph.addMessage(conversationId, message);
      }

      // Link to code files if provided
      if (options.linkToCode && options.linkToCode.length > 0) {
        for (const codeFile of options.linkToCode) {
          graph.linkToCode(messageId, codeFile);
        }
      }

      return messageId;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to send message');
      setError(error);
      onError?.(error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [graph, conversationId, onError]);

  /**
   * Create a new branch from a message
   */
  const createBranch = useCallback(async (
    fromMessageId: string,
    content: string,
    branchName?: string
  ): Promise<string> => {
    setIsLoading(true);
    setError(null);

    try {
      const message: ChatMessage = {
        role: 'user',
        content,
        timestamp: new Date().toISOString(),
        metadata: {
          branchName: branchName || `branch-${Date.now()}`,
          branchPoint: fromMessageId
        }
      };

      const messageId = graph.createBranch(fromMessageId, message);
      return messageId;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to create branch');
      setError(error);
      onError?.(error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [graph, onError]);

  /**
   * Link a message to a code file
   */
  const linkCode = useCallback(async (
    messageId: string,
    filePath: string
  ): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      graph.linkToCode(messageId, filePath);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to link code');
      setError(error);
      onError?.(error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [graph, onError]);

  /**
   * Create bidirectional link between messages
   */
  const linkMessages = useCallback((
    msg1: string,
    msg2: string,
    type: EdgeRelationType,
    metadata?: any
  ) => {
    try {
      graph.linkBidirectional(msg1, msg2, type, metadata);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to link messages');
      setError(error);
      onError?.(error);
      throw error;
    }
  }, [graph, onError]);

  /**
   * Switch to a different branch
   */
  const switchBranch = useCallback((branchId: string) => {
    try {
      graph.switchBranch(branchId);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to switch branch');
      setError(error);
      onError?.(error);
      throw error;
    }
  }, [graph, onError]);

  /**
   * Refresh the graph (useful for external updates)
   */
  const refreshGraph = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      // In a real implementation, this would fetch latest data
      // For now, it's a no-op since we're managing state locally
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to refresh graph');
      setError(error);
      onError?.(error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [onError]);

  return {
    graph,
    store: graph.store,
    sendMessage,
    createBranch,
    linkCode,
    linkMessages,
    switchBranch,
    refreshGraph,
    isLoading,
    error
  };
}

/**
 * Hook for managing optimistic UI updates
 */
export function useOptimisticUpdate<T>(
  initialData: T,
  updateFn: (data: T, update: any) => T
): [T, (update: any) => void, () => void] {
  const [data, setData] = useState(initialData);
  const [optimisticUpdates, setOptimisticUpdates] = useState<any[]>([]);

  const addOptimisticUpdate = useCallback((update: any) => {
    setOptimisticUpdates(prev => [...prev, update]);
    setData(prev => updateFn(prev, update));
  }, [updateFn]);

  const rollbackOptimisticUpdates = useCallback(() => {
    setData(initialData);
    setOptimisticUpdates([]);
  }, [initialData]);

  return [data, addOptimisticUpdate, rollbackOptimisticUpdates];
}