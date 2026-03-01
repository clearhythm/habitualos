# Sunlight Replies — Phase 1: Reply Working End-to-End

**Goal**: Tap "Reply" on a moment card → chat with Pidgerton → Pidgerton helps craft a reply → reply saves to Firestore → navigate back. No points, no weather, no celebration yet — just the core reply loop.

## Data model

```
Collection: moment-replies
{
  id: "reply-{timestamp36}{random4}",
  momentId: "moment-abc123",
  _userId: "u-...",
  repliedBy: "Erik",
  content: "...",
  createdAt: "2026-02-15T..."
}
```

## Steps

### 1. Create `db-replies.cjs` service
- `createReply({ momentId, userId, repliedBy, content })` → creates doc
- `getRepliesByMomentIds(momentIds)` → batch fetch for display
- `getReplyForMoment(momentId)` → single lookup
- Path: `apps/relationship-web/netlify/functions/_services/db-replies.cjs`
- Reuse: `@habitualos/db-core` (same pattern as `db-moments.cjs`)

### 2. Create `moment-reply-save.js` endpoint
- POST: `{ userId, momentId, content }`
- Validates moment exists, replier is the partner (not the sharer)
- Calls `db-replies.createReply()`
- Returns: `{ success, replyId }`
- Path: `apps/relationship-web/netlify/functions/moment-reply-save.js`

### 3. Add `SEND_REPLY` signal to edge function
- Add `/^SEND_REPLY\s*\n---/m` to signalPatterns array
- Path: `apps/relationship-web/netlify/edge-functions/chat-stream.ts` (line 13)

### 4. Add reply-mode prompt to `rely-chat-init.js`
- Accept `replyToMomentId` in request body
- If present, fetch the moment via `getMoment()`
- Append reply-mode section to system prompt (see below)
- Path: `apps/relationship-web/netlify/functions/rely-chat-init.js`

Reply-mode prompt section:
```
== REPLY MODE ==

{userName} is replying to a moment shared by {partnerName}.

The moment:
- Type: {type}
- Shared: {date}
- Content: "{content}"

Your role:
- Help them sit with what their partner shared
- What stands out? What might have been hard for their partner?
- What do they want to acknowledge, affirm, or say?
- Help them craft a loving, present response — in their voice
- A few sentences is plenty

When they're ready, confirm and emit:

SEND_REPLY
---
{ "momentId": "...", "content": "[reply in their voice]" }

After the signal, say something brief. No fanfare.
```

### 5. Add `?replyTo` handling in `chat.njk`
- On load: detect `?replyTo={momentId}` URL param
- Fetch moment details via `/api/moment-list` or new GET endpoint
- Show context banner above chat: "Replying to {name}'s moment ({date}): {content}" + [Cancel]
- Use separate localStorage keys for reply-mode chat (don't mix with normal chat)
- Pass `replyToMomentId` in chat-stream request body
- Add `SEND_REPLY` to signal marker list in `appendStreamingText` and `finalizeStreamingMessage`
- Handle `SEND_REPLY` signal: call `/api/moment-reply-save`, show brief confirmation, navigate to `/`
- Path: `apps/relationship-web/src/chat.njk`

### 6. Add reply display + "Reply" link on moment cards
- Modify `moment-list.js` to include replies in response (batch fetch via `getRepliesByMomentIds`)
- On homepage (`index.njk`) and `/moments/` (`moments.njk`):
  - Show existing reply under moment card: "Erik replied: {content}"
  - Show "Reply: Chat" link for partner's unreplied moments
  - "Chat" links to `/chat/?replyTo={momentId}`
- Need current user's firstName to determine which moments are partner's
- Paths: `src/index.njk`, `src/moments.njk`, `netlify/functions/moment-list.js`

## Key files to modify
- `apps/relationship-web/netlify/edge-functions/chat-stream.ts` — signal pattern
- `apps/relationship-web/netlify/functions/rely-chat-init.js` — reply-mode prompt
- `apps/relationship-web/src/chat.njk` — reply flow + signal handling
- `apps/relationship-web/src/index.njk` — reply display + link
- `apps/relationship-web/src/moments.njk` — reply display + link
- `apps/relationship-web/netlify/functions/moment-list.js` — include replies

## Verification
1. Create a test moment as Marta (hard type)
2. Sign in as Erik, see "Reply: Chat" on the moment
3. Tap Chat → opens Pidgerton with context banner showing Marta's moment
4. Chat → Pidgerton emits SEND_REPLY → reply saves
5. Navigate to homepage → reply visible under the moment
6. Sign in as Marta → see the reply
