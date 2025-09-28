/**
 * Message parser for extracting information from chat messages
 */

import { ExtractedEntity, MessageMetadata } from '../models/MessageNode';

export interface ParsedMessage {
  content: string;
  htmlContent?: string;
  contentType: 'text' | 'code' | 'mixed' | 'error';

  // Extracted elements
  codeBlocks: CodeBlock[];
  inlineCode: InlineCode[];
  links: ExtractedLink[];
  mentions: ExtractedMention[];
  entities: ExtractedEntity[];

  // Detected features
  isQuestion: boolean;
  hasErrorContent: boolean;
  hasCommandIntent: boolean;
  hasFileReference: boolean;

  // Structure
  sections: MessageSection[];

  // Analysis
  sentiment: 'positive' | 'negative' | 'neutral';
  intent: MessageIntent;
  urgency: 'low' | 'medium' | 'high';
  complexity: number; // 0-1 scale
}

export interface CodeBlock {
  id: string;
  language?: string;
  code: string;
  startLine: number;
  endLine: number;
  isExecutable: boolean;
  hasErrors: boolean;
  functions: string[];
  classes: string[];
  imports: string[];
}

export interface InlineCode {
  text: string;
  startIndex: number;
  endIndex: number;
  type: 'variable' | 'function' | 'path' | 'command' | 'value' | 'unknown';
}

export interface ExtractedLink {
  url: string;
  text: string;
  type: 'http' | 'file' | 'relative' | 'internal';
  startIndex: number;
  endIndex: number;
}

export interface ExtractedMention {
  type: 'user' | 'file' | 'function' | 'class' | 'variable' | 'issue' | 'pr';
  text: string;
  resolvedId?: string;
  startIndex: number;
  endIndex: number;
  confidence: number;
}

export interface MessageSection {
  type: 'text' | 'code' | 'list' | 'quote' | 'heading';
  content: string;
  startIndex: number;
  endIndex: number;
  metadata?: any;
}

export interface MessageIntent {
  primary: 'question' | 'request' | 'explanation' | 'error-report' | 'suggestion' | 'information';
  secondary?: string[];
  confidence: number;
  keywords: string[];
}

/**
 * Main message parser class
 */
export class MessageParser {
  private static readonly CODE_BLOCK_REGEX = /```(?:(\w+)\n)?([\s\S]*?)```/g;
  private static readonly INLINE_CODE_REGEX = /`([^`\n]+)`/g;
  private static readonly LINK_REGEX = /\[([^\]]+)\]\(([^)]+)\)|https?:\/\/[^\s]+/g;
  private static readonly FILE_PATH_REGEX = /(?:^|\s|["`'])([a-zA-Z0-9_\-./\\]+\.[a-zA-Z]{1,4})(?:\s|["`']|$)/g;
  private static readonly FUNCTION_REGEX = /(?:function|def|func|const|let|var)\s+([a-zA-Z_][a-zA-Z0-9_]*)/g;
  private static readonly CLASS_REGEX = /(?:class|interface|struct|type)\s+([a-zA-Z_][a-zA-Z0-9_]*)/g;
  private static readonly QUESTION_INDICATORS = ['?', 'how', 'what', 'where', 'when', 'why', 'which', 'can you', 'could you', 'would you'];
  private static readonly ERROR_KEYWORDS = ['error', 'exception', 'failed', 'crash', 'bug', 'issue', 'problem', 'stack trace', 'traceback'];
  private static readonly COMMAND_INDICATORS = ['please', 'can you', 'could you', 'help me', 'implement', 'create', 'build', 'fix', 'debug', 'refactor'];

  /**
   * Parse a message and extract all relevant information
   */
  static parseMessage(content: string, role: 'user' | 'assistant' | 'system' = 'user'): ParsedMessage {
    const parser = new MessageParser();
    return parser.parse(content, role);
  }

  private parse(content: string, role: 'user' | 'assistant' | 'system'): ParsedMessage {
    const codeBlocks = this.extractCodeBlocks(content);
    const inlineCode = this.extractInlineCode(content);
    const links = this.extractLinks(content);
    const mentions = this.extractMentions(content);
    const entities = this.extractEntities(content);
    const sections = this.extractSections(content);

    const contentType = this.determineContentType(content, codeBlocks, inlineCode);
    const isQuestion = this.detectQuestion(content);
    const hasErrorContent = this.detectErrors(content);
    const hasCommandIntent = this.detectCommandIntent(content);
    const hasFileReference = this.detectFileReferences(content);

    const sentiment = this.analyzeSentiment(content, role);
    const intent = this.analyzeIntent(content, role);
    const urgency = this.analyzeUrgency(content, hasErrorContent);
    const complexity = this.calculateComplexity(content, codeBlocks, entities);

    return {
      content,
      htmlContent: this.generateHtmlContent(content, codeBlocks, inlineCode, links),
      contentType,
      codeBlocks,
      inlineCode,
      links,
      mentions,
      entities,
      isQuestion,
      hasErrorContent,
      hasCommandIntent,
      hasFileReference,
      sections,
      sentiment,
      intent,
      urgency,
      complexity
    };
  }

  /**
   * Extract code blocks from message
   */
  private extractCodeBlocks(content: string): CodeBlock[] {
    const blocks: CodeBlock[] = [];
    const lines = content.split('\n');
    let match;

    MessageParser.CODE_BLOCK_REGEX.lastIndex = 0;
    let blockIndex = 0;

    while ((match = MessageParser.CODE_BLOCK_REGEX.exec(content)) !== null) {
      const language = match[1] || 'text';
      const code = match[2];
      const fullMatch = match[0];

      // Find line numbers
      const beforeCode = content.substring(0, match.index);
      const startLine = beforeCode.split('\n').length;
      const endLine = startLine + code.split('\n').length - 1;

      const block: CodeBlock = {
        id: `code-block-${blockIndex++}`,
        language,
        code: code.trim(),
        startLine,
        endLine,
        isExecutable: this.isExecutableCode(language, code),
        hasErrors: this.detectCodeErrors(code),
        functions: this.extractFunctionsFromCode(code),
        classes: this.extractClassesFromCode(code),
        imports: this.extractImportsFromCode(code, language)
      };

      blocks.push(block);
    }

    return blocks;
  }

  /**
   * Extract inline code from message
   */
  private extractInlineCode(content: string): InlineCode[] {
    const inlineCode: InlineCode[] = [];
    let match;

    MessageParser.INLINE_CODE_REGEX.lastIndex = 0;

    while ((match = MessageParser.INLINE_CODE_REGEX.exec(content)) !== null) {
      const text = match[1];
      const type = this.classifyInlineCode(text);

      inlineCode.push({
        text,
        startIndex: match.index,
        endIndex: match.index + match[0].length,
        type
      });
    }

    return inlineCode;
  }

  /**
   * Extract links from message
   */
  private extractLinks(content: string): ExtractedLink[] {
    const links: ExtractedLink[] = [];
    let match;

    MessageParser.LINK_REGEX.lastIndex = 0;

    while ((match = MessageParser.LINK_REGEX.exec(content)) !== null) {
      let url: string;
      let text: string;

      if (match[1] && match[2]) {
        // Markdown link [text](url)
        text = match[1];
        url = match[2];
      } else {
        // Plain URL
        url = match[0];
        text = match[0];
      }

      const type = this.classifyLink(url);

      links.push({
        url,
        text,
        type,
        startIndex: match.index,
        endIndex: match.index + match[0].length
      });
    }

    return links;
  }

  /**
   * Extract mentions and references
   */
  private extractMentions(content: string): ExtractedMention[] {
    const mentions: ExtractedMention[] = [];

    // File mentions
    let match;
    MessageParser.FILE_PATH_REGEX.lastIndex = 0;

    while ((match = MessageParser.FILE_PATH_REGEX.exec(content)) !== null) {
      mentions.push({
        type: 'file',
        text: match[1],
        startIndex: match.index,
        endIndex: match.index + match[0].length,
        confidence: 0.8
      });
    }

    // Function mentions
    MessageParser.FUNCTION_REGEX.lastIndex = 0;
    while ((match = MessageParser.FUNCTION_REGEX.exec(content)) !== null) {
      mentions.push({
        type: 'function',
        text: match[1],
        startIndex: match.index,
        endIndex: match.index + match[0].length,
        confidence: 0.9
      });
    }

    // Class mentions
    MessageParser.CLASS_REGEX.lastIndex = 0;
    while ((match = MessageParser.CLASS_REGEX.exec(content)) !== null) {
      mentions.push({
        type: 'class',
        text: match[1],
        startIndex: match.index,
        endIndex: match.index + match[0].length,
        confidence: 0.9
      });
    }

    return mentions;
  }

  /**
   * Extract entities using basic NLP
   */
  private extractEntities(content: string): ExtractedEntity[] {
    const entities: ExtractedEntity[] = [];
    const words = content.toLowerCase().split(/\s+/);

    // Technology framework detection
    const frameworks = ['react', 'vue', 'angular', 'express', 'fastapi', 'django', 'rails', 'spring'];
    const languages = ['javascript', 'typescript', 'python', 'java', 'cpp', 'csharp', 'go', 'rust'];

    for (let i = 0; i < words.length; i++) {
      const word = words[i].replace(/[^\w]/g, '');

      if (frameworks.includes(word)) {
        const startIndex = content.toLowerCase().indexOf(word);
        entities.push({
          type: 'framework',
          text: word,
          confidence: 0.8,
          startIndex,
          endIndex: startIndex + word.length
        });
      }

      if (languages.includes(word)) {
        const startIndex = content.toLowerCase().indexOf(word);
        entities.push({
          type: 'concept',
          text: word,
          confidence: 0.7,
          startIndex,
          endIndex: startIndex + word.length
        });
      }
    }

    return entities;
  }

  /**
   * Extract message sections
   */
  private extractSections(content: string): MessageSection[] {
    const sections: MessageSection[] = [];
    const lines = content.split('\n');
    let currentSection: MessageSection | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Detect section type
      let sectionType: MessageSection['type'] = 'text';

      if (trimmed.startsWith('#')) {
        sectionType = 'heading';
      } else if (trimmed.startsWith('```')) {
        sectionType = 'code';
      } else if (trimmed.startsWith('>')) {
        sectionType = 'quote';
      } else if (trimmed.match(/^[-*+]\s/) || trimmed.match(/^\d+\.\s/)) {
        sectionType = 'list';
      }

      // Handle section boundaries
      if (!currentSection || currentSection.type !== sectionType) {
        // End previous section
        if (currentSection) {
          sections.push(currentSection);
        }

        // Start new section
        currentSection = {
          type: sectionType,
          content: line,
          startIndex: content.indexOf(line),
          endIndex: content.indexOf(line) + line.length
        };
      } else {
        // Continue current section
        currentSection.content += '\n' + line;
        currentSection.endIndex = content.indexOf(line) + line.length;
      }
    }

    // Add final section
    if (currentSection) {
      sections.push(currentSection);
    }

    return sections;
  }

  /**
   * Determine overall content type
   */
  private determineContentType(
    content: string,
    codeBlocks: CodeBlock[],
    inlineCode: InlineCode[]
  ): 'text' | 'code' | 'mixed' | 'error' {
    const hasErrors = MessageParser.ERROR_KEYWORDS.some(keyword =>
      content.toLowerCase().includes(keyword)
    );

    if (hasErrors) return 'error';

    if (codeBlocks.length > 0) {
      const codeLength = codeBlocks.reduce((sum, block) => sum + block.code.length, 0);
      const totalLength = content.length;
      return codeLength > totalLength * 0.3 ? 'code' : 'mixed';
    }

    if (inlineCode.length > 3) return 'mixed';

    return 'text';
  }

  /**
   * Detect if message is a question
   */
  private detectQuestion(content: string): boolean {
    const lower = content.toLowerCase();
    return MessageParser.QUESTION_INDICATORS.some(indicator => {
      if (indicator === '?') {
        return content.includes('?');
      }
      return lower.includes(indicator);
    });
  }

  /**
   * Detect error content
   */
  private detectErrors(content: string): boolean {
    const lower = content.toLowerCase();
    return MessageParser.ERROR_KEYWORDS.some(keyword => lower.includes(keyword));
  }

  /**
   * Detect command intent
   */
  private detectCommandIntent(content: string): boolean {
    const lower = content.toLowerCase();
    return MessageParser.COMMAND_INDICATORS.some(indicator => lower.includes(indicator));
  }

  /**
   * Detect file references
   */
  private detectFileReferences(content: string): boolean {
    return MessageParser.FILE_PATH_REGEX.test(content);
  }

  /**
   * Analyze sentiment
   */
  private analyzeSentiment(content: string, role: 'user' | 'assistant' | 'system'): 'positive' | 'negative' | 'neutral' {
    const positiveWords = ['good', 'great', 'awesome', 'perfect', 'excellent', 'works', 'success'];
    const negativeWords = ['bad', 'wrong', 'broken', 'error', 'fail', 'problem', 'issue'];

    const lower = content.toLowerCase();
    const positiveCount = positiveWords.filter(word => lower.includes(word)).length;
    const negativeCount = negativeWords.filter(word => lower.includes(word)).length;

    if (positiveCount > negativeCount) return 'positive';
    if (negativeCount > positiveCount) return 'negative';
    return 'neutral';
  }

  /**
   * Analyze intent
   */
  private analyzeIntent(content: string, role: 'user' | 'assistant' | 'system'): MessageIntent {
    const lower = content.toLowerCase();

    if (this.detectErrors(content)) {
      return {
        primary: 'error-report',
        confidence: 0.9,
        keywords: MessageParser.ERROR_KEYWORDS.filter(keyword => lower.includes(keyword))
      };
    }

    if (this.detectQuestion(content)) {
      return {
        primary: 'question',
        confidence: 0.8,
        keywords: MessageParser.QUESTION_INDICATORS.filter(indicator => lower.includes(indicator))
      };
    }

    if (this.detectCommandIntent(content)) {
      return {
        primary: 'request',
        confidence: 0.7,
        keywords: MessageParser.COMMAND_INDICATORS.filter(indicator => lower.includes(indicator))
      };
    }

    return {
      primary: role === 'assistant' ? 'explanation' : 'information',
      confidence: 0.6,
      keywords: []
    };
  }

  /**
   * Analyze urgency
   */
  private analyzeUrgency(content: string, hasErrors: boolean): 'low' | 'medium' | 'high' {
    const urgentWords = ['urgent', 'asap', 'immediately', 'critical', 'emergency'];
    const lower = content.toLowerCase();

    if (hasErrors || urgentWords.some(word => lower.includes(word))) {
      return 'high';
    }

    if (content.includes('!') || lower.includes('quickly') || lower.includes('soon')) {
      return 'medium';
    }

    return 'low';
  }

  /**
   * Calculate complexity score
   */
  private calculateComplexity(
    content: string,
    codeBlocks: CodeBlock[],
    entities: ExtractedEntity[]
  ): number {
    let score = 0;

    // Base complexity from length
    score += Math.min(content.length / 1000, 0.3);

    // Code complexity
    score += codeBlocks.length * 0.2;
    score += codeBlocks.reduce((sum, block) => sum + block.functions.length + block.classes.length, 0) * 0.1;

    // Entity complexity
    score += entities.length * 0.05;

    // Structure complexity
    const sentences = content.split(/[.!?]+/).length;
    score += Math.min(sentences / 10, 0.2);

    return Math.min(score, 1);
  }

  /**
   * Helper methods
   */
  private isExecutableCode(language?: string, code?: string): boolean {
    if (!language || !code) return false;

    const executableLanguages = ['javascript', 'python', 'bash', 'sh', 'node'];
    return executableLanguages.includes(language.toLowerCase());
  }

  private detectCodeErrors(code: string): boolean {
    // Simple error detection - would be enhanced with actual parsing
    return code.includes('Error') || code.includes('Exception') || code.includes('Traceback');
  }

  private extractFunctionsFromCode(code: string): string[] {
    const functions: string[] = [];
    const functionRegex = /(?:function|def|func|const|let|var)\s+([a-zA-Z_][a-zA-Z0-9_]*)/g;
    let match;

    while ((match = functionRegex.exec(code)) !== null) {
      functions.push(match[1]);
    }

    return functions;
  }

  private extractClassesFromCode(code: string): string[] {
    const classes: string[] = [];
    const classRegex = /(?:class|interface|struct|type)\s+([a-zA-Z_][a-zA-Z0-9_]*)/g;
    let match;

    while ((match = classRegex.exec(code)) !== null) {
      classes.push(match[1]);
    }

    return classes;
  }

  private extractImportsFromCode(code: string, language?: string): string[] {
    const imports: string[] = [];

    if (language === 'javascript' || language === 'typescript') {
      const importRegex = /import.*?['"]([^'"]+)['"]/g;
      let match;
      while ((match = importRegex.exec(code)) !== null) {
        imports.push(match[1]);
      }
    } else if (language === 'python') {
      const importRegex = /(?:from\s+(\S+)\s+import|import\s+(\S+))/g;
      let match;
      while ((match = importRegex.exec(code)) !== null) {
        imports.push(match[1] || match[2]);
      }
    }

    return imports;
  }

  private classifyInlineCode(text: string): InlineCode['type'] {
    if (text.includes('/') || text.includes('.')) return 'path';
    if (text.includes('(') || text.includes(')')) return 'function';
    if (text.match(/^[A-Z][a-zA-Z0-9]*$/)) return 'class';
    if (text.startsWith('npm') || text.startsWith('git')) return 'command';
    if (text.match(/^\d+$/) || text.match(/^["'].*["']$/)) return 'value';
    return 'variable';
  }

  private classifyLink(url: string): ExtractedLink['type'] {
    if (url.startsWith('http://') || url.startsWith('https://')) return 'http';
    if (url.startsWith('./') || url.startsWith('../')) return 'relative';
    if (url.includes('/') && !url.includes('://')) return 'file';
    return 'internal';
  }

  private generateHtmlContent(
    content: string,
    codeBlocks: CodeBlock[],
    inlineCode: InlineCode[],
    links: ExtractedLink[]
  ): string {
    let html = content;

    // Convert code blocks to HTML
    for (const block of codeBlocks) {
      const codeHtml = `<pre><code class="language-${block.language}">${this.escapeHtml(block.code)}</code></pre>`;
      html = html.replace(`\`\`\`${block.language}\n${block.code}\`\`\``, codeHtml);
    }

    // Convert inline code to HTML
    for (const code of inlineCode) {
      const codeHtml = `<code class="inline-code ${code.type}">${this.escapeHtml(code.text)}</code>`;
      html = html.replace(`\`${code.text}\``, codeHtml);
    }

    // Convert links to HTML
    for (const link of links) {
      if (link.type === 'http') {
        const linkHtml = `<a href="${link.url}" target="_blank" rel="noopener">${link.text}</a>`;
        html = html.replace(link.url, linkHtml);
      }
    }

    return html;
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}