# Agent Notes API

Quick-capture notes for agents, accessible from mobile and desktop.

## Data Model

```javascript
{
  id: "note-{timestamp}-{random}",
  agentId: "agent-{random}",
  _userId: "u-{timestamp}-{random}",
  type: string,           // Freeform: "url", "idea", "bookmark", etc.
  title: string,
  content: string,
  metadata: {             // Optional
    url?: string,
    tags?: string[],
    source?: string
  },
  status: "active" | "archived" | "merged",
  _createdAt: Timestamp,
  _updatedAt: Timestamp
}
```

---

## POST /api/agent-notes-create

Create a new note for an agent.

### Request

```javascript
{
  userId: "u-{timestamp}-{random}",   // Required
  agentId: "agent-{random}",          // Required
  type: string,                        // Required - freeform type
  title: string,                       // Required
  content: string,                     // Required
  metadata: {                          // Optional
    url?: string,
    tags?: string[],
    source?: string
  }
}
```

### Response (200)

```javascript
{
  success: true,
  note: {
    id: "note-{timestamp}-{random}",
    type: string,
    title: string,
    content: string,
    metadata: object,
    status: "active"
  }
}
```

---

## POST /api/agent-notes-list

List notes for an agent with optional filters.

### Request

```javascript
{
  userId: "u-{timestamp}-{random}",   // Required
  agentId: "agent-{random}",          // Required
  status?: string,                     // Optional: "active", "archived", "merged"
  type?: string,                       // Optional: filter by type
  limit?: number                       // Optional: max results (default: unlimited)
}
```

### Response (200)

```javascript
{
  success: true,
  notes: [{
    id: string,
    type: string,
    title: string,
    content: string,
    metadata: object,
    status: string,
    _createdAt: Timestamp
  }]
}
```

---

## POST /api/agent-notes-update

Update an existing note.

### Request

```javascript
{
  userId: "u-{timestamp}-{random}",   // Required
  noteId: "note-{timestamp}-{random}", // Required
  updates: {                           // Required - at least one field
    title?: string,
    content?: string,
    type?: string,
    status?: "active" | "archived" | "merged",
    metadata?: object
  }
}
```

### Response (200)

```javascript
{
  success: true,
  id: string,
  updated: string[]  // List of updated field names
}
```

---

## POST /api/agent-notes-delete

Delete a note (hard delete).

### Request

```javascript
{
  userId: "u-{timestamp}-{random}",   // Required
  noteId: "note-{timestamp}-{random}"  // Required
}
```

### Response (200)

```javascript
{
  success: true,
  id: string,
  deleted: true
}
```

---

## Agent Chat Tools

Agents can also interact with notes via tools in the chat interface:

- `create_note(type, title, content, metadata?)` - Save a quick capture
- `get_notes(status?, type?, limit?)` - Retrieve saved notes
- `update_note(note_id, updates)` - Update an existing note

These tools allow agents to capture information during conversation without the user needing to call the API directly.

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
- 403 - Access denied (note belongs to different user)
- 404 - Note not found
- 405 - Method not allowed
- 500 - Server error
