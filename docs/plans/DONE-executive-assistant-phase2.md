# Executive Assistant - Phase 2: Dashboard + Log Work UI

## Context

We're redesigning `/do/` to mirror the practice system. Phase 1 built the data layer (projects, work logs) and EA agent logic. This phase builds the dashboard and log work UI.

## What Was Built in Phase 1

- `netlify/functions/_services/db-projects.cjs` - Projects CRUD
- `netlify/functions/_services/db-work-logs.cjs` - Work logs CRUD
- `netlify/functions/project-list.js` - GET projects
- `netlify/functions/project-create.js` - POST create project
- `netlify/functions/work-log-submit.js` - POST log work
- `netlify/functions/work-log-list.js` - GET work logs
- `netlify/functions/agent-chat.js` - Modified with executive type handling

## Prior Art to Reference

**Practice dashboard** (`src/practice/index.njk`):
- Rank system with emoji
- Two action cards (Motivate + Log Practice)
- Stats section (check-ins + practices counts)
- Clean, centered layout

**Practice log form** (`src/practice/log.njk`):
- Simple form with optional fields
- Success state with visual feedback
- "Log Another" flow

## What to Build

### 1. Backup Old Dashboard

Create `src/do/backup.njk` as copy of current `src/do/index.njk`:
- Change permalink to `/do/backup/`
- Keep all existing functionality intact

### 2. New Dashboard (`src/do/index.njk`)

Mirror the practice dashboard structure:

```
[Rank emoji] [Rank name]
"You logged X work sessions."

┌─────────────┐  ┌─────────────┐
│ 🧭 Motivate │  │ 📝 Log Work │
│  EA helps   │  │  Track what │
│  you focus  │  │   you did   │
└─────────────┘  └─────────────┘

Your Projects
┌─────────────────────────────┐
│ [X] work logs │ [Y] projects│
│   view >      │    view >   │
└─────────────────────────────┘
```

**Rank system** (work-focused):
```javascript
function getRank(workLogs) {
  if (workLogs <= 2) return { emoji: '✨', name: 'Starting' };
  if (workLogs <= 5) return { emoji: '🚀', name: 'Building Momentum' };
  if (workLogs <= 10) return { emoji: '⚡', name: 'Gaining Traction' };
  if (workLogs <= 20) return { emoji: '🔥', name: 'On Fire' };
  if (workLogs <= 50) return { emoji: '💪', name: 'Powerhouse' };
  return { emoji: '🏆', name: 'Champion' };
}
```

**Data fetching**:
- Call `work-log-list` to get totalCount
- Call `project-list` to get project count
- No pageScript needed - inline script like practice

**Action cards**:
- Motivate → `/do/chat/` (purple hover like Obi-Wai)
- Log Work → `/do/log/` (blue hover)

**Stats section**:
- Work logs count → links to `/do/history/` (Phase 3)
- Projects count → links to `/do/projects/` (Phase 3)
- For now, links can be placeholder (just show count, link disabled)

### 3. Log Work Form (`src/do/log.njk`)

Mirror practice log form structure:

**Layout**:
- Centered container (max-width 600px)
- Clean form with clear labels

**Form fields**:
```html
<form id="work-log-form">
  <!-- Required -->
  <label>What did you work on?</label>
  <input type="text" name="title" required placeholder="e.g., Worked on resume formatting">

  <!-- Optional - Project dropdown -->
  <label>Project (optional)</label>
  <select name="projectId">
    <option value="">No project</option>
    <!-- Populated dynamically from project-list -->
  </select>

  <!-- Optional -->
  <label>Duration (minutes)</label>
  <input type="number" name="duration" placeholder="e.g., 45">

  <!-- Optional -->
  <label>Reflection (optional)</label>
  <textarea name="reflection" placeholder="What did you learn? What's next?"></textarea>

  <button type="submit">Log Work</button>
</form>
```

**Success state**:
- Show growth visual (similar to practice)
- Show updated count: "Work session #X logged!"
- Buttons: "Log Another" (resets form) + "Back to Dashboard"

**Data flow**:
1. On load: fetch projects to populate dropdown
2. On submit: POST to `work-log-submit`
3. On success: show success state with count

### 4. Navigation Update (`src/_includes/nav.njk`)

Update the "Agentify" / Do section:

```html
<!-- Before -->
<a href="/do/">Agentify</a>
  <a href="/do/setup/">New Agent</a>

<!-- After -->
<a href="/do/">Do</a>
  <a href="/do/chat/">Motivate</a>
  <a href="/do/log/">Log Work</a>
```

Keep the old agent routes accessible but de-emphasize in nav.

## Template Reference

Use practice templates as reference:
- `src/practice/index.njk` - Dashboard structure
- `src/practice/log.njk` - Form structure and success state

## Verification

1. Visit `/do/` - should see new dashboard with:
   - Rank and work log count
   - Motivate + Log Work cards
   - Projects stats section

2. Visit `/do/backup/` - old dashboard still works

3. Visit `/do/log/`:
   - Form shows with project dropdown
   - Submit work log
   - See success state
   - "Log Another" works

4. Return to `/do/` - count should be updated

## Files to Create

| File | Purpose |
|------|---------|
| `src/do/backup.njk` | Backup of old dashboard |
| `src/do/log.njk` | Log work form |

## Files to Modify

| File | Change |
|------|---------|
| `src/do/index.njk` | Complete rewrite to mirror practice |
| `src/_includes/nav.njk` | Update Do section navigation |

## Success Criteria

- [ ] Old dashboard accessible at `/do/backup/`
- [ ] New dashboard shows rank, cards, and stats
- [ ] Log work form submits successfully
- [ ] Stats update after logging work
- [ ] Navigation shows new structure

## Notes for Implementation

Please work with the user to review and refine this plan before implementing. Key areas that may need adjustment:
- Exact wording on cards and labels
- Whether to disable history/projects links or show them
- Any styling preferences
