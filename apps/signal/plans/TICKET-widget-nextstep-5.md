# TICKET-5: renderNextStep — next-step CTA in chat area

## Why this exists

After a fit score is established in visitor mode, the widget should surface a "what's next" call to action. The CSS for a `.nextstep` panel already exists in `widget.scss` (`.nextstep`, `.nextstep-heading`, `.nextstep-label`, `.nextstep-actions`), but there is no JS implementation.

**Prerequisite:** TICKET-3 complete. `score.js` has a `renderNextStep(els, state, step, label)` stub.

## Design decision (from planning)

The next step should live in the **primary chat area**, not the left panel. It should feel conversational — a natural prompt after the agent has assessed fit, not a sidebar widget.

## Work

### When to trigger

After `update_fit_score` tool call where `confidence >= 0.7` (high enough to suggest action) OR at the end of a `evaluate_fit` tool call. Triggered once per session.

### What to show

Based on `ownerConfig.contactLinks`:
- `calendar` → "Book a call with [name] →" (primary CTA)
- `linkedin` → "Connect on LinkedIn →"
- Neither → no-op (don't render)

Optionally: a custom `nextStepLabel` from owner config.

### Placement

Render in the messages area as a special `.msg.msg--nextstep` bubble (not a floating element). This keeps it in the chat flow.

### `renderNextStep(els, state, step, label)`

Fill in the stub in `core/score.js`. Parameters:
- `step`: URL to link to
- `label`: button label text

## Acceptance criteria

- [ ] After a high-confidence score, a next-step CTA appears in the chat
- [ ] CTA links to owner's calendar or LinkedIn
- [ ] No CTA rendered if no contact links configured
- [ ] Triggered at most once per session
