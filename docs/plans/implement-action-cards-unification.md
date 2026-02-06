# Action Cards & Modals Unification Plan

## Overview
Unify action cards and modals across `/do/` dashboard and `/do/agent/?id={}#actions` with consistent design, sorting, and functionality.

## Key Design Decisions
- **assignedTo field**: Add to schema, default `'user'` (blue), `'agent'` for autonomous work (purple)
- **Default filter**: 'Open' (hide completed), dropdown for 'All', 'Open', 'Completed'
- **Sorting**: Blue items first (newest first), then purple items (newest first)
- **Priority pills**: Remove from display (keep in DB)
- **Icons**: measurement=📊, manual/document=📄, interactive/chat=💬

---

## Phase 1: Schema Update

### 1.1 Add `assignedTo` field to action schema

**File:** `netlify/functions/_services/db-actions.cjs`

Add to schema documentation:
```javascript
assignedTo: "user",  // "user" (blue bar) or "agent" (purple bar)
```

**File:** `netlify/functions/action-define.js`

When creating action, set `assignedTo: 'user'` by default.

---

## Phase 2: Unified Action Card Component

### 2.1 Update `/assets/js/components/action-card.js`

**New card structure:**
```
┌─────────────────────────────────┐
│▌ 📊 Action Title                │  ← colored left bar (blue/purple) + icon + title
│▌ Action description text...     │  ← description (truncated)
│▌ Jan 15, 2026                   │  ← creation date (small, gray)
└─────────────────────────────────┘
```

**Changes:**
- Add colored left border: blue (`#3b82f6`) for `assignedTo: 'user'`, purple (`#8b5cf6`) for `assignedTo: 'agent'`
- Update icon logic:
  - `taskType === 'measurement'` → 📊 (survey)
  - `taskType === 'manual'` → 📄 (document)
  - `taskType === 'interactive'` → 💬 (chat)
  - default → 📥
- Remove priority badge from card display
- Remove state badge from card display
- Keep: title, description (truncated ~100 chars), creation date

**Function signature remains:** `createActionCard(action, onClick)`

---

## Phase 3: Dashboard Updates (`/scripts/dashboard.js`)

### 3.1 Update grid to 3-columns on desktop

**File:** `src/do/index.njk`

Add CSS (similar to agent.njk fix):
```css
#actions-grid {
  grid-template-columns: 1fr;
}
@media (min-width: 768px) {
  #actions-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}
```

### 3.2 Update filter dropdown

Replace current "Show Completed" toggle with dropdown:
- Options: 'Open' (default), 'All', 'Completed'
- Update `displayActions()` to filter based on selection

### 3.3 Update sorting

New sort logic in `displayActions()`:
1. Filter by dropdown selection
2. Separate into blue (`assignedTo !== 'agent'`) and purple (`assignedTo === 'agent'`)
3. Sort each group by `_createdAt` descending (newest first)
4. Concatenate: blue first, then purple

---

## Phase 4: Agent Page Updates (`/scripts/agent.js`)

### 4.1 Update filter dropdown options

Change from: 'All', 'Scheduled', 'Active', 'Completed'
To: 'Open' (default), 'All', 'Completed'

### 4.2 Update sorting

Same logic as dashboard:
1. Filter by dropdown selection
2. Blue items first (newest first)
3. Purple items second (newest first)

### 4.3 Use shared action-card component

Replace inline card rendering (lines 615-668) with `createActionCard()` from component.

---

## Phase 5: Unified Action Modal Component

### 5.1 Update `/assets/js/components/action-modal.js`

**New modal structure:**
```
┌─────────────────────────────────────────┐
│ Action Title                         ✕  │
│ Action description/subtitle             │
│ Jan 15, 2026                            │  ← small gray date
├─────────────────────────────────────────┤
│ Content                           📄    │  ← section title + type badge
│ ┌─────────────────────────────────────┐ │
│ │ Scrollable content area...          │ │
│ │                                     │ │
│ └─────────────────────────────────────┘ │
├─────────────────────────────────────────┤
│ [📋 Copy]  [💬 Chat]  [✓ Complete]      │  ← action buttons
├─────────────────────────────────────────┤
│ [measurement] [manual]                  │  ← small meta pills
└─────────────────────────────────────────┘
```

**Button logic:**
- **Copy**: Show for actions with `content` field
- **Chat**: Always show - navigates to `/do/agent/?id={agentId}#chat` with action context in sessionStorage
- **Complete**: Show if `state !== 'completed' && state !== 'dismissed'`

**Meta pills**: Smaller size, show taskType and any other relevant meta

---

## Phase 6: Chat Button Navigation

### 6.1 Implement chat navigation from modal

When "Chat" button clicked:
1. Store action context in sessionStorage (similar to measurement flow)
2. Navigate to `/do/agent/?id={agentId}#chat`
3. Agent page detects context and can reference the action

**SessionStorage key:** `actionChatContext`
```javascript
{
  actionId: 'action-xxx',
  title: 'Action title',
  description: 'Action description',
  taskType: 'manual',
  content: '...'  // if applicable
}
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `netlify/functions/_services/db-actions.cjs` | Add `assignedTo` to schema docs |
| `netlify/functions/action-define.js` | Set `assignedTo: 'user'` default |
| `src/assets/js/components/action-card.js` | New card design with colored bar, new icons, remove priority |
| `src/assets/js/components/action-modal.js` | New modal layout, add Chat button |
| `src/scripts/dashboard.js` | 3-col grid, new filter dropdown, new sorting |
| `src/scripts/agent.js` | Use shared card component, new filter/sort |
| `src/do/index.njk` | CSS for 3-col grid, filter dropdown HTML |
| `src/do/agent.njk` | Update filter dropdown options |

---

## Verification

1. **Dashboard (`/do/`):**
   - Actions display in 3-column grid on desktop
   - Filter dropdown shows 'Open', 'All', 'Completed' (default: Open)
   - Cards have colored left bar (blue for now, all user work)
   - Cards show icon, title, description, date (no priority pills)
   - Click opens modal with new layout
   - Modal has Copy, Chat, Complete buttons as appropriate

2. **Agent page (`/do/agent/?id={}#actions`):**
   - Same 3-column grid
   - Same filter dropdown and sorting
   - Same card design
   - Same modal behavior

3. **Chat navigation:**
   - Click Chat in modal → navigates to agent chat with context stored

---

## Implementation Details

### Action Card Component (`action-card.js`)

```javascript
// Icon mapping
function getActionIcon(taskType) {
  const icons = {
    measurement: '📊',
    manual: '📄',
    interactive: '💬',
  };
  return icons[taskType] || '📥';
}

// Color based on assignedTo
function getAssignedToColor(assignedTo) {
  return assignedTo === 'agent' ? '#8b5cf6' : '#3b82f6';
}

// Card HTML structure
card.innerHTML = `
  <div style="position: absolute; left: 0; top: 0; bottom: 0; width: 4px;
              background: ${barColor}; border-radius: 12px 0 0 12px;"></div>
  <div style="display: flex; align-items: flex-start; gap: 0.5rem; margin-bottom: 0.5rem;">
    <span style="font-size: 1.25rem;">${icon}</span>
    <h3 style="margin: 0; font-size: 1rem; font-weight: 600;">${escapeHtml(title)}</h3>
  </div>
  <p style="margin: 0 0 0.5rem; font-size: 0.875rem; color: #6b7280;">${truncatedDesc}</p>
  <span style="font-size: 0.75rem; color: #9ca3af;">Created ${date}</span>
`;
```

### Filter/Sort Logic (shared by both views)

```javascript
function filterActions(actions, filter) {
  switch (filter) {
    case 'open':
      return actions.filter(a => a.state !== 'completed' && a.state !== 'dismissed');
    case 'completed':
      return actions.filter(a => a.state === 'completed' || a.state === 'dismissed');
    default:
      return actions;
  }
}

function sortActions(actions) {
  return actions.sort((a, b) => {
    const aIsAgent = (a.assignedTo || 'user') === 'agent';
    const bIsAgent = (b.assignedTo || 'user') === 'agent';
    if (!aIsAgent && bIsAgent) return -1;
    if (aIsAgent && !bIsAgent) return 1;
    return new Date(b._createdAt) - new Date(a._createdAt);
  });
}
```

### Modal Chat Navigation

```javascript
function navigateToChat(actionId) {
  sessionStorage.setItem('actionChatContext', JSON.stringify({
    actionId: currentAction.id,
    title: currentAction.title,
    description: currentAction.description,
    taskType: currentAction.taskType,
    taskConfig: currentAction.taskConfig
  }));
  hideActionModal();
  window.location.href = `/do/agent/?id=${currentAction.agentId}#chat`;
}
```

### Backend Change (`action-define.js`)

Add to actionData object:
```javascript
assignedTo: 'user',  // default to user assignment
```

---

## Edge Cases

1. **Existing actions**: Default `assignedTo` to `'user'` if undefined
2. **Empty states**: Show helpful message when no actions match filter
3. **Completed styling**: Apply `opacity: 0.7` to completed/dismissed cards
4. **Mobile**: Consider CSS `line-clamp` instead of JS truncation
5. **Dead code**: Remove `#toggle-completed` button, old filter options

---

## Future Enhancements (not in this PR)
- Purple bar actions when autonomous agent work is implemented
- Chat button updates action from within conversation
- Automation advisor agent to suggest blue→purple conversions
