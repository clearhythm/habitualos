# Signal — Design Notes & Code Reference

*A working document summarizing what Signal is, what's been built, and what V1 requires.*

---

## What Signal Is

Signal is an AI-powered professional networking widget embedded on erikburns.com. The core idea: instead of a static résumé, visitors have a conversation with an agent trained on Erik's real work history. The agent responds honestly — including about mismatches — and returns a structured **Fit Score** when it has enough context to do so.

**Tagline:** "Professional networking built on real work, not résumés."

**Intended destination:** `signal.habitualos.com` (not yet live — linked in the footer of the preview card)

---

## The Fit Score

The core output of a Signal conversation. Two parts:

**1. Overlap Score (1–10)**
Surfaced mid-conversation when the visitor has shared enough about themselves. Shown as a visual card appended to the chat. Includes:
- A numeric score (1–10)
- A 1–2 sentence reason that references specific projects/skills on both sides

**2. Sample card (teaser, static)**
Shown on the homepage before the chat opens. Three scored dimensions:
- Skills: 8 (82% bar fill)
- Alignment: 9 (88% bar fill)
- Personality: 7 (74% bar fill)
- Overall ring score: 9

The bars animate in on scroll and re-animate on hover.

---

## Visitor Personas

Signal asks visitors to identify themselves before the conversation starts. Four options, each with different framing and an opening message:

| Persona   | Who they are | Opening message |
|-----------|-------------|-----------------|
| `recruiter` | Recruiter or hiring manager | "What role are you hiring for? I can tell you honestly where he'd be a strong fit (and where he wouldn't be)." |
| `founder`   | Founder or operator building something | "I can tell you what Erik has built, what worked, and where his experience might overlap with what you're working on. What are you building?" |
| `builder`   | Engineer, PM, or technical builder | "Erik builds agentic AI systems with Claude, designs behavioral health products, and writes real code. What are you working on?" |
| `curious`   | Just exploring | "I'm an AI built on Erik's work history, spanning neuroscience research, enterprise product, clinical therapy, and agentic AI. What brings you here?" |

Switching persona mid-conversation resets chat history and shows the new persona's opener.

---

## Erik's Context (baked into the system prompt)

From `netlify/functions/signal-chat.js`:

**Background:**
- Stanford biological sciences — ranked first in class, Beckman Scholar, published in neuroscience and cognitive science
- 25+ years consumer and enterprise product: Apple, Intuit, Realtor.com, Capital One — 100M+ users
- Measurable outcomes: $45M revenue at Realtor.com (14% paid conversion lift), 20% support call reduction at Intuit, 300% ROI increase at Capital One
- Founded Healify 2020 — behavioral health platform, 1M+ mood assessments
- Licensed somatic therapist — treated 100+ patients through hypnotherapy and nervous system regulation
- Building HabitualOS since 2024 — production multi-agent AI system, used daily

**Where he excels:**
- Behavioral science + AI intersection (trained therapist who ships production AI)
- Getting agentic systems to production (not demos)
- Consumer product strategy with measurable revenue impact
- Founding-level product work: concept, architecture, clinical validation, and code

**Where he's still learning (intentionally honest):**
- Large-scale distributed systems engineering
- Business development and enterprise sales

**What he's looking for:**
- Senior product or AI leadership roles where behavioral science + agentic AI is the core challenge
- Collaborative work with founders building serious AI-native products
- Open to advisory, fractional, or full-time depending on fit

---

## How the Overlap Score Is Generated

The backend prompts Claude to optionally append a structured block to any response:

```
OVERLAP
---
SCORE: [1-10]
REASON: [1-2 sentences referencing actual projects/skills on both sides]
```

The Netlify function parses this block out of the response, returns it separately as `{ score, reason }`, and the JS widget renders it as a distinct visual card (`signal-overlap`) appended to the chat. Not forced on every message — only when enough visitor context exists.

---

## Code Files

### Backend
- [`netlify/functions/signal-chat.js`](../netlify/functions/signal-chat.js) — Netlify function, Claude `sonnet-4-6`, Erik's context + persona framing + overlap score extraction. POST endpoint at `/.netlify/functions/signal-chat`. Accepts `{ persona, message, chatHistory }`, returns `{ success, response, overlap }`.

### Frontend JS
- [`src/assets/js/signal.js`](../src/assets/js/signal.js) — Chat widget. Persona selection, chat history (client-side array), POST to backend, typing indicator (animated dots), overlap card rendering.

### Homepage section (teaser only, no live chat)
- [`src/index.njk`](../src/index.njk) lines 42–96 — The "What's the Score?" section with sample card, bar animations, and "Get Our Fit Score" CTA buttons.

### Coming-soon modal (placeholder)
- [`src/index.njk`](../src/index.njk) lines 524–547 — All `.signal-open-modal` clicks currently open this overlay. Has a close button and mailto link. **This is what V1 replaces.**

### Styles
- [`src/assets/styles/components/_landing.scss`](../src/assets/styles/components/_landing.scss) lines 1802–2600 — All signal-* classes. Covers:
  - `.signal-widget` — split-column grid layout (260px left / 1fr right on desktop)
  - `.signal-panel--left` / `.signal-panel--right` — panel columns
  - `.signal-personas` / `.signal-persona-btn` — persona selector row, pill buttons
  - `.signal-messages` — scrollable message container (min 280px, max 480px)
  - `.signal-message--user` / `.signal-message--assistant` — message bubbles
  - `.signal-message--thinking` — animated typing dots (3-dot bounce)
  - `.signal-overlap` — overlap score card (score number + reason text)
  - `.signal-form` / `.signal-input` / `.signal-send` — chat input row
  - `.signal-sample-*` — static preview card classes (bars, ring, labels)
  - `.signal-orb-wrap` / `.signal-ring-wrap` — ring animation (scroll-triggered enter, hover pulse)
  - `#signal.section` — section padding override (6rem top / 7rem bottom) with box-shadow bands

---

## V1 Gap — What's Missing

Everything is built except **the chat widget HTML**. The SCSS and JS are complete and deployed. The backend function is deployed. The only thing blocking V1 is:

1. Replace the coming-soon modal with a real modal (or inline panel) that contains:
   - Persona selector buttons (`.signal-persona-btn` × 4)
   - Message container (`#signal-messages` / `.signal-messages`)
   - Chat form (`#signal-form` / `.signal-input` / `.signal-send`)
   - Signal footer (logo + branding line)

2. Wire `src/assets/js/signal.js` into the page (currently built but not yet loaded / the DOM elements it targets don't exist).

The widget layout classes (`.signal-widget`, `.signal-panel--left`, `.signal-panel--right`) are in the SCSS but have no corresponding HTML in the page.

---

## Open Design Questions (as of session end)

- **Modal vs inline:** Should clicking "Get Our Fit Score" open a fullscreen/overlay modal, or expand an inline panel below the teaser card? Modal is simpler to build; inline is more integrated.
- **First message or persona first?** Current design: persona first, then chat opens. Alternative: skip persona and let Signal figure out context from the first message.
- **Mobile layout:** The `.signal-widget` goes single-column on mobile. The persona buttons wrap. Needs testing.
- **Fit Score vs Overlap Score:** The teaser card calls it "Fit Score" with Skills/Alignment/Personality dimensions. The live chat generates an "Overlap Score" (single 1–10 number + reason). These aren't the same shape — worth deciding if V1 should align them or keep them distinct.
