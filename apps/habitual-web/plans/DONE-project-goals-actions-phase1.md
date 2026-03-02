# Phase 1: Action Detail Pages & Collection Rename

## Context

HabitualOS is a personal agentic system built on Netlify serverless functions, 11ty static site generator, and Google Firestore. We are building out a hierarchical task system:

- **Projects** (long-term, ongoing or end-date)
- **Goals** (optional tier within projects - Phase 4)
- **Actions** (atomic work items completable in ≤1 day)

This phase:
1. Renames Firestore collections to use `work-` prefix for organization
2. Creates dedicated action detail pages (replacing the modal-only approach)

## Current State

### Collections
- `projects` collection (to become `work-projects`)
- `actions` collection (to become `work-actions`)

### Services (use old collection names)
- `netlify/functions/_services/db-projects.cjs` - uses `collection: 'projects'`
- `netlify/functions/_services/db-actions.cjs` - uses `collection: 'actions'`

### Action Display
- List view at `src/do/actions.njk` with tabs (Open/Completed)
- Detail view is modal-only via `src/assets/js/components/action-modal.js`
- Modal shows: title, description, agent, date, content/taskConfig, and action buttons

### Action Get Endpoint
- `GET /api/action/:id?userId=u-xxx` returns action + chat + artifacts
- Located at `netlify/functions/action-get.js`

## Requirements

### Part A: Rename Collections

Update all service files to use new collection names:

| Old Name | New Name |
|----------|----------|
| `projects` | `work-projects` |
| `actions` | `work-actions` |

Files to update:
- `netlify/functions/_services/db-projects.cjs` - change `'projects'` → `'work-projects'`
- `netlify/functions/_services/db-actions.cjs` - change `'actions'` → `'work-actions'`

**Note:** This will create new empty collections. Existing data in old collections will need manual migration or will start fresh.

### Part B: Action Detail Page

Create a dedicated page at `/do/action/?id=xxx` that displays:

1. **Header Section**
   - Title (editable inline or via edit button)
   - Description (editable)
   - State badge (open, in_progress, completed, dismissed)
   - Priority badge (high, medium, low)
   - Due date (if set)

2. **Parent Section**
   - Show project name with link (if projectId set)
   - Show agent name with link (if agentId set)
   - (Goal link will be added in Phase 4)

3. **Content Section**
   - For manual actions: show `content` field with copy button
   - For scheduled/interactive: show `taskConfig.instructions` and `taskConfig.expectedOutput`

4. **Notes Section** (placeholder for Phase 2)
   - Show "Notes coming soon" or empty state
   - Will be populated in Phase 2

5. **Time Entries Section** (placeholder for Phase 3)
   - Show "Time tracking coming soon" or empty state
   - Show total duration from completion if exists
   - Will be populated in Phase 3

6. **Chat History Section**
   - Display chat messages from `action-chats` collection
   - Messages already returned by `/api/action/:id`
   - Simple chronological list (user/assistant messages)

7. **Artifacts Section**
   - Display artifacts from `action-artifacts` collection
   - Artifacts already returned by `/api/action/:id`
   - Show title, type badge, and content preview

8. **Action Buttons**
   - Complete (with duration input) - if not completed/dismissed
   - Delete/Dismiss - if not completed/dismissed
   - Chat (navigate to agent chat or EA)
   - Edit (open edit mode for title/description/priority/due date)

### Files to Create

1. `src/do/action.njk` - 11ty template for action detail page
   - Query param: `id` (action ID)
   - Fetch action data client-side using existing `/api/action/:id` endpoint
   - Use similar layout patterns as existing pages

2. `src/assets/js/pages/action-detail.js` - Page logic
   - Fetch action + chat + artifacts on load
   - Handle complete, dismiss, edit actions
   - Render all sections

### Files to Modify

1. `src/do/actions.njk`
   - Change action list items to link to `/do/action/?id=xxx` instead of opening modal
   - Keep modal available for quick actions if desired (optional)

2. `netlify/functions/_services/db-projects.cjs`
   - Replace `'projects'` with `'work-projects'`

3. `netlify/functions/_services/db-actions.cjs`
   - Replace `'actions'` with `'work-actions'`

## Implementation Notes

### URL Pattern
Use query parameter style: `/do/action/?id=action-xxx`
This matches existing patterns like `/do/agent/?id=agent-xxx`

### Data Loading
The existing `/api/action/:id` endpoint already returns:
```javascript
{
  success: true,
  action: { ... },
  chat: [ ... ],
  artifacts: [ ... ]
}
```
No backend changes needed for basic detail page.

### Project Lookup
To show project name, you'll need to fetch projects. Options:
- Add project data to action-get response (requires backend change)
- Fetch projects separately on client (simpler, uses existing endpoint)

Recommend: Fetch projects separately to avoid backend changes in Phase 1.

### Styling
Follow existing patterns from:
- Agent detail page: `src/do/agent.njk`
- Action modal: `src/assets/js/components/action-modal.js`

Use inline styles or existing CSS classes for consistency.

## Verification

1. **Collection Rename**
   - Create a new action via UI
   - Verify in Firestore console that document appears in `work-actions` (not `actions`)
   - Create a new project
   - Verify in Firestore console that document appears in `work-projects`

2. **Action Detail Page**
   - Navigate from action list to detail page
   - Verify URL is `/do/action/?id=xxx`
   - Verify all sections display correctly
   - Test Complete button (with and without duration)
   - Test Dismiss button
   - Test Chat navigation (to agent or EA)
   - Verify back navigation works

3. **Edge Cases**
   - Action with no project (projectId null)
   - Action with no agent (agentId null)
   - Action with content (manual type)
   - Action with taskConfig (scheduled type)
   - Completed action (action buttons hidden)
   - Dismissed action (action buttons hidden)
