# Recurring Actions System Implementation Plan

## Overview

Replace the current completion-triggered recurrence (action-complete.js:81-118) with a template/instance pattern where a Netlify scheduled function spawns daily action instances from recurring-action templates.

## Current Problem

- Recurrence only works when user completes the action
- If user skips a day, no new instance appears the next day
- Historical data tied to individual instances, not a template

---

## 1. New Collection: `recurring-actions`

```javascript
{
  id: "recurring-{timestamp}-{random}",
  _userId: "u-xyz789",
  agentId: "agent-abc123",

  // Template definition (copied to each instance)
  title: string,
  description: string,
  priority: "high" | "medium" | "low",
  taskType: "measurement",  // Only measurement for now
  taskConfig: {
    dimensions: [...]  // Array of dimension names to measure
  },

  // Recurrence config (daily only for now)
  recurrenceType: "daily",

  // Status and tracking
  status: "active" | "paused",
  lastSpawnedDate: "2026-01-19",  // YYYY-MM-DD, audit trail

  _createdAt: Timestamp,
  _updatedAt: Timestamp
}
```

**Note:** `taskConfig` only contains `dimensions` for measurement type. The agent uses title, description, taskType and dimensions to conduct the check-in.

---

## 2. Action Schema Addition

Add one optional field to existing actions:

```javascript
{
  // ... existing fields ...
  templateId: "recurring-xyz..." | null  // Links instance to template
}
```

---

## 3. New Service Function: `getOpenActionsByTemplateId`

**File:** `netlify/functions/_services/db-actions.cjs`

Add new function to query actions by templateId:

```javascript
/**
 * Get open (non-completed, non-dismissed) actions for a recurring template
 * Used by scheduled function to check if a new instance should be spawned
 * @param {string} templateId - Recurring action template ID
 * @returns {Promise<Array>} Array of open action documents
 */
exports.getOpenActionsByTemplateId = async (templateId) => {
  const all = await dbCore.query({ collection: 'actions' });
  return all.filter(a =>
    a.templateId === templateId &&
    a.state !== 'completed' &&
    a.state !== 'dismissed'
  );
};
```

**Note:** Firestore doesn't support compound queries well, so we query all actions and filter. For a production system with many actions, we'd add a Firestore index on `templateId` + `state`.

---

## 4. Netlify Scheduled Function

**File:** `netlify/functions/spawn-recurring-actions.js`

```javascript
require('dotenv').config();
const { getActiveRecurringActions, updateRecurringAction } = require('./_services/db-recurring-actions.cjs');
const { createAction, getOpenActionsByTemplateId } = require('./_services/db-actions.cjs');
const { generateActionId } = require('./_utils/data-utils.cjs');

// Runs daily at 5:00 AM PT (1:00 PM UTC)
exports.handler = async (event) => {
  // Only run in dev environment (change to 'prod' for production)
  if (process.env.CONTEXT !== 'dev') {
    console.log('[spawn-recurring] Skipped - not dev environment');
    return { statusCode: 200, body: 'Skipped (wrong environment)' };
  }

  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  console.log(`[spawn-recurring] Starting spawn check for ${today}`);

  const templates = await getActiveRecurringActions();
  console.log(`[spawn-recurring] Found ${templates.length} active templates`);

  let spawned = 0;
  let skipped = 0;

  for (const template of templates) {
    // Check if there's an OPEN action for this template
    const openActions = await getOpenActionsByTemplateId(template.id);

    if (openActions.length > 0) {
      console.log(`[spawn-recurring] Skipping ${template.id} - ${openActions.length} open action(s) exist`);
      skipped++;
      continue;
    }

    // No open actions - spawn a new instance
    const actionId = generateActionId();
    const actionData = {
      _userId: template._userId,
      agentId: template.agentId,
      templateId: template.id,
      title: template.title,
      description: template.description,
      state: 'scheduled',
      priority: template.priority || 'medium',
      taskType: template.taskType,
      taskConfig: { ...template.taskConfig },  // Full copy preserves history
      scheduleTime: new Date().toISOString(),
      startedAt: null,
      completedAt: null,
      dismissedAt: null,
      dismissedReason: null,
      errorMessage: null,
      type: null,
      content: null
    };

    await createAction(actionId, actionData);
    await updateRecurringAction(template.id, { lastSpawnedDate: today });
    console.log(`[spawn-recurring] Created ${actionId} from template ${template.id}`);
    spawned++;
  }

  console.log(`[spawn-recurring] Complete: ${spawned} spawned, ${skipped} skipped`);
  return { statusCode: 200, body: JSON.stringify({ spawned, skipped, date: today }) };
};
```

**Timeout note:** Netlify scheduled functions have 30s timeout. Each template requires 1-2 Firestore queries - should complete well within limit for reasonable template counts.

**netlify.toml addition:**
```toml
# Scheduled function: spawns recurring action instances
# Cron format: minute hour day month day-of-week
# "0 13 * * *" = every day at 13:00 UTC (5:00 AM Pacific)
[functions."spawn-recurring-actions"]
  schedule = "0 13 * * *"
```

---

## 5. Service Layer: `db-recurring-actions.cjs`

**File:** `netlify/functions/_services/db-recurring-actions.cjs`

```javascript
//
// netlify/functions/_services/db-recurring-actions.cjs
// ------------------------------------------------------
// DATA ACCESS LAYER (Recurring Actions) for Firestore.
// Manages recurring action templates that spawn daily instances.
// ------------------------------------------------------

const dbCore = require('./db-core.cjs');

exports.createRecurringAction = async (id, data) => {
  const formattedId = id?.startsWith('recurring-') ? id : `recurring-${id}`;
  const recurringData = {
    ...data,
    recurrenceType: 'daily',
    status: data.status || 'active',
    lastSpawnedDate: null
  };
  await dbCore.create({ collection: 'recurring-actions', id: formattedId, data: recurringData });
  return { id: formattedId };
};

exports.getRecurringAction = async (id) => {
  return await dbCore.get({ collection: 'recurring-actions', id });
};

exports.getRecurringActionsByUserId = async (userId) => {
  return await dbCore.query({
    collection: 'recurring-actions',
    where: `_userId::eq::${userId}`
  });
};

exports.getActiveRecurringActions = async () => {
  const all = await dbCore.query({ collection: 'recurring-actions' });
  return all.filter(r => r.status === 'active');
};

exports.updateRecurringAction = async (id, updates) => {
  return await dbCore.patch({ collection: 'recurring-actions', id, data: updates });
};

exports.pauseRecurringAction = async (id) => {
  return exports.updateRecurringAction(id, { status: 'paused' });
};

exports.resumeRecurringAction = async (id) => {
  return exports.updateRecurringAction(id, { status: 'active' });
};
```

---

## 6. ID Generator

**File:** `netlify/functions/_utils/data-utils.cjs`

Add function and export:
```javascript
function generateRecurringActionId() {
  return uniqueId('recurring');
}

module.exports = {
  // ... existing exports ...
  generateRecurringActionId
};
```

---

## 7. Agent Integration: `create_recurring_action` Tool

**File:** `netlify/functions/agent-chat.js`

Add import at top:
```javascript
const { createRecurringAction } = require('./_services/db-recurring-actions.cjs');
const { generateRecurringActionId } = require('./_utils/data-utils.cjs');
```

Add to `handleToolCall` function:
```javascript
if (name === 'create_recurring_action') {
  const { title, description, priority, taskConfig } = input;

  if (!title) return { error: 'Title is required' };

  const recurringId = generateRecurringActionId();
  await createRecurringAction(recurringId, {
    _userId: userId,
    agentId: agentId,
    title,
    description: description || '',
    priority: priority || 'medium',
    taskType: 'measurement',
    taskConfig: taskConfig || { dimensions: [] }
  });

  return {
    success: true,
    message: `Created recurring action "${title}" - will spawn daily when no open instance exists`,
    recurringActionId: recurringId
  };
}
```

Add to `tools` array:
```javascript
{
  name: "create_recurring_action",
  description: "Create a recurring measurement action that spawns a new instance every day (if no open instance exists). Use for daily check-ins.",
  input_schema: {
    type: "object",
    properties: {
      title: { type: "string", description: "Title for the recurring action" },
      description: { type: "string", description: "Description of the check-in" },
      priority: { type: "string", enum: ["low", "medium", "high"] },
      taskConfig: {
        type: "object",
        properties: {
          dimensions: { type: "array", items: { type: "string" }, description: "Dimensions to measure (e.g., energy, focus)" }
        }
      }
    },
    required: ["title"]
  }
}
```

Add to system prompt AVAILABLE TOOLS section:
```
4. create_recurring_action(title, description, priority, taskConfig)
   - Create a daily recurring measurement action
   - Spawns new instance each morning if no open instance exists
   - taskConfig.dimensions: array of dimensions to measure
```

---

## 8. Remove Old Recurrence Logic

**File:** `netlify/functions/action-complete.js`

Delete lines 81-118 (the entire recurrence block):
```javascript
// DELETE THIS ENTIRE BLOCK:
// Check for recurrence configuration and create next instance
if (action.taskConfig?.recurrence?.type === 'daily') {
  // ... all the way to line 118
}
```

---

## 9. Update Documentation

**File:** `docs/features/scheduled-tasks.md`

Update to reflect new architecture:
- Remove references to node-cron local scheduler
- Document the recurring-actions collection schema
- Explain the Netlify scheduled function approach
- Document the spawn logic (only spawns if no open instance)
- Note that recurrence is now managed via templates, not per-action config

---

## Files Summary

### Create
| File | Purpose |
|------|---------|
| `netlify/functions/_services/db-recurring-actions.cjs` | Service layer for recurring templates |
| `netlify/functions/spawn-recurring-actions.js` | Netlify scheduled function |

### Modify
| File | Change |
|------|--------|
| `netlify/functions/_services/db-actions.cjs` | Add `getOpenActionsByTemplateId` function |
| `netlify/functions/_utils/data-utils.cjs` | Add `generateRecurringActionId` |
| `netlify/functions/agent-chat.js` | Add `create_recurring_action` tool + handler + imports |
| `netlify/functions/action-complete.js` | Remove lines 81-118 |
| `netlify.toml` | Add schedule config |
| `docs/features/scheduled-tasks.md` | Update to reflect new architecture |

---

## Verification

1. **Service layer:** Create recurring-action via service, verify Firestore document
2. **getOpenActionsByTemplateId:** Create action with templateId, verify function returns it
3. **Spawn logic - no open actions:**
   - Create recurring-action in Firestore
   - Call spawn function (with CONTEXT=dev)
   - Verify action instance created with templateId
4. **Spawn logic - open action exists:**
   - Leave the spawned action in 'scheduled' state
   - Call spawn function again
   - Verify NO new action created (skipped)
5. **Spawn logic - after completion:**
   - Complete the action
   - Call spawn function
   - Verify new action created
6. **Agent tool:** Ask agent to create daily check-in, verify recurring-action created
7. **Old logic removed:** Complete a non-recurring action, verify no new action created
