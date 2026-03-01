# Executive Assistant - Phase 3: EA Chat UI

## Context

We're redesigning `/do/` to mirror the practice system. Phase 1 built the data layer and EA agent logic. Phase 2 built the dashboard and log work UI. This phase builds the EA chat interface.

## What Was Built Previously

**Phase 1:**
- Projects and work logs data layer
- API endpoints for CRUD operations
- `do-chat.js` - dedicated EA endpoint with observational language

**Phase 2:**
- New dashboard at `/do/` with Motivate + Log Work cards
- Log work form at `/do/log/`
- Old dashboard backed up at `/do/backup/`
- Navigation updated

## Prior Art to Reference

**Practice chat** (`src/practice/chat.njk` + `src/scripts/practice-chat.js`):
- Full-height layout (header/footer hidden)
- Chat bubbles (user right/blue, assistant left/purple)
- Input area fixed at bottom
- LocalStorage persistence
- Markdown rendering for assistant messages
- "READY_TO_PRACTICE" signal handling
- **Primary reference for EA chat UI**

**EA backend** (from Phase 1):
- `netlify/functions/do-chat.js` - dedicated EA endpoint
- Simpler than agent-chat (no action creation signals)
- Just conversation + notes tools

## What to Build

### 1. EA Chat Page (`src/do/chat.njk`)

**Layout** (mirror practice-chat):
- Full-height, no header/footer
- Messages area (scrollable)
- Fixed input at bottom
- Back button to dashboard

```html
---
title: Motivate - HabitualOS
layout: base.njk
permalink: /do/chat/
hideHeader: true
hideFooter: true
---

<div class="chat-container">
  <div class="chat-header">
    <a href="/do/" class="back-link">← Back</a>
    <h1>Executive Assistant</h1>
  </div>

  <div class="messages-area" id="messages">
    <!-- Chat bubbles rendered here -->
  </div>

  <div class="input-area">
    <textarea id="message-input" placeholder="What's on your mind?"></textarea>
    <button id="send-btn">Send</button>
  </div>
</div>
```

**Styling**:
- Full viewport height
- Messages scroll independently
- User messages: blue, right-aligned
- EA messages: purple, left-aligned
- Input area always visible at bottom

### 2. EA Chat Logic

**On page load**:
1. Load chat history from localStorage (if any)
2. Display existing messages or show EA greeting

**EA greeting** (if no history):
- Don't auto-send a message
- Show placeholder text in messages area:
  "Your Executive Assistant is here to help you focus. Ask about what to work on, or share what's on your mind."

**Message flow**:
1. User types and sends
2. Show user message immediately
3. Call `do-chat` endpoint:
   ```javascript
   const response = await fetch('/.netlify/functions/do-chat', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({
       userId,
       message: userMessage,
       chatHistory: previousMessages
     })
   });
   ```
4. Display EA response
5. Save to localStorage

Note: No agent ID needed - `do-chat.js` is dedicated to EA and fetches all context server-side.

**Chat history persistence**:
- Store in localStorage: `ea-chat-history`
- Clear on "New Conversation" button
- Don't persist to server (keeping it simple)

### 3. Handle EA Responses

The EA can:
- Just chat (most common)
- Use notes tools (internal)
- Potentially suggest creating actions

For this phase, focus on conversational flow:
- Render markdown responses
- Show typing indicator during API call
- Handle errors gracefully

### 4. Simple Save/Reset

**Reset button**:
- Clears localStorage chat history
- Shows fresh state
- Keeps same EA agent

**Optional: Save to server**:
- Could reuse practice-chat-save pattern
- Or skip for now (localStorage is sufficient for MVP)

## Key Differences from Practice Chat

| Aspect | Practice Chat | EA Chat |
|--------|--------------|---------|
| Endpoint | `practice-chat.js` | `do-chat.js` |
| Signal | READY_TO_PRACTICE | None (just conversation) |
| Outcome | Navigate to /practice/log/ | Stay in chat or user leaves |
| Purpose | Motivate to practice | Help focus/prioritize |
| Persistence | Server + localStorage | localStorage only |
| Agent ID | None needed | None needed (dedicated endpoint) |

## Verification

1. Visit `/do/chat/`:
   - Should see chat interface
   - EA agent created automatically if needed

2. Send a message:
   - "What should I work on today?"
   - EA should respond with observational language
   - Should reference projects/actions if any exist

3. Check localStorage:
   - Chat history saved
   - EA agent ID stored

4. Refresh page:
   - Chat history restored
   - Can continue conversation

5. Test "New Conversation":
   - History cleared
   - Fresh start

## Files to Create

| File | Purpose |
|------|---------|
| `src/do/chat.njk` | EA chat page template |
| `src/scripts/ea-chat.js` | EA chat JavaScript |

## Success Criteria

- [ ] EA chat page loads at `/do/chat/`
- [ ] EA agent auto-created if none exists
- [ ] Can send messages and receive responses
- [ ] EA uses observational language ("I notice...", "I see...")
- [ ] Chat history persists in localStorage
- [ ] Can start new conversation

## Notes for Implementation

Please work with the user to review and refine this plan. Key decisions:
- Whether to persist chat to server or just localStorage
- Exact greeting/placeholder text
- Whether to add any special signal handling (like READY_TO_PRACTICE)
- Styling preferences (colors, fonts, spacing)
