# Project Progress Tracking & Visualization

## Context

This phase adds progress visualization to projects. Different project types (end-date vs ongoing) get different progress views. Please review current architecture and system design and and then have a design discussion with the user to finalize the design and generate a plan before implementation.

## Current State

- Projects have goals and actions
- Goals have progress (completed/total)
- Projects have `timeline` field: date string or "ongoing"
- No aggregate progress view for projects

## Project Types

### End-Date Projects
- Have a target date in `timeline` field (e.g., "2025-03-31")
- Progress measured by: % of goals/actions completed
- Optionally: burndown chart showing work remaining over time

### Ongoing Projects
- Have `timeline: "ongoing"`
- Progress measured by: activity over time (time spent, actions completed per period)
- Show trends rather than % complete

## Requirements

### Project Progress Endpoint

Create **GET /api/project/:id/progress?userId=xxx&period=week**

Response for **end-date projects**:
```javascript
{
  success: true,
  projectType: "end-date",
  dueDate: "2025-03-31",
  daysRemaining: 45,
  goals: {
    total: 5,
    completed: 2,
    percentage: 40
  },
  actions: {
    total: 20,
    completed: 8,
    percentage: 40
  },
  // Optional: historical data for burndown
  burndown: [
    { date: "2025-01-01", remaining: 20 },
    { date: "2025-01-15", remaining: 15 },
    { date: "2025-01-30", remaining: 12 }
  ]
}
```

Response for **ongoing projects**:
```javascript
{
  success: true,
  projectType: "ongoing",
  currentPeriod: {
    label: "This Week",
    actionsCompleted: 5,
    timeSpentMinutes: 240
  },
  previousPeriod: {
    label: "Last Week",
    actionsCompleted: 3,
    timeSpentMinutes: 180
  },
  trend: {
    actions: "+66%",      // vs previous period
    time: "+33%"
  },
  // Optional: historical data for trend chart
  history: [
    { period: "Week 1", actions: 2, minutes: 60 },
    { period: "Week 2", actions: 3, minutes: 120 },
    { period: "Week 3", actions: 5, minutes: 180 },
    { period: "Week 4", actions: 5, minutes: 240 }
  ]
}
```

### Project Detail Page Updates

Add progress section to project page:

#### For End-Date Projects

1. **Progress Summary**
   - "X days remaining" (or "Y days overdue")
   - Goals: "2 of 5 completed (40%)"
   - Actions: "8 of 20 completed (40%)"
   - Overall progress bar

2. **Burndown Chart** (optional, can defer)
   - X-axis: time
   - Y-axis: remaining actions
   - Shows trend toward completion

#### For Ongoing Projects

1. **Current Period Stats**
   - "This Week: 5 actions, 4h spent"
   - Comparison: "vs 3 actions, 3h last week"
   - Trend indicators (up/down arrows with %)

2. **Trend Chart** (optional, can defer)
   - X-axis: weeks/months
   - Y-axis: actions completed or time spent
   - Simple line chart

### Time Aggregation

To calculate time spent per period:
1. Query `work-action-time-entries` for project's actions
2. Group by period (week/month)
3. Sum durations

Helper function:
```javascript
async function getProjectTimeByPeriod(projectId, userId, periodType = 'week') {
  // Get all actions for project
  const actions = await getProjectActions(projectId, userId);
  const actionIds = actions.map(a => a.id);

  // Get all time entries for these actions
  const entries = await getTimeEntriesByActions(actionIds, userId);

  // Group by period
  return groupByPeriod(entries, periodType);
}
```

This may require a new service function or helper.

### Files to Create

1. `netlify/functions/project-progress.js` - Progress endpoint
2. (Optional) Progress chart component if doing visualizations

### Files to Modify

1. `netlify/functions/_services/db-action-time-entries.cjs` - Add batch query function
2. Project detail page - Add progress section
3. (Optional) Add charting library if doing visualizations

## Minimal vs Full Implementation

### Minimal (recommended for Phase 5)
- Text-based progress display
- No charts
- Current period stats only (no history)

### Full (can be follow-up)
- Burndown chart for end-date projects
- Trend chart for ongoing projects
- Historical data collection and display

## Determining Project Type

```javascript
function getProjectType(project) {
  if (!project.timeline || project.timeline === 'ongoing') {
    return 'ongoing';
  }
  // Try to parse as date
  const date = new Date(project.timeline);
  if (!isNaN(date.getTime())) {
    return 'end-date';
  }
  return 'ongoing'; // Default if unparseable
}
```

## Verification

1. **End-Date Project Progress**
   - View project with timeline date
   - Verify days remaining calculation
   - Verify goal/action counts
   - Verify percentages

2. **Ongoing Project Progress**
   - View project with timeline "ongoing"
   - Verify current period stats
   - Complete an action, verify count updates
   - Log time, verify time total updates

3. **Trend Calculation**
   - Have data in previous period
   - Verify trend percentage shows correctly
   - Verify +/- indicators

4. **Edge Cases**
   - New project with no actions (0 of 0)
   - Overdue project (negative days remaining)
   - Project with no time entries (0 time)

## Future Considerations

- **Burndown chart:** Store snapshots or calculate on-the-fly
- **Weekly/monthly email:** Summarize progress
- **Goal-level progress:** Already implemented in Phase 4
- **Velocity tracking:** Average actions completed per week
