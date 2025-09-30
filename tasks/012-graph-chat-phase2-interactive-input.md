# Task 012: Graph Chat Phase 2 - Interactive Chat Input

## Status: ✅ COMPLETED

## Priority: HIGH (MVP)

## Description
Add interactive chat capabilities to the graph visualization, allowing users to send messages, continue conversations, and create branches directly from the UI. Transform the static graph into a real-time collaborative chat interface.

## Context
Phase 1 added message display and context panels. Now we need to make the chat interactive:
- Users can't send new messages
- No way to continue conversations from a specific node
- No UI for creating branches
- Graph doesn't update in real-time

## Goals
1. **Chat Input Component**: Text input for sending messages
2. **Message Actions**: Reply, branch, link to code
3. **Real-time Updates**: Graph updates immediately after new message
4. **Branch Creation**: Create new branch from any message

## Technical Requirements

### 1. Chat Input Component
**File**: `client/src/components/chat/ChatInput.tsx`

```typescript
interface ChatInputProps {
  currentNodeId?: string;      // Node to reply to
  branchId?: string;            // Current branch
  mode: 'continue' | 'branch' | 'new';
  onSendMessage: (message: ChatMessage, options: SendOptions) => void;
  onCancel?: () => void;
}

interface SendOptions {
  createBranch: boolean;
  linkToCode?: string[];
  metadata?: Record<string, any>;
}
```

**Features**:
- Multi-line text input (textarea with auto-expand)
- Markdown preview toggle
- "Send in current branch" button
- "Create new branch" button
- Code reference picker (@mention style)
- Character count (optional limit)
- Send on Ctrl+Enter

### 2. Message Actions Component
**File**: `client/src/components/chat/MessageActions.tsx`

```typescript
interface MessageActionsProps {
  messageId: string;
  onReply: () => void;
  onBranch: () => void;
  onLinkCode: () => void;
  onLinkMessage: (targetId: string) => void;
}
```

**Actions**:
- **Reply**: Add message to same branch, sequential
- **Branch**: Create new branch from this message
- **Link Code**: Select code file to link
- **Connect Message**: Create bidirectional link to another message

### 3. Real-time Graph Updates
**File**: `client/src/hooks/useChatGraph.ts`

```typescript
interface UseChatGraphReturn {
  graph: GraphStore;
  sendMessage: (content: string, options: SendOptions) => Promise<string>;
  createBranch: (fromMessageId: string, content: string) => Promise<string>;
  linkCode: (messageId: string, filePath: string) => void;
  linkMessages: (msg1: string, msg2: string, type: EdgeRelationType) => void;
  refreshGraph: () => Promise<void>;
}
```

**Features**:
- Optimistic UI updates (show message immediately)
- Incremental graph rendering (add nodes without reload)
- Smooth animations for new nodes/edges
- Error handling and rollback

### 4. Code Reference Picker
**File**: `client/src/components/chat/CodeReferenceSelector.tsx`

```typescript
interface CodeReferenceSelectorProps {
  onSelect: (filePath: string) => void;
  availableFiles: string[];
  selectedFiles: string[];
}
```

**Features**:
- Searchable file list
- Recent files
- Project file tree
- Selected files preview

### 5. Branch Creation Dialog
**File**: `client/src/components/chat/BranchCreationDialog.tsx`

```typescript
interface BranchCreationDialogProps {
  fromMessageId: string;
  onConfirm: (branchName: string, firstMessage: string) => void;
  onCancel: () => void;
}
```

**Features**:
- Branch name input (auto-generated from message topic)
- First message for new branch
- Preview branch point in graph
- Cancel/Create buttons

## Implementation Steps

### Step 1: Create ChatInput Component (4 hours)
1. Create `client/src/components/chat/ChatInput.tsx`
2. Implement multi-line textarea with auto-expand
3. Add markdown preview toggle
4. Add "Send" and "Create Branch" buttons
5. Implement Ctrl+Enter send
6. Add character count
7. Style component (bottom of screen or in detail panel)

### Step 2: Create useChatGraph Hook (3 hours)
1. Create `client/src/hooks/useChatGraph.ts`
2. Implement `sendMessage()` function
3. Implement `createBranch()` function
4. Add optimistic UI updates
5. Add error handling and rollback
6. Test with EnhancedConversationGraph

### Step 3: Real-time Graph Updates (4 hours)
1. Modify `HtmlGraphGenerator.ts` for incremental updates
2. Add `addNodeToGraph()` function (no reload)
3. Add `addEdgeToGraph()` function
4. Implement smooth animations (D3 transitions)
5. Test adding 10+ messages without performance issues

### Step 4: Create MessageActions Component (3 hours)
1. Create `client/src/components/chat/MessageActions.tsx`
2. Add "Reply" button → Opens ChatInput in reply mode
3. Add "Branch" button → Opens BranchCreationDialog
4. Add "Link Code" button → Opens CodeReferenceSelector
5. Style actions (icon buttons in detail panel)

### Step 5: Create CodeReferenceSelector (3 hours)
1. Create `client/src/components/chat/CodeReferenceSelector.tsx`
2. Implement file search (filter by name)
3. Show project file tree
4. Add "Recent files" section
5. Allow multiple file selection
6. Test with sample React app files

### Step 6: Create BranchCreationDialog (2 hours)
1. Create `client/src/components/chat/BranchCreationDialog.tsx`
2. Auto-generate branch name from message content
3. Preview branch point on graph
4. Implement confirm/cancel actions
5. Style modal dialog

### Step 7: Integration & Testing (3 hours)
1. Wire ChatInput to graph
2. Test send message → graph updates
3. Test create branch → new branch visible
4. Test link code → edge appears
5. Test reply action → ChatInput opens
6. Verify smooth animations
7. Test error scenarios (network failure, invalid input)

## Acceptance Criteria
- [ ] Users can type and send messages via ChatInput
- [ ] Graph updates in real-time (<500ms) after sending
- [ ] "Reply" adds message to same branch sequentially
- [ ] "Branch" creates new branch with custom name
- [ ] Code reference picker shows all project files
- [ ] Selected code files link to message bidirectionally
- [ ] Markdown preview works correctly
- [ ] Ctrl+Enter sends message
- [ ] Error messages shown if send fails
- [ ] Optimistic updates work (message shows immediately)
- [ ] Graph animations smooth (no flicker)

## Dependencies
- React 18+ (already in project)
- react-markdown (for markdown preview)
- D3.js (already in project for graph updates)
- EnhancedConversationGraph (Task 010 - completed)

## Testing
1. **Unit Tests**: Test sendMessage, createBranch, linkCode methods
2. **Component Tests**: Test ChatInput, MessageActions, CodeReferenceSelector
3. **Integration Tests**: Test message send → graph update flow
4. **E2E Tests**: Add Playwright test for:
   - User sends message
   - User creates branch
   - User links code
   - Graph updates correctly

## Estimated Time
**Total**: 22 hours (3 days)
- ChatInput: 4 hours
- useChatGraph hook: 3 hours
- Real-time updates: 4 hours
- MessageActions: 3 hours
- CodeReferenceSelector: 3 hours
- BranchCreationDialog: 2 hours
- Integration & Testing: 3 hours

## Success Metrics
- Message sent and graph updated in <1 second
- Users can send 10+ messages without performance degradation
- Branch creation takes <3 clicks
- Code linking takes <5 clicks
- 0 message send failures (with retry logic)

## Next Steps
After completion, proceed to:
- **Task 013**: Graph Chat Phase 3 - Branch Management
- Visual branch indicators (colors, labels)
- Branch selector UI
- Branch comparison view

## References
- `GRAPH-CHAT-IMPROVEMENTS.md` - Full improvement plan
- `Task 011` - Message display (prerequisite)
- `src/core/graph-engine/chat/EnhancedConversationGraph.ts` - Core graph logic
- `scripts/demo/graph-chat.ts` - Demo with branching

## Notes
- Consider WebSocket for multi-user collaboration (future)
- Add message edit/delete (future)
- Add message reactions/likes (future)
- Consider voice input (future)
- Add attachment support (images, files) (future)