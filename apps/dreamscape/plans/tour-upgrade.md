# Tour Upgrade Design Spec

## Concept
Tour mode shows each section in its real UI — actual icons, backgrounds, and layouts — but with a conditional tour header that appears when `?tour=true` is set in the URL. The tour feels like a real walkthrough of the app, not a simplified overlay.

## How It Works

### Tour Param
- Tour context is carried via URL param: `?tour=true`
- All sections check for this param and conditionally render the tour header
- Autofocus is disabled globally on all inputs/textareas when tour param is set

### Tour Header (conditional)
- Shown only when `?tour=true`
- Follows the same design pattern as the homepage: icon + title + subtitle + `[ continue ]` button + sublink

### Slide Structure
Each tour slide = real section UI + tour header overlay at top:

---

**Slide 1 — Home**
Route: `/`
Icon: chime
Title: Practice
Subtitle: awaken a beautiful world
Action: `[ continue ]`
Sublink: `practice` → enters practice flow, exits tour

---

**Slide 2 — Reflect**
Route: `/reflect`
Icon: reflect leaf
Title: Reflect
Subtitle: shine a little light on your path
Action: `[ continue ]`
Sublink: `reflect` → exits tour, reloads reflect fully with name in bubble and autofocus on reply field

- AI prompt bubble is hidden in tour mode
- Placeholder text on reply field: "What's present for you tonight?" (no name personalization in tour)
- Autofocus disabled so keyboard doesn't hijack on load
- Tapping the textarea exits tour and reloads reflect fully — name in bubble, autofocus on reply field

---

**Slide 3 — Circle**
Route: `/circle`
Icon: circle icon
Title: Circle
Subtitle: share support with friends
Action: `[ continue ]`
Sublink: `invite` → goes to invite flow, exits tour

- Real sortable members list shown
- Bottom invite button hidden in tour mode — invite lives as sublink only

---

### Offramp Behavior
- Each section's sublink is the feature itself (`practice`, `reflect`, `invite`)
- Tapping a sublink exits tour (clears `?tour=true`) and enters that section for real
- No explicit "skip tour" needed — the offramps ARE the skip

### Tour End
- Last slide's `[ continue ]` navigates to homepage
- Tour param cleared
- Scene returns to idle state
- User has arrived — ready to begin
