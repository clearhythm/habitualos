# Phase 4: Goals

## Context

This phase adds Goals as an optional tier between Projects and Actions. Goals allow users to group related actions within a project and track progress toward specific objectives.

**Prerequisites:** Phases 1-3 must be complete.

## Current State

After Phase 3:
- Projects contain actions (directly or via agents)
- Actions have notes and time tracking
- No intermediate grouping layer exists
- Project success_criteria is plain text (not measurable)

## Hierarchy After This Phase

```
Project
├── Goal (optional)
│   └── Actions (goalId set)
└── Actions (projectId set directly, no goalId)
```

## Requirements

### Data Model

Create `work-goals` collection with schema:

```javascript
{
  id: "goal-{uuid}",         // Prefix: "goal"
  _userId: string,           // User ownership
  projectId: string,         // Parent project ID (required)
  title: string,             // Goal title
  description: string | null, // Optional description
  state: string,             // "active" | "completed" | "archived"
  _createdAt: Timestamp,
  _updatedAt: Timestamp
}
```

### Action Model Update

Add `goalId` field to actions:

```javascript
{
  // ... existing fields ...
  projectId: string | null,   // Direct project assignment
  goalId: string | null,      // Goal assignment (optional)
  // ... rest of fields ...
}
```

An action can have:
- `projectId` only (belongs to project directly)
- `goalId` + `projectId` (belongs to goal within project)
- Neither (belongs via agent's project assignment - existing behavior)

When setting `goalId`, should auto-set `projectId` to the goal's project.

### Service Layer

Create `netlify/functions/_services/db-goals.cjs`:

```javascript
// Functions to implement:
createGoal(id, data)                    // Create goal
getGoalsByProject(projectId, userId)    // List goals in a project
getGoal(goalId)                         // Get single goal
updateGoal(goalId, updates)             // Update goal fields
getGoalActions(goalId, userId)          // Get actions for a goal
getGoalProgress(goalId, userId)         // { total, completed, percentage }
```

### Endpoints

1. **POST /api/goal-create**
   - Request: `{ userId, projectId, title, description? }`
   - Response: `{ success: true, goal: { id, ... } }`

2. **POST /api/goal-update**
   - Request: `{ userId, goalId, title?, description?, state? }`
   - Response: `{ success: true }`

3. **GET /api/goal/:id?userId=xxx**
   - Response: `{ success, goal, actions, progress: { total, completed, percentage } }`

4. **GET /api/goals-list?userId=xxx&projectId=xxx**
   - Response: `{ success, goals: [...] }`

5. **Update action-define.js**
   - Accept `goalId` parameter
   - When `goalId` provided, look up goal to get `projectId`

6. **Update action-update.js**
   - Allow setting/changing `goalId`

### Goal Detail Page

Create `/do/goal/?id=xxx` page showing:

1. **Header**
   - Title (editable)
   - Description (editable)
   - State badge
   - Parent project link

2. **Progress Section**
   - Progress bar: X of Y actions completed
   - Percentage display

3. **Actions Section**
   - List of actions belonging to this goal
   - Filter tabs: Open | Completed | All
   - Add action button (pre-fills goalId)

4. **Action Buttons**
   - Complete Goal (mark as completed)
   - Archive Goal
   - Delete Goal (if no actions, or confirm cascade)

### Project Page Updates

Modify project detail page to show:

1. **Goals Section**
   - List of goals with progress indicators
   - Link to goal detail page
   - Add goal button

2. **Ungrouped Actions Section**
   - Actions with projectId but no goalId
   - Label: "Actions not in a goal" or similar

### Action Detail Page Updates

- Show goal name with link (if goalId set)
- Add "Move to Goal" dropdown to assign/reassign goalId

### Files to Create

1. `netlify/functions/_services/db-goals.cjs` - Service layer
2. `netlify/functions/goal-create.js` - Create endpoint
3. `netlify/functions/goal-update.js` - Update endpoint
4. `netlify/functions/goal-get.js` - Get with actions and progress
5. `netlify/functions/goals-list.js` - List for project
6. `src/do/goal.njk` - Goal detail page template
7. `src/assets/js/pages/goal-detail.js` - Goal page logic

### Files to Modify

1. `netlify/functions/_services/db-actions.cjs` - Document goalId in schema
2. `netlify/functions/action-define.js` - Accept goalId
3. `netlify/functions/action-update.js` - Allow goalId updates
4. `netlify/functions/action-get.js` - Include goal data in response (optional)
5. `src/assets/js/pages/action-detail.js` - Show goal link, goal selector
6. Project detail page - Add goals section
7. `docs/endpoints/action-define.md` - Document goalId parameter

## Progress Calculation

```javascript
async function getGoalProgress(goalId, userId) {
  const actions = await getGoalActions(goalId, userId);
  const total = actions.length;
  const completed = actions.filter(a => a.state === 'completed').length;
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
  return { total, completed, percentage };
}
```

## Migration Consideration

Existing actions have no `goalId`. This is fine - they remain as "ungrouped" actions under their project. No migration needed.

## Verification

1. **Create Goal**
   - Create a goal under a project
   - Verify it appears in Firestore `work-goals`
   - Verify it shows on project page

2. **Goal Detail Page**
   - Navigate to goal detail page
   - Verify progress shows 0 of 0

3. **Add Action to Goal**
   - Create action with goalId set
   - Verify it appears on goal detail page
   - Verify progress updates to 1 of 1 (0%)

4. **Complete Action in Goal**
   - Complete the action
   - Verify goal progress shows 1 of 1 (100%)

5. **Move Action Between Goals**
   - Change action's goalId
   - Verify it moves between goal pages
   - Verify both goals' progress updates

6. **Ungrouped Actions**
   - Create action with projectId only (no goalId)
   - Verify it shows in "ungrouped" section on project page
   - Verify it does not appear in any goal

7. **Complete Goal**
   - Mark goal as completed
   - Verify state change persists
   - Verify display updates on project page
