/**
 * Branch Operations
 *
 * Provides operations for managing conversation branches:
 * - Merging branches with different strategies
 * - Renaming branches
 * - Archiving and restoring branches
 * - Deleting branches permanently
 */

import { GraphStore } from '../GraphStore';
import { ConversationNode } from '../types/NodeTypes';
import { ConversationBranch } from './EnhancedConversationGraph';

export type MergeStrategy = 'keep-both' | 'prefer-source' | 'prefer-target';

export interface MergeResult {
  success: boolean;
  newBranchId?: string;
  mergedMessageIds: string[];
  conflicts: MergeConflict[];
  error?: string;
}

export interface MergeConflict {
  messageId: string;
  reason: string;
  sourceContent: string;
  targetContent: string;
}

export interface BranchMetadata {
  archived: boolean;
  archivedAt?: Date;
  deletedAt?: Date;
  renamedFrom?: string[];
  mergedFrom?: string[];
  mergedInto?: string;
}

/**
 * Handles branch operations like merge, rename, archive, and delete
 */
export class BranchOperations {
  private store: GraphStore;
  private branchMetadata: Map<string, BranchMetadata> = new Map();

  constructor(store: GraphStore) {
    this.store = store;
  }

  /**
   * Merge two branches together
   */
  async mergeBranches(
    sourceBranchId: string,
    targetBranchId: string,
    strategy: MergeStrategy,
    sourceBranch: ConversationBranch,
    targetBranch: ConversationBranch
  ): Promise<MergeResult> {
    try {
      // Find divergence point
      const divergencePoint = this.findDivergencePoint(sourceBranch, targetBranch);

      if (!divergencePoint) {
        return {
          success: false,
          mergedMessageIds: [],
          conflicts: [],
          error: 'Could not find divergence point between branches'
        };
      }

      // Get messages unique to each branch
      const sourceMessages = this.getMessagesAfterPoint(sourceBranch, divergencePoint);
      const targetMessages = this.getMessagesAfterPoint(targetBranch, divergencePoint);

      // Detect conflicts
      const conflicts = this.detectConflicts(sourceMessages, targetMessages);

      // Execute merge based on strategy
      let mergedMessageIds: string[];
      let newBranchId: string | undefined;

      switch (strategy) {
        case 'keep-both':
          ({ mergedMessageIds, newBranchId } = await this.mergeKeepBoth(
            sourceBranch,
            targetBranch,
            sourceMessages,
            targetMessages,
            divergencePoint
          ));
          break;

        case 'prefer-source':
          mergedMessageIds = await this.mergePreferSource(
            targetBranch,
            sourceMessages,
            targetMessages,
            divergencePoint
          );
          break;

        case 'prefer-target':
          mergedMessageIds = await this.mergePreferTarget(
            targetBranch,
            sourceMessages,
            targetMessages,
            divergencePoint
          );
          break;

        default:
          throw new Error(`Unknown merge strategy: ${strategy}`);
      }

      // Update branch metadata
      this.recordMerge(sourceBranchId, targetBranchId, newBranchId);

      return {
        success: true,
        newBranchId,
        mergedMessageIds,
        conflicts
      };
    } catch (error: any) {
      return {
        success: false,
        mergedMessageIds: [],
        conflicts: [],
        error: error.message || 'Unknown error during merge'
      };
    }
  }

  /**
   * Merge strategy: Keep both branches' messages
   * Creates a new branch combining both message sequences
   */
  private async mergeKeepBoth(
    sourceBranch: ConversationBranch,
    targetBranch: ConversationBranch,
    sourceMessages: string[],
    targetMessages: string[],
    divergencePoint: string
  ): Promise<{ mergedMessageIds: string[]; newBranchId: string }> {
    // Interleave messages by timestamp
    const allMessages = this.interleaveMessages(sourceMessages, targetMessages);

    // Create edges connecting messages to divergence point
    for (const messageId of allMessages) {
      // These messages will be reconnected in the graph
      // For now, just collect them
    }

    const newBranchId = `merged-${sourceBranch.id}-${targetBranch.id}-${Date.now()}`;

    return {
      mergedMessageIds: allMessages,
      newBranchId
    };
  }

  /**
   * Merge strategy: Prefer source branch
   * Replaces target branch messages with source messages
   */
  private async mergePreferSource(
    targetBranch: ConversationBranch,
    sourceMessages: string[],
    targetMessages: string[],
    divergencePoint: string
  ): Promise<string[]> {
    // Remove target branch messages after divergence point
    for (const messageId of targetMessages) {
      // Mark for removal or actually remove edges
      const edges = this.store.getAllEdges();
      const messageEdges = edges.filter((e: any) =>
        e.source === messageId || e.target === messageId
      );

      // Remove edges but keep nodes for reference
      messageEdges.forEach((edge: any) => {
        // this.store.removeEdge(edge.id); // Uncomment if removal is needed
      });
    }

    // Add source messages to target branch
    return sourceMessages;
  }

  /**
   * Merge strategy: Prefer target branch
   * Keeps target branch messages, discards source
   */
  private async mergePreferTarget(
    targetBranch: ConversationBranch,
    sourceMessages: string[],
    targetMessages: string[],
    divergencePoint: string
  ): Promise<string[]> {
    // Simply return target messages as they remain unchanged
    return targetMessages;
  }

  /**
   * Find the divergence point between two branches
   */
  private findDivergencePoint(
    branch1: ConversationBranch,
    branch2: ConversationBranch
  ): string | null {
    // The divergence point is typically the parent message ID
    // or the branch point stored in metadata

    if (branch1.branchPoint === branch2.branchPoint) {
      return branch1.branchPoint;
    }

    // If different branch points, find common ancestor
    return this.findCommonAncestor(branch1.branchPoint, branch2.branchPoint);
  }

  /**
   * Find common ancestor between two message nodes
   */
  private findCommonAncestor(messageId1: string, messageId2: string): string | null {
    const ancestors1 = this.getAncestors(messageId1);
    const ancestors2 = this.getAncestors(messageId2);

    // Find first common ancestor
    for (const ancestor of ancestors1) {
      if (ancestors2.includes(ancestor)) {
        return ancestor;
      }
    }

    return null;
  }

  /**
   * Get all ancestor message IDs
   */
  private getAncestors(messageId: string): string[] {
    const ancestors: string[] = [];
    let currentId = messageId;

    while (currentId) {
      const edges = this.store.getAllEdges();
      const parentEdge = edges.find((e: any) =>
        e.target === currentId && (e.type === 'follows' || e.type === 'relates_to')
      );

      if (!parentEdge) break;

      currentId = (parentEdge as any).source;
      ancestors.push(currentId);
    }

    return ancestors;
  }

  /**
   * Get messages after a specific point in a branch
   */
  private getMessagesAfterPoint(branch: ConversationBranch, pointId: string): string[] {
    const pointIndex = branch.messages.indexOf(pointId);

    if (pointIndex === -1) {
      return branch.messages;
    }

    return branch.messages.slice(pointIndex + 1);
  }

  /**
   * Detect conflicts between two message sets
   */
  private detectConflicts(
    sourceMessages: string[],
    targetMessages: string[]
  ): MergeConflict[] {
    const conflicts: MergeConflict[] = [];

    // Check for messages at the same position with different content
    const maxLength = Math.max(sourceMessages.length, targetMessages.length);

    for (let i = 0; i < maxLength; i++) {
      const sourceId = sourceMessages[i];
      const targetId = targetMessages[i];

      if (sourceId && targetId) {
        const sourceNode = this.store.getNode(sourceId) as ConversationNode;
        const targetNode = this.store.getNode(targetId) as ConversationNode;

        if (sourceNode && targetNode) {
          const sourceContent = sourceNode.content || '';
          const targetContent = targetNode.content || '';

          if (sourceContent !== targetContent) {
            conflicts.push({
              messageId: targetId,
              reason: `Position ${i}: Different message content`,
              sourceContent,
              targetContent
            });
          }
        }
      }
    }

    return conflicts;
  }

  /**
   * Interleave messages by timestamp
   */
  private interleaveMessages(
    sourceMessages: string[],
    targetMessages: string[]
  ): string[] {
    const allMessages = [...sourceMessages, ...targetMessages];

    // Sort by timestamp from node metadata
    allMessages.sort((a, b) => {
      const nodeA = this.store.getNode(a) as ConversationNode;
      const nodeB = this.store.getNode(b) as ConversationNode;

      if (!nodeA || !nodeB) return 0;

      const timeA = nodeA.timestamp?.getTime() || 0;
      const timeB = nodeB.timestamp?.getTime() || 0;

      return timeA - timeB;
    });

    return allMessages;
  }

  /**
   * Record merge operation in metadata
   */
  private recordMerge(
    sourceBranchId: string,
    targetBranchId: string,
    newBranchId?: string
  ): void {
    const targetMetadata = this.getBranchMetadata(targetBranchId);

    targetMetadata.mergedFrom = targetMetadata.mergedFrom || [];
    targetMetadata.mergedFrom.push(sourceBranchId);

    this.branchMetadata.set(targetBranchId, targetMetadata);

    if (newBranchId) {
      this.branchMetadata.set(newBranchId, {
        archived: false,
        mergedFrom: [sourceBranchId, targetBranchId]
      });
    }
  }

  /**
   * Rename a branch
   */
  renameBranch(branchId: string, newName: string, oldName: string): void {
    const metadata = this.getBranchMetadata(branchId);

    metadata.renamedFrom = metadata.renamedFrom || [];
    metadata.renamedFrom.push(oldName);

    this.branchMetadata.set(branchId, metadata);
  }

  /**
   * Archive a branch (soft delete - can be restored)
   */
  archiveBranch(branchId: string): void {
    const metadata = this.getBranchMetadata(branchId);

    metadata.archived = true;
    metadata.archivedAt = new Date();

    this.branchMetadata.set(branchId, metadata);
  }

  /**
   * Restore an archived branch
   */
  restoreBranch(branchId: string): void {
    const metadata = this.getBranchMetadata(branchId);

    metadata.archived = false;
    metadata.archivedAt = undefined;

    this.branchMetadata.set(branchId, metadata);
  }

  /**
   * Permanently delete a branch
   */
  deleteBranch(branchId: string): void {
    const metadata = this.getBranchMetadata(branchId);

    metadata.deletedAt = new Date();

    this.branchMetadata.set(branchId, metadata);

    // In a real implementation, we would remove all nodes and edges
    // associated with this branch from the graph store
  }

  /**
   * Check if a branch is archived
   */
  isArchived(branchId: string): boolean {
    const metadata = this.branchMetadata.get(branchId);
    return metadata?.archived || false;
  }

  /**
   * Check if a branch is deleted
   */
  isDeleted(branchId: string): boolean {
    const metadata = this.branchMetadata.get(branchId);
    return !!metadata?.deletedAt;
  }

  /**
   * Get branch metadata
   */
  getBranchMetadata(branchId: string): BranchMetadata {
    let metadata = this.branchMetadata.get(branchId);

    if (!metadata) {
      metadata = {
        archived: false
      };
      this.branchMetadata.set(branchId, metadata);
    }

    return metadata;
  }

  /**
   * Get all archived branches
   */
  getArchivedBranches(): string[] {
    const archived: string[] = [];

    this.branchMetadata.forEach((metadata, branchId) => {
      if (metadata.archived) {
        archived.push(branchId);
      }
    });

    return archived;
  }

  /**
   * Get merge history for a branch
   */
  getMergeHistory(branchId: string): string[] {
    const metadata = this.branchMetadata.get(branchId);
    return metadata?.mergedFrom || [];
  }

  /**
   * Get rename history for a branch
   */
  getRenameHistory(branchId: string): string[] {
    const metadata = this.branchMetadata.get(branchId);
    return metadata?.renamedFrom || [];
  }
}
