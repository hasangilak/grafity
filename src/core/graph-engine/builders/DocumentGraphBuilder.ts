import * as fs from 'fs';
import * as path from 'path';
import { GraphBuilder } from './GraphBuilder';
import { DocumentNode } from '../types/NodeTypes';
import { EdgeRelationType } from '../types/EdgeTypes';

export interface DocumentSection {
  title: string;
  level: number;
  content: string;
  startLine: number;
  endLine: number;
}

export interface DocumentMetadata {
  title?: string;
  author?: string;
  date?: string;
  tags?: string[];
  links?: string[];
  codeBlocks?: Array<{
    language: string;
    content: string;
    line: number;
  }>;
}

/**
 * Builds graph from documentation files (markdown, text, etc.)
 */
export class DocumentGraphBuilder extends GraphBuilder {
  private documentCache = new Map<string, DocumentNode>();

  /**
   * Process a directory of documentation files
   */
  async processDirectory(dirPath: string): Promise<void> {
    const files = await this.findDocumentFiles(dirPath);

    for (const file of files) {
      await this.processFile(file);
    }

    // Connect related documents
    this.connectRelatedDocuments();
  }

  /**
   * Process a single documentation file
   */
  async processFile(filePath: string): Promise<DocumentNode> {
    const content = await fs.promises.readFile(filePath, 'utf-8');
    const ext = path.extname(filePath).toLowerCase();

    let node: DocumentNode;

    switch (ext) {
      case '.md':
      case '.markdown':
        node = await this.processMarkdown(filePath, content);
        break;
      case '.txt':
        node = await this.processTextFile(filePath, content);
        break;
      case '.rst':
        node = await this.processReStructuredText(filePath, content);
        break;
      default:
        node = await this.processGenericDocument(filePath, content);
    }

    this.documentCache.set(filePath, node);
    return node;
  }

  /**
   * Process markdown file
   */
  private async processMarkdown(
    filePath: string,
    content: string
  ): Promise<DocumentNode> {
    const metadata = this.extractMarkdownMetadata(content);
    const sections = this.extractMarkdownSections(content);
    const codeReferences = this.extractCodeReferences(content);

    const nodeId = this.generateNodeId('document', filePath);

    const documentNode: DocumentNode = {
      id: nodeId,
      type: 'document',
      label: metadata.title || path.basename(filePath, '.md'),
      description: this.extractFirstParagraph(content),
      metadata: {
        filePath,
        format: 'markdown',
        title: metadata.title,
        author: metadata.author,
        createdAt: metadata.date || new Date().toISOString(),
        tags: metadata.tags || [],
        ...metadata
      },
      content,
      sections
    };

    this.store.addNode(documentNode);

    // Create section nodes
    for (const section of sections) {
      const sectionNode = this.createSectionNode(
        documentNode,
        section,
        filePath
      );
      this.store.addNode(sectionNode);

      // Connect section to document
      this.store.addEdge({
        id: `${nodeId}-${sectionNode.id}`,
        source: nodeId,
        target: sectionNode.id,
        type: 'contains',
        bidirectional: false,
        weight: 1
      });
    }

    // Create edges for code references
    for (const ref of codeReferences) {
      this.createCodeReference(documentNode, ref);
    }

    // Create edges for document links
    for (const link of metadata.links || []) {
      this.createDocumentLink(documentNode, link);
    }

    return documentNode;
  }

  /**
   * Extract metadata from markdown frontmatter
   */
  private extractMarkdownMetadata(content: string): DocumentMetadata {
    const metadata: DocumentMetadata = {};

    // Check for YAML frontmatter
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (frontmatterMatch) {
      const frontmatter = frontmatterMatch[1];
      const lines = frontmatter.split('\n');

      for (const line of lines) {
        const [key, ...valueParts] = line.split(':');
        const value = valueParts.join(':').trim();

        switch (key.trim().toLowerCase()) {
          case 'title':
            metadata.title = value;
            break;
          case 'author':
            metadata.author = value;
            break;
          case 'date':
            metadata.date = value;
            break;
          case 'tags':
            metadata.tags = value.split(',').map(t => t.trim());
            break;
        }
      }
    }

    // Extract title from first heading if not in frontmatter
    if (!metadata.title) {
      const titleMatch = content.match(/^#\s+(.+)$/m);
      if (titleMatch) {
        metadata.title = titleMatch[1];
      }
    }

    // Extract links
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    const links: string[] = [];
    let match;

    while ((match = linkRegex.exec(content)) !== null) {
      links.push(match[2]);
    }
    metadata.links = links;

    // Extract code blocks
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    const codeBlocks: DocumentMetadata['codeBlocks'] = [];
    let codeMatch;
    let lineNumber = 0;

    while ((codeMatch = codeBlockRegex.exec(content)) !== null) {
      const lines = content.substring(0, codeMatch.index).split('\n');
      lineNumber = lines.length;

      codeBlocks.push({
        language: codeMatch[1] || 'unknown',
        content: codeMatch[2],
        line: lineNumber
      });
    }
    metadata.codeBlocks = codeBlocks;

    return metadata;
  }

  /**
   * Extract sections from markdown content
   */
  private extractMarkdownSections(content: string): DocumentSection[] {
    const sections: DocumentSection[] = [];
    const lines = content.split('\n');
    const headingRegex = /^(#{1,6})\s+(.+)$/;

    let currentSection: DocumentSection | null = null;
    let sectionContent: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const headingMatch = line.match(headingRegex);

      if (headingMatch) {
        // Save previous section
        if (currentSection) {
          currentSection.content = sectionContent.join('\n').trim();
          currentSection.endLine = i - 1;
          sections.push(currentSection);
        }

        // Start new section
        currentSection = {
          title: headingMatch[2],
          level: headingMatch[1].length,
          content: '',
          startLine: i,
          endLine: i
        };
        sectionContent = [];
      } else if (currentSection) {
        sectionContent.push(line);
      }
    }

    // Save last section
    if (currentSection) {
      currentSection.content = sectionContent.join('\n').trim();
      currentSection.endLine = lines.length - 1;
      sections.push(currentSection);
    }

    return sections;
  }

  /**
   * Extract code references from document
   */
  private extractCodeReferences(content: string): string[] {
    const references: string[] = [];

    // Look for file references
    const fileRegex = /(?:^|\s)([a-zA-Z0-9_\-/]+\.(ts|tsx|js|jsx|py|java|cpp|h|cs))(?:\s|$)/gm;
    let match;

    while ((match = fileRegex.exec(content)) !== null) {
      references.push(match[1]);
    }

    // Look for function/class references
    const codeRegex = /`([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*)`/g;
    while ((match = codeRegex.exec(content)) !== null) {
      references.push(match[1]);
    }

    return [...new Set(references)]; // Remove duplicates
  }

  /**
   * Create a section node
   */
  private createSectionNode(
    parent: DocumentNode,
    section: DocumentSection,
    filePath: string
  ): DocumentNode {
    const nodeId = this.generateNodeId(
      'document-section',
      `${filePath}#${section.title}`
    );

    return {
      id: nodeId,
      type: 'document',
      label: section.title,
      description: section.content.substring(0, 200),
      metadata: {
        filePath,
        format: 'markdown-section',
        parentDocument: parent.id,
        level: section.level,
        startLine: section.startLine,
        endLine: section.endLine
      },
      content: section.content,
      sections: []
    };
  }

  /**
   * Process plain text file
   */
  private async processTextFile(
    filePath: string,
    content: string
  ): Promise<DocumentNode> {
    const nodeId = this.generateNodeId('document', filePath);

    const documentNode: DocumentNode = {
      id: nodeId,
      type: 'document',
      label: path.basename(filePath, '.txt'),
      description: this.extractFirstParagraph(content),
      metadata: {
        filePath,
        format: 'text',
        createdAt: new Date().toISOString()
      },
      content,
      sections: this.extractTextSections(content)
    };

    this.store.addNode(documentNode);
    return documentNode;
  }

  /**
   * Process ReStructuredText file
   */
  private async processReStructuredText(
    filePath: string,
    content: string
  ): Promise<DocumentNode> {
    // Basic RST parsing
    const nodeId = this.generateNodeId('document', filePath);
    const title = this.extractRSTTitle(content);

    const documentNode: DocumentNode = {
      id: nodeId,
      type: 'document',
      label: title || path.basename(filePath, '.rst'),
      description: this.extractFirstParagraph(content),
      metadata: {
        filePath,
        format: 'restructuredtext',
        title,
        createdAt: new Date().toISOString()
      },
      content,
      sections: this.extractRSTSections(content)
    };

    this.store.addNode(documentNode);
    return documentNode;
  }

  /**
   * Process generic document
   */
  private async processGenericDocument(
    filePath: string,
    content: string
  ): Promise<DocumentNode> {
    const nodeId = this.generateNodeId('document', filePath);

    const documentNode: DocumentNode = {
      id: nodeId,
      type: 'document',
      label: path.basename(filePath),
      description: content.substring(0, 200),
      metadata: {
        filePath,
        format: 'generic',
        createdAt: new Date().toISOString()
      },
      content,
      sections: []
    };

    this.store.addNode(documentNode);
    return documentNode;
  }

  /**
   * Extract sections from plain text
   */
  private extractTextSections(content: string): DocumentSection[] {
    const sections: DocumentSection[] = [];
    const lines = content.split('\n');
    let currentSection: DocumentSection | null = null;
    let sectionContent: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Detect section headers (lines with all caps or followed by underline)
      if (line.length > 0 && line === line.toUpperCase() && /[A-Z]/.test(line)) {
        if (currentSection) {
          currentSection.content = sectionContent.join('\n').trim();
          currentSection.endLine = i - 1;
          sections.push(currentSection);
        }

        currentSection = {
          title: line,
          level: 1,
          content: '',
          startLine: i,
          endLine: i
        };
        sectionContent = [];
      } else if (currentSection) {
        sectionContent.push(line);
      }
    }

    if (currentSection) {
      currentSection.content = sectionContent.join('\n').trim();
      currentSection.endLine = lines.length - 1;
      sections.push(currentSection);
    }

    return sections;
  }

  /**
   * Extract title from RST
   */
  private extractRSTTitle(content: string): string | undefined {
    const lines = content.split('\n');
    for (let i = 0; i < lines.length - 1; i++) {
      if (lines[i + 1].match(/^=+$/)) {
        return lines[i];
      }
    }
    return undefined;
  }

  /**
   * Extract sections from RST
   */
  private extractRSTSections(content: string): DocumentSection[] {
    const sections: DocumentSection[] = [];
    const lines = content.split('\n');
    const sectionChars = ['=', '-', '^', '~'];

    for (let i = 0; i < lines.length - 1; i++) {
      const nextLine = lines[i + 1];
      const char = nextLine[0];

      if (sectionChars.includes(char) && nextLine === char.repeat(nextLine.length)) {
        const level = sectionChars.indexOf(char) + 1;
        sections.push({
          title: lines[i],
          level,
          content: '',
          startLine: i,
          endLine: i
        });
      }
    }

    // Fill in content
    for (let i = 0; i < sections.length; i++) {
      const start = sections[i].endLine + 2;
      const end = i < sections.length - 1 ? sections[i + 1].startLine : lines.length;
      sections[i].content = lines.slice(start, end).join('\n').trim();
      sections[i].endLine = end - 1;
    }

    return sections;
  }

  /**
   * Extract first paragraph
   */
  private extractFirstParagraph(content: string): string {
    const paragraphs = content.split(/\n\n/);
    for (const p of paragraphs) {
      const trimmed = p.trim();
      if (trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('---')) {
        return trimmed.substring(0, 200);
      }
    }
    return content.substring(0, 200);
  }

  /**
   * Create code reference edge
   */
  private createCodeReference(doc: DocumentNode, reference: string): void {
    // Find matching code nodes
    const codeNodes = this.store.getNodesByType('code');

    for (const node of codeNodes) {
      const codeNode = node as any;
      if (
        codeNode.label === reference ||
        (codeNode.metadata?.filePath &&
          codeNode.metadata.filePath.includes(reference))
      ) {
        this.store.addEdge({
          id: `${doc.id}-references-${node.id}`,
          source: doc.id,
          target: node.id,
          type: 'references',
          bidirectional: false,
          weight: 0.8
        });
      }
    }
  }

  /**
   * Create document link edge
   */
  private createDocumentLink(doc: DocumentNode, link: string): void {
    // Check if link is to another document
    if (link.endsWith('.md') || link.endsWith('.txt')) {
      const linkedPath = path.isAbsolute(link)
        ? link
        : path.join(path.dirname(doc.metadata!.filePath!), link);

      const linkedDoc = this.documentCache.get(linkedPath);
      if (linkedDoc) {
        this.store.addEdge({
          id: `${doc.id}-links-${linkedDoc.id}`,
          source: doc.id,
          target: linkedDoc.id,
          type: 'links',
          bidirectional: false,
          weight: 0.9
        });
      }
    }
  }

  /**
   * Connect related documents based on content similarity
   */
  private connectRelatedDocuments(): void {
    const documents = Array.from(this.documentCache.values());

    for (let i = 0; i < documents.length; i++) {
      for (let j = i + 1; j < documents.length; j++) {
        const similarity = this.calculateSimilarity(documents[i], documents[j]);

        if (similarity > 0.3) {
          this.store.addEdge({
            id: `${documents[i].id}-related-${documents[j].id}`,
            source: documents[i].id,
            target: documents[j].id,
            type: 'related',
            bidirectional: true,
            weight: similarity
          });
        }
      }
    }
  }

  /**
   * Calculate similarity between documents
   */
  private calculateSimilarity(doc1: DocumentNode, doc2: DocumentNode): number {
    // Simple keyword-based similarity
    const words1 = this.extractKeywords(doc1.content || '');
    const words2 = this.extractKeywords(doc2.content || '');

    const intersection = words1.filter(w => words2.includes(w));
    const union = [...new Set([...words1, ...words2])];

    if (union.length === 0) return 0;

    return intersection.length / union.length;
  }

  /**
   * Extract keywords from content
   */
  private extractKeywords(content: string): string[] {
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at',
      'to', 'for', 'of', 'with', 'by', 'as', 'is', 'was', 'are',
      'were', 'been', 'be', 'have', 'has', 'had', 'do', 'does',
      'did', 'will', 'would', 'could', 'should', 'may', 'might'
    ]);

    const words = content
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3 && !stopWords.has(word));

    // Return unique words
    return [...new Set(words)];
  }

  /**
   * Find documentation files
   */
  private async findDocumentFiles(dirPath: string): Promise<string[]> {
    const files: string[] = [];
    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        // Skip node_modules and hidden directories
        if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
          files.push(...await this.findDocumentFiles(fullPath));
        }
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (['.md', '.markdown', '.txt', '.rst', '.adoc'].includes(ext)) {
          files.push(fullPath);
        }
      }
    }

    return files;
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.documentCache.clear();
  }
}