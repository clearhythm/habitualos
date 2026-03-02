# Phase 3: Time Entries

## Context

This phase adds time tracking for actions. Users can log multiple work sessions against an action, each with a duration and optional note. The system tallies total time spent.

**Prerequisites:** Phase 1 and 2 must be complete.

## Current State

After Phase 2:
- Action detail pages have working notes section
- Duration can be entered when completing an action (single value)
- No way to log incremental time before completion
- Completion duration stored but not as discrete entries

## Requirements

### Data Model

Create `work-action-time-entries` collection with schema:

```javascript
{
  id: "ate-{uuid}",          // Prefix: "ate" for action-time-entry
  _userId: string,           // User ownership
  actionId: string,          // Parent action ID
  duration: number,          // Minutes (integer)
  note: string | null,       // Optional description of work done
  loggedAt: string,          // ISO timestamp (when the work was done)
  _createdAt: Timestamp      // Firestore server timestamp
}
```

**Note:** `loggedAt` is when the work happened (user can backdate). `_createdAt` is when the entry was recorded.

### Service Layer

Create `netlify/functions/_services/db-action-time-entries.cjs`:

```javascript
// Functions to implement:
createTimeEntry(id, data)              // Create new time entry
getTimeEntriesByAction(actionId, userId)  // Get all entries for an action
deleteTimeEntry(entryId)               // Delete an entry
getTotalTimeForAction(actionId, userId)   // Sum of all durations (helper)
```

### Endpoints

1. **POST /api/action-time-entry-create**
   - Request: `{ userId, actionId, duration, note?, loggedAt? }`
   - Response: `{ success: true, entry: { id, ... }, totalMinutes: number }`
   - If `loggedAt` not provided, use current time
   - Returns updated total for convenience

2. **POST /api/action-time-entry-delete**
   - Request: `{ userId, entryId }`
   - Response: `{ success: true, totalMinutes: number }`
   - Validate user ownership before delete
   - Returns updated total

3. **Extend /api/action/:id (action-get.js)**
   - Add timeEntries to response
   - Add totalMinutes (sum of all entry durations)
   - Response: `{ success, action, chat, artifacts, notes, timeEntries, totalMinutes }`

### UI Updates

Update action detail page:

1. **Time Summary**
   - Display total time prominently: "4h 30m total"
   - Format helper: `formatDuration(minutes)` → "2h 15m" or "45m"

2. **Time Entries List**
   - Show each entry: duration, note (if any), date
   - Most recent first
   - Delete button on each entry

3. **Log Time Form**
   - Duration input (minutes or hours:minutes)
   - Optional note textarea
   - Optional date picker (defaults to now)
   - "Log Time" button

4. **Integration with Complete Action**
   - When completing with duration, create a time entry instead of just storing on action
   - OR keep completion duration separate and time entries are for incremental logging
   - Recommend: Create time entry on completion, so all time is tracked uniformly

### Duration Input UX

Options for duration input:
- **Simple:** Just minutes input (e.g., "30", "90")
- **Friendly:** Hours and minutes (e.g., "1h 30m" or separate fields)

Recommend starting simple (minutes only) and enhancing later if needed.

### Files to Create

1. `netlify/functions/_services/db-action-time-entries.cjs` - Service layer
2. `netlify/functions/action-time-entry-create.js` - Create endpoint
3. `netlify/functions/action-time-entry-delete.js` - Delete endpoint

### Files to Modify

1. `netlify/functions/action-get.js` - Add timeEntries and totalMinutes to response
2. `src/assets/js/pages/action-detail.js` - Add time tracking UI
3. `netlify/functions/action-complete.js` (optional) - Create time entry on completion

## Format Helper

```javascript
function formatDuration(minutes) {
  if (!minutes || minutes <= 0) return '0m';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}
```

## Verification

1. **Log Time Entry**
   - Add a time entry to an action
   - Verify it appears in the list with correct duration/note
   - Verify total updates

2. **Multiple Entries**
   - Add several entries
   - Verify total accumulates correctly
   - Verify list shows all entries

3. **Delete Entry**
   - Delete a time entry
   - Verify it's removed from list
   - Verify total recalculates

4. **Completion Integration** (if implemented)
   - Complete action with duration
   - Verify time entry created
   - Verify total reflects completion duration

5. **Backdate Entry**
   - Log time with a past date
   - Verify loggedAt shows correct date
   - Verify it sorts correctly in list

6. **Cross-Action Isolation**
   - Time entries on one action don't appear on another
