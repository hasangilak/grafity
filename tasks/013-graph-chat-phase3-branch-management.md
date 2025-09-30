# Task 013: Graph Chat Phase 3 - Branch Management & Visualization

## Status: 🔴 Not Started

## Priority: MEDIUM

## Description
Enhance branch visualization and management to make conversation branches easily distinguishable, navigable, and comparable. Add visual indicators, branch selector UI, and branch comparison tools.

## Context
Phase 1 added message display, Phase 2 added interactive input. Now we need to make branches visually clear:
- Branches exist but aren't visually distinguished
- Can't tell which messages belong to which branch
- No UI to switch between branches
- Can't compare different branch outcomes

## Goals
1. **Visual Branch Indicators**: Color-code branches, add labels
2. **Branch Selector**: UI to view and switch branches
3. **Branch Comparison**: Side-by-side comparison of branches
4. **Branch Operations**: Merge, archive, rename branches

## Technical Requirements

### 1. Branch Style System
**File**: `src/core/graph-engine/chat/BranchStyleManager.ts`

```typescript
interface BranchStyle {
  id: string;
  name: string;
  color: string;           // Unique color (from palette)
  pattern: 'solid' | 'dashed' | 'dotted';
  icon: string;            // Unicode icon or emoji
  createdAt: Date;
  createdFrom: string;     // Parent message ID
  isActive: boolean;
}

class BranchStyleManager {
  assignColor(branchId: string): string;
  getColorPalette(): string[];  // 10+ distinct colors
  getBranchStyle(branchId: string): BranchStyle;
  highlightActivePath(branchId: string): void;
}
```

### 2. Enhanced Visualization
**File**: `src/core/graph-engine/visualization/HtmlGraphGenerator.ts`

Modify to include:
- Node colors based on branch
- Branch labels next to nodes
- Active path highlighting (thicker edges)
- Branch boundary visualization
- Legend showing branch colors

### 3. Branch Selector Component
**File**: `client/src/components/chat/BranchSelector.tsx`

```typescript
interface BranchSelectorProps {
  branches: ConversationBranch[];
  activeBranchId: string;
  onSwitchBranch: (branchId: string) => void;
  onRenameBranch: (branchId: string, newName: string) => void;
  onMergeBranches: (sourceId: string, targetId: string) => void;
  onArchiveBranch: (branchId: string) => void;
}

interface BranchListItem {
  id: string;
  name: string;
  messageCount: number;
  branchPoint: string;      // Where it diverged
  lastUpdated: Date;
  isActive: boolean;
  color: string;
}
```

**Features**:
- Dropdown list of all branches
- Show message count per branch
- Show branch point (divergence message)
- Show last updated timestamp
- Color indicator next to each branch
- Quick switch action
- Branch actions menu (rename, merge, archive)

### 4. Branch Comparison View
**File**: `client/src/components/chat/BranchComparison.tsx`

```typescript
interface BranchComparisonProps {
  branch1: ConversationBranch;
  branch2: ConversationBranch;
  onClose: () => void;
  onMerge?: (strategy: MergeStrategy) => void;
}

interface BranchDiff {
  divergencePoint: ConversationNode;
  branch1Messages: ConversationNode[];
  branch2Messages: ConversationNode[];
  sharedMessages: ConversationNode[];
  differences: {
    messageId: string;
    type: 'added' | 'modified' | 'removed';
    content: string;
  }[];
}
```

**Features**:
- Side-by-side message display
- Highlight divergence point
- Show unique messages per branch
- Show shared messages
- Visual diff of message content
- Merge suggestions
- Merge actions (keep both, prefer branch 1, prefer branch 2)

### 5. Branch Operations
**File**: `src/core/graph-engine/chat/BranchOperations.ts`

```typescript
class BranchOperations {
  mergeBranches(
    source: string,
    target: string,
    strategy: 'keep-both' | 'prefer-source' | 'prefer-target'
  ): Promise<string>;

  renameBranch(branchId: string, newName: string): void;
  archiveBranch(branchId: string): void;
  restoreBranch(branchId: string): void;
  deleteBranch(branchId: string): void;  // Permanent
}
```

## Implementation Steps

### Step 1: Create BranchStyleManager (3 hours)
1. Create `src/core/graph-engine/chat/BranchStyleManager.ts`
2. Define color palette (10+ distinct colors)
3. Implement `assignColor()` method (round-robin assignment)
4. Implement `getBranchStyle()` method
5. Test with 5+ branches (ensure distinct colors)

### Step 2: Enhance Graph Visualization (4 hours)
1. Modify `HtmlGraphGenerator.ts`
2. Color nodes based on branch ID
3. Add branch labels to nodes (small text)
4. Highlight active path (thicker edges, brighter colors)
5. Add branch boundary lines (subtle visual separator)
6. Update legend to show branch colors
7. Test with graph-chat demo

### Step 3: Create BranchSelector Component (4 hours)
1. Create `client/src/components/chat/BranchSelector.tsx`
2. Implement dropdown with branch list
3. Show message count, branch point, timestamp
4. Add color indicator circles
5. Implement switch branch action
6. Add branch actions menu (3-dot icon)
7. Style component (top toolbar, 300px dropdown)

### Step 4: Create BranchComparison Component (5 hours)
1. Create `client/src/components/chat/BranchComparison.tsx`
2. Implement side-by-side layout
3. Calculate branch differences
4. Highlight divergence point
5. Show message diff (added/removed/modified)
6. Add merge suggestions
7. Style component (modal, full-screen or large panel)

### Step 5: Implement Branch Operations (4 hours)
1. Create `src/core/graph-engine/chat/BranchOperations.ts`
2. Implement `mergeBranches()` method
   - Keep-both strategy: Add all messages from both branches
   - Prefer-source: Use source messages when conflict
   - Prefer-target: Use target messages when conflict
3. Implement `renameBranch()` method
4. Implement `archiveBranch()` method
5. Add undo functionality (optional)
6. Test merge scenarios

### Step 6: Integration & Testing (3 hours)
1. Wire BranchSelector to graph
2. Test branch switching → graph updates colors
3. Test branch comparison → diff shown correctly
4. Test merge branches → graph merges successfully
5. Test rename branch → name updates everywhere
6. Verify color consistency across all views

## Acceptance Criteria
- [ ] Each branch has distinct color (from palette)
- [ ] Nodes show branch colors and labels
- [ ] Active path highlighted with thicker edges
- [ ] Branch selector dropdown lists all branches
- [ ] Switching branches updates graph colors immediately
- [ ] Branch comparison shows divergence point
- [ ] Message diff highlights added/removed messages
- [ ] Merge branches combines messages correctly
- [ ] Rename branch updates name in all views
- [ ] Archive branch hides it from main view (recoverable)
- [ ] Legend shows all active branch colors

## Dependencies
- D3.js (already in project for visualization)
- React 18+ (already in project)
- EnhancedConversationGraph (Task 010 - completed)
- ChatInput (Task 012 - prerequisite)

## Testing
1. **Unit Tests**: Test BranchStyleManager, BranchOperations
2. **Component Tests**: Test BranchSelector, BranchComparison
3. **Integration Tests**: Test branch switch → graph update
4. **Visual Tests**: Verify colors are distinct and accessible
5. **E2E Tests**: Add Playwright test for:
   - Create 3 branches
   - Switch between branches
   - Compare 2 branches
   - Merge branches

## Estimated Time
**Total**: 23 hours (3 days)
- BranchStyleManager: 3 hours
- Enhanced visualization: 4 hours
- BranchSelector: 4 hours
- BranchComparison: 5 hours
- BranchOperations: 4 hours
- Integration & Testing: 3 hours

## Success Metrics
- Users can identify branch in <2 seconds (color + label)
- Branch switch completes in <500ms
- Branch comparison loads in <1 second
- 90%+ users understand which message belongs to which branch
- Merge operation completes in <2 seconds

## Next Steps
After completion, proceed to:
- **Task 014**: Graph Chat Phase 4 - Advanced Context
- Semantic search across conversations
- Multi-file code context
- Related conversations suggestions

## References
- `GRAPH-CHAT-IMPROVEMENTS.md` - Full improvement plan
- `Task 011` - Message display (prerequisite)
- `Task 012` - Interactive input (prerequisite)
- `src/core/graph-engine/chat/EnhancedConversationGraph.ts` - Branch logic

## Color Palette Recommendations
```typescript
const BRANCH_COLORS = [
  '#9C27B0',  // Purple (main)
  '#2196F3',  // Blue
  '#4CAF50',  // Green
  '#FF9800',  // Orange
  '#F44336',  // Red
  '#00BCD4',  // Cyan
  '#FFEB3B',  // Yellow
  '#795548',  // Brown
  '#607D8B',  // Blue Grey
  '#E91E63',  // Pink
];
```

## Notes
- Ensure color contrast meets WCAG AA standards
- Support colorblind modes (patterns + colors)
- Add keyboard shortcuts for branch switching (Ctrl+1-9)
- Consider branch templates (exploration, debugging, feature)
- Add branch description field (optional metadata)