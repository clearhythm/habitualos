# Executive Assistant - Phase 4: Supporting Pages + Polish

## Context

We're redesigning `/do/` to mirror the practice system. Previous phases built:
- Phase 1: Data layer (projects, work logs) + EA agent logic
- Phase 2: Dashboard + Log Work UI
- Phase 3: EA Chat UI

This phase adds supporting pages and polish based on testing feedback.

## What Was Built Previously

- `/do/` - New dashboard with Motivate + Log Work cards
- `/do/log/` - Log work form
- `/do/chat/` - EA conversational interface
- `/do/backup/` - Old dashboard preserved
- Projects and work logs data layer
- EA agent type with observational language

## What to Build

### 1. Work History Page (`src/do/history.njk`)

Mirror `src/practice/history.njk`:

**Layout**:
- Centered container
- List of work log entries (newest first)
- Back link to dashboard

**Entry card format**:
```
[Title]
[Project name if assigned]
[Date] at [Time]                    [Duration if present]
─────────────────────────────────────────────────────────
[Reflection if present - expandable]
```

**Data**: Fetch from `work-log-list` endpoint

### 2. Projects Page (`src/do/projects.njk`)

Mirror `src/practice/library.njk`:

**Layout**:
- Centered container
- List of project cards
- "Add Project" button

**Card format**:
```
[Project Name]                      [Work log count]
[Goal - truncated]                  work sessions
Last worked: X days ago
```

**Data**: Fetch from `project-list`

**Link**: Each project links to `/do/project/?id={projectId}`

### 3. Project Detail Page (`src/do/project.njk`)

Mirror `src/practice/detail.njk`:

**Layout**:
- Back link to projects
- Project name + goal
- Work log count
- List of work logs for this project
- Related actions (if any have projectId)

**Query param**: `?id={projectId}`

### 4. Add Project Flow

Simple modal or inline form on `/do/projects/`:

```html
<form id="add-project-form">
  <input type="text" name="name" placeholder="Project name" required>
  <textarea name="goal" placeholder="What's the goal?"></textarea>
  <button type="submit">Create Project</button>
</form>
```

Or navigate to a dedicated `/do/project-new/` page.

### 5. Link Integration

Update dashboard stats to link:
- Work logs count → `/do/history/`
- Projects count → `/do/projects/`

Update log work form:
- Project dropdown links to "Manage Projects" if user needs to create one

### 6. Polish Based on Testing

This phase should include time to:
- Fix any bugs from Phases 1-3
- Refine copy/labels based on user feedback
- Adjust styling for consistency
- Improve error handling
- Add loading states where missing

## Files to Create

| File | Purpose |
|------|---------|
| `src/do/history.njk` | Work history page |
| `src/do/projects.njk` | Projects library page |
| `src/do/project.njk` | Project detail page |

## Files to Modify

| File | Change |
|------|---------|
| `src/do/index.njk` | Enable links to history/projects |
| `src/do/log.njk` | Add "Manage Projects" link |

## Verification

1. `/do/history/` - Shows all work logs, newest first
2. `/do/projects/` - Shows all projects with stats
3. `/do/project/?id=xxx` - Shows project detail with work logs
4. Can create new project from projects page
5. All links work from dashboard
6. Navigation is intuitive

## Notes for Implementation

**Please work with the user to:**
- Review Phase 1-3 implementation and gather feedback
- Prioritize which supporting pages matter most
- Decide on project creation flow (modal vs page)
- Identify any bugs or UX issues to fix
- Refine the overall feel and flow

This phase is more flexible - adjust based on what's learned from using the system.
