# Scheduled Tasks Feature

## Overview
Scheduled tasks enable autonomous AI work to run at specified times, allowing you to utilize Claude API credits during off-hours (e.g., overnight) while you sleep.

## Use Case
Generate batch AI outputs for multiple subjects based on templates and data files. Example: Generate 3 personalized shift cards for each of 15 Healify users.

## Key Decisions from Planning

### Use Existing Action Cards
Scheduled tasks are **NOT** a separate entity - they're just actions with:
- `task_type = 'scheduled'`
- `schedule_time` field populated
- `task_config` JSON with execution details

This keeps the UI unified - all tasks appear in the same dashboard grid.

### File-Based I/O
**Inputs** (per task):
- `context.md`: Combined instructions + template examples + any context
- `user1.json`, `user2.json`, etc.: Data files for each subject

**Outputs** (per subject):
- Generated markdown files saved to `data/tasks/{task_id}/outputs/`

### Batch Execution Strategy
- **1 API call per user** (not per card)
- Each call generates all 3 cards at once
- Claude formats output with delimiters (`=== CARD 1 ===`, etc.)
- System parses and saves each card separately

### Local Execution (PoC)
- node-cron scheduler runs locally
- Computer must stay awake during execution (use tmux/screen)
- Files stored locally in `data/tasks/`
- Cloud execution deferred to future phase

## context.md Structure

```markdown
# [Task Title - 3-8 words]

## Description
[1 paragraph explaining what this task does]

## Instructions
[Detailed instructions for the AI on how to complete the task]

## Template Examples
[Sample outputs showing the desired format and style]

## Additional Guidelines
[Any other context, constraints, or requirements]
```

## Database Schema Extensions

### action_cards Table
Add fields to existing table:
```sql
ALTER TABLE action_cards ADD COLUMN schedule_time TEXT;
ALTER TABLE action_cards ADD COLUMN task_type TEXT DEFAULT 'interactive';
ALTER TABLE action_cards ADD COLUMN task_config TEXT; -- JSON
```

**task_config JSON structure:**
```json
{
  "inputs_path": "data/tasks/{task_id}/inputs/",
  "outputs_path": "data/tasks/{task_id}/outputs/",
  "batch_size": 15,
  "cards_per_subject": 3
}
```

## API Endpoints

### POST /api/task-execute/:id
Execute a task immediately (bypasses scheduling).

**Query params:**
- None (removed test mode for simplicity)

**Response:**
```json
{
  "success": true,
  "status": "running",
  "progress": { "current": 0, "total": 15 }
}
```

### GET /api/action-get/:id
Get action details (works for both interactive and scheduled actions).

**Response includes:**
```json
{
  "success": true,
  "action": {
    ...
    "task_type": "scheduled",
    "schedule_time": "2025-12-13T02:00:00Z",
    "task_config": {...}
  },
  "outputs": ["user1_card1.md", "user1_card2.md", ...]
}
```

## Scheduler Implementation

### scheduler/index.js
```javascript
const cron = require('node-cron');
const { getAllActions, updateActionState } = require('../db/helpers');
const executeTask = require('./task-executor');

// Check every minute for tasks due to run
cron.schedule('* * * * *', async () => {
  const now = new Date().toISOString();

  // Query for scheduled tasks that are due
  const tasks = getAllActions()
    .filter(a =>
      a.task_type === 'scheduled' &&
      a.state === 'open' &&
      a.schedule_time &&
      a.schedule_time <= now
    );

  for (const task of tasks) {
    try {
      await executeTask(task.id);
    } catch (error) {
      console.error(`Task ${task.id} failed:`, error);
      updateActionState(task.id, 'failed', {
        error_message: error.message
      });
    }
  }
});
```

### scheduler/task-executor.js
```javascript
const fs = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');
const { getAction, updateActionState } = require('../db/helpers');

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

async function executeTask(actionId) {
  const action = getAction(actionId);
  const config = JSON.parse(action.task_config);

  // Mark as running
  updateActionState(actionId, 'in_progress', {
    started_at: new Date().toISOString()
  });

  // Load context.md
  const contextPath = path.join(config.inputs_path, 'context.md');
  const context = fs.readFileSync(contextPath, 'utf8');

  // Get all user JSON files
  const userFiles = fs.readdirSync(config.inputs_path)
    .filter(f => f.endsWith('.json'));

  // Process each user
  for (const userFile of userFiles) {
    const userData = JSON.parse(
      fs.readFileSync(path.join(config.inputs_path, userFile))
    );
    const userId = userFile.replace('.json', '');

    // Call Claude API - generate all 3 cards at once
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8192,
      system: context,
      messages: [{
        role: 'user',
        content: `User data:\n${JSON.stringify(userData, null, 2)}\n\nGenerate 3 shift cards using the format:\n\n=== CARD 1 ===\n[content]\n\n=== CARD 2 ===\n[content]\n\n=== CARD 3 ===\n[content]`
      }]
    });

    // Parse output and save each card
    const output = response.content[0].text;
    const cards = output.split(/===\s*CARD\s*\d+\s*===/).slice(1);

    cards.forEach((card, index) => {
      const filename = `${userId}_card${index + 1}.md`;
      fs.writeFileSync(
        path.join(config.outputs_path, filename),
        card.trim()
      );
    });
  }

  // Mark complete
  updateActionState(actionId, 'completed', {
    completed_at: new Date().toISOString()
  });
}

module.exports = executeTask;
```

## UI Components

### Task Detail Page
Shows for any action (interactive or scheduled).

**For scheduled tasks, additionally displays:**
- Schedule time (if pending)
- Input files list (context.md, user JSONs)
- Output files list with download links (if completed)
- "Run Now" button (if state='open')
- Progress indicator (if state='in_progress')

## Testing Strategy

### Phase 0: System Test
- Create simple test task (timestamp generation)
- 2 dummy user files
- Verify loop, API calls, file writing work

### Phase 1: Schedule Test
- Schedule test task for 2 minutes from now
- Verify node-cron triggers execution

### Phase 2: Real Data Test
- 1 Healify user, manual "Run Now"
- Verify output quality

### Phase 3: Full Overnight Run
- All 15 users, scheduled for 2 AM
- Confident execution

## Security
- File writes restricted to `data/tasks/{uuid}/outputs/`
- UUID validation prevents path traversal
- Filename sanitization (alphanumeric + underscore only)
- No execution of generated content
- Generated markdown stored as plain text

## Future Enhancements
- Cloud execution (Netlify Background Functions)
- Resume from failure (track which users completed)
- Parallel API calls (with rate limiting)
- MCP publishing to destinations (Substack, GitHub, etc.)
- Recurring schedules (cron expressions)
- Task templates library
