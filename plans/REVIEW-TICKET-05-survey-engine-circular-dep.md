# TICKET-05: Fix Circular Dependency in survey-engine

**Phase**: Cleanup — run after TICKET-00 through TICKET-04 are complete
**App**: `packages/survey-engine`
**Prerequisites**: All other tickets done

---

## Goal

Remove the circular dependency introduced in TICKET-00 between `src/tools/handlers.cjs` and `index.cjs`.

---

## The Problem

`handlers.cjs` imports from `../../index.cjs`, which in turn imports from `handlers.cjs`. Node.js CJS handles circular deps without crashing but can produce `undefined` values if module evaluation order is unlucky.

---

## Fix

In `packages/survey-engine/src/tools/handlers.cjs`, replace the import from `../../index.cjs`:

```javascript
// Before
const { getSurveyDefinition, createSurveyResponse, markActionCompleted } = require('../../index.cjs');

// After
const { getSurveyDefinition } = require('../../survey-definitions.cjs');
const { createSurveyResponse } = require('../../survey-responses.cjs');
const { markActionCompleted } = require('../../survey-actions.cjs');
```

No other changes needed.

---

## Acceptance Criteria

- `require('@habitualos/survey-engine')` loads without circular dependency warnings
- `handleSurveyTool('start_survey', ...)`, `handleSurveyTool('store_survey_results', ...)` still work correctly
