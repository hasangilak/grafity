import { MessageNode, ChatConversationNode } from '../models';
import { ChatGraphStructure } from '../models/ChatGraphStructure';
import { MessageBranch } from '../models/ConversationNode';

export interface MergeStrategy {
  type: 'chronological' | 'selective' | 'consensus' | 'automatic' | 'manual';
  options: {
    preserveAllMessages?: boolean;
    resolveConflicts?: 'latest' | 'oldest' | 'participant_priority' | 'manual';
    participantPriority?: string[];
    autoMergeRules?: MergeRule[];
  };
}

export interface MergeRule {
  condition: {
    type: 'similarity_threshold' | 'time_window' | 'participant_count' | 'topic_overlap';
    threshold: number;
    timeWindow?: number; // minutes
    topics?: string[];
  };
  action: 'merge' | 'keep_separate' | 'flag_for_review';
}

export interface MergeConflict {
  id: string;
  type: 'duplicate_message' | 'contradictory_content' | 'order_ambiguity' | 'context_mismatch';
  description: string;
  affectedMessages: string[];
  suggestedResolution: {
    action: 'keep_first' | 'keep_last' | 'merge_content' | 'manual_review';
    reasoning: string;
  };
  severity: 'low' | 'medium' | 'high';
}

export interface MergeCandidate {
  sourceBranchId: string;
  targetBranchId: string;
  similarity: number;
  sharedParticipants: string[];
  topicOverlap: string[];
  timeGap: number; // minutes
  messageCount: number;
  conflicts: MergeConflict[];
  recommendation: 'merge' | 'keep_separate' | 'review_required';
}

export interface MergeRequest {
  conversationId: string;
  sourceBranchId: string;
  targetBranchId: string;
  strategy: MergeStrategy;
  preserveHistory: boolean;
  requestedBy: string;
  reason?: string;
}

export interface MergeResult {
  success: boolean;
  mergedBranchId: string;
  mergedMessages: MessageNode[];
  conflicts: MergeConflict[];
  resolvedConflicts: Array<{
    conflict: MergeConflict;
    resolution: string;
    resolvedBy: 'automatic' | 'manual';
  }>;
  preservedBranches: string[];
  statistics: {
    totalMessages: number;
    mergedMessages: number;
    duplicatesRemoved: number;
    conflictsResolved: number;
    processingTime: number;
  };
  warnings: string[];
}

export interface MergePreview {
  sourceBranch: MessageBranch;
  targetBranch: MessageBranch;
  previewMessages: MessageNode[];
  estimatedConflicts: MergeConflict[];
  recommendation: string;
  statistics: {
    totalResultingMessages: number;
    duplicatesDetected: number;
    potentialConflicts: number;
  };
}

export class ConversationMerger {
  private mergeHistory = new Map<string, MergeResult[]>();

  constructor(private chatGraph: ChatGraphStructure) {}

  async findMergeCandidates(conversationId: string): Promise<MergeCandidate[]> {
    const conversation = this.chatGraph.getConversation(conversationId);
    if (!conversation) {
      throw new Error(`Conversation ${conversationId} not found`);
    }

    const branches = Array.from(conversation.branches.values());
    const candidates: MergeCandidate[] = [];

    // Compare each pair of branches
    for (let i = 0; i < branches.length; i++) {
      for (let j = i + 1; j < branches.length; j++) {
        const sourceBranch = branches[i];
        const targetBranch = branches[j];

        const candidate = await this.evaluateMergeCandidate(
          conversation,
          sourceBranch,
          targetBranch
        );

        if (candidate.similarity > 0.3) { // Threshold for considering merge
          candidates.push(candidate);
        }
      }
    }

    return candidates.sort((a, b) => b.similarity - a.similarity);
  }

  async previewMerge(request: MergeRequest): Promise<MergePreview> {
    const conversation = this.chatGraph.getConversation(request.conversationId);
    if (!conversation) {
      throw new Error(`Conversation ${request.conversationId} not found`);
    }

    const sourceBranch = conversation.branches.get(request.sourceBranchId);
    const targetBranch = conversation.branches.get(request.targetBranchId);

    if (!sourceBranch || !targetBranch) {
      throw new Error('Source or target branch not found');
    }

    const sourceMessages = this.getBranchMessages(conversation, request.sourceBranchId);
    const targetMessages = this.getBranchMessages(conversation, request.targetBranchId);

    const { mergedMessages, conflicts } = await this.simulateMerge(
      sourceMessages,
      targetMessages,
      request.strategy
    );

    return {
      sourceBranch,
      targetBranch,
      previewMessages: mergedMessages,
      estimatedConflicts: conflicts,
      recommendation: this.generateMergeRecommendation(conflicts, sourceMessages, targetMessages),
      statistics: {
        totalResultingMessages: mergedMessages.length,
        duplicatesDetected: this.countDuplicates(sourceMessages, targetMessages),
        potentialConflicts: conflicts.length
      }
    };
  }

  async mergeBranches(request: MergeRequest): Promise<MergeResult> {
    const startTime = Date.now();
    const conversation = this.chatGraph.getConversation(request.conversationId);

    if (!conversation) {
      throw new Error(`Conversation ${request.conversationId} not found`);
    }

    const sourceBranch = conversation.branches.get(request.sourceBranchId);
    const targetBranch = conversation.branches.get(request.targetBranchId);

    if (!sourceBranch || !targetBranch) {
      throw new Error('Source or target branch not found');
    }

    try {
      const sourceMessages = this.getBranchMessages(conversation, request.sourceBranchId);
      const targetMessages = this.getBranchMessages(conversation, request.targetBranchId);

      // Perform the merge
      const { mergedMessages, conflicts, resolvedConflicts } = await this.performMerge(
        sourceMessages,
        targetMessages,
        request.strategy
      );

      // Create merged branch or update target branch
      const mergedBranchId = await this.createMergedBranch(
        conversation,
        request.targetBranchId,
        mergedMessages,
        request.preserveHistory
      );

      // Update conversation graph
      await this.updateConversationAfterMerge(
        conversation,
        request.sourceBranchId,
        request.targetBranchId,
        mergedBranchId,
        request.preserveHistory
      );

      const result: MergeResult = {
        success: true,
        mergedBranchId,
        mergedMessages,
        conflicts,
        resolvedConflicts,
        preservedBranches: request.preserveHistory ? [request.sourceBranchId] : [],
        statistics: {
          totalMessages: sourceMessages.length + targetMessages.length,
          mergedMessages: mergedMessages.length,
          duplicatesRemoved: (sourceMessages.length + targetMessages.length) - mergedMessages.length,
          conflictsResolved: resolvedConflicts.length,
          processingTime: Date.now() - startTime
        },
        warnings: this.generateMergeWarnings(conflicts, resolvedConflicts)
      };

      // Store merge history
      this.storeMergeHistory(request.conversationId, result);

      return result;

    } catch (error) {
      return {
        success: false,
        mergedBranchId: '',
        mergedMessages: [],
        conflicts: [],
        resolvedConflicts: [],
        preservedBranches: [],
        statistics: {
          totalMessages: 0,
          mergedMessages: 0,
          duplicatesRemoved: 0,
          conflictsResolved: 0,
          processingTime: Date.now() - startTime
        },
        warnings: [`Merge failed: ${error.message}`]
      };
    }
  }

  async autoMerge(conversationId: string, rules: MergeRule[]): Promise<MergeResult[]> {
    const candidates = await this.findMergeCandidates(conversationId);
    const results: MergeResult[] = [];

    for (const candidate of candidates) {
      const shouldMerge = this.evaluateAutoMergeRules(candidate, rules);

      if (shouldMerge) {
        const request: MergeRequest = {
          conversationId,
          sourceBranchId: candidate.sourceBranchId,
          targetBranchId: candidate.targetBranchId,
          strategy: {
            type: 'automatic',
            options: {
              preserveAllMessages: true,
              resolveConflicts: 'latest',
              autoMergeRules: rules
            }
          },
          preserveHistory: true,
          requestedBy: 'system'
        };

        const result = await this.mergeBranches(request);
        if (result.success) {
          results.push(result);
        }
      }
    }

    return results;
  }

  getMergeHistory(conversationId: string): MergeResult[] {
    return this.mergeHistory.get(conversationId) || [];
  }

  private async evaluateMergeCandidate(
    conversation: ChatConversationNode,
    sourceBranch: MessageBranch,
    targetBranch: MessageBranch
  ): Promise<MergeCandidate> {
    const sourceMessages = this.getBranchMessages(conversation, sourceBranch.id);
    const targetMessages = this.getBranchMessages(conversation, targetBranch.id);

    const sharedParticipants = this.findSharedParticipants(sourceMessages, targetMessages);
    const topicOverlap = this.findTopicOverlap(sourceMessages, targetMessages);
    const timeGap = this.calculateTimeGap(sourceMessages, targetMessages);
    const similarity = this.calculateBranchSimilarity(sourceMessages, targetMessages);

    const { conflicts } = await this.simulateMerge(sourceMessages, targetMessages, {
      type: 'chronological',
      options: { preserveAllMessages: true }
    });

    return {
      sourceBranchId: sourceBranch.id,
      targetBranchId: targetBranch.id,
      similarity,
      sharedParticipants,
      topicOverlap,
      timeGap,
      messageCount: sourceMessages.length + targetMessages.length,
      conflicts,
      recommendation: this.generateCandidateRecommendation(similarity, conflicts, timeGap)
    };
  }

  private async simulateMerge(
    sourceMessages: MessageNode[],
    targetMessages: MessageNode[],
    strategy: MergeStrategy
  ): Promise<{ mergedMessages: MessageNode[]; conflicts: MergeConflict[] }> {
    const conflicts: MergeConflict[] = [];
    let mergedMessages: MessageNode[] = [];

    switch (strategy.type) {
      case 'chronological':
        mergedMessages = this.mergeChronologically(sourceMessages, targetMessages, conflicts);
        break;

      case 'selective':
        mergedMessages = this.mergeSelectively(sourceMessages, targetMessages, strategy.options, conflicts);
        break;

      case 'consensus':
        mergedMessages = this.mergeByConsensus(sourceMessages, targetMessages, conflicts);
        break;

      case 'automatic':
        mergedMessages = this.mergeAutomatically(sourceMessages, targetMessages, strategy.options, conflicts);
        break;

      case 'manual':
        // For manual merge, just concatenate and flag all potential conflicts
        mergedMessages = [...sourceMessages, ...targetMessages].sort((a, b) =>
          a.timestamp.getTime() - b.timestamp.getTime()
        );
        this.flagAllConflicts(sourceMessages, targetMessages, conflicts);
        break;
    }

    return { mergedMessages, conflicts };
  }

  private async performMerge(
    sourceMessages: MessageNode[],
    targetMessages: MessageNode[],
    strategy: MergeStrategy
  ): Promise<{
    mergedMessages: MessageNode[];
    conflicts: MergeConflict[];
    resolvedConflicts: Array<{ conflict: MergeConflict; resolution: string; resolvedBy: 'automatic' | 'manual' }>;
  }> {
    const { mergedMessages, conflicts } = await this.simulateMerge(sourceMessages, targetMessages, strategy);
    const resolvedConflicts: Array<{ conflict: MergeConflict; resolution: string; resolvedBy: 'automatic' | 'manual' }> = [];

    // Automatically resolve conflicts based on strategy
    for (const conflict of conflicts) {
      if (strategy.options.resolveConflicts && strategy.options.resolveConflicts !== 'manual') {
        const resolution = this.resolveConflictAutomatically(conflict, strategy.options.resolveConflicts);
        if (resolution) {
          resolvedConflicts.push({
            conflict,
            resolution,
            resolvedBy: 'automatic'
          });
        }
      }
    }

    return { mergedMessages, conflicts, resolvedConflicts };
  }

  private mergeChronologically(
    sourceMessages: MessageNode[],
    targetMessages: MessageNode[],
    conflicts: MergeConflict[]
  ): MessageNode[] {
    const allMessages = [...sourceMessages, ...targetMessages];
    const sortedMessages = allMessages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    // Detect and handle duplicates
    const uniqueMessages: MessageNode[] = [];
    const seenContent = new Set<string>();

    for (const message of sortedMessages) {
      const contentKey = this.generateContentKey(message);

      if (seenContent.has(contentKey)) {
        conflicts.push({
          id: `duplicate_${message.id}`,
          type: 'duplicate_message',
          description: `Duplicate message detected: "${this.truncateContent(message.content)}"`,
          affectedMessages: [message.id],
          suggestedResolution: {
            action: 'keep_first',
            reasoning: 'Keep the first occurrence to maintain chronological order'
          },
          severity: 'low'
        });
      } else {
        seenContent.add(contentKey);
        uniqueMessages.push(message);
      }
    }

    return uniqueMessages;
  }

  private mergeSelectively(
    sourceMessages: MessageNode[],
    targetMessages: MessageNode[],
    options: MergeStrategy['options'],
    conflicts: MergeConflict[]
  ): MessageNode[] {
    // Implement selective merge based on participant priority or other criteria
    const participantPriority = options.participantPriority || [];
    const allMessages = [...sourceMessages, ...targetMessages];

    if (participantPriority.length > 0) {
      return allMessages
        .sort((a, b) => {
          const aPriority = participantPriority.indexOf(this.getParticipantId(a));
          const bPriority = participantPriority.indexOf(this.getParticipantId(b));

          if (aPriority !== -1 && bPriority !== -1) {
            return aPriority - bPriority;
          }
          if (aPriority !== -1) return -1;
          if (bPriority !== -1) return 1;

          return a.timestamp.getTime() - b.timestamp.getTime();
        });
    }

    return this.mergeChronologically(sourceMessages, targetMessages, conflicts);
  }

  private mergeByConsensus(
    sourceMessages: MessageNode[],
    targetMessages: MessageNode[],
    conflicts: MergeConflict[]
  ): MessageNode[] {
    // Merge by finding consensus points and resolving disagreements
    const consensusMessages: MessageNode[] = [];
    const allMessages = [...sourceMessages, ...targetMessages];

    // Group similar messages and find consensus
    const messageGroups = this.groupSimilarMessages(allMessages);

    for (const group of messageGroups) {
      if (group.length === 1) {
        consensusMessages.push(group[0]);
      } else {
        // Multiple similar messages - find consensus or flag conflict
        const consensusMessage = this.findConsensusMessage(group);
        if (consensusMessage) {
          consensusMessages.push(consensusMessage);
        } else {
          conflicts.push({
            id: `consensus_${group[0].id}`,
            type: 'contradictory_content',
            description: `No consensus found for similar messages`,
            affectedMessages: group.map(m => m.id),
            suggestedResolution: {
              action: 'manual_review',
              reasoning: 'Multiple contradictory messages require manual resolution'
            },
            severity: 'high'
          });

          // Include all messages for manual resolution
          consensusMessages.push(...group);
        }
      }
    }

    return consensusMessages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  private mergeAutomatically(
    sourceMessages: MessageNode[],
    targetMessages: MessageNode[],
    options: MergeStrategy['options'],
    conflicts: MergeConflict[]
  ): MessageNode[] {
    // Apply automatic merge rules
    const rules = options.autoMergeRules || [];
    let mergedMessages = this.mergeChronologically(sourceMessages, targetMessages, conflicts);

    for (const rule of rules) {
      mergedMessages = this.applyMergeRule(mergedMessages, rule, conflicts);
    }

    return mergedMessages;
  }

  private flagAllConflicts(
    sourceMessages: MessageNode[],
    targetMessages: MessageNode[],
    conflicts: MergeConflict[]
  ): void {
    // Flag potential conflicts for manual resolution
    const duplicates = this.findDuplicateMessages(sourceMessages, targetMessages);
    const orderIssues = this.findOrderingIssues(sourceMessages, targetMessages);

    conflicts.push(...duplicates, ...orderIssues);
  }

  private getBranchMessages(conversation: ChatConversationNode, branchId: string): MessageNode[] {
    const branch = conversation.branches.get(branchId);
    if (!branch) return [];

    return branch.messageIds
      .map(id => conversation.messages.get(id))
      .filter((message): message is MessageNode => message !== undefined)
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  private findSharedParticipants(sourceMessages: MessageNode[], targetMessages: MessageNode[]): string[] {
    const sourceParticipants = new Set(sourceMessages.map(m => this.getParticipantId(m)));
    const targetParticipants = new Set(targetMessages.map(m => this.getParticipantId(m)));

    return Array.from(sourceParticipants).filter(p => targetParticipants.has(p));
  }

  private findTopicOverlap(sourceMessages: MessageNode[], targetMessages: MessageNode[]): string[] {
    const sourceTopics = this.extractTopics(sourceMessages);
    const targetTopics = this.extractTopics(targetMessages);

    return sourceTopics.filter(topic => targetTopics.includes(topic));
  }

  private calculateTimeGap(sourceMessages: MessageNode[], targetMessages: MessageNode[]): number {
    if (sourceMessages.length === 0 || targetMessages.length === 0) return 0;

    const sourceEnd = Math.max(...sourceMessages.map(m => m.timestamp.getTime()));
    const targetStart = Math.min(...targetMessages.map(m => m.timestamp.getTime()));

    return Math.abs(sourceEnd - targetStart) / (1000 * 60); // minutes
  }

  private calculateBranchSimilarity(sourceMessages: MessageNode[], targetMessages: MessageNode[]): number {
    const sharedParticipants = this.findSharedParticipants(sourceMessages, targetMessages);
    const topicOverlap = this.findTopicOverlap(sourceMessages, targetMessages);
    const timeGap = this.calculateTimeGap(sourceMessages, targetMessages);

    // Calculate similarity score (0-1)
    const participantSimilarity = sharedParticipants.length > 0 ? 0.4 : 0;
    const topicSimilarity = topicOverlap.length > 0 ? 0.4 : 0;
    const timeSimilarity = Math.max(0, 1 - (timeGap / 1440)) * 0.2; // 1 day = 0 similarity

    return participantSimilarity + topicSimilarity + timeSimilarity;
  }

  private getParticipantId(message: MessageNode): string {
    return message.metadata.participantId || message.role;
  }

  private extractTopics(messages: MessageNode[]): string[] {
    // Simple topic extraction - would use more sophisticated NLP in practice
    const topics = new Set<string>();

    messages.forEach(message => {
      const content = message.content.toLowerCase();

      // Extract simple keywords as topics
      const keywords = content.match(/\b\w{4,}\b/g) || [];
      keywords.forEach(keyword => {
        if (keyword.length > 3 && !this.isStopWord(keyword)) {
          topics.add(keyword);
        }
      });
    });

    return Array.from(topics);
  }

  private isStopWord(word: string): boolean {
    const stopWords = ['this', 'that', 'with', 'have', 'will', 'been', 'they', 'their', 'would', 'could', 'should'];
    return stopWords.includes(word);
  }

  private generateContentKey(message: MessageNode): string {
    // Generate a key for detecting duplicate content
    return `${message.content.trim().toLowerCase()}_${this.getParticipantId(message)}`;
  }

  private truncateContent(content: string, maxLength: number = 50): string {
    return content.length > maxLength ? content.substring(0, maxLength) + '...' : content;
  }

  private countDuplicates(sourceMessages: MessageNode[], targetMessages: MessageNode[]): number {
    const sourceKeys = new Set(sourceMessages.map(m => this.generateContentKey(m)));
    return targetMessages.filter(m => sourceKeys.has(this.generateContentKey(m))).length;
  }

  private generateMergeRecommendation(
    conflicts: MergeConflict[],
    sourceMessages: MessageNode[],
    targetMessages: MessageNode[]
  ): string {
    const totalMessages = sourceMessages.length + targetMessages.length;
    const conflictRatio = conflicts.length / totalMessages;

    if (conflictRatio > 0.3) {
      return 'High conflict ratio - recommend manual review before merging';
    } else if (conflictRatio > 0.1) {
      return 'Some conflicts detected - proceed with caution';
    } else {
      return 'Low conflict ratio - safe to merge automatically';
    }
  }

  private generateCandidateRecommendation(
    similarity: number,
    conflicts: MergeConflict[],
    timeGap: number
  ): 'merge' | 'keep_separate' | 'review_required' {
    if (similarity > 0.7 && conflicts.length < 2) {
      return 'merge';
    } else if (similarity < 0.3 || timeGap > 1440) { // 1 day
      return 'keep_separate';
    } else {
      return 'review_required';
    }
  }

  private evaluateAutoMergeRules(candidate: MergeCandidate, rules: MergeRule[]): boolean {
    for (const rule of rules) {
      const meetsCriteria = this.evaluateRuleCondition(candidate, rule.condition);

      if (meetsCriteria) {
        return rule.action === 'merge';
      }
    }

    return false;
  }

  private evaluateRuleCondition(candidate: MergeCandidate, condition: MergeRule['condition']): boolean {
    switch (condition.type) {
      case 'similarity_threshold':
        return candidate.similarity >= condition.threshold;

      case 'time_window':
        return candidate.timeGap <= (condition.timeWindow || 60);

      case 'participant_count':
        return candidate.sharedParticipants.length >= condition.threshold;

      case 'topic_overlap':
        const requiredTopics = condition.topics || [];
        return requiredTopics.every(topic => candidate.topicOverlap.includes(topic));

      default:
        return false;
    }
  }

  private resolveConflictAutomatically(
    conflict: MergeConflict,
    strategy: 'latest' | 'oldest' | 'participant_priority'
  ): string | null {
    switch (strategy) {
      case 'latest':
        return 'Kept latest version based on timestamp';

      case 'oldest':
        return 'Kept oldest version to preserve original intent';

      case 'participant_priority':
        return 'Resolved based on participant priority settings';

      default:
        return null;
    }
  }

  private groupSimilarMessages(messages: MessageNode[]): MessageNode[][] {
    const groups: MessageNode[][] = [];
    const processed = new Set<string>();

    for (const message of messages) {
      if (processed.has(message.id)) continue;

      const group = [message];
      processed.add(message.id);

      // Find similar messages
      for (const otherMessage of messages) {
        if (processed.has(otherMessage.id)) continue;

        if (this.areMessagesSimilar(message, otherMessage)) {
          group.push(otherMessage);
          processed.add(otherMessage.id);
        }
      }

      groups.push(group);
    }

    return groups;
  }

  private areMessagesSimilar(message1: MessageNode, message2: MessageNode): boolean {
    // Simple similarity check - would use more sophisticated comparison in practice
    const content1 = message1.content.toLowerCase().trim();
    const content2 = message2.content.toLowerCase().trim();

    if (content1 === content2) return true;

    // Check for high word overlap
    const words1 = new Set(content1.split(/\s+/));
    const words2 = new Set(content2.split(/\s+/));
    const intersection = new Set([...words1].filter(word => words2.has(word)));

    const similarity = intersection.size / Math.max(words1.size, words2.size);
    return similarity > 0.8;
  }

  private findConsensusMessage(messages: MessageNode[]): MessageNode | null {
    // Find the message that represents consensus among similar messages
    // For now, return the longest message as it likely contains the most information
    return messages.reduce((longest, current) =>
      current.content.length > longest.content.length ? current : longest
    );
  }

  private applyMergeRule(
    messages: MessageNode[],
    rule: MergeRule,
    conflicts: MergeConflict[]
  ): MessageNode[] {
    // Apply specific merge rule to the message set
    // Implementation would depend on the specific rule type
    return messages;
  }

  private findDuplicateMessages(
    sourceMessages: MessageNode[],
    targetMessages: MessageNode[]
  ): MergeConflict[] {
    const conflicts: MergeConflict[] = [];
    const sourceKeys = new Set(sourceMessages.map(m => this.generateContentKey(m)));

    targetMessages.forEach(message => {
      if (sourceKeys.has(this.generateContentKey(message))) {
        conflicts.push({
          id: `duplicate_${message.id}`,
          type: 'duplicate_message',
          description: `Duplicate message found in both branches`,
          affectedMessages: [message.id],
          suggestedResolution: {
            action: 'keep_first',
            reasoning: 'Remove duplicate to avoid redundancy'
          },
          severity: 'low'
        });
      }
    });

    return conflicts;
  }

  private findOrderingIssues(
    sourceMessages: MessageNode[],
    targetMessages: MessageNode[]
  ): MergeConflict[] {
    // Implementation for finding temporal ordering issues
    // This would involve checking for temporal inconsistencies
    return [];
  }

  private async createMergedBranch(
    conversation: ChatConversationNode,
    targetBranchId: string,
    mergedMessages: MessageNode[],
    preserveHistory: boolean
  ): Promise<string> {
    // Update the target branch with merged messages
    const targetBranch = conversation.branches.get(targetBranchId);
    if (targetBranch) {
      // Clear existing messages and add merged ones
      targetBranch.messageIds = mergedMessages.map(m => m.id);

      // Add messages to conversation
      mergedMessages.forEach(message => {
        conversation.messages.set(message.id, message);
      });
    }

    return targetBranchId;
  }

  private async updateConversationAfterMerge(
    conversation: ChatConversationNode,
    sourceBranchId: string,
    targetBranchId: string,
    mergedBranchId: string,
    preserveHistory: boolean
  ): Promise<void> {
    if (!preserveHistory) {
      // Remove source branch if not preserving history
      conversation.branches.delete(sourceBranchId);
    } else {
      // Mark source branch as merged
      const sourceBranch = conversation.branches.get(sourceBranchId);
      if (sourceBranch) {
        sourceBranch.isActive = false;
        sourceBranch.mergedInto = mergedBranchId;
      }
    }
  }

  private generateMergeWarnings(
    conflicts: MergeConflict[],
    resolvedConflicts: Array<{ conflict: MergeConflict; resolution: string; resolvedBy: 'automatic' | 'manual' }>
  ): string[] {
    const warnings: string[] = [];

    const highSeverityConflicts = conflicts.filter(c => c.severity === 'high');
    if (highSeverityConflicts.length > 0) {
      warnings.push(`${highSeverityConflicts.length} high-severity conflicts detected`);
    }

    const unresolvedConflicts = conflicts.filter(c =>
      !resolvedConflicts.some(rc => rc.conflict.id === c.id)
    );
    if (unresolvedConflicts.length > 0) {
      warnings.push(`${unresolvedConflicts.length} conflicts remain unresolved`);
    }

    return warnings;
  }

  private storeMergeHistory(conversationId: string, result: MergeResult): void {
    if (!this.mergeHistory.has(conversationId)) {
      this.mergeHistory.set(conversationId, []);
    }

    this.mergeHistory.get(conversationId)!.push(result);
  }
}