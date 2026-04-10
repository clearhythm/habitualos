# TICKET-1b: Person Fit Scoring Engine

## Why this exists

This is the conceptual core of the entire network feature — the thing that makes it Signal and not just a contacts list. Every other network ticket (discovery, outreach, the dashboard table) is downstream of this one question: *how similar are two people, and in what ways?*

Person-to-person scoring is fundamentally different from the JD scoring Signal already does. JD scoring asks "does this person's past fit this role's requirements?" — it's backward-looking and asymmetric. Person scoring asks "would these two people find value in knowing each other?" — it's bidirectional, trajectory-aware, and depends on reading personality signals in addition to credentials.

The output of this ticket is a single service function: `scorePersonAgainstOwner()`. It takes an owner profile and a contact's extracted profile, runs a Sonnet prompt, and returns a structured score. Everything downstream calls this.

**Depends on:** TICKET-1 (db-signal-contacts must exist before scores can be stored)

---

## ⚠️ Stop before executing — design questions to resolve first

This ticket requires design decisions that will shape the prompt and the score calibration. **Ask the user these questions before writing any code.** Record their answers in this ticket and adjust the implementation accordingly.

---

### Q1: What does the overall score mean in practice?

The plan has three downstream thresholds:
- Discovery pipeline filters out contacts below **6**
- Auto-outreach triggers at **8+**
- The dashboard shows a "High match" filter at **8+**

Do these numbers feel right to you? Concretely: if Signal found 20 people, would you want to reach out to roughly the top 25% (scores 8-10), see everyone scoring 6+ in the full table, and discard the rest? Or should these thresholds shift?

*This matters because the prompt needs calibration anchors. If "8" means top 10% of people you'd ever want to meet, the instructions to the model are different than if it means "reasonably interesting."*

---

### Q2: Which part of your profile should drive the scoring?

The owner doc has: `contextText` (bio), `skillsProfile`, `wantsProfile`, `personalityProfile`, plus synthesized chunks from Signal sessions. The current plan uses `buildProfileSection()` + `buildCoverageSection()` from `signal-init-shared.cjs`, which assembles all of those together.

For person scoring specifically — is **trajectory and personality** the dominant signal, with skills as a secondary check? Or do you want skills overlap to carry more weight?

*This determines how the owner context is assembled in the prompt and whether we want the full synthesized profile or a slimmer version that foregrounds wants/personality.*

---

### Q3: How should the model handle sparse prospect data?

Most scraped profiles will be thin: a title, a company, maybe 2-3 bullet points from a LinkedIn summary. The `style` dimension in particular is nearly impossible to assess from a job title alone.

Options:
- **Default sparse style scores to 5 (neutral)** and note low confidence
- **Let the model score freely** knowing it will produce lower-quality style scores on thin data, reflected in a low confidence value
- **Skip the style dimension entirely** when raw text is under a threshold length, and reweight: domain × 0.60 + trajectory × 0.40

Which behavior do you want? *(Recommended: default to neutral on sparse data — it's honest and avoids punishing people for having minimal web presence.)*

---

### Q4: Is working style compatibility actually scoreable here?

The `style` dimension assumes Signal has enough behavioral data on both the owner AND the prospect to compare how they work. The owner side is reasonably rich (Signal sessions give personality signals). The prospect side will usually be sparse.

Should `style` stay as a scored dimension, or should it be replaced with something more observable from public profiles — like **communication clarity**, **depth of thinking visible in writing**, or **community/collaboration signals** (open source, writing, talks)?

*This is the dimension most likely to produce noise. It's worth being intentional about what we're actually measuring.*

---

### After answering: adjust the implementation below accordingly

The code here reflects the defaults — revise the prompt, weights, and confidence guidance based on answers before executing.

---

## Example scored output

Before writing code, here's what a good score response looks like — use this as a calibration target when reviewing the first real outputs:

```json
{
  "domain": 8,
  "trajectory": 7,
  "style": 5,
  "overall": 7,
  "confidence": 0.55,
  "summary": "Strong domain overlap in AI product and behavioral systems. Both moving toward founder/operator roles from IC backgrounds, which makes the trajectory alignment interesting. Style score is low-confidence — not enough writing or behavioral signal to assess.",
  "sharedGrounds": [
    "AI product development",
    "behavioral systems / habit formation",
    "IC-to-operator career trajectory"
  ]
}
```

A `confidence` of 0.55 here means: the scores are directionally right but shouldn't be fully trusted. A scrape that returns only a job title and company might produce confidence of 0.2-0.3 — still useful for rough filtering, but not for outreach decisions.

---

## Read first

- `/Users/erik/Sites/habitualos/apps/signal/netlify/functions/_services/signal-score-opportunity.cjs` — the two-model Haiku→Sonnet pipeline pattern; person scoring uses Sonnet only (no distillation step needed, prospect profiles are already short)
- `/Users/erik/Sites/habitualos/apps/signal/netlify/functions/_services/signal-init-shared.cjs` — `buildProfileSection()`, `buildCoverageSection()` — understand what these produce before using them in the prompt
- `/Users/erik/Sites/habitualos/apps/signal/netlify/functions/_services/db-signal-owners.cjs` — owner schema; note which fields are relevant to person scoring vs. JD scoring

---

## Create `netlify/functions/_services/signal-score-person.cjs`

```js
'use strict';

/**
 * signal-score-person.cjs
 *
 * Scores the fit between a Signal owner and a prospect contact.
 * This is person-to-person scoring — bidirectional, trajectory-aware,
 * not a credentials-vs-requirements check.
 *
 * Dimensions:
 *   domain overlap      — shared expertise, industries, technologies, topics
 *   trajectory alignment — are they moving in directions that would make
 *                          a connection mutually generative?
 *   working style       — personality/style compatibility from available signals
 *
 * Weights: overall = round(domain × 0.45 + trajectory × 0.35 + style × 0.20)
 *
 * Uses Sonnet 4.6 directly. No distillation step — prospect profiles
 * are already short; Haiku extraction happens upstream in the scraper.
 */

const { buildProfileSection, buildCoverageSection } = require('./signal-init-shared.cjs');

const SCORE_PERSON_PROMPT = ({ ownerContext, contactProfile }) => `You are scoring the professional fit between two people for a potential connection. Score honestly — a 4 is a 4.

== PERSON A (Signal owner) ==
${ownerContext}

== PERSON B (prospect) ==
Name: ${contactProfile.name || 'Unknown'}
Title: ${contactProfile.title || 'not specified'}
Company: ${contactProfile.company || 'not specified'}
Summary: ${contactProfile.summary || 'not available'}
Skills/domains: ${(contactProfile.skills || []).concat(contactProfile.domains || []).join(', ') || 'not specified'}
Trajectory: ${contactProfile.trajectory || 'not specified'}

Score three dimensions (0-10):

- Domain overlap: shared expertise areas, industries, technologies, topics. High score = significant overlap in what they know and work on.

- Trajectory alignment: are they moving in directions that would make a connection mutually generative? This is about where each person is GOING, not just where they've been. High score = both moving toward goals where knowing each other would matter.

- Working style: personality and style compatibility based on available signals — how they communicate, what they value, their orientation toward work. If Person B's data is sparse, score this 5 (neutral) and note low confidence. Do not penalize for having minimal web presence.

Return ONLY valid JSON — no explanation, no markdown:
{
  "domain": 0,
  "trajectory": 0,
  "style": 0,
  "overall": 0,
  "confidence": 0.0,
  "summary": "2-3 sentences on why this match is or isn't interesting — be specific about what overlaps or doesn't",
  "sharedGrounds": ["specific overlapping area 1", "area 2"]
}

overall: round(domain × 0.45 + trajectory × 0.35 + style × 0.20)
confidence: 0.0–1.0. Rich profiles on both sides → 0.7+. Sparse prospect (title + company only) → 0.2–0.4. One strong dimension well-evidenced → 0.5–0.6.
sharedGrounds: 2–4 specific things they share — name the actual skill, domain, interest, or trajectory signal, not generic categories.`;

async function scorePersonAgainstOwner({ owner, contactProfile, anthropicClient }) {
  // Build owner context — same approach as JD scoring prompts
  const profileSection = buildProfileSection(owner);
  const coverageSection = buildCoverageSection(owner);
  const ownerContext = [
    owner.contextText ? `Background: ${owner.contextText}` : '',
    profileSection,
    coverageSection,
  ].filter(Boolean).join('\n\n');

  const msg = await anthropicClient.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 512,
    messages: [{ role: 'user', content: SCORE_PERSON_PROMPT({ ownerContext, contactProfile }) }],
  });

  const raw = msg.content[0]?.text || '{}';
  const match = raw.match(/\{[\s\S]*\}/);
  const parsed = JSON.parse(match ? match[0] : raw);

  // Recompute overall from dimensions to guarantee formula consistency
  parsed.overall = Math.round((parsed.domain * 0.45) + (parsed.trajectory * 0.35) + (parsed.style * 0.20));

  return parsed;
}

module.exports = { scorePersonAgainstOwner };
```

---

## Critical Files

| File | Action |
|---|---|
| `netlify/functions/_services/signal-score-person.cjs` | New |

---

## Do not commit
Leave all changes for review.

## Verification

1. Call `scorePersonAgainstOwner()` directly with a real owner doc and a hand-crafted `contactProfile` — verify JSON parses cleanly and `overall` matches the formula
2. Test with a sparse contactProfile (name + title only) — verify `confidence` is low (< 0.4) and `style` defaults toward 5
3. Test with a rich contactProfile — verify `confidence` rises and `sharedGrounds` are specific, not generic
4. Review 3-5 real scored outputs against the calibration example above — do the numbers feel right given the thresholds used downstream (≥6 discovery filter, ≥8 outreach)?
