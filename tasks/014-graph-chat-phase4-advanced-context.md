# Task 014: Graph Chat Phase 4 - Advanced Context & Intelligence

## Status: 🔴 Not Started

## Priority: LOW (Nice to Have)

## Description
Add advanced features to make graph chat more intelligent and productive: semantic search across conversations, multi-file code context, related conversation suggestions, and conversation export/sharing capabilities.

## Context
Phases 1-3 delivered core graph chat functionality. This phase adds intelligence:
- Find relevant messages quickly across large conversations
- See all code context in one place
- Discover related conversations
- Share and export conversation threads

## Goals
1. **Semantic Search**: Find messages by content, code, or topic
2. **Multi-file Code Context**: Aggregate all referenced code
3. **Related Conversations**: Suggest similar past conversations
4. **Export & Sharing**: Export as markdown, generate shareable links

## Technical Requirements

### 1. Semantic Search Engine
**File**: `src/core/graph-engine/chat/SemanticSearch.ts`

```typescript
interface SearchQuery {
  text: string;
  filters: {
    messageRole?: 'user' | 'assistant' | 'system';
    dateRange?: [Date, Date];
    branchIds?: string[];
    hasCodeLinks?: boolean;
    topics?: string[];
  };
  limit?: number;
}

interface SearchResult {
  message: ConversationNode;
  relevanceScore: number;      // 0-1
  matchedContent: string[];    // Highlighted snippets
  context: {
    conversationPath: string[];
    linkedCode: string[];
    relatedMessages: string[];
  };
}

class SemanticSearch {
  search(query: SearchQuery): SearchResult[];
  indexMessage(message: ConversationNode): void;
  reindexAll(): Promise<void>;
  getTopics(conversationId: string): string[];
}
```

**Features**:
- Full-text search on message content
- Filter by role, date, branch, code links
- Relevance scoring (TF-IDF or similar)
- Context extraction (surrounding messages)
- Topic detection (extract key terms)

### 2. Search UI Component
**File**: `client/src/components/chat/SearchPanel.tsx`

```typescript
interface SearchPanelProps {
  onResultClick: (messageId: string) => void;
  onClose: () => void;
}
```

**Features**:
- Search input with autocomplete
- Filter UI (role, date range, branch, has code)
- Results list with snippets
- Highlight matched terms
- Jump to message in graph
- Keyboard navigation (up/down arrows)
- Recent searches

### 3. Multi-file Code Context
**File**: `client/src/components/chat/CodeContextPanel.tsx`

```typescript
interface CodeContextPanelProps {
  conversationId?: string;
  branchId?: string;
  messageId?: string;  // If provided, show code for this message only
}

interface CodeContext {
  files: {
    path: string;
    language: string;
    snippets: {
      startLine: number;
      endLine: number;
      code: string;
      linkedMessages: string[];  // Messages that reference this
    }[];
  }[];
}
```

**Features**:
- File tree view (all referenced files)
- Syntax-highlighted code
- Show which messages reference each file
- Jump to message from code
- Download all files as ZIP
- Open in editor

### 4. Related Conversations Finder
**File**: `src/core/graph-engine/chat/RelatedConversationsFinder.ts`

```typescript
interface RelatedConversation {
  id: string;
  title: string;
  similarity: number;          // 0-1
  sharedTopics: string[];
  sharedCodeFiles: string[];
  messageCount: number;
  lastUpdated: Date;
}

class RelatedConversationsFinder {
  findRelated(
    conversationId: string,
    options: {
      minSimilarity?: number;
      maxResults?: number;
      includeArchived?: boolean;
    }
  ): RelatedConversation[];

  calculateSimilarity(conv1: string, conv2: string): number;
  getSharedTopics(conv1: string, conv2: string): string[];
}
```

**Similarity Factors**:
- Shared code file references (high weight)
- Common topics (medium weight)
- Similar message patterns (low weight)
- Participant overlap (low weight)

### 5. Related Conversations UI
**File**: `client/src/components/chat/RelatedConversationsPanel.tsx`

```typescript
interface RelatedConversationsPanelProps {
  currentConversationId: string;
  onNavigate: (conversationId: string) => void;
}
```

**Features**:
- List of related conversations
- Similarity score bar
- Shared topics tags
- Shared code files list
- "Open in new tab" action
- "Continue conversation" action

### 6. Conversation Exporter
**File**: `src/core/graph-engine/chat/ConversationExporter.ts`

```typescript
interface ExportOptions {
  format: 'markdown' | 'json' | 'html';
  includeCode: boolean;
  includeBranches: 'all' | 'active' | 'selected';
  selectedBranchIds?: string[];
  includeMetadata: boolean;
}

class ConversationExporter {
  exportToMarkdown(
    conversationId: string,
    options: ExportOptions
  ): string;

  exportToJSON(
    conversationId: string,
    options: ExportOptions
  ): object;

  exportToHTML(
    conversationId: string,
    options: ExportOptions
  ): string;

  generateShareableLink(
    conversationId: string,
    expiresIn?: number  // Hours
  ): string;
}
```

**Markdown Format**:
```markdown
# Conversation: Discussing React Component Architecture

## Main Branch

### Message 1 - User (10:00 AM)
How does the Dashboard component work?

### Message 2 - Assistant (10:01 AM)
The Dashboard component uses useState and useEffect...

**Linked Code**: `examples/sample-react-app/src/components/Dashboard.tsx`

## Branch: Performance Optimization

### Message 3 - User (10:05 AM)
Tell me more about the hooks...
```

### 7. Export UI Component
**File**: `client/src/components/chat/ExportDialog.tsx`

```typescript
interface ExportDialogProps {
  conversationId: string;
  onClose: () => void;
}
```

**Features**:
- Format selector (Markdown, JSON, HTML)
- Branch selector (all, active, custom)
- Options checkboxes (include code, include metadata)
- Preview export
- Download button
- Copy to clipboard
- Generate shareable link

## Implementation Steps

### Step 1: Implement Semantic Search (5 hours)
1. Create `src/core/graph-engine/chat/SemanticSearch.ts`
2. Implement basic text search (case-insensitive)
3. Add TF-IDF scoring for relevance
4. Implement filters (role, date, branch)
5. Add topic extraction (extract key terms)
6. Test with demo conversation (100+ messages)

### Step 2: Create Search UI (4 hours)
1. Create `client/src/components/chat/SearchPanel.tsx`
2. Implement search input with real-time results
3. Add filter UI (dropdown/checkboxes)
4. Display results with highlighted snippets
5. Implement click → jump to message
6. Add keyboard navigation
7. Style panel (left sidebar, collapsible)

### Step 3: Implement Multi-file Code Context (4 hours)
1. Create `client/src/components/chat/CodeContextPanel.tsx`
2. Aggregate all code files from conversation
3. Display file tree view
4. Show code snippets with syntax highlighting
5. Add "which messages reference this" section
6. Implement jump to message from code
7. Add download all files button

### Step 4: Implement Related Conversations (4 hours)
1. Create `src/core/graph-engine/chat/RelatedConversationsFinder.ts`
2. Implement similarity calculation (Jaccard, cosine)
3. Weight shared code files higher
4. Extract common topics
5. Create `RelatedConversationsPanel.tsx`
6. Display related conversations with scores
7. Test with 10+ conversations

### Step 5: Implement Conversation Exporter (5 hours)
1. Create `src/core/graph-engine/chat/ConversationExporter.ts`
2. Implement markdown export (thread format)
3. Implement JSON export (structured data)
4. Implement HTML export (styled, shareable)
5. Add branch filtering logic
6. Test with multi-branch conversation

### Step 6: Create Export UI (3 hours)
1. Create `client/src/components/chat/ExportDialog.tsx`
2. Add format selector
3. Add branch selector with preview
4. Add options checkboxes
5. Implement preview pane
6. Add download and copy buttons
7. Style modal dialog

### Step 7: Integration & Testing (3 hours)
1. Wire search to graph navigation
2. Test multi-file context with complex conversation
3. Test related conversations suggestions
4. Test export with all branches
5. Verify shareable links work
6. Performance test with large conversations

## Acceptance Criteria
- [ ] Search finds relevant messages in <500ms
- [ ] Search highlights matched terms
- [ ] Filters work correctly (role, date, branch, code)
- [ ] Code context shows all referenced files
- [ ] Jump to message from code works
- [ ] Related conversations show reasonable suggestions (>0.5 similarity)
- [ ] Markdown export preserves conversation structure
- [ ] JSON export includes all metadata
- [ ] HTML export is styled and readable
- [ ] Shareable links work for 7 days (configurable)
- [ ] Download all code files as ZIP works

## Dependencies
- Lunr.js or similar (for full-text search)
- JSZip (for ZIP file creation)
- React 18+ (already in project)
- EnhancedConversationGraph (completed)

## Testing
1. **Unit Tests**: Test SemanticSearch, RelatedConversationsFinder, Exporter
2. **Component Tests**: Test SearchPanel, CodeContextPanel, ExportDialog
3. **Integration Tests**: Test search → navigate → export flow
4. **Performance Tests**: Test with 500+ messages
5. **E2E Tests**: Add Playwright test for:
   - Search for message
   - View code context
   - Export conversation

## Estimated Time
**Total**: 28 hours (4 days)
- Semantic search: 5 hours
- Search UI: 4 hours
- Multi-file context: 4 hours
- Related conversations: 4 hours
- Exporter: 5 hours
- Export UI: 3 hours
- Integration & Testing: 3 hours

## Success Metrics
- Search returns relevant results in top 5 (80%+ precision)
- Code context loads in <1 second
- Related conversations have >0.6 average similarity
- Export completes in <3 seconds
- 90%+ users find search useful
- 70%+ users export conversations

## Next Steps
After completion:
- Add AI-powered semantic search (embeddings)
- Add conversation templates
- Add collaborative editing (multiple users)
- Add conversation analytics (message frequency, topic trends)

## References
- `GRAPH-CHAT-IMPROVEMENTS.md` - Full improvement plan
- `Tasks 011-013` - Previous phases (prerequisites)
- Lunr.js documentation: https://lunrjs.com/

## Notes
- Consider using vector embeddings for better semantic search (future)
- Add conversation templates (debugging, feature planning, code review)
- Add analytics dashboard (message count over time, topic trends)
- Consider integration with external tools (Notion, Confluence)
- Add conversation versioning (snapshots)