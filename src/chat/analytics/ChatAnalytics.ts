import { MessageNode, ChatConversationNode } from '../models';
import { ChatGraphStructure } from '../models/ChatGraphStructure';
import { ExtractedEntity } from '../context/EntityExtractor';

export interface ConversationMetrics {
  totalMessages: number;
  userMessages: number;
  assistantMessages: number;
  systemMessages: number;
  averageMessageLength: number;
  totalCharacters: number;
  conversationDuration: number; // in minutes
  messagesPerHour: number;
  branchCount: number;
  activeBranches: number;
  maxBranchDepth: number;
  responseTime: {
    average: number;
    median: number;
    min: number;
    max: number;
  };
}

export interface ParticipantAnalytics {
  participantId: string;
  messageCount: number;
  characterCount: number;
  averageMessageLength: number;
  mostActiveHours: number[];
  topicsDiscussed: string[];
  questionsAsked: number;
  codeBlocksShared: number;
  engagementScore: number; // 0-100
  responsePattern: {
    averageDelay: number;
    consistency: number; // 0-1
  };
}

export interface TopicAnalytics {
  topic: string;
  frequency: number;
  firstMention: Date;
  lastMention: Date;
  participants: string[];
  messageIds: string[];
  sentiment: 'positive' | 'neutral' | 'negative';
  complexity: number; // 0-1
  relatedTopics: Array<{ topic: string; correlation: number }>;
}

export interface ConversationFlow {
  branchId: string;
  parentBranchId?: string;
  messageCount: number;
  participants: string[];
  createdAt: Date;
  lastActivity: Date;
  topics: string[];
  avgResponseTime: number;
  isActive: boolean;
  mergedInto?: string;
}

export interface ConversationInsights {
  summary: string;
  keyTopics: string[];
  mainParticipants: string[];
  conversationPattern: 'linear' | 'branched' | 'exploratory' | 'collaborative';
  complexity: 'low' | 'medium' | 'high';
  resolution: 'resolved' | 'ongoing' | 'abandoned';
  recommendations: string[];
  similarConversations: string[];
}

export interface AnalyticsQuery {
  conversationId?: string;
  participantIds?: string[];
  dateRange?: {
    start: Date;
    end: Date;
  };
  topics?: string[];
  messageTypes?: Array<'user' | 'assistant' | 'system'>;
  branchIds?: string[];
  includeMetrics?: boolean;
  includeParticipants?: boolean;
  includeTopics?: boolean;
  includeInsights?: boolean;
}

export interface AnalyticsResult {
  query: AnalyticsQuery;
  metrics?: ConversationMetrics;
  participants?: ParticipantAnalytics[];
  topics?: TopicAnalytics[];
  insights?: ConversationInsights;
  conversationFlows?: ConversationFlow[];
  generatedAt: Date;
}

export class ChatAnalytics {
  private conversationCache = new Map<string, ConversationMetrics>();
  private topicCache = new Map<string, TopicAnalytics[]>();
  private insightsCache = new Map<string, ConversationInsights>();

  constructor(private chatGraph: ChatGraphStructure) {}

  async analyzeConversation(query: AnalyticsQuery): Promise<AnalyticsResult> {
    const result: AnalyticsResult = {
      query,
      generatedAt: new Date()
    };

    if (query.includeMetrics !== false) {
      result.metrics = await this.calculateMetrics(query);
    }

    if (query.includeParticipants) {
      result.participants = await this.analyzeParticipants(query);
    }

    if (query.includeTopics) {
      result.topics = await this.analyzeTopics(query);
    }

    if (query.includeInsights) {
      result.insights = await this.generateInsights(query);
    }

    return result;
  }

  async calculateMetrics(query: AnalyticsQuery): Promise<ConversationMetrics> {
    const cacheKey = this.getCacheKey(query);
    if (this.conversationCache.has(cacheKey)) {
      return this.conversationCache.get(cacheKey)!;
    }

    const messages = this.getFilteredMessages(query);
    const conversation = query.conversationId ?
      this.chatGraph.getConversation(query.conversationId) : null;

    if (messages.length === 0) {
      return this.getEmptyMetrics();
    }

    const metrics: ConversationMetrics = {
      totalMessages: messages.length,
      userMessages: messages.filter(m => m.role === 'user').length,
      assistantMessages: messages.filter(m => m.role === 'assistant').length,
      systemMessages: messages.filter(m => m.role === 'system').length,
      averageMessageLength: this.calculateAverageLength(messages),
      totalCharacters: messages.reduce((sum, m) => sum + m.content.length, 0),
      conversationDuration: this.calculateDuration(messages),
      messagesPerHour: this.calculateMessagesPerHour(messages),
      branchCount: conversation ? conversation.branches.size : 0,
      activeBranches: conversation ? this.countActiveBranches(conversation) : 0,
      maxBranchDepth: conversation ? this.calculateMaxBranchDepth(conversation) : 0,
      responseTime: this.calculateResponseTimes(messages)
    };

    this.conversationCache.set(cacheKey, metrics);
    return metrics;
  }

  async analyzeParticipants(query: AnalyticsQuery): Promise<ParticipantAnalytics[]> {
    const messages = this.getFilteredMessages(query);
    const participantMap = new Map<string, MessageNode[]>();

    // Group messages by participant
    messages.forEach(message => {
      const participantId = this.getParticipantId(message);
      if (!participantMap.has(participantId)) {
        participantMap.set(participantId, []);
      }
      participantMap.get(participantId)!.push(message);
    });

    const analytics: ParticipantAnalytics[] = [];

    for (const [participantId, participantMessages] of participantMap.entries()) {
      const analytics_item: ParticipantAnalytics = {
        participantId,
        messageCount: participantMessages.length,
        characterCount: participantMessages.reduce((sum, m) => sum + m.content.length, 0),
        averageMessageLength: this.calculateAverageLength(participantMessages),
        mostActiveHours: this.calculateMostActiveHours(participantMessages),
        topicsDiscussed: this.extractParticipantTopics(participantMessages),
        questionsAsked: this.countQuestions(participantMessages),
        codeBlocksShared: this.countCodeBlocks(participantMessages),
        engagementScore: this.calculateEngagementScore(participantMessages, messages),
        responsePattern: this.analyzeResponsePattern(participantMessages)
      };

      analytics.push(analytics_item);
    }

    return analytics.sort((a, b) => b.messageCount - a.messageCount);
  }

  async analyzeTopics(query: AnalyticsQuery): Promise<TopicAnalytics[]> {
    const cacheKey = this.getCacheKey(query);
    if (this.topicCache.has(cacheKey)) {
      return this.topicCache.get(cacheKey)!;
    }

    const messages = this.getFilteredMessages(query);
    const topicMap = new Map<string, {
      messages: MessageNode[];
      participants: Set<string>;
      firstMention: Date;
      lastMention: Date;
    }>();

    // Extract topics from messages
    for (const message of messages) {
      const topics = this.extractTopicsFromMessage(message);

      for (const topic of topics) {
        if (!topicMap.has(topic)) {
          topicMap.set(topic, {
            messages: [],
            participants: new Set(),
            firstMention: message.timestamp,
            lastMention: message.timestamp
          });
        }

        const topicData = topicMap.get(topic)!;
        topicData.messages.push(message);
        topicData.participants.add(this.getParticipantId(message));

        if (message.timestamp < topicData.firstMention) {
          topicData.firstMention = message.timestamp;
        }
        if (message.timestamp > topicData.lastMention) {
          topicData.lastMention = message.timestamp;
        }
      }
    }

    // Convert to analytics format
    const analytics: TopicAnalytics[] = [];
    for (const [topic, data] of topicMap.entries()) {
      const topicAnalytics: TopicAnalytics = {
        topic,
        frequency: data.messages.length,
        firstMention: data.firstMention,
        lastMention: data.lastMention,
        participants: Array.from(data.participants),
        messageIds: data.messages.map(m => m.id),
        sentiment: this.analyzeSentiment(data.messages),
        complexity: this.calculateTopicComplexity(data.messages),
        relatedTopics: this.findRelatedTopics(topic, topicMap)
      };

      analytics.push(topicAnalytics);
    }

    const sortedAnalytics = analytics.sort((a, b) => b.frequency - a.frequency);
    this.topicCache.set(cacheKey, sortedAnalytics);
    return sortedAnalytics;
  }

  async generateInsights(query: AnalyticsQuery): Promise<ConversationInsights> {
    const cacheKey = this.getCacheKey(query);
    if (this.insightsCache.has(cacheKey)) {
      return this.insightsCache.get(cacheKey)!;
    }

    const messages = this.getFilteredMessages(query);
    const topics = await this.analyzeTopics(query);
    const participants = await this.analyzeParticipants(query);
    const metrics = await this.calculateMetrics(query);

    const insights: ConversationInsights = {
      summary: this.generateSummary(messages, topics, participants),
      keyTopics: topics.slice(0, 5).map(t => t.topic),
      mainParticipants: participants.slice(0, 3).map(p => p.participantId),
      conversationPattern: this.determineConversationPattern(metrics, messages),
      complexity: this.determineComplexity(metrics, topics),
      resolution: this.determineResolution(messages, topics),
      recommendations: this.generateRecommendations(metrics, topics, participants),
      similarConversations: await this.findSimilarConversations(query, topics)
    };

    this.insightsCache.set(cacheKey, insights);
    return insights;
  }

  private getFilteredMessages(query: AnalyticsQuery): MessageNode[] {
    let messages: MessageNode[] = [];

    if (query.conversationId) {
      const conversation = this.chatGraph.getConversation(query.conversationId);
      if (conversation) {
        messages = Array.from(conversation.messages.values());
      }
    } else {
      // Get all messages from all conversations
      const conversations = this.chatGraph.getAllConversations();
      messages = conversations.flatMap(conv => Array.from(conv.messages.values()));
    }

    // Apply filters
    if (query.participantIds) {
      messages = messages.filter(m =>
        query.participantIds!.includes(this.getParticipantId(m))
      );
    }

    if (query.dateRange) {
      messages = messages.filter(m =>
        m.timestamp >= query.dateRange!.start &&
        m.timestamp <= query.dateRange!.end
      );
    }

    if (query.messageTypes) {
      messages = messages.filter(m => query.messageTypes!.includes(m.role));
    }

    if (query.branchIds) {
      messages = messages.filter(m =>
        query.branchIds!.some(branchId => m.id.startsWith(branchId))
      );
    }

    return messages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  private getParticipantId(message: MessageNode): string {
    return message.metadata.participantId || message.role;
  }

  private calculateAverageLength(messages: MessageNode[]): number {
    if (messages.length === 0) return 0;
    const totalLength = messages.reduce((sum, m) => sum + m.content.length, 0);
    return Math.round(totalLength / messages.length);
  }

  private calculateDuration(messages: MessageNode[]): number {
    if (messages.length < 2) return 0;
    const start = messages[0].timestamp;
    const end = messages[messages.length - 1].timestamp;
    return Math.round((end.getTime() - start.getTime()) / (1000 * 60)); // minutes
  }

  private calculateMessagesPerHour(messages: MessageNode[]): number {
    const duration = this.calculateDuration(messages);
    return duration > 0 ? Math.round((messages.length / duration) * 60) : 0;
  }

  private countActiveBranches(conversation: ChatConversationNode): number {
    return Array.from(conversation.branches.values())
      .filter(branch => branch.isActive).length;
  }

  private calculateMaxBranchDepth(conversation: ChatConversationNode): number {
    let maxDepth = 0;
    for (const branch of conversation.branches.values()) {
      let depth = 1;
      let currentBranch = branch;
      while (currentBranch.parentBranchId) {
        depth++;
        const parentBranch = conversation.branches.get(currentBranch.parentBranchId);
        if (!parentBranch) break;
        currentBranch = parentBranch;
      }
      maxDepth = Math.max(maxDepth, depth);
    }
    return maxDepth;
  }

  private calculateResponseTimes(messages: MessageNode[]): ConversationMetrics['responseTime'] {
    const responseTimes: number[] = [];

    for (let i = 1; i < messages.length; i++) {
      const current = messages[i];
      const previous = messages[i - 1];

      // Only calculate response time between different participants
      if (this.getParticipantId(current) !== this.getParticipantId(previous)) {
        const responseTime = current.timestamp.getTime() - previous.timestamp.getTime();
        responseTimes.push(responseTime / 1000); // Convert to seconds
      }
    }

    if (responseTimes.length === 0) {
      return { average: 0, median: 0, min: 0, max: 0 };
    }

    const sorted = responseTimes.sort((a, b) => a - b);
    return {
      average: Math.round(responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length),
      median: Math.round(sorted[Math.floor(sorted.length / 2)]),
      min: Math.round(sorted[0]),
      max: Math.round(sorted[sorted.length - 1])
    };
  }

  private calculateMostActiveHours(messages: MessageNode[]): number[] {
    const hourCounts = new Array(24).fill(0);

    messages.forEach(message => {
      const hour = message.timestamp.getHours();
      hourCounts[hour]++;
    });

    // Return top 3 most active hours
    return hourCounts
      .map((count, hour) => ({ hour, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)
      .map(item => item.hour);
  }

  private extractParticipantTopics(messages: MessageNode[]): string[] {
    const topics = new Set<string>();

    messages.forEach(message => {
      const messageTopics = this.extractTopicsFromMessage(message);
      messageTopics.forEach(topic => topics.add(topic));
    });

    return Array.from(topics);
  }

  private extractTopicsFromMessage(message: MessageNode): string[] {
    // Simple topic extraction - in practice, would use NLP libraries
    const topics: string[] = [];
    const content = message.content.toLowerCase();

    // Code-related topics
    if (content.includes('function') || content.includes('method') || content.includes('class')) {
      topics.push('code-structure');
    }
    if (content.includes('bug') || content.includes('error') || content.includes('fix')) {
      topics.push('debugging');
    }
    if (content.includes('test') || content.includes('testing')) {
      topics.push('testing');
    }
    if (content.includes('performance') || content.includes('optimization')) {
      topics.push('performance');
    }
    if (content.includes('api') || content.includes('endpoint')) {
      topics.push('api-development');
    }

    // Extract technical terms as topics
    const technicalTerms = content.match(/\b(react|typescript|javascript|python|node|express|database|sql)\b/g);
    if (technicalTerms) {
      topics.push(...technicalTerms.map(term => `tech-${term}`));
    }

    return topics;
  }

  private countQuestions(messages: MessageNode[]): number {
    return messages.filter(message =>
      message.content.includes('?') ||
      message.content.toLowerCase().startsWith('how') ||
      message.content.toLowerCase().startsWith('what') ||
      message.content.toLowerCase().startsWith('why') ||
      message.content.toLowerCase().startsWith('when') ||
      message.content.toLowerCase().startsWith('where')
    ).length;
  }

  private countCodeBlocks(messages: MessageNode[]): number {
    return messages.filter(message =>
      message.content.includes('```') ||
      message.content.includes('`')
    ).length;
  }

  private calculateEngagementScore(participantMessages: MessageNode[], allMessages: MessageNode[]): number {
    const participation = participantMessages.length / allMessages.length;
    const avgLength = this.calculateAverageLength(participantMessages);
    const questions = this.countQuestions(participantMessages);
    const codeShared = this.countCodeBlocks(participantMessages);

    // Weighted scoring (0-100)
    const score = Math.min(100, Math.round(
      (participation * 30) +
      (Math.min(avgLength / 100, 1) * 25) +
      (Math.min(questions / 10, 1) * 25) +
      (Math.min(codeShared / 5, 1) * 20)
    ));

    return score;
  }

  private analyzeResponsePattern(messages: MessageNode[]): ParticipantAnalytics['responsePattern'] {
    if (messages.length < 2) {
      return { averageDelay: 0, consistency: 0 };
    }

    const delays: number[] = [];
    for (let i = 1; i < messages.length; i++) {
      const delay = messages[i].timestamp.getTime() - messages[i - 1].timestamp.getTime();
      delays.push(delay / 1000); // Convert to seconds
    }

    const averageDelay = delays.reduce((sum, delay) => sum + delay, 0) / delays.length;
    const variance = delays.reduce((sum, delay) => sum + Math.pow(delay - averageDelay, 2), 0) / delays.length;
    const consistency = Math.max(0, 1 - (Math.sqrt(variance) / averageDelay));

    return {
      averageDelay: Math.round(averageDelay),
      consistency: Math.round(consistency * 100) / 100
    };
  }

  private analyzeSentiment(messages: MessageNode[]): 'positive' | 'neutral' | 'negative' {
    // Simple sentiment analysis - in practice, would use sentiment analysis libraries
    let positiveCount = 0;
    let negativeCount = 0;

    const positiveWords = ['good', 'great', 'excellent', 'perfect', 'works', 'thanks', 'helpful'];
    const negativeWords = ['error', 'bug', 'problem', 'issue', 'broken', 'fail', 'wrong'];

    messages.forEach(message => {
      const content = message.content.toLowerCase();

      positiveWords.forEach(word => {
        if (content.includes(word)) positiveCount++;
      });

      negativeWords.forEach(word => {
        if (content.includes(word)) negativeCount++;
      });
    });

    if (positiveCount > negativeCount) return 'positive';
    if (negativeCount > positiveCount) return 'negative';
    return 'neutral';
  }

  private calculateTopicComplexity(messages: MessageNode[]): number {
    const avgLength = this.calculateAverageLength(messages);
    const codeBlocks = this.countCodeBlocks(messages);
    const technicalTerms = messages.reduce((count, message) => {
      const matches = message.content.match(/\b(function|class|interface|algorithm|optimization|performance)\b/gi);
      return count + (matches ? matches.length : 0);
    }, 0);

    // Normalize to 0-1 scale
    const complexity = Math.min(1, (avgLength / 200 + codeBlocks / 10 + technicalTerms / 20) / 3);
    return Math.round(complexity * 100) / 100;
  }

  private findRelatedTopics(topic: string, topicMap: Map<string, any>): Array<{ topic: string; correlation: number }> {
    const relatedTopics: Array<{ topic: string; correlation: number }> = [];
    const currentTopic = topicMap.get(topic);

    if (!currentTopic) return relatedTopics;

    for (const [otherTopic, data] of topicMap.entries()) {
      if (otherTopic === topic) continue;

      // Calculate correlation based on shared participants and message proximity
      const sharedParticipants = Array.from(currentTopic.participants)
        .filter(p => data.participants.has(p)).length;

      const participantCorrelation = sharedParticipants / Math.max(currentTopic.participants.size, data.participants.size);

      // Time proximity correlation
      const timeDiff = Math.abs(currentTopic.firstMention.getTime() - data.firstMention.getTime());
      const timeCorrelation = Math.max(0, 1 - (timeDiff / (1000 * 60 * 60 * 24))); // 1 day = 0 correlation

      const correlation = (participantCorrelation + timeCorrelation) / 2;

      if (correlation > 0.1) {
        relatedTopics.push({ topic: otherTopic, correlation: Math.round(correlation * 100) / 100 });
      }
    }

    return relatedTopics.sort((a, b) => b.correlation - a.correlation).slice(0, 5);
  }

  private generateSummary(messages: MessageNode[], topics: TopicAnalytics[], participants: ParticipantAnalytics[]): string {
    const messageCount = messages.length;
    const participantCount = participants.length;
    const topTopics = topics.slice(0, 3).map(t => t.topic);
    const duration = this.calculateDuration(messages);

    return `Conversation with ${messageCount} messages from ${participantCount} participants over ${duration} minutes. ` +
           `Key topics discussed: ${topTopics.join(', ')}. ` +
           `Most active participant: ${participants[0]?.participantId || 'unknown'}.`;
  }

  private determineConversationPattern(metrics: ConversationMetrics, messages: MessageNode[]): ConversationInsights['conversationPattern'] {
    if (metrics.branchCount === 0) return 'linear';
    if (metrics.branchCount > 2) return 'exploratory';
    if (new Set(messages.map(m => this.getParticipantId(m))).size > 2) return 'collaborative';
    return 'branched';
  }

  private determineComplexity(metrics: ConversationMetrics, topics: TopicAnalytics[]): ConversationInsights['complexity'] {
    const avgComplexity = topics.reduce((sum, t) => sum + t.complexity, 0) / topics.length;
    const messageComplexity = metrics.averageMessageLength > 200 ? 1 : 0;
    const branchComplexity = metrics.branchCount > 3 ? 1 : 0;

    const totalComplexity = (avgComplexity + messageComplexity + branchComplexity) / 3;

    if (totalComplexity > 0.7) return 'high';
    if (totalComplexity > 0.4) return 'medium';
    return 'low';
  }

  private determineResolution(messages: MessageNode[], topics: TopicAnalytics[]): ConversationInsights['resolution'] {
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage) return 'abandoned';

    const timeSinceLastMessage = Date.now() - lastMessage.timestamp.getTime();
    const daysSinceLastMessage = timeSinceLastMessage / (1000 * 60 * 60 * 24);

    if (daysSinceLastMessage > 7) return 'abandoned';

    const content = lastMessage.content.toLowerCase();
    const resolutionWords = ['thanks', 'solved', 'fixed', 'working', 'resolved', 'complete'];
    const hasResolutionIndicator = resolutionWords.some(word => content.includes(word));

    return hasResolutionIndicator ? 'resolved' : 'ongoing';
  }

  private generateRecommendations(metrics: ConversationMetrics, topics: TopicAnalytics[], participants: ParticipantAnalytics[]): string[] {
    const recommendations: string[] = [];

    if (metrics.branchCount > 5) {
      recommendations.push('Consider merging similar branches to reduce complexity');
    }

    if (metrics.responseTime.average > 3600) { // 1 hour
      recommendations.push('Response times are high - consider setting expectations or using async communication');
    }

    if (participants.some(p => p.engagementScore < 30)) {
      recommendations.push('Some participants have low engagement - encourage more active participation');
    }

    const technicalTopics = topics.filter(t => t.topic.includes('tech-') || t.topic.includes('code-'));
    if (technicalTopics.length > 5) {
      recommendations.push('High technical complexity detected - consider breaking into focused sessions');
    }

    if (metrics.averageMessageLength < 50) {
      recommendations.push('Messages are quite short - encourage more detailed explanations');
    }

    return recommendations;
  }

  private async findSimilarConversations(query: AnalyticsQuery, topics: TopicAnalytics[]): Promise<string[]> {
    // Simple similarity based on shared topics
    const currentTopics = new Set(topics.map(t => t.topic));
    const allConversations = this.chatGraph.getAllConversations();
    const similarities: Array<{ id: string; score: number }> = [];

    for (const conversation of allConversations) {
      if (conversation.id === query.conversationId) continue;

      const conversationTopics = await this.analyzeTopics({ conversationId: conversation.id });
      const sharedTopics = conversationTopics.filter(t => currentTopics.has(t.topic));
      const similarity = sharedTopics.length / Math.max(topics.length, conversationTopics.length);

      if (similarity > 0.3) {
        similarities.push({ id: conversation.id, score: similarity });
      }
    }

    return similarities
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(s => s.id);
  }

  private getEmptyMetrics(): ConversationMetrics {
    return {
      totalMessages: 0,
      userMessages: 0,
      assistantMessages: 0,
      systemMessages: 0,
      averageMessageLength: 0,
      totalCharacters: 0,
      conversationDuration: 0,
      messagesPerHour: 0,
      branchCount: 0,
      activeBranches: 0,
      maxBranchDepth: 0,
      responseTime: { average: 0, median: 0, min: 0, max: 0 }
    };
  }

  private getCacheKey(query: AnalyticsQuery): string {
    return JSON.stringify({
      conversationId: query.conversationId,
      participantIds: query.participantIds?.sort(),
      dateRange: query.dateRange,
      topics: query.topics?.sort(),
      messageTypes: query.messageTypes?.sort(),
      branchIds: query.branchIds?.sort()
    });
  }

  clearCache(): void {
    this.conversationCache.clear();
    this.topicCache.clear();
    this.insightsCache.clear();
  }
}