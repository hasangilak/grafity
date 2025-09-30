# Task 011: Graph Chat Phase 1 - Message Display & Context Panel

## Status: 🔴 Not Started

## Priority: HIGH (MVP)

## Description
Implement essential chat features to make the graph-based conversation visualization interactive and useful. Focus on displaying message content, linked code, and conversation context in a side panel.

## Context
The graph chat visualization currently exists but lacks critical features:
- Nodes only show "Message from user/assistant" labels (no content)
- No way to see full message text or metadata
- No code preview for linked files
- No conversation path/breadcrumb navigation

## Goals
1. **Message Detail Panel**: Show full message content when clicking a node
2. **Code Preview**: Display code snippets for linked files
3. **Conversation Breadcrumbs**: Show conversation path from root to current message
4. **Rich Tooltips**: Preview message content on hover

## Technical Requirements

### 1. Message Detail Panel Component
**File**: `client/src/components/chat/MessageDetailPanel.tsx`

```typescript
interface MessageDetailPanelProps {
  messageId: string;
  onClose: () => void;
}

interface MessageData {
  content: string;
  role: 'user' | 'assistant' | 'system';
  timestamp: string;
  conversationPath: string[];
  linkedCode: CodeReference[];
  relatedMessages: RelatedMessage[];
  branch: BranchInfo;
}
```

**Features**:
- Full message content with markdown rendering
- Metadata display (timestamp, role, branch)
- Related messages section (bidirectional connections)
- Linked code preview section
- Actions (reply, branch, link to code)

### 2. Code Preview Component
**File**: `client/src/components/chat/CodePreview.tsx`

```typescript
interface CodePreviewProps {
  filePath: string;
  language?: string;
  startLine?: number;
  endLine?: number;
  highlights?: number[];
}
```

**Features**:
- Syntax highlighting (use Prism.js or highlight.js)
- Line numbers
- Jump to definition
- Copy to clipboard
- Open in editor button

### 3. Conversation Breadcrumb Component
**File**: `client/src/components/chat/ConversationBreadcrumb.tsx`

```typescript
interface ConversationBreadcrumbProps {
  path: ConversationNode[];
  onNavigate: (nodeId: string) => void;
}
```

**Features**:
- Show conversation path from root
- Clickable breadcrumbs to navigate
- Highlight current message
- Collapse long paths (show first, last, and ...)

### 4. Enhanced Graph Data Methods
**File**: `src/core/graph-engine/chat/EnhancedConversationGraph.ts`

Add methods:
```typescript
getMessageContent(messageId: string): string
getMessageMetadata(messageId: string): MessageMetadata
getLinkedCode(messageId: string): CodeReference[]
getRelatedMessages(messageId: string, depth: number): ConversationNode[]
```

### 5. Rich Tooltips in Visualization
**File**: `src/core/graph-engine/visualization/HtmlGraphGenerator.ts`

Modify to include:
- Message preview (first 100 chars)
- Timestamp
- Role indicator
- Number of connections
- Branch name

## Implementation Steps

### Step 1: Add Graph Data Methods (2 hours)
1. Open `src/core/graph-engine/chat/EnhancedConversationGraph.ts`
2. Add `getMessageContent(messageId)` method
3. Add `getMessageMetadata(messageId)` method
4. Add `getLinkedCode(messageId)` method
5. Test methods with existing demo data

### Step 2: Create MessageDetailPanel (4 hours)
1. Create `client/src/components/chat/MessageDetailPanel.tsx`
2. Implement message content display with markdown
3. Add metadata section (timestamp, role, branch)
4. Add related messages section
5. Style panel (side drawer, 400px width)

### Step 3: Create CodePreview Component (3 hours)
1. Create `client/src/components/chat/CodePreview.tsx`
2. Add syntax highlighting (install highlight.js)
3. Implement line numbers
4. Add copy to clipboard functionality
5. Test with Dashboard.tsx and TodoList.tsx

### Step 4: Create ConversationBreadcrumb (2 hours)
1. Create `client/src/components/chat/ConversationBreadcrumb.tsx`
2. Use existing `getConversationPath()` method
3. Implement clickable breadcrumb navigation
4. Add collapse logic for long paths
5. Style breadcrumbs (top of detail panel)

### Step 5: Add Rich Tooltips (2 hours)
1. Modify `HtmlGraphGenerator.ts` to include message preview
2. Add D3 tooltip on node hover
3. Include timestamp, role, connections count
4. Test with demo visualization

### Step 6: Integration & Testing (3 hours)
1. Wire up MessageDetailPanel to graph click event
2. Test navigation between messages
3. Verify code preview works for all linked files
4. Test breadcrumb navigation
5. Verify tooltips show correct data

## Acceptance Criteria
- [ ] Clicking a message node opens detail panel with full content
- [ ] Detail panel shows all metadata (timestamp, role, branch)
- [ ] Linked code files show syntax-highlighted preview
- [ ] Breadcrumbs show conversation path and are clickable
- [ ] Hovering over node shows message preview tooltip
- [ ] Panel closes cleanly (X button or click outside)
- [ ] Code preview supports all languages (TypeScript, JavaScript, etc.)
- [ ] Related messages section shows bidirectional connections
- [ ] Performance: Panel opens in <200ms

## Dependencies
- React 18+ (already in project)
- highlight.js or Prism.js (for code syntax highlighting)
- react-markdown (for message content rendering)
- D3.js (already in project for tooltips)

## Testing
1. **Unit Tests**: Test getMessageContent, getMessageMetadata methods
2. **Component Tests**: Test MessageDetailPanel, CodePreview, Breadcrumb
3. **Integration Tests**: Test click → panel open → code preview flow
4. **E2E Tests**: Add Playwright test for user clicking node and viewing content

## Estimated Time
**Total**: 16 hours (2 days)
- Graph methods: 2 hours
- MessageDetailPanel: 4 hours
- CodePreview: 3 hours
- Breadcrumb: 2 hours
- Tooltips: 2 hours
- Integration & Testing: 3 hours

## Success Metrics
- Message content visible in <2 clicks
- Code preview renders in <500ms
- User can navigate conversation path via breadcrumbs
- Tooltip provides enough context to decide if message is relevant

## Next Steps
After completion, proceed to:
- **Task 012**: Graph Chat Phase 2 - Interactive Chat Input
- Add real-time message sending
- Implement branch creation from UI

## References
- `GRAPH-CHAT-IMPROVEMENTS.md` - Full improvement plan
- `src/core/graph-engine/chat/EnhancedConversationGraph.ts` - Existing implementation
- `scripts/demo/graph-chat.ts` - Demo with sample data
- `dist/visualizations/graph-chat-demo.html` - Current visualization

## Notes
- Keep panel responsive (works on smaller screens)
- Consider mobile layout (future)
- Ensure accessibility (keyboard navigation, screen readers)
- Add loading states for code preview