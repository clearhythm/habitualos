# Signal Launch Roadmap
_Captured 2026-03-29. Ordered by priority._

## DONE 1. Email service
Configure DKIM/SPF on habitualos.com, wire up Resend to send from `Signal <erik@habitualos.com>`.
Start now so DNS propagates.

## 1b. Email service
Generate Resend key and add here to app to send emails `Erik <erik@habitualos.com>` and also `Signal <signal@habitualos.com>`.
Needed: confirmation email + welcome email on early-access claim. These will have subject line starting with "Signal: " to make it clear what it's from, though it will come from Erik. Configure and test the emails with Claude.

## DONE 2. Personality signal balance
Ingest is only storing positive personality observations. Coach mode was requested on Erik's
profile but isn't working. Signals should be balanced — both `strength` and `edge` polarity.

## 3a. Consolidate embed.js + signal-modal.js (TICKET-embed-consolidation.md)
embed.js is an old widget that has diverged from the Signal Interview UI in signal-modal.js.
Rewrite embed.js to inject the Signal Interview HTML/CSS/logic, making it the one widget
used everywhere — on signal.habitualos.com and any external embed. Delete signal-modal.js after.

## 3. Widget: Signal Evidence
Surface session evidence in the widget like the Spock/Data demo does. Currently missing
from the live widget experience. Evidence cards need both `strength` and `edge` signals
to be credible — a profile with only positives reads like a resume. The edge signals are
what make it feel like a behavioral record rather than self-promotion. Requires balanced
ingest data to populate properly (now enforced in CLAUDE.md).

## 4. Widget: streaming chat
Migrate widget chat to streaming responses. Currently not streaming.

## 5. Data modeling for consolidated experience display
Ingests need to be aggregated/stored differently to display like the Spock/Data demo.
Biggest architectural lift.

## 6. Interview-style voice
Widget persona must stay strictly first-person throughout, including follow-up questions.
"Someone you'd be working with" → "someone I'd be working with." The agent IS the person,
not a narrator. Every sentence should be speakable by the person. Partially working well
(good context weaving) but pronouns slip occasionally.

Live Example (from Erik's Signal widget)
Q: How do you handle getting slowed down, like falling out of flow?
A: That's a real one — and honestly, it happens in patterns I've learned to recognize.

The main culprits for me are ambiguity without a clear owner, and context-switching between too many half-baked workstreams. When I feel that friction, I usually stop and ask: "what's the one thing that, if I finished it, would unblock everything else?" Then I protect time to do just that.

The somatic therapy work I've done actually sharpened this — I got better at noticing the physical signal of cognitive overload before it turns into a full stall. That early warning system matters more than any productivity system I've tried.

What's prompting the question — is this about managing yourself, or about how someone you'd be working with operates?

## 7. Launch article
Final polish before publish.

## 8. Article series
(a) Invite to claim Signal profile
(b) Spock vs Data heads-up series and other A vs B comparisons

---

## POST LAUNCH

### P1. Embedding-based evidence retrieval (Voyage AI)
Current `searchChunks()` uses keyword overlap to find relevant chunks for a JD eval.
This works at <50 chunks but misses semantically related evidence that doesn't share exact keywords
(e.g. "real-time systems" won't match a chunk tagged "SSE streaming").

Replace with embedding-based retrieval:
- At ingest: embed chunk summary via Voyage AI → store vector on chunk doc
- At eval: embed JD → cosine similarity against stored vectors → return top 8
- Migrate existing chunks retroactively (one-time script)

Trigger: when evidence quality starts feeling off, or at ~200 chunks, whichever comes first.
Anthropic's recommended embeddings partner: Voyage AI (voyageai.com).
