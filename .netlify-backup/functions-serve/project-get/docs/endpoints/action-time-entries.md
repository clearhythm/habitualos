# Action Time Entries API

Track time spent on actions through multiple discrete work sessions.

## Data Model

```javascript
{
  id: "ate-{uuid}",                    // Prefix: "ate" for action-time-entry
  _userId: "u-{timestamp}-{random}",
  actionId: "action-{timestamp}-{random}",
  duration: number,                     // Minutes (positive integer)
  note: string | null,                  // Optional description of work done
  loggedAt: string,                     // ISO timestamp (when work was done)
  _createdAt: Timestamp                 // Firestore server timestamp
}
```

**Note:** `loggedAt` is when the work happened (user can backdate). `_createdAt` is when the entry was recorded.

---

## POST /api/action-time-entry-create

Create a new time entry for an action.

### Request

```javascript
{
  userId: "u-{timestamp}-{random}",     // Required
  actionId: "action-{timestamp}-{random}", // Required
  duration: number,                      // Required - positive integer (minutes)
  note?: string,                         // Optional - what was worked on
  loggedAt?: string                      // Optional - ISO timestamp, defaults to now
}
```

### Response (200)

```javascript
{
  success: true,
  entry: {
    id: "ate-{uuid}",
    actionId: string,
    duration: number,
    note: string | null,
    loggedAt: string
  },
  totalMinutes: number  // Updated total for the action
}
```

---

## POST /api/action-time-entry-delete

Delete a time entry.

### Request

```javascript
{
  userId: "u-{timestamp}-{random}",     // Required
  entryId: "ate-{uuid}"                  // Required
}
```

### Response (200)

```javascript
{
  success: true,
  totalMinutes: number  // Updated total for the action
}
```

---

## GET /api/action/:id (Extended)

The action-get endpoint includes time entries in its response:

### Response (200)

```javascript
{
  success: true,
  action: { ... },
  chat: [ ... ],
  artifacts: [ ... ],
  notes: [ ... ],
  timeEntries: [{
    id: string,
    actionId: string,
    duration: number,
    note: string | null,
    loggedAt: string,
    _createdAt: string
  }],
  totalMinutes: number  // Sum of all entry durations
}
```

---

## Completion Integration

When completing an action with a duration via `POST /api/action/:id/complete`, a time entry is automatically created with the note "Logged on completion".

---

## Error Responses

All endpoints return errors in this format:

```javascript
{
  success: false,
  error: string  // Human-readable error message
}
```

Common status codes:
- 400 - Invalid request (missing/invalid fields)
- 403 - Access denied (entry belongs to different user)
- 404 - Action or entry not found
- 405 - Method not allowed
- 500 - Server error
