# Phase 2: Notes on Actions

## Context

This phase adds a separate notes system for actions. Notes are user annotations for tracking progress, thoughts, and completed steps - distinct from the AI chat history.

**Prerequisites:** Phase 1 must be complete (action detail pages exist, collections renamed to `work-*`).

## Current State

After Phase 1:
- Actions displayed on detail pages at `/do/action/?id=xxx`
- Notes section exists as placeholder
- No notes collection or endpoints exist

## Requirements

### Data Model

Create `work-action-notes` collection with schema:

```javascript
{
  id: "an-{uuid}",           // Prefix: "an" for action-note
  _userId: string,           // User ownership
  actionId: string,          // Parent action ID
  content: string,           // Note text (plain text or markdown)
  _createdAt: Timestamp,     // Firestore server timestamp
  _updatedAt: Timestamp      // Firestore server timestamp
}
```

### Service Layer

Create `netlify/functions/_services/db-action-notes.cjs`:

```javascript
// Functions to implement:
createNote(id, data)           // Create new note
getNotesByAction(actionId, userId)  // Get all notes for an action
updateNote(noteId, updates)    // Update note content
deleteNote(noteId)             // Delete a note
```

### Endpoints

1. **POST /api/action-note-create**
   - Request: `{ userId, actionId, content }`
   - Response: `{ success: true, note: { id, ... } }`
   - Creates note in `work-action-notes`

2. **POST /api/action-note-update**
   - Request: `{ userId, noteId, content }`
   - Response: `{ success: true }`
   - Updates note content (validate user ownership)

3. **POST /api/action-note-delete**
   - Request: `{ userId, noteId }`
   - Response: `{ success: true }`
   - Deletes note (validate user ownership)

4. **Extend /api/action/:id (action-get.js)**
   - Add notes to response alongside chat and artifacts
   - Response becomes: `{ success, action, chat, artifacts, notes }`

### UI Updates

Update action detail page (`src/do/action.njk` and `src/assets/js/pages/action-detail.js`):

1. **Notes Section**
   - Display list of notes (newest first or oldest first - decide)
   - Each note shows: content, timestamp
   - Edit button (inline edit or modal)
   - Delete button with confirmation

2. **Add Note Form**
   - Textarea for new note content
   - "Add Note" button
   - Clear form after successful add
   - Show new note immediately (optimistic UI or refetch)

### Files to Create

1. `netlify/functions/_services/db-action-notes.cjs` - Service layer
2. `netlify/functions/action-note-create.js` - Create endpoint
3. `netlify/functions/action-note-update.js` - Update endpoint
4. `netlify/functions/action-note-delete.js` - Delete endpoint

### Files to Modify

1. `netlify/functions/action-get.js` - Add notes to response
2. `src/assets/js/pages/action-detail.js` - Add notes UI
3. `src/assets/js/api/actions.js` - Add note API functions (optional, or inline fetch)

## ID Generation

Use pattern: `an-{uuid}` where uuid is generated via:
```javascript
const { v4: uuidv4 } = require('uuid');
const noteId = `an-${uuidv4()}`;
```

Or use timestamp-based:
```javascript
const noteId = `an-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
```

## Verification

1. **Create Note**
   - Add a note to an action
   - Verify it appears in the list
   - Verify it persists after page reload
   - Check Firestore console for document in `work-action-notes`

2. **Edit Note**
   - Edit an existing note
   - Verify changes save and display

3. **Delete Note**
   - Delete a note
   - Confirm deletion dialog works
   - Verify note removed from list
   - Verify removed from Firestore

4. **Multiple Actions**
   - Add notes to different actions
   - Verify notes only appear on their respective action pages

5. **User Isolation**
   - Notes should only be visible/editable by the owner user
