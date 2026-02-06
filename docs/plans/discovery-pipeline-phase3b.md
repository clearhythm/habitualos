# Discovery Pipeline — Phase 3b: Scheduled Action Executor

**Status**: Deferred (build after Phase 3 is validated)

---

## Overview

A general scheduled action executor that runs on a cron schedule, queries Firestore for scheduled actions that are due, and executes them on behalf of the owning agent.

This phase builds the infrastructure for agents to own and run scheduled work. Discovery (Phase 3) is one type of scheduled work; reports, digests, and other automated tasks would use the same infrastructure.

---

## Mental Model

**Agents own scheduled actions.** Each scheduled action belongs to an agent and runs in that agent's context:
- Agent's goal/instructions inform the work
- Agent's feedback history provides learning
- Results are attributed to the agent
- Metrics tracked per agent

The executor is a Netlify scheduled function that:
1. Runs on a cron schedule (e.g., 4am daily)
2. Queries Firestore for scheduled actions that are due
3. For each action, loads the agent context and dispatches to the appropriate handler
4. Updates action state and logs results

---

## Files to Create

### 1. `netlify/functions/scheduled-executor.js`

Netlify scheduled function (or background function with cron trigger).

```javascript
const { getScheduledActionsDue } = require('./_services/db-actions.cjs');
const { executeScheduledAction } = require('./_utils/action-executor.cjs');

exports.handler = async (event) => {
  console.log('[scheduled-executor] Starting scheduled run');

  // Get all scheduled actions that are due
  const actions = await getScheduledActionsDue();
  console.log(`[scheduled-executor] Found ${actions.length} actions due`);

  const results = [];
  for (const action of actions) {
    try {
      const result = await executeScheduledAction(action);
      results.push({ actionId: action.id, success: true, result });
    } catch (err) {
      results.push({ actionId: action.id, success: false, error: err.message });
    }
  }

  console.log('[scheduled-executor] Complete:', results);
  return { statusCode: 200, body: JSON.stringify(results) };
};
```

### 2. `netlify/functions/_utils/action-executor.cjs`

Dispatch logic by action type.

```javascript
const { runDiscovery } = require('./discovery-pipeline.cjs');
// Future: const { runDigest } = require('./digest-pipeline.cjs');

async function executeScheduledAction(action) {
  const { taskType, taskConfig, agentId, _userId } = action;

  switch (taskConfig?.scheduledType || taskType) {
    case 'discovery':
      return await runDiscovery({ agentId, userId: _userId });

    // Future handlers:
    // case 'digest':
    //   return await runDigest({ agentId, userId: _userId });
    // case 'report':
    //   return await runReport({ agentId, userId: _userId });

    default:
      throw new Error(`Unknown scheduled action type: ${taskType}`);
  }
}

module.exports = { executeScheduledAction };
```

---

## Files to Modify

### `netlify/functions/_services/db-actions.cjs`

Add method to query scheduled actions that are due:

```javascript
/**
 * Get scheduled actions that are due to run
 * Checks lastRunAt vs schedule to determine if action should run
 * @returns {Promise<Array>} Actions ready to execute
 */
exports.getScheduledActionsDue = async () => {
  // Query actions with taskType: "scheduled" and state: "open" or "scheduled"
  const all = await dbCore.query({
    collection: 'actions',
    where: 'taskType::eq::scheduled'
  });

  const now = new Date();
  return all.filter(action => {
    // Check if action should run based on schedule
    const schedule = action.taskConfig?.schedule; // e.g., "daily", "weekly"
    const lastRun = action.lastRunAt ? new Date(action.lastRunAt) : null;

    if (!schedule) return false;

    if (schedule === 'daily') {
      if (!lastRun) return true;
      const hoursSinceLastRun = (now - lastRun) / (1000 * 60 * 60);
      return hoursSinceLastRun >= 24;
    }

    if (schedule === 'weekly') {
      if (!lastRun) return true;
      const daysSinceLastRun = (now - lastRun) / (1000 * 60 * 60 * 24);
      return daysSinceLastRun >= 7;
    }

    return false;
  });
};
```

### `netlify.toml`

Add scheduled function:

```toml
[functions."scheduled-executor"]
  schedule = "0 12 * * *"  # Daily at 12:00 UTC (4am PT / 5am MT)
```

---

## Action Schema for Scheduled Work

Scheduled actions use the existing action schema with these conventions:

```javascript
{
  id: "action-...",
  _userId: "u-...",
  agentId: "agent-...",
  title: "Daily company discovery",
  taskType: "scheduled",
  taskConfig: {
    scheduledType: "discovery",  // What kind of scheduled work
    schedule: "daily",           // When to run: "daily" | "weekly" | "hourly"
    draftType: "company"         // Type-specific config
  },
  state: "scheduled",            // Special state for recurring actions
  lastRunAt: "2026-01-29T12:00:00Z",
  lastRunResult: { draftIds: [...], errors: [] }
}
```

---

## Creating a Scheduled Action

User or agent creates a scheduled action:

```javascript
await createAction(generateActionId(), {
  _userId: userId,
  agentId: agentId,
  title: "Daily company discovery",
  description: "Automatically search for companies matching your interests",
  taskType: "scheduled",
  taskConfig: {
    scheduledType: "discovery",
    schedule: "daily",
    draftType: "company"
  },
  state: "scheduled",
  priority: "low"
});
```

---

## Execution Flow

```
[Netlify Cron: 4am daily]
     │
     ▼
┌─────────────────────────────────────────────┐
│ scheduled-executor.js                       │
│ • Query actions where taskType="scheduled"  │
│ • Filter by schedule vs lastRunAt           │
└────────────────────┬────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────┐
│ For each due action:                        │
│ • Load agent context                        │
│ • Dispatch to handler (discovery, etc.)     │
│ • Update lastRunAt and lastRunResult        │
└─────────────────────────────────────────────┘
```

---

## Future Scheduled Action Types

| Type | Description |
|------|-------------|
| `discovery` | Find new content (companies, people, articles) |
| `digest` | Generate weekly summary of activity |
| `report` | Create progress report on agent goals |
| `cleanup` | Archive old drafts, prune stale data |

---

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Handler throws | Log error, update lastRunResult with error, continue to next action |
| No actions due | Log and exit cleanly |
| Database error | Log and exit, actions will retry next run |
| Handler timeout | Netlify kills function, action retries next run |

---

## Prerequisites

- Phase 3 (discovery-pipeline.cjs) must be working
- Actions schema supports `taskType: "scheduled"`
- Agent context loading works
