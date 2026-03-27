# Signal — Design Philosophy & Dimension Framework

## The Core Thesis

Signal is not a hiring tool. Hiring is the current context. The deeper purpose is **human potentiation** — helping people and teams understand what the behavioral record of their work actually reveals about them.

The key insight: **prompts are data**. Most people focus on AI outputs. Signal focuses on the inputs — the behavioral trace left by how someone actually works. That trace is rich with signal about who a person is, not just what they can do.

A secondary insight: **how someone treats an AI is not categorically different from how they treat another person**. AI removes the social friction that normally masks behavior. The impatience, the precision, the self-correction, the aesthetic sensitivity — these are consistent character expressions, not context-dependent performances.

---

## The Three Dimensions

Skills, alignment, and personality are not equal in how they emerge from data. Each requires a different extraction strategy and accumulates at a different rate.

### 1. Skills
**What it is:** Technical and domain competencies demonstrated through work.
**How it emerges:** High frequency, low inference. Present in almost every session.
**Extraction:** Relatively objective. What was built, what technologies used, what problems solved, what complexity was navigated.
**Confidence:** High. Verifiable from session content.

### 2. Personality
**What it is:** Behavioral and dispositional patterns — how someone works, not what they work on.
**How it emerges:** Medium frequency, medium inference. Present in most sessions if you look for the right signals.
**Extraction:** Requires looking at *how*, not *what*:
- How someone handles being blocked (persistence, pivot, escalation)
- Whether they over-engineer or cut scope
- How they respond to their own mistakes
- The ratio of questioning to executing
- What they notice aesthetically and correct unprompted
- When frustration surfaces and what triggers it
- Whether self-correction happens and how it's framed
- Tolerance for ambiguity vs. need for specification

**Confidence:** Medium. Patterns only become reliable across multiple sessions.

### 3. Alignment
**What it is:** What someone is actually oriented toward — values, interests, what they're moving toward or away from.
**How it emerges:** Low frequency, high inference. Rare in work sessions alone. Comes out most clearly in conversation.
**Extraction:** Look for:
- What someone *chooses* to work on when they have latitude
- What they push back on or abandon
- What they describe with energy vs. obligation
- Conversational signals about what they're looking for

**Confidence:** Low from sessions alone. High when combined with conversational data.
**Primary instrument:** The chat interface, not session ingests.

---

## Implications for the Ingest Pipeline

The current ingest (`signal-ingest.js`) treats sessions primarily as skill logs — tracking what happened and how it relates to competencies. This is correct but incomplete.

The ingest should run **three extraction passes**, not one:

### Pass 1: Skills extraction (current behavior, refine)
Extract: technologies, problem types, complexity level, output quality signals.

### Pass 2: Personality trace extraction (new)
Extract behavioral signals from the session narrative:
- Friction moments and responses
- Scope decisions (expand vs. constrain)
- Error handling and self-correction
- Aesthetic and quality signals
- Collaboration tone and directness

Store as structured behavioral observations, not summaries. These accumulate into patterns over time.

### Pass 3: Alignment signals (opportunistic)
Only flag when present. Don't force it. Look for:
- Statements of preference or direction
- What the person chose to build when unconstrained
- Explicit statements about what they're looking for

---

## Accumulation Logic

A single session is an anecdote. The value is in accumulation across sessions.

| Dimension | Min sessions for signal | Confidence growth |
|-----------|------------------------|-------------------|
| Skills | 1–3 | Linear |
| Personality | 5–10 | Logarithmic (patterns stabilize) |
| Alignment | Variable | Spike-based (rare but high-value events) |

The profile synthesis layer (not yet built) should weight recency and consistency — a personality pattern that appears in 30 of 40 sessions is more reliable than one that appeared 3 times recently.

---

## How This Should Inform Ongoing Development

### In this codebase

1. **Redesign the ingest prompt** in `signal-ingest.js` to run all three extraction passes and return structured fields for each dimension — not just a freeform summary.

2. **Extend the Firestore schema** for ingested sessions to store `skills[]`, `personalityTraces[]`, and `alignmentSignals[]` as separate arrays alongside the existing summary.

3. **Build a synthesis layer** — a function (or endpoint) that reads accumulated sessions and produces a rolling profile across all three dimensions. This feeds the RAG context that the chat agent uses.

4. **The chat interface IS the alignment instrument** — design conversation flows that surface alignment signals and feed them back into the profile. A person's response to an eval, their stated reasons for interest or hesitation — these are data points.

5. **Treat the owner's own behavior as signal** — how Erik (or any Signal owner) interacts with their own agent, what they refine, what they push back on, is itself a behavioral record worth capturing.

### In CLAUDE.md and architecture.md

- `CLAUDE.md` should reference this document so every session is framed within the three-dimension model
- `architecture.md` should document the ingest schema extensions and synthesis layer once designed
- When writing ingest prompts or synthesis logic, always ask: *which dimension does this serve, and what's the appropriate confidence level?*

---

## Polarity — Strengths and Edges

Personality signals are not uniformly positive. Honest collection requires capturing both polarities.

**Naming: `strength` and `edge`**
- `strength` — what the person consistently brings; publicly expressible
- `edge` — patterns worth examining; honest observations about friction, avoidance, or recurring difficulty

"Edge" carries a deliberate double meaning: a boundary (something to be aware of) and sharpness (not inherently negative — edges can be useful). It avoids clinical language ("weakness", "deficit") and coaching-speak ("growth area") while remaining honest.

### Reflection Mode

Owners control how deeply their personality signals are extracted via `reflectionMode`:

- **Standard** — extracts strength signals only. Appropriate for owners who want a professional, public-ready profile.
- **Coach** — extracts both strengths and edges. For owners who want the fuller picture for self-understanding.

Collection mode and presentation context are separate concerns:

| Context | What's shown |
|---------|-------------|
| Visitor widget / chat | Strengths only (always) |
| Owner dashboard | Both, visually separated |
| Owner chat agent | Both, labeled |
| RAG context (visitor) | Strengths only |
| RAG context (owner) | Both |

### The Therapeutic Contract

Unsolicited critical reflection is a violation of the implicit contract between people — and between a person and a tool. Signal never surfaces edge signals to anyone who hasn't explicitly opted in. The owner contracts for coach mode; visitors never receive another person's edges.

This principle — that insight must be contracted for, not delivered unilaterally — is central to how Signal differs from assessment tools that pathologize or flatter without permission. It is also a core principle in the work of David D. Burns and CBT-informed coaching: you do not offer an insight someone hasn't asked for.

### Future: Real-Time Edge Detection

The deepest application of this framework is an agent that notices behavioral signals *during* a working session and gently surfaces them in the moment — not as judgment, but as reflection. The agent as a trusted mirror.

This is explicitly **not in current scope**. How it surfaces is art, not science. A poorly timed or poorly framed reflection is worse than none. It requires its own design phase, a separate consent model, and significant iteration. But it is the direction this is pointing.

---

## The Experience Layer — Talking TO the Person

Signal's interface is not a report viewer. It's a conversation with the candidate.

The AI speaks in first person *as* the candidate, voiced by the behavioral record. The agent disappears. What remains is: you can talk to someone who has unusual self-knowledge.

> *"My Signal score for this role is 84. Here's what drove it — and here's where I'd genuinely struggle."*

This reframes the entire product. Most candidates can't answer "where would you struggle in this role?" with any precision. Signal makes that possible because the behavioral evidence is right there, accessible as memory.

**The core use case, stated plainly:** "Go find out if we should talk more." Signal is the pre-conversation — it handles the part that's awkward, repetitive, and inefficient. When a real conversation happens, it's already worth both parties' time.

The fit score stays. But it's delivered by the person, not a black box. This makes it more credible (the candidate is vouching for it, not a screener), more honest (they can explain where they fell short), and more useful (the conversation that follows is about specifics, not impressions).

**The agent as instrument:** The candidate wields their behavioral record like a doctor reading their own labs. They don't say "my diagnostic agent reports..." — they say "my numbers show X, here's what I think it means."

---

## Voice — A Fourth Dimension

The three dimensions (skills, personality, alignment) describe *what* someone is. Voice captures *how they sound* — the tone, register, and stance that makes them recognizable.

Voice matters because the experience layer requires it. A first-person chat that sounds generic defeats the purpose. But voice is also the hardest dimension to extract — especially for users whose sessions are sparse and task-oriented.

**Important constraint:** Not everyone leaves rich voice signal in their AI sessions. People who use AI as a tool ("fix this bug") leave thin data. People who use AI collaboratively (explaining context, debating approaches, self-correcting out loud) leave rich data. Signal works best for the latter — but needs a graceful fallback for the former.

**What's always present, even in sparse sessions:**
- How problems are framed (context-rich vs. code-dump)
- Response to pushback (accepts suggestions vs. argues back)
- Vocabulary register (technical precision, abstraction level, metaphor use)
- Pacing (slow iteration vs. fast and course-correct)
- How the AI is addressed (collaborative vs. directive)

**Extraction targets for voice:**
- Sentence rhythm: terse vs. expansive
- Default register: formal / casual / technical / conversational
- Recurring framing patterns or phrases
- Whether the person explains their reasoning or just states conclusions
- Degree of expressed uncertainty vs. confidence

**Sparse profile handling:** When voice data is thin, the candidate defaults to neutral/professional. Never invent a voice that isn't evidenced. A flat voice is honest; a fabricated one breaks trust the moment it diverges from reality.

**In the ingest pipeline:** Voice should be captured as a separate field — not folded into personality. It's less about *what they do* and more about *how they sound doing it*. A small number of observations per session, accumulated into a voice profile over time.

---

## The Longer Arc

Hiring is the current application. The longer arc is helping teams understand the behavioral data they're already generating — every prompt, every session, every correction. Most organizations aren't thinking about this yet. Signal is a prototype for what it looks like when you do.

The three dimensions (skills, personality, alignment) are a starting framework, not a finished taxonomy. They will evolve as the data accumulates and patterns emerge that the framework doesn't yet account for.

The goal is not assessment. It's **recognition** — helping people see clearly what they're already expressing.
