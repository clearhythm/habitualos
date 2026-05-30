# Daily Practice — MVP Scope for June 1

Core scope for Frank + Ro'i invite launch:

TEST 1. Core practice experience working reliably
2. Witness mechanic wired to backend so you can see each other's practice
   - Change voice note sublink to "skip" since voice note is non-functional
3. Invite flow functional so Frank and Ro'i can actually join
4. Add `VITE_USE_MOCK_WITNESS` env variable toggle in `.env.local` for safe local testing of witness mechanic without losing mock data capability
5. Confirm unlock/lock deploy shell command is working before June 1 push
6. Drift off mode: toggle in practice settings (defaults to off), auto-saves on timer end, bypasses post-practice screen, returns to homepage with quiet "your practice was saved" confirmation

That's it. Everything else waits.

---

## Stretch (if time allows)

TEST 1. Fix broken audio check on splash (existing ticket)
2. Remove "tap for tour" — revert to chime swaying on "all caught up"
3. Tour refinement: Ditch all auto advance (skip exists for a reason), remove annoying system chime on advance — applies to tour and witness loop
4. Wire start chime toggle in practice flow (pairs naturally with stop chime)

---

## V2 Ideas

- **API logging**: Fix duplicate logs (writing ~3x per API call) for cleaner usage data
- **Friends Chimes during live practice**: Use existing RTDB to notify friends when you're actively practicing — leave toggle visible as curiosity starter for now
- **AI story note**: Brief AI-generated summary at top of Ago/Story page that turns the history feed into an actual narrative "Story"
- **Chime swap**: Reduce chime frequency on homepage or replace with simpler sound — test whether annoyance persists with real usage before building
- **Untimed practice mode**: Ro'i does both timed and untimed — timed only for now, untimed coming in V2
