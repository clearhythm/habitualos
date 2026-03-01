# Pidgerton: Relational Weather

**Status:** Tabled (idea documented, not yet implementing)
**Prerequisite:** `isFirstWeekly` detection fix in `rely-chat-init.js`

## Concept

Replace the plain score summary in the survey completion modal with a "weather" metaphor. Weather is intuitive, emotionally resonant, and more engaging than raw percentages.

Two surfaces for weather:

1. **Survey modal** — Shows the user's OWN relative weather (how their scores moved since last week)
2. **Homepage widget** — Shows the MUTUAL weather trend (average movement across both partners)

## Why Movement, Not Absolute Scores

The weekly micro-survey only covers the 3 growth dimensions (lowest-scoring from the initial survey). Absolute scores will structurally skew negative — "Snowing" every week isn't motivating.

Movement-based weather solves this:
- Rewards engagement ("Clearing up" even if scores are still low)
- Tells the user the process is working
- Sidesteps the negativity bias of only tracking growth areas
- Gives the homepage weather actual meaning tied to real data

## Weather Scale (Draft)

Based on week-over-week delta across the 3 growth dimensions:

| Average Delta | Weather | Emoji | Meaning |
|---|---|---|---|
| +2 or more | Sunny | ☀️ | Significant improvement |
| +0.5 to +2 | Clearing up | 🌤️ | Positive movement |
| -0.5 to +0.5 | Steady | ☁️ | Holding stable |
| -2 to -0.5 | Overcast | 🌧️ | Some regression |
| -2 or worse | Stormy | ⛈️ | Notable decline |

Thresholds are rough — would need tuning with real data.

## Week 1 Problem

No previous data means no delta to compute. Options:
- Show a neutral placeholder: "First forecast" or "Calibrating..."
- Skip weather entirely on week 1, just show the standard score summary
- Use the initial full survey scores as the implicit baseline (week 1 delta = weekly score minus initial survey score for each dimension)

The third option is the most useful — the initial survey already captured scores for these dimensions, so week 1 can show movement from that baseline.

## Two Surfaces, Two Calculations

### Survey Modal (Individual)
- Computed at save time from the current user's scores vs their previous week
- Only that user's data needed — no dependency on partner completing
- Shown immediately in the confirmation modal after STORE_MEASUREMENT

### Homepage Widget (Mutual)
- Computed from both partners' most recent deltas, averaged
- Only updates when both have completed for the current week (aligns with existing `markUserCompleted` / action completion logic)
- Could show "Waiting for [partner]..." if only one has completed

## Data Requirements

Already available:
- `survey-responses` collection has per-user weekly responses with dimension scores
- `getResponsesByUser(userId, surveyId)` in `survey-responses.cjs` can pull history
- `survey-actions` tracks completion status for both users

Would need:
- Delta calculation logic (compare current week's scores to previous week's scores per dimension)
- Weather mapping function (delta -> weather state)
- Homepage endpoint or client-side logic to compute mutual weather

## Open Questions

- Should the weather smooth over multiple weeks (rolling average) or be purely week-over-week? Week-over-week is simpler but more volatile with only 3 dimensions on a 0-10 scale. A single dimension shifting +/-1 could swing the weather.
- What's the right granularity? 5 states might be too many for the range of realistic deltas. 3 (improving / steady / declining) might be enough.
- Does the homepage weather need its own endpoint, or can it be derived client-side from existing response data?
