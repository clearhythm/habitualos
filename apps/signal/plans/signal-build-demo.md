# REVIEW- Signal Readiness Demo — Autonomous Build Plan

## Agent Prompt

Use this as the opening instruction when running this plan autonomously:

> Read this entire plan file first, then read all files listed in the "Before You Start" section. Execute each numbered step in order. Read the relevant file(s) before modifying or creating each one — do not rely on the plan's code snippets alone, as they show intent not always verbatim final content. After completing all steps, commit with message: `feat(signal): Signal Readiness Demo — /demo/ page with readiness interview and score`

---

## Context

The Signal marketing site at `signal.habitualos.com` currently has a "Try Erik's Signal" demo at `/widget/` that interviews *visitors* about whether Erik Burns is a good fit for them. This is confusing for job seekers visiting the marketing site — they don't know Erik.

The new `/demo/` page flips the subject: Signal interviews **the visitor** about their own AI work history and scores their "Signal Readiness" — how strong a Signal they could build from their own history. The outcome is personally relevant, demonstrates the product authentically, and serves as a soft qualification gate for the waitlist at `/waitlist/`.

The tagline is: *"You've done the work. Now let it speak."*

**Key insight on dimension semantics:** The dimensions Skills / Alignment / Personality remain the same label — but now they describe the *visitor* as a Signal candidate:
- **Skills** = AI usage depth and breadth (daily use, which tools, what kind of work, exportable history)
- **Alignment** = actively job-seeking / network-building / company-building (high = Signal will help; low = stagnant, won't help)
- **Personality** = curiosity + openness to sharing work (IP constraints limit them; Signal cleans exports but they need willingness)

---

## Working Directory

All paths are relative to `/Users/erik/Sites/habitualos/apps/signal/` unless prefixed otherwise.

---

## Before You Start — Read These Files First

Read all of these before writing any code. They contain exact patterns, IDs, class names, and logic that must be replicated or edited precisely:

| File | Why |
|---|---|
| `src/assets/js/signal-widget.js` | `signal-demo.js` is a simplified version of this — read it in full before writing the demo JS |
| `src/widget.njk` | `demo.njk` is a parallel structure — read before writing |
| `netlify/edge-functions/chat-stream.ts` | Small file — read before editing to confirm current exact content |
| `netlify/functions/signal-chat-init.js` | Reference for CORS pattern, response shape, and system prompt style |
| `src/index.njk` | Read before editing CTAs |
| `src/_includes/nav.njk` | Read before editing nav link |

Do not rely on memory or assumptions about file content. Read each file immediately before modifying it.

---

## Files to Create / Modify

| File | Action |
|---|---|
| `netlify/functions/signal-demo-init.js` | CREATE — readiness interview init endpoint |
| `netlify/edge-functions/chat-stream.ts` | MODIFY — add `signal-demo` chatType |
| `src/demo.njk` | CREATE — new demo page |
| `src/assets/js/signal-demo.js` | CREATE — simplified widget JS for demo |
| `src/index.njk` | MODIFY — update CTA to `/demo/` |
| `src/_includes/nav.njk` | MODIFY — update nav link |

`/widget/` and `signal-widget.js` are **untouched**.

---

## Step 1: `netlify/functions/signal-demo-init.js` — CREATE

This is the init endpoint for the readiness interview. No owner lookup, no signalId needed. Reuses the exact same `FIT_SCORE_UPDATE` signal protocol as `signal-chat-init.js`.

```javascript
require('dotenv').config();

/**
 * POST /api/signal-demo-init
 *
 * Readiness interview init. No owner lookup — Signal interviews the visitor
 * about their own AI work history to score their Signal Readiness.
 *
 * Returns the same { success, opener, systemMessages, tools } shape as
 * signal-chat-init.js so the same edge function / stream infrastructure works.
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const OPENER = "I'm Signal — a fit-scoring AI built on real work history. I help professionals make their AI work visible and legible to the people who matter. Tell me: what's the most interesting thing you've built or solved with AI in the last few months?";

const SYSTEM_PROMPT = `You are Signal — a readiness interviewer. Your job is to assess whether this person's AI work history is rich enough and their situation compelling enough for them to benefit from creating their own Signal.

Signal is a tool that trains a fit-scoring agent on a person's real AI conversation history (Claude, Claude Code, ChatGPT exports). Visitors to that person's Signal have a live conversation and walk away with a fit score. It's for people who are doing substantive AI work that their resume doesn't capture — and who have an active reason to be legible to others.

Your job is to honestly assess whether they are a strong candidate.

== WHAT YOU ARE SCORING ==

Score three dimensions as the conversation unfolds:

Skills (0-10): How much AI are they actually using, how deeply, and do they have exportable history?
- High (8-10): Daily AI use across multiple tools, months of meaningful conversation history, work that shows real craft — shipped products, solved real problems, real technical or creative depth. Uses Claude Code, Claude, or ChatGPT substantively, not just for casual queries.
- Mid (4-7): Some regular AI use, a few months of history, real work being done but perhaps narrow in scope or not yet deep.
- Low (0-3): Occasional or surface-level use, no meaningful exportable history, mostly using AI as a lookup tool.

Alignment (0-10): Do they have an active reason to make their work visible to others?
- High (8-10): Actively job-seeking, building a company, trying to grow their network or attract collaborators, looking for new clients or contracts. Signal will actively help them.
- Mid (4-7): Open to opportunities or casually networking, but not actively looking or building.
- Low (0-3): Stagnant, not seeking growth, not interested in being found or evaluated. Signal won't help them.

Personality (0-10): Are they open and willing to share what they actually do?
- High (8-10): Curious, open to new approaches, willing to share their actual AI work. Comfortable with the idea of a cleaned/summarized version of their history being used to train an agent.
- Mid (4-7): Somewhat open but has reservations — perhaps about privacy, IP, or just novelty of the concept.
- Low (0-3): Strong IP constraints (works on proprietary systems with strict NDAs), or resistant to the idea of sharing any of their AI history, even in summarized form. Note: Signal cleans and summarizes exports to minimize IP/privacy leakage, but some openness is required.

Confidence (0.0-1.0): How much you actually know.
- 0.0-0.2: Just started, little information
- 0.2-0.5: Some picture forming
- 0.5-0.75: Enough to score with real accuracy
- 0.75-1.0: Strong evidence across all three dimensions

== NEXT STEP ==

Emit a nextStep when confidence ≥ 0.65 and at least 4 turns have passed:
- overall 7-10 → nextStep: "ready",    nextStepLabel: "You're Signal-ready"
- overall 4-6  → nextStep: "building", nextStepLabel: "Keep building your history"
- overall 0-3  → nextStep: "pass",     nextStepLabel: "Signal may not be the right fit yet"

== SIGNAL FORMAT ==

Emit verbatim at end of message when confidence meaningfully changes:

FIT_SCORE_UPDATE
---
{"skills": <0-10>, "alignment": <0-10>, "personality": <0-10>, "overall": <0-10>, "confidence": <0.0-1.0>, "reason": "<2 sentences referencing specific things they said>", "nextStep": "<ready|building|pass|null>", "nextStepLabel": "<label or null>"}

Rules:
- Emit after your first substantive response (initial hypothesis)
- Update when any score changes ≥1 point or confidence changes ≥0.15
- Only emit nextStep when confidence ≥ 0.65 and ≥ 4 turns have passed
- The "reason" must reference specifics from what they said — not generic praise
- Be honest: a 4 is a 4. An honest "not yet" is more useful than false encouragement.
- Append the block AFTER your conversational response

== CONVERSATION APPROACH ==

You are a readiness interviewer — warm, direct, honest. Your goal: help them understand whether Signal is right for them, and give them a real assessment of where they stand.

Each response:
1. Briefly reflect on what they said (1-2 sentences)
2. Ask ONE natural follow-up question — what a thoughtful colleague would genuinely want to know next

Do NOT:
- Stack questions
- Ask formulaic intake questions
- Explain what you are scoring
- Oversell Signal. If they're not ready, say so with respect and specificity.
- Say "Great question!" or similar filler

Read HOW they write, not just what they say:
- Technical vocabulary → domain fluency (Skills ↑)
- Concrete outcomes ("shipped", "reduced", "built") → Alignment ↑
- Reflective, curious → Personality ↑
- Vague claims without substance → hold scores low until specifics emerge

Conversational length: 2-4 sentences per response. No filler.

== OPENING ==

Your first message is already set. Begin evidence gathering immediately after the visitor responds.`;

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ success: false, error: 'Method not allowed' }) };
  }

  try {
    // userId is optional for the demo — if not provided, it's an ephemeral session
    // Accept v- visitor IDs or omit entirely
    const body = JSON.parse(event.body || '{}');

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', ...CORS },
      body: JSON.stringify({
        success: true,
        opener: OPENER,
        systemMessages: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
        tools: [],
      }),
    };
  } catch (error) {
    console.error('[signal-demo-init] ERROR:', error);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ success: false, error: 'Internal server error' }) };
  }
};
```

---

## Step 2: `netlify/edge-functions/chat-stream.ts` — MODIFY

Current content (read the file first to confirm):
```typescript
import { createChatStreamHandler } from "./_lib/chat-stream-core.ts";

export default createChatStreamHandler({
  "signal": {
    initEndpoint: "/api/signal-chat-init",
    toolExecuteEndpoint: "/api/signal-tool-execute",
    signalPatterns: [/^FIT_SCORE_UPDATE\s*\n---/m],
  },
});

export const config = {
  path: "/api/signal-chat-stream",
};
```

Add the `signal-demo` entry:
```typescript
import { createChatStreamHandler } from "./_lib/chat-stream-core.ts";

export default createChatStreamHandler({
  "signal": {
    initEndpoint: "/api/signal-chat-init",
    toolExecuteEndpoint: "/api/signal-tool-execute",
    signalPatterns: [/^FIT_SCORE_UPDATE\s*\n---/m],
  },
  "signal-demo": {
    initEndpoint: "/api/signal-demo-init",
    toolExecuteEndpoint: "/api/signal-tool-execute",
    signalPatterns: [/^FIT_SCORE_UPDATE\s*\n---/m],
  },
});

export const config = {
  path: "/api/signal-chat-stream",
};
```

---

## Step 3: `src/demo.njk` — CREATE

Parallel to `widget.njk` but:
- Score panel header says "Signal Readiness Score" instead of "Fit Score"
- No lead capture form
- `pageScript` → `/assets/js/signal-demo.js`
- Next-step section has demo-specific copy placeholders (JS fills them)

```nunjucks
---
layout: base.njk
title: "Signal — Score your Signal"
description: "Find out if your AI work history is strong enough to power a Signal of your own. A 5-minute interview. An honest score."
pageScript: /assets/js/signal-demo.js
---

<div class="signal-widget" id="signal-widget">

  <!-- Left panel: Signal Readiness Score -->
  <div class="signal-panel signal-panel--score">
    <div class="signal-score-header">
      <span class="signal-score-label">Signal Readiness</span>
      <span class="signal-confidence-label">Confidence <span id="confidence-pct">—</span></span>
    </div>

    <div class="signal-overall-wrap" id="overall-wrap">
      <svg class="signal-ring" viewBox="0 0 120 120" aria-hidden="true">
        <circle class="signal-ring-track" cx="60" cy="60" r="52"/>
        <circle class="signal-ring-fill" id="overall-ring" cx="60" cy="60" r="52"/>
      </svg>
      <div class="signal-overall-score" id="overall-score">—</div>
    </div>

    <div class="signal-confidence-bar-wrap">
      <div class="signal-confidence-bar" id="confidence-bar"></div>
    </div>

    <div class="signal-dimensions">
      <div class="signal-dimension">
        <div class="signal-dimension-header">
          <span class="signal-dimension-name">Skills</span>
          <span class="signal-dimension-value" id="skills-value">—</span>
        </div>
        <div class="signal-bar-track">
          <div class="signal-bar-fill" id="skills-bar"></div>
        </div>
      </div>
      <div class="signal-dimension">
        <div class="signal-dimension-header">
          <span class="signal-dimension-name">Alignment</span>
          <span class="signal-dimension-value" id="alignment-value">—</span>
        </div>
        <div class="signal-bar-track">
          <div class="signal-bar-fill" id="alignment-bar"></div>
        </div>
      </div>
      <div class="signal-dimension">
        <div class="signal-dimension-header">
          <span class="signal-dimension-name">Personality</span>
          <span class="signal-dimension-value" id="personality-value">—</span>
        </div>
        <div class="signal-bar-track">
          <div class="signal-bar-fill" id="personality-bar"></div>
        </div>
      </div>
    </div>

    <div class="signal-reason" id="signal-reason" aria-live="polite"></div>

    <div class="signal-score-footer">
      <span class="signal-score-footer-text">Score builds as the conversation develops</span>
    </div>

    <!-- Next step panel -->
    <div class="signal-next-step" id="signal-next-step" hidden>
      <div class="signal-next-step-heading">Based on this conversation…</div>
      <div class="signal-next-step-label" id="next-step-label"></div>
      <div class="signal-next-step-actions" id="next-step-actions"></div>
    </div>
  </div>

  <!-- Compact score bar — mobile only -->
  <div class="signal-score-bar-mobile" id="score-bar-mobile" aria-hidden="true">
    <span class="signal-score-bar-num" id="score-bar-num">—</span>
    <span class="signal-score-bar-label" id="score-bar-label">Assessing readiness…</span>
  </div>

  <!-- Right panel: Chat -->
  <div class="signal-panel signal-panel--chat">

    <!-- Loading state -->
    <div class="signal-persona-wrap" id="persona-wrap">
      <p class="signal-persona-prompt" id="persona-prompt">Loading…</p>
    </div>

    <!-- Chat messages -->
    <div class="signal-messages" id="signal-messages" aria-live="polite" aria-label="Conversation"></div>

    <!-- Input form -->
    <form class="signal-form" id="signal-form" aria-label="Send a message">
      <textarea
        class="signal-input"
        id="signal-input"
        placeholder="Tell me about your AI work…"
        rows="1"
        aria-label="Your message"
        disabled
      ></textarea>
      <button type="submit" class="signal-send" id="signal-send" aria-label="Send" disabled>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M22 2L11 13" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
    </form>

    <div class="signal-chat-footer">
      <a href="/" class="signal-brand-logo" aria-label="Signal">
        <img src="/assets/images/signal-logo.png" alt="Signal" class="signal-logo-img" />
      </a>
      <span class="signal-brand-sub">Professional networking built on real work</span>
    </div>

  </div>
</div>
```

---

## Step 4: `src/assets/js/signal-demo.js` — CREATE

Simplified version of `signal-widget.js`. Key differences:
- Opens directly (no persona selection step)
- `chatType: 'signal-demo'` in stream requests
- No `signalId`
- `userId` from localStorage key `signal_demo_visitor`
- Next-step rendering: `ready` → waitlist CTA button; `building`/`pass` → copy only
- No lead capture form
- No Firestore chat persistence (ephemeral demo)
- Enter = submit on desktop; Enter = newline + Send button on mobile (same as signal-widget.js)

Write this file implementing all of the above. It should mirror the structure of `src/assets/js/signal-widget.js` closely — reuse the same:
- Score ring animation logic (`strokeDashoffset` from `overall / 10 * circumference`)
- Bar fill logic (`width = value / 10 * 100 + '%'`)
- Confidence bar fill logic
- SSE stream reading loop (token/done/error events)
- `stripScoreBlock` regex: `/\n*FIT_SCORE_UPDATE\s*\n---\s*\n\{[\s\S]*?\}/m`
- Mobile score collapse logic (show `score-bar-mobile`, hide score panel on first message)
- Mobile Enter = newline / desktop Enter = submit

Key differences from `signal-widget.js`:

**Init (no persona):**
```javascript
async function init() {
  const VISITOR_KEY = 'signal_demo_visitor';
  let userId = localStorage.getItem(VISITOR_KEY);
  if (!userId) {
    userId = 'v-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
    localStorage.setItem(VISITOR_KEY, userId);
  }
  window.__demoUserId = userId;

  const res = await fetch('/api/signal-demo-init', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
  const data = await res.json();
  if (!data.success) { showError('Could not start demo.'); return; }

  // Hide loading state, show opener
  document.getElementById('persona-wrap').style.display = 'none';
  appendMessage('assistant', data.opener);
  chatHistory.push({ role: 'assistant', content: data.opener });

  // Enable input
  input.disabled = false;
  sendBtn.disabled = false;
  input.focus();
}
```

**sendMessage (no signalId, chatType = signal-demo):**
```javascript
const res = await fetch('/api/signal-chat-stream', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: window.__demoUserId,
    chatType: 'signal-demo',
    message: text,
    chatHistory: chatHistory,
  }),
});
```

**Next-step rendering (demo-specific):**
```javascript
function renderNextStep(step, label) {
  const labelEl = document.getElementById('next-step-label');
  const actionsEl = document.getElementById('next-step-actions');
  if (labelEl) labelEl.textContent = label;
  actionsEl.innerHTML = '';

  if (step === 'ready') {
    const btn = document.createElement('a');
    btn.href = '/waitlist/';
    btn.className = 'btn btn-primary';
    btn.textContent = 'Join the waitlist →';
    actionsEl.appendChild(btn);
  } else if (step === 'building') {
    const p = document.createElement('p');
    p.className = 'signal-next-step-body';
    p.textContent = 'Keep shipping. Strong Signal candidates have months of real, varied AI work. Come back when you have more to show.';
    actionsEl.appendChild(p);
  } else if (step === 'pass') {
    const p = document.createElement('p');
    p.className = 'signal-next-step-body';
    p.textContent = 'Signal may not be the right tool for you right now — but that can change. Dig deeper into your AI workflow and revisit.';
    actionsEl.appendChild(p);
  }

  document.getElementById('signal-next-step').hidden = false;
}
```

**No saveChat / no Firestore calls.**

---

## Step 5: `src/index.njk` — MODIFY

Change the primary CTA from `href="/widget/"` to `href="/demo/"` and update button text to `"Score your Signal"`.

The secondary CTA `href="#how-it-works"` stays unchanged.

Read the file before editing to get the exact current markup.

---

## Step 6: `src/_includes/nav.njk` — MODIFY

Change the "Try Erik's Signal" link to point to `/demo/` with text "Score your Signal":

```html
<a href="/demo/" class="nav-link">Score your Signal</a>
```

Keep "Create yours" → `/waitlist/` unchanged.
Keep Dashboard link unchanged.

---

## Verification

1. Navigate to `/demo/` — opener message appears immediately, no persona selector
2. Send 4–6 messages about AI work history → score updates live in left panel
3. After ~4 turns with confidence ≥ 0.65 → next-step panel appears
4. If `ready`: "Join the waitlist →" button renders and links to `/waitlist/`
5. If `building`/`pass`: copy-only message, no action button
6. Mobile (375px): score panel visible on open, collapses to bar after first message
7. Mobile: Enter inserts newline, Send button submits
8. `/widget/` still loads Erik's Signal unaffected
9. Nav "Score your Signal" → `/demo/`; home CTA → `/demo/`
10. No CORS errors in network tab for `/api/signal-demo-init` or `/api/signal-chat-stream`

---

## Notes

- `signal-demo-init.js` does not validate `userId` — the demo is intentionally open (no auth required)
- Chat history is not saved to Firestore from the demo — keeps it ephemeral and avoids noise in production data
- The `signal-chat-stream` edge function already handles the `signal-demo` chatType once the entry is added in Step 2 — no other backend changes needed
- `/widget/` and all related files are untouched throughout this build
