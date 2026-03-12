# Signal — Phase 5: Opportunity Evaluation + Career Intelligence

## Before Starting

**Read these files first** (in order — each informs the next change):

1. `netlify/functions/signal-lead-save.js` — the auth/validation pattern all new endpoints follow: `httpMethod` check → `JSON.parse(event.body)` → validate userId → `getOwnerByUserId` → guard on `owner.status !== 'active'` → do work → return structured JSON
2. `netlify/functions/_services/db-signal-context.cjs` — specifically the `searchChunks` function added in Phase 4 (used in the evaluation prompt to pull relevant evidence); if Phase 4 is not yet done, use `getTopChunks` as a fallback and note it for later upgrade
3. `netlify/functions/signal-chat-init.js` — see `buildProfileSection()` for how synthesized profiles are formatted into text; reuse this pattern in the evaluation prompt
4. `src/dashboard.njk` + `src/assets/js/dashboard.js` — understand the existing dashboard section/form patterns before adding the Opportunity Fit section; new UI follows the same `.dash-section` / `.dash-form-actions` / `dash-save-status` structure

**Prerequisites:**
- Phase 3 complete — owner must have synthesized profiles (`skillsProfile`, `wantsProfile`, `personalityProfile`) for meaningful scoring; evaluation degrades gracefully if missing (lower confidence, no evidence citations)
- Phase 4 recommended but not required — `searchChunks` improves evidence relevance; `getTopChunks` works as a fallback

**Key pattern:** New Firestore collections (`signal-evaluations`, `signal-resumes`, `signal-covers`) follow the same doc structure as `signal-leads` — see `signal-lead-save.js` and `netlify/functions/_services/db-signal-owners.cjs` for the `db` import and write pattern. All use `@habitualos/db-core`.

**No new env vars needed.** Uses existing `ANTHROPIC_API_KEY` and `FIREBASE_ADMIN_CREDENTIALS`.

---

## Context

Phases 1-4 built Signal as a reactive tool — visitors come to the widget, the agent assesses fit. Phase 5 inverts this: the owner evaluates themselves against *any* opportunity. Paste a job description, a project brief, or a partnership proposal and Signal scores your profile against it, identifies real gaps, and — if the fit is strong enough — generates a tailored resume and cover letter grounded in your actual work history.

This is not a generic resume builder. Every output is derived from evidence in the owner's chunk collection (their real Claude/ChatGPT conversation history). Claims are specific and verifiable, not fabricated.

**The chain:**
```
Job description (URL or paste)
  → Evaluate: skills/alignment fit score + gap analysis
    → If fit ≥ threshold: Generate tailored resume
      → Generate cover letter
        → Owner refines and applies
```

**Secondary use case (free with the same API):** Machine-to-machine scoring — another agent, an ATS, or another Signal profile can POST a job description and get a structured evaluation back. The self-evaluation product and the M2M integration are the same endpoint.

---

## Part 1 — Evaluation Engine

### `POST /api/signal-evaluate`

Single-call evaluation. No streaming, no conversation. Both sides of context loaded, scored by Claude in one pass.

**Request:**
```json
{
  "userId": "u-...",
  "targetSignalId": "erik-burns",
  "opportunity": {
    "type": "job-description" | "project-brief" | "partnership" | "free-text",
    "title": "Senior AI Product Lead — Seed Stage Startup",
    "content": "We are building...",
    "url": "https://..."   // optional, for display only
  }
}
```

**Response:**
```json
{
  "success": true,
  "evaluationId": "eval-...",
  "score": {
    "skills": 8,
    "alignment": 6,
    "overall": 7
  },
  "confidence": 0.85,
  "recommendation": "strong-candidate" | "worth-applying" | "stretch" | "poor-fit",
  "strengths": [
    "Production agentic AI experience directly matches their stated need",
    "Behavioral health background is rare and explicitly mentioned as a plus"
  ],
  "gaps": [
    {
      "dimension": "skills",
      "gap": "Role requires Kubernetes/containerization; history shows serverless/edge only",
      "severity": "moderate",
      "closeable": true,
      "framing": "Netlify Edge Functions and serverless architecture covers comparable infrastructure concerns at a different layer"
    },
    {
      "dimension": "alignment",
      "gap": "Role is described as IC-heavy engineering; profile suggests senior product/hybrid preference",
      "severity": "high",
      "closeable": false
    }
  ],
  "summary": "Strong skills match on AI systems and behavioral product. The alignment gap is worth understanding — this role skews more IC engineering than the leadership/craft hybrid you've expressed interest in.",
  "evidenceUsed": ["[2024-11] HabitualOS streaming architecture", "[2024-09] Healify behavioral model design"]
}
```

**Note:** Personality dimension is intentionally omitted from opportunity evaluation — it requires behavioral observation of an actual human. Skills and alignment are fully scoreable from structured data on both sides.

### Evaluation prompt design

The Claude call gets both sides of full context:

```
== CANDIDATE PROFILE ==
{skillsProfile, wantsProfile, personalityProfile summary}

== RELEVANT EVIDENCE ==
{top chunks matched by concept overlap to the opportunity — uses same searchChunks() from Phase 4}

== OPPORTUNITY ==
Type: {type}
Title: {title}
{content}

Evaluate fit across two dimensions:
- Skills (0-10): How well does the candidate's demonstrated experience match what this role/project requires?
- Alignment (0-10): How well does this opportunity match what the candidate has expressed they want?

Return JSON with: score {skills, alignment, overall}, confidence, recommendation, strengths[], gaps[], summary, evidenceUsed[].

For gaps, assess: what is missing, how severe, and whether it can be reframed honestly.
Be direct. A stretch is a stretch. Don't soften gaps.
```

### Storing evaluations

`signal-evaluations/{evalId}`:
```
evalId: string
signalId: string
userId: string
opportunity: { type, title, content, url }
score: { skills, alignment, overall }
confidence: number
recommendation: string
strengths: string[]
gaps: { dimension, gap, severity, closeable, framing }[]
summary: string
evidenceUsed: string[]
_createdAt: Timestamp
resumeGenerated: boolean
coverLetterGenerated: boolean
```

Stored on creation. Owner can see history, re-run with updated profile.

---

## Part 2 — Resume Generation

### `POST /api/signal-resume-generate`

Only called after an evaluation. Takes the evaluation result + full opportunity content and generates a tailored resume as structured JSON (renderable to formatted text or PDF-ready HTML).

**Request:**
```json
{
  "userId": "u-...",
  "evaluationId": "eval-...",
  "format": "text" | "html"
}
```

**What the Claude call gets:**
- Owner's full synthesized profiles
- The opportunity text
- The specific evidence chunks that were used in the evaluation (not all 15 — just the relevant ones)
- The gap analysis from the evaluation (so it knows what to emphasize/minimize)
- Instruction: generate a resume that maximizes this candidate's fit for this specific role

**What makes this different from generic resume builders:**
- Claims come from real evidence: "Built production streaming architecture serving real users" is derived from an actual chunk, not hallucinated
- The resume emphasizes skills that match the role's specific language
- Gaps flagged as uncloseable are honestly omitted rather than spun
- The format is tailored: IC engineering role → more technical depth; product leadership → more outcome/impact framing

**Response:**
```json
{
  "success": true,
  "resumeId": "resume-...",
  "content": {
    "summary": "...",
    "experience": [
      {
        "title": "...", "org": "...", "dates": "...",
        "bullets": ["...", "..."]
      }
    ],
    "skills": ["...", "..."],
    "education": [...]
  },
  "html": "<div>...</div>"  // if format === "html"
}
```

### Resume generation prompt

```
You are generating a targeted resume for a specific opportunity.

== CANDIDATE PROFILE ==
{profiles}

== OPPORTUNITY ==
{opportunity.title}
{opportunity.content}

== RELEVANT WORK EVIDENCE ==
{evidence chunks matched to this opportunity}

== GAP ANALYSIS ==
{gaps from evaluation — what to emphasize, what to de-emphasize}

Generate a resume that:
1. Uses language from the job description where the candidate genuinely has matching experience
2. Leads with the most relevant evidence (drawn from the work history above — be specific)
3. Does NOT fabricate or embellish — only claims supported by the evidence chunks
4. Frames transferable experience honestly where gaps exist and it's closeable
5. Omits or minimizes areas where gaps were flagged as uncloseable

Return structured JSON: { summary, experience[], skills[], education[] }
```

---

## Part 3 — Cover Letter Generation

### `POST /api/signal-cover-generate`

Follows resume generation. Takes evaluation + (optionally) the generated resume and writes a cover letter that:
- Connects the candidate's specific story to the company's specific problem
- References real work (by project/domain, not made up)
- Addresses the key alignment question: why *this* role, why *now*
- Keeps it honest about gaps where relevant (showing self-awareness is often a positive signal)

**Request:**
```json
{
  "userId": "u-...",
  "evaluationId": "eval-...",
  "resumeId": "resume-...",   // optional
  "tone": "direct" | "warm" | "formal"   // default: matches personalityProfile
}
```

**Tone** defaults to `personalityProfile.communicationStyle` — a direct person gets a direct cover letter. This is a small but differentiating touch.

---

## Part 4 — Dashboard UI: "Evaluate an Opportunity"

New dashboard section: **Opportunity Fit**

```
┌─────────────────────────────────────────────────┐
│  Evaluate an Opportunity                         │
│                                                  │
│  Paste a job description, project brief,         │
│  or role URL to see how well it fits your        │
│  Signal profile.                                 │
│                                                  │
│  [textarea: paste JD or URL here]                │
│  [Title (optional)]                              │
│                                                  │
│  [Evaluate Fit →]                                │
└─────────────────────────────────────────────────┘
```

**Results panel (shown after evaluation):**

```
┌─────────────────────────────────────────────────┐
│  Senior AI Product Lead — Seed Stage Startup     │
│                                                  │
│  Overall Fit: 7/10  ●●●●●●●○○○                  │
│  Skills: 8   Alignment: 6                        │
│                                                  │
│  Worth applying. Strong technical match.          │
│  Alignment gap worth understanding before you    │
│  invest time.                                    │
│                                                  │
│  ✓ Production agentic AI experience matches      │
│  ✓ Behavioral health background is a rare plus  │
│  △ Role skews IC engineering vs your hybrid     │
│    preference                                    │
│  △ Kubernetes/containers not in your history    │
│    (reframeable as serverless equivalent)        │
│                                                  │
│  [Generate Resume →]   [Generate Cover Letter →] │
└─────────────────────────────────────────────────┘
```

**Evaluation history** (list below, sortable by score):
```
Senior AI Product Lead        Score 7   2d ago   [view] [resume] [cover letter]
VP Product — Health Tech      Score 4   5d ago   [view]
Fractional CPO — Fintech      Score 6   1w ago   [view] [resume]
```

---

## Part 5 — Machine-to-Machine API (same endpoint, different caller)

The same `POST /api/signal-evaluate` endpoint works for M2M:
- An ATS can call it with a job description to screen candidates
- Another Signal profile owner can call it to evaluate fit before reaching out
- Any orchestration layer can batch-score a set of Signal profiles against a role

**Auth for M2M:** Owner generates an API key from the dashboard (stored hashed in Firestore). M2M callers pass it as `Authorization: Bearer {key}`. The endpoint resolves `targetSignalId` from the key's associated owner.

The self-evaluation product (owner evaluating themselves) and the M2M product are the same call — the difference is only who's calling and whether they own the target profile.

---

## Part 6 — Implementation Files

### New endpoints
| File | Endpoint | Purpose |
|------|----------|---------|
| `netlify/functions/signal-evaluate.js` | POST `/api/signal-evaluate` | Core evaluation: score + gaps + strengths |
| `netlify/functions/signal-resume-generate.js` | POST `/api/signal-resume-generate` | Tailored resume from evaluation + profile |
| `netlify/functions/signal-cover-generate.js` | POST `/api/signal-cover-generate` | Cover letter from evaluation + resume |
| `netlify/functions/signal-evaluations-get.js` | POST `/api/signal-evaluations-get` | Owner's evaluation history |
| `netlify/functions/signal-apikey-generate.js` | POST `/api/signal-apikey-generate` | Generate M2M API key for owner |

### New Firestore collections
| Collection | Purpose |
|-----------|---------|
| `signal-evaluations/{evalId}` | Evaluation results (score, gaps, evidence used) |
| `signal-resumes/{resumeId}` | Generated resume content |
| `signal-covers/{coverId}` | Generated cover letter content |

### Modified files
| File | Change |
|------|--------|
| `src/dashboard.njk` | Add "Evaluate an Opportunity" section + results panel + history list |
| `src/assets/js/dashboard.js` | Evaluation form submission, results rendering, resume/cover CTAs |
| `src/styles/_widget.scss` | Evaluation results panel, score bars, gap list, history table |

### Reused from Phase 3/4
- `db-signal-context.cjs` `searchChunks()` — used to pull relevant evidence for the evaluation prompt
- Owner's `skillsProfile`, `wantsProfile`, `personalityProfile` from Firestore (already synthesized)
- Same concept matching logic as Phase 4 tool call

---

## Verification

1. Paste a real job description → evaluation returns plausible scores with specific evidence cited
2. Gaps reference actual missing terms from the profile, not generic statements
3. "Uncloseable" gaps appear in evaluation but are omitted from generated resume
4. Resume bullets are traceable to specific chunk evidence (not hallucinated)
5. Cover letter tone matches `personalityProfile.communicationStyle`
6. Evaluation history persists and renders correctly in dashboard
7. M2M: POST with `Authorization: Bearer {apiKey}` → same result as owner self-evaluation
8. Re-run evaluation after uploading new Claude export → score changes if new evidence is relevant

---

## Not in Phase 5

- PDF export (render HTML to PDF) — deferred, browser print-to-PDF works for now
- Interview prep (question anticipation based on gaps) — natural Phase 6
- LinkedIn profile optimization — same engine, different output format
- Batch evaluation (score against multiple JDs simultaneously) — Phase 6
- Proactive matching (Signal alerts owner when new public JDs match their profile) — requires crawling, deferred
