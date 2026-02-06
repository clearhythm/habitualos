---
last_sync: 2026-01-12T19:20:00.000Z
last_commit: 2026-01-12T19:20:00Z
commits_since_sync: 0
---

# HabitualOS Practice Tracker (Obi-Wai System)

## Overview

The Practice Tracker is a minimal, non-demanding habit tracking system that helps users log practices, receive occasional AI wisdom, and build consistency without gamification or pressure.

**Philosophy**: Intentionally simple, non-judgmental, observation-focused rather than achievement-focused.

## Core Concepts

### Practice Logs
Individual check-in records that form the timeline/history:
- Optional fields: practice name, duration, reflection
- Each log may trigger Obi-Wai wisdom (~14% of check-ins)
- ID format: `p-{timestamp}-{random}`

### Practices
Practice definitions that serve as the library:
- Unique practices with metadata (name, instructions, check-in count)
- Single source of truth for practice metadata
- ID format: `practice-{random}`

### Practice Chats
Saved conversations with Obi-Wai for practice discovery:
- Full conversation history preserved
- Tracks suggested practice and instructions
- Marks if user completed the suggested practice
- ID format: `pc-{timestamp}-{random}`

### Obi-Wai Wisdom

**Pattern-Based Appearance** (~14% of check-ins):
- First practice of all time
- Returning after 3+ day gap
- Milestones (3rd, 7th check-in)
- Substantial reflection written
- Early morning (4-6am) or late night (10pm-4am)
- Long practice (30+ minutes)
- Consistency streak (4+ in 7 days)

**Wisdom Generation**:
- Uses Claude Sonnet 4.5
- Context: practice history, detected pattern, reflection, time of day
- Two-part message: short (immediate) + long (expandable)
- User feedback: thumbs up/down

### Rank Progression

Flower metaphor for growth:
- **Seedling** (0-2 practices)
- **Sprout** (3-5 practices)
- **Budding** (6-10 practices)
- **Blooming** (11-20 practices)
- **Full Bloom** (21-50 practices)
- **Garden** (51+ practices)

## User Journey

### 1. Dashboard
Entry point showing rank, stats, and action cards:
- Motivate (opens chat with Obi-Wai)
- Log Practice (direct to logging form)

### 2. Practice Discovery (Chat Flow)
```
Discovery phase (4-6 exchanges)
  → What practice? Why? How?
  ↓
Timing phase
  → Now or later?
  ↓
Ready confirmation
  → "I'm Ready to Practice" button appears
  ↓
Do Your Practice overlay
  → User practices offline
  ↓
Click "I Practiced"
  → Redirect to log form with pre-filled name
```

### 3. Log Practice
```
Fill form (name, duration, reflection)
  ↓
Submit → Pattern detection
  ↓
IF pattern detected:
  → Obi-Wai appears with wisdom
  → User can expand for longer message
  → User provides feedback (thumbs up/down)
ELSE:
  → System success with flower visual
  ↓
Practice logged + library updated
```

### 4. View History
Chronological timeline of all check-ins with:
- Date, time, duration
- Obi-Wai quotes (expandable)
- Reflection text

### 5. View Library
Unique practices sorted by check-in count:
- Practice name
- Last practiced (relative time)
- Total check-ins
- Links to detail page

### 6. Garden Visualization
Generative SVG flowers based on practice data:
- **Position**: Seeded random from practice ID
- **Size**: Based on duration (10-40 minutes)
- **Color**: Based on time of day
- **Petals**: 6 (default) or 8 (if reflection written)
- Animated fade-in and sway effect

## Architecture

### Frontend Pages

**[src/practice/index.njk](src/practice/index.njk)** - Dashboard
- Rank display with emoji and subtitle
- Action cards (Motivate, Log Practice)
- Stats (check-ins count, practices count)

**[src/practice/log.njk](src/practice/log.njk)** - Practice logging form
- Optional fields with guidance text
- Obi-Wai response display (three-state flow)
- Pre-fill support from chat

**[src/practice/chat.njk](src/practice/chat.njk)** - Conversational interface
- Full-height layout (fixed header, scrollable messages, fixed input)
- Message bubbles (user: blue/right, Obi-Wai: purple/left)
- "I'm Ready" modal + "Do Your Practice" overlay
- Save/Reset buttons

**[src/practice/history.njk](src/practice/history.njk)** - Timeline view
- Chronological feed of all check-ins
- Shared rendering with `practice-entry-renderer.js`

**[src/practice/library.njk](src/practice/library.njk)** - Practice library
- Cards sorted by check-in count
- Links to detail pages

**[src/practice/detail.njk](src/practice/detail.njk)** - Single practice view
- Practice metadata + all check-ins for that practice

**[src/practice/garden.njk](src/practice/garden.njk)** - Visual garden
- SVG flowers with generative attributes

### Backend Endpoints

**[netlify/functions/practice-submit.js](netlify/functions/practice-submit.js)**
- POST: Log a practice check-in
- Pattern detection + AI wisdom generation
- Updates both practice-logs and practices collections

**[netlify/functions/practice-list.js](netlify/functions/practice-list.js)**
- GET: Fetch practice library (unique practices with counts)

**[netlify/functions/practice-logs-list.js](netlify/functions/practice-logs-list.js)**
- GET: Fetch check-in history (chronological timeline)

**[netlify/functions/practice-feedback.js](netlify/functions/practice-feedback.js)**
- POST: Update thumbs up/down feedback on Obi-Wai messages

**[netlify/functions/practice-chat.js](netlify/functions/practice-chat.js)**
- POST: Conversational coaching to discover practices
- Detects READY_TO_PRACTICE signal

**[netlify/functions/practice-chat-save.js](netlify/functions/practice-chat-save.js)**
- POST: Save practice chat history to Firestore

### Service Layer

**[netlify/functions/_services/db-practice-logs.cjs](netlify/functions/_services/db-practice-logs.cjs)**
- CRUD for practice-logs collection

**[netlify/functions/_services/db-practices.cjs](netlify/functions/_services/db-practices.cjs)**
- CRUD for practices collection

**[netlify/functions/_services/db-practice-chats.cjs](netlify/functions/_services/db-practice-chats.cjs)**
- CRUD for practice-chats collection

### Frontend Utilities

**[src/assets/js/practice-chat-state.js](src/assets/js/practice-chat-state.js)**
- localStorage management for chat history
- 24-hour expiry for suggested practice state

**[src/assets/js/practice-entry-renderer.js](src/assets/js/practice-entry-renderer.js)**
- Shared utility for consistent practice entry rendering
- Used across history and detail pages

## Data Flow

### Logging a Practice

```
User fills form → POST /practice-submit
  ↓
1. Get current practice count + recent logs
2. Analyze patterns (analyzeAndRespond)
3. If pattern detected → Generate AI wisdom (Claude Sonnet 4.5)
4. Create practice log in practice-logs collection
5. Create/update practice in practices collection
6. Increment checkins counter
  ↓
Return: success, practice data, count, Obi-Wai message (if appeared)
  ↓
Frontend: Show Obi-Wai response OR flower visual
  ↓
User feedback (thumbs up/down) → POST /practice-feedback
```

### Practice Discovery

```
User opens chat → Load from localStorage
  ↓
User sends message → POST /practice-chat
  ↓
Backend:
1. Fetch user's practice history (context)
2. Build system prompt with Obi-Wai persona
3. Call Claude API
4. Detect READY_TO_PRACTICE signal
  ↓
If ready: Return practiceName + affirmation
If not ready: Return conversational response
  ↓
Frontend:
- If ready: Show "I'm Ready to Practice" button
- User clicks → "Do Your Practice" overlay
- User completes practice offline
- User clicks "I Practiced" → Redirect to log form
  ↓
Optional: Save chat → POST /practice-chat-save
```

## Database Schema

### Collection: practice-logs

```javascript
{
  id: "p-{timestamp}-{random}",
  _userId: "u-{timestamp}-{random}",
  practice_name: string | null,        // Optional
  duration: number | null,             // Minutes
  reflection: string | null,           // User's reflection
  obi_wan_message: string | null,      // Short wisdom
  obi_wan_expanded: string | null,     // Long wisdom
  obi_wan_feedback: string | null,     // 'thumbs_up' | 'thumbs_down'
  timestamp: string,                   // ISO timestamp
  _createdAt: Timestamp
}
```

### Collection: practices

```javascript
{
  id: "practice-{random}",
  _userId: "u-{timestamp}-{random}",
  name: string,                        // Original casing preserved
  instructions: string,                // Latest/best from chat
  checkins: number,                    // Counter
  _createdAt: Timestamp,
  _updatedAt: Timestamp | null
}
```

### Collection: practice-chats

```javascript
{
  id: "pc-{timestamp}-{random}",
  _userId: "u-{timestamp}-{random}",
  messages: [
    {
      role: "assistant" | "user",
      content: string,
      timestamp: string
    }
  ],
  suggestedPractice: string | null,
  fullSuggestion: string | null,
  completed: boolean,
  savedAt: string,
  _createdAt: Timestamp
}
```

## Key Implementation Details

### Obi-Wai Wisdom Generation
- Model: Claude Sonnet 4.5
- Context: practice history, pattern, reflection, time of day
- Returns JSON: `{short: "...", long: "..."}`
- Fallback: Canned wisdom library if API fails
- Testing: `OBI_WAI_ALWAYS_APPEAR=true` env var

### Practice Name Matching
- Case-insensitive lookups
- Original casing preserved in storage
- Queries done in JavaScript (Firestore limitation)

### LocalStorage State
- Chat history expires after 24 hours
- Suggested practice carries from chat to log form
- Clear button removes suggestion

### Authentication
- Client-side user ID: `u-{timestamp}-{random}`
- Stored in localStorage with sessionStorage fallback
- All queries filtered by `_userId`

### Frontend Patterns
- Shared rendering utility for consistency
- HTML escaping to prevent XSS
- Cache busting with `_=${Date.now()}` query parameter
- Page reload on `pageshow` event for back/forward cache

## Design Philosophy

The practice tracker embodies **gentle tracking** - data is collected to enable reflection and wisdom, not to create pressure or obligation. The AI appears when patterns emerge, not on a schedule, making encounters feel meaningful rather than routine.

Key principles:
- **Optional everything**: Name, duration, reflection all optional
- **No streaks**: No pressure to maintain daily habits
- **Wisdom, not metrics**: Focus on growth patterns, not numbers
- **Respectful AI**: Obi-Wai appears rarely and meaningfully
- **Beautiful simplicity**: Minimalist UI with flower metaphors
