# Profile Settings UI — View + Edit Owner Profile Fields

## Context

The `signal-owner` doc holds fields that users should be able to view and update from within the Signal signed-in experience: display name, nickname, tagline, avatar, and bio. Currently there is no UI for this — values are set at registration or via scripts. As Signal adds features like head-to-head comparisons and public profile pages, keeping these fields accurate and editable becomes important.

This ticket scopes a minimal Profile Settings page in the signed-in app.

---

## Editable Fields

| Field | signal-owner key | Notes |
|-------|-----------------|-------|
| Full name | `displayName` | Used everywhere |
| Nickname | `nickname` | Short name for head-to-head and public contexts; falls back to displayName if absent |
| Tagline | `tagline` | One-liner shown on profile and demo pages |
| Bio / background | `contextText` | Freeform background text; feeds into RAG synthesis |
| Avatar | `avatarUrl` | URL string; local path now, hosted URL later |

Read-only display (not editable here):
- `synthesizedContext` — AI-generated narrative (regenerated via synthesis, not directly edited)
- `skillsProfile`, `wantsProfile`, `personalityProfile` — derived from chunks
- `contextStats` — chunk counts, sources, last ingest

---

## UI Scope

### Route
`/settings/profile/` (or `/profile/settings/` — follow existing nav conventions)

### Page Sections

**1. Identity**
- Full name (text input)
- Nickname (text input, optional — placeholder: "Short name for public contexts")
- Tagline (text input, max ~120 chars)
- Avatar (for now: URL text input with preview `<img>` — no upload yet)

**2. Background**
- `contextText` (textarea, ~500 char limit shown, no hard limit)
- Helper text: "This feeds into your Signal profile. Write in third person or first — either works."

**3. Synthesized Profile (read-only)**
- Show `synthesizedContext` (the AI-generated narrative) with a "Regenerate" button that calls `/api/signal-context-synthesize`
- Show `skillsProfile.completeness`, `wantsProfile.completeness`, `personalityProfile.completeness` as a simple coverage indicator

---

## API

### Endpoint: `signal-config-set.js` (already exists)
Check if it supports the fields above. If it currently only updates a subset, extend it to accept `nickname`, `tagline`, `contextText`, `avatarUrl`. The endpoint already handles auth (userId check against owner).

### Endpoint: `signal-config-get.js` (already exists)
Returns owner doc fields for the settings page to populate. Verify `nickname` and `avatarUrl` are included in the response shape once those fields are added to the schema.

---

## Avatar Strategy (matches TICKET-kirk-vs-data)

`avatarUrl` is always a string. Current behavior:
- User sets it manually as a URL (text input)
- No upload flow yet — stub with URL input + preview
- When image hosting is added later, the upload UI replaces the text input; the field stays the same

Show a preview `<img>` next to the input. If `avatarUrl` is empty or errors, show `/assets/images/avatar-placeholder.svg`.

---

## Out of Scope (defer)

- Image upload / file hosting (Cloudinary, S3, etc.) — `avatarUrl` is a URL string for now
- Email or account settings (separate concerns)
- Editing synthesized profile dimensions directly
- Public profile page (`/u/signalId/`) — separate ticket

---

## Execution Order

1. Audit `signal-config-get.js` + `signal-config-set.js` — confirm they support all fields above; extend if needed
2. Add `nickname` + `avatarUrl` to the config get/set endpoints if missing
3. Build `/settings/profile/` page (11ty Nunjucks template + inline JS for save)
4. Wire save button to `signal-config-set.js`
5. Wire "Regenerate" to `/api/signal-context-synthesize`
6. Test: update each field, reload, confirm persisted; confirm synthesized context regenerates

---

## Notes

- `nickname` and `avatarUrl` are new fields being added as part of TICKET-kirk-vs-data — that ticket's migration script adds them to existing demo owners. The `signal-register.js` flow doesn't need to set them at registration yet (both have fallbacks).
- This page is also where a future "Upload photo" CTA would live once image hosting is in place.
