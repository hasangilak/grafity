/**
 * Conversation Exporter
 *
 * Exports conversations to various formats:
 * - Markdown: Human-readable format for documentation
 * - JSON: Structured data for programmatic access
 * - HTML: Styled, shareable web format
 */

import { GraphStore } from '../GraphStore';
import { ConversationNode } from '../types/NodeTypes';
import { ConversationBranch } from './EnhancedConversationGraph';

export interface ExportOptions {
  format: 'markdown' | 'json' | 'html';
  includeCode: boolean;
  includeBranches: 'all' | 'active' | 'selected';
  selectedBranchIds?: string[];
  includeMetadata: boolean;
}

export interface ExportedConversation {
  id: string;
  title: string;
  participants: string[];
  created: string;
  branches: ExportedBranch[];
  metadata?: Record<string, any>;
}

export interface ExportedBranch {
  id: string;
  name: string;
  isActive: boolean;
  messages: ExportedMessage[];
}

export interface ExportedMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  linkedCode?: string[];
  metadata?: Record<string, any>;
}

/**
 * Exports conversations to various formats
 */
export class ConversationExporter {
  private store: GraphStore;

  constructor(store: GraphStore) {
    this.store = store;
  }

  /**
   * Export conversation to Markdown format
   */
  exportToMarkdown(conversationId: string, options: ExportOptions): string {
    const conversation = this.prepareExport(conversationId, options);

    let markdown = `# Conversation: ${conversation.title}\n\n`;

    // Metadata
    if (options.includeMetadata) {
      markdown += `**Created**: ${new Date(conversation.created).toLocaleString()}\n`;
      markdown += `**Participants**: ${conversation.participants.join(', ')}\n`;
      markdown += `**Branches**: ${conversation.branches.length}\n`;
      markdown += `**Total Messages**: ${conversation.branches.reduce((sum, b) => sum + b.messages.length, 0)}\n\n`;
      markdown += '---\n\n';
    }

    // Export each branch
    for (const branch of conversation.branches) {
      markdown += `## ${branch.name}${branch.isActive ? ' (Active)' : ''}\n\n`;

      for (let i = 0; i < branch.messages.length; i++) {
        const msg = branch.messages[i];
        const roleIcon = msg.role === 'user' ? '👤' : msg.role === 'assistant' ? '🤖' : '⚙️';

        markdown += `### Message ${i + 1} - ${roleIcon} ${this.capitalize(msg.role)} (${new Date(msg.timestamp).toLocaleTimeString()})\n\n`;
        markdown += `${msg.content}\n\n`;

        // Linked code
        if (options.includeCode && msg.linkedCode && msg.linkedCode.length > 0) {
          markdown += `**Linked Code**:\n`;
          for (const file of msg.linkedCode) {
            markdown += `- \`${file}\`\n`;
          }
          markdown += '\n';
        }

        markdown += '\n';
      }

      markdown += '---\n\n';
    }

    return markdown;
  }

  /**
   * Export conversation to JSON format
   */
  exportToJSON(conversationId: string, options: ExportOptions): string {
    const conversation = this.prepareExport(conversationId, options);
    return JSON.stringify(conversation, null, 2);
  }

  /**
   * Export conversation to HTML format
   */
  exportToHTML(conversationId: string, options: ExportOptions): string {
    const conversation = this.prepareExport(conversationId, options);

    let html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${this.escapeHtml(conversation.title)}</title>
    <style>
        ${this.getHTMLStyles()}
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>${this.escapeHtml(conversation.title)}</h1>`;

    if (options.includeMetadata) {
      html += `
            <div class="metadata">
                <span class="meta-item">📅 ${new Date(conversation.created).toLocaleString()}</span>
                <span class="meta-item">👥 ${conversation.participants.join(', ')}</span>
                <span class="meta-item">🌿 ${conversation.branches.length} branch${conversation.branches.length !== 1 ? 'es' : ''}</span>
            </div>`;
    }

    html += `
        </header>
        <main>`;

    // Export each branch
    for (const branch of conversation.branches) {
      html += `
            <section class="branch ${branch.isActive ? 'active-branch' : ''}">
                <h2 class="branch-title">
                    ${this.escapeHtml(branch.name)}
                    ${branch.isActive ? '<span class="active-badge">Active</span>' : ''}
                </h2>
                <div class="messages">`;

      for (const msg of branch.messages) {
        const roleClass = msg.role;
        const roleIcon = msg.role === 'user' ? '👤' : msg.role === 'assistant' ? '🤖' : '⚙️';

        html += `
                    <div class="message ${roleClass}">
                        <div class="message-header">
                            <span class="role">${roleIcon} ${this.capitalize(msg.role)}</span>
                            <span class="timestamp">${new Date(msg.timestamp).toLocaleString()}</span>
                        </div>
                        <div class="message-content">
                            ${this.escapeHtml(msg.content)}
                        </div>`;

        if (options.includeCode && msg.linkedCode && msg.linkedCode.length > 0) {
          html += `
                        <div class="linked-code">
                            <strong>Linked Code:</strong>
                            <ul>`;
          for (const file of msg.linkedCode) {
            html += `<li><code>${this.escapeHtml(file)}</code></li>`;
          }
          html += `
                            </ul>
                        </div>`;
        }

        html += `
                    </div>`;
      }

      html += `
                </div>
            </section>`;
    }

    html += `
        </main>
        <footer>
            <p>Exported from Grafity on ${new Date().toLocaleString()}</p>
        </footer>
    </div>
</body>
</html>`;

    return html;
  }

  /**
   * Generate a shareable link (placeholder - would need server support)
   */
  generateShareableLink(conversationId: string, expiresIn: number = 168): string {
    // In a real implementation, this would:
    // 1. Upload the conversation to a server
    // 2. Generate a unique token
    // 3. Set expiration time
    // 4. Return a URL

    const token = this.generateToken(conversationId);
    const expiresAt = new Date(Date.now() + expiresIn * 60 * 60 * 1000);

    return `https://grafity.app/shared/${token}?expires=${expiresAt.getTime()}`;
  }

  /**
   * Prepare conversation data for export
   */
  private prepareExport(conversationId: string, options: ExportOptions): ExportedConversation {
    const node = this.store.getNode(conversationId) as ConversationNode;
    if (!node) {
      throw new Error(`Conversation not found: ${conversationId}`);
    }

    const branches = this.getConversationBranches(conversationId);
    const filteredBranches = this.filterBranches(branches, options);

    const exportedBranches: ExportedBranch[] = filteredBranches.map(branch => ({
      id: branch.id,
      name: this.getBranchName(branch.id),
      isActive: branch.active,
      messages: this.getExportedMessages(branch, options)
    }));

    return {
      id: conversationId,
      title: node.label,
      participants: node.participants || [],
      created: node.startTime || new Date().toISOString(),
      branches: exportedBranches,
      metadata: options.includeMetadata ? node.metadata : undefined
    };
  }

  /**
   * Get conversation branches
   */
  private getConversationBranches(conversationId: string): ConversationBranch[] {
    // This would ideally come from EnhancedConversationGraph
    // For now, we'll create a simple representation
    const messages = this.getConversationMessages(conversationId);

    if (messages.length === 0) {
      return [];
    }

    // Group messages by branch
    const branchesMap = new Map<string, ConversationNode[]>();

    for (const message of messages) {
      const branchId = (message as any).metadata?.branchId || 'main';
      if (!branchesMap.has(branchId)) {
        branchesMap.set(branchId, []);
      }
      branchesMap.get(branchId)!.push(message);
    }

    // Convert to ConversationBranch format
    return Array.from(branchesMap.entries()).map(([branchId, msgs]) => ({
      id: branchId,
      parentMessageId: conversationId,
      branchPoint: conversationId,
      messages: msgs.map(m => m.id),
      active: branchId.includes('main')
    }));
  }

  /**
   * Filter branches based on options
   */
  private filterBranches(branches: ConversationBranch[], options: ExportOptions): ConversationBranch[] {
    switch (options.includeBranches) {
      case 'all':
        return branches;
      case 'active':
        return branches.filter(b => b.active);
      case 'selected':
        if (!options.selectedBranchIds) return branches;
        return branches.filter(b => options.selectedBranchIds!.includes(b.id));
      default:
        return branches;
    }
  }

  /**
   * Get exported messages for a branch
   */
  private getExportedMessages(branch: ConversationBranch, options: ExportOptions): ExportedMessage[] {
    return branch.messages
      .map(messageId => {
        const node = this.store.getNode(messageId) as ConversationNode;
        if (!node) return null;

        const linkedCode = options.includeCode ? this.getLinkedCode(messageId) : undefined;

        return {
          id: messageId,
          role: (node.metadata?.role || 'unknown') as 'user' | 'assistant' | 'system',
          content: node.content || '',
          timestamp: node.timestamp?.toISOString() || new Date().toISOString(),
          linkedCode,
          metadata: options.includeMetadata ? node.metadata : undefined
        };
      })
      .filter(Boolean) as ExportedMessage[];
  }

  /**
   * Get all messages in a conversation
   */
  private getConversationMessages(conversationId: string): ConversationNode[] {
    const edges = this.store.getAllEdges();
    const messageIds = edges
      .filter((e: any) =>
        e.source === conversationId &&
        e.type === 'relates_to' &&
        e.metadata?.relationship === 'contains'
      )
      .map((e: any) => e.target);

    return messageIds
      .map(id => this.store.getNode(id))
      .filter(node => node && node.type === 'conversation') as ConversationNode[];
  }

  /**
   * Get linked code files for a message
   */
  private getLinkedCode(messageId: string): string[] {
    const edges = this.store.getAllEdges();
    const codeEdges = edges.filter((e: any) =>
      e.source === messageId && e.type === 'references'
    );

    return codeEdges.map((edge: any) => {
      const node = this.store.getNode(edge.target);
      return (node as any)?.filePath || edge.target;
    });
  }

  /**
   * Get branch name from branch ID
   */
  private getBranchName(branchId: string): string {
    // Try to extract name from ID
    if (branchId.includes('main')) return 'Main Branch';

    // Otherwise use the ID suffix
    const parts = branchId.split('-');
    return parts[parts.length - 1] || branchId;
  }

  /**
   * Generate a unique token
   */
  private generateToken(conversationId: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(7);
    return `${conversationId.substring(0, 8)}-${timestamp}-${random}`;
  }

  /**
   * Capitalize first letter
   */
  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  /**
   * Escape HTML special characters
   */
  private escapeHtml(text: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
  }

  /**
   * Get CSS styles for HTML export
   */
  private getHTMLStyles(): string {
    return `
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 20px;
        }

        .container {
            max-width: 900px;
            margin: 0 auto;
            background: white;
            border-radius: 12px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.2);
            overflow: hidden;
        }

        header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
        }

        h1 {
            font-size: 28px;
            margin-bottom: 12px;
        }

        .metadata {
            display: flex;
            gap: 20px;
            flex-wrap: wrap;
            font-size: 14px;
            opacity: 0.9;
        }

        .meta-item {
            display: flex;
            align-items: center;
            gap: 6px;
        }

        main {
            padding: 30px;
        }

        .branch {
            margin-bottom: 40px;
            border-left: 4px solid #9C27B0;
            padding-left: 20px;
        }

        .branch.active-branch {
            border-left-color: #4CAF50;
        }

        .branch-title {
            font-size: 22px;
            color: #333;
            margin-bottom: 20px;
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .active-badge {
            font-size: 12px;
            background: #4CAF50;
            color: white;
            padding: 3px 10px;
            border-radius: 12px;
            font-weight: normal;
        }

        .messages {
            display: flex;
            flex-direction: column;
            gap: 20px;
        }

        .message {
            background: #f9f9f9;
            border-radius: 8px;
            padding: 16px;
            border-left: 3px solid #ddd;
        }

        .message.user {
            border-left-color: #2196F3;
            background: #e3f2fd;
        }

        .message.assistant {
            border-left-color: #4CAF50;
            background: #e8f5e9;
        }

        .message-header {
            display: flex;
            justify-content: space-between;
            margin-bottom: 10px;
            font-size: 13px;
        }

        .role {
            font-weight: 600;
            color: #333;
        }

        .timestamp {
            color: #999;
        }

        .message-content {
            white-space: pre-wrap;
            line-height: 1.6;
            color: #333;
        }

        .linked-code {
            margin-top: 12px;
            padding: 10px;
            background: rgba(0,0,0,0.05);
            border-radius: 4px;
            font-size: 13px;
        }

        .linked-code ul {
            margin-top: 6px;
            margin-left: 20px;
        }

        .linked-code code {
            background: rgba(0,0,0,0.1);
            padding: 2px 6px;
            border-radius: 3px;
            font-family: Monaco, Consolas, monospace;
            font-size: 12px;
        }

        footer {
            background: #f5f5f5;
            padding: 20px 30px;
            text-align: center;
            color: #999;
            font-size: 13px;
        }
    `;
  }
}
