# Daily Practice — MVP Scope for June 1

Core scope for Frank + Ro'i invite launch:

TEST 3. Invite flow functional so Frank and Ro'i can actually join
TEST 2. Witness mechanic wired to backend so you can see each other's practice
   DONE - Change voice note sublink to "skip" since voice note is non-functional
TEST 1. Core practice experience working reliably
DONE 4. Add ?mockWitness param to homepage to allow system to witness using the mock data and LS (for front-end testing)

That's it. Everything else waits.

---

## Stretch (if time allows)

1. Confirm unlock/lock deploy shell command is working before June 1 push
2. Profile cache in sessionStorage — one API call per tab session instead of per page load; reduces API log noise; write-through on settings save fixes dp-name going stale after name change. Profile values migrate to sessionStorage with `dp-profile-` prefix (`dp-name` → `dp-profile-name`, chime → `dp-profile-chime`).
DONE 1. Fix broken audio check on splash (existing ticket)
DONE 2. Remove "tap for tour" — revert to chime swaying on "all caught up"
DONE 3. Tour refinement: Ditch all auto advance (skip exists for a reason), remove annoying system chime on advance — applies to tour and witness loop
DONE 4. Wire start chime toggle in practice flow (pairs naturally with stop chime)

---

## V2 Ideas

- **Drift off mode**: Toggle in practice settings (defaults to off), auto-saves on timer end, bypasses post-practice screen, returns to homepage with quiet "your practice was saved" confirmation
- **API logging**: Fix duplicate logs (writing ~3x per API call) for cleaner usage data
- **Storage cleanup**: Move `dp-cache-circle` and `dp-has-unread` to sessionStorage (resolved naturally when witness queue is rebuilt with Firestore onSnapshot). Move `dp-scene-tier`, `dp-nav-seen`, `dp-witness-witnessed` to Firestore for true cross-device sync.
- **Friends Chimes during live practice**: Use existing RTDB to notify friends when you're actively practicing — leave toggle visible as curiosity starter for now
- **AI story note**: Brief AI-generated summary at top of Ago/Story page that turns the history feed into an actual narrative "Story"
- **Chime swap**: Reduce chime frequency on homepage or replace with simpler sound — test whether annoyance persists with real usage before building
- **Untimed practice mode**: Ro'i does both timed and untimed — timed only for now, untimed coming in V2
