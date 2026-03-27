# Ticket: Synthesis System — Weighted Aggregation + Narrative

> **Supersedes** the previous version of this file. Implement this ticket before `TICKET-synthesis-dashboard.md`.

## Context

Signal's synthesis pipeline (`signal-context-synthesize.js`) runs and produces output but the output is weak:
- Personality profile derives generic labels ("direct, warm") via regex — discards the specificity of actual behavioral observations
- Skills/alignment are pure frequency counts with no weighting by session quality or recency
- Result: `buildProfileSection()` injects low-signal text into every eval and chat prompt

This ticket fixes the aggregation and adds a Claude-generated 3-paragraph narrative (`synthesizedContext`) stored on the owner doc. The narrative is the user-facing "what does Signal think about me?" artifact and also flows into all prompts as richer behavioral context.

**Prerequisite:** `TICKET-reflection-mode.md` should be implemented first. This ticket handles polarity-aware `personalitySignals` (`{ signal: string, polarity: "strength" | "edge" }`). Graceful fallback: plain strings normalize to strength signals.

**Field naming:** `synthesizedContext`, `synthesizedContextHash`, `synthesizedContextGeneratedAt` — no underscore prefix. Underscore prefix is reserved for system metadata (`_userId`, `_createdAt`, etc.).

---

## Files to Change

| File | Change |
|------|--------|
| `netlify/functions/signal-context-synthesize.js` | Weighted scoring, confidence filtering, fixed personality aggregation, haiku narrative call |
| `netlify/functions/signal-init-shared.cjs` | Update `buildContextText()` and `buildProfileSection()` personality block |

No changes needed to `signal-evaluate.js`, `signal-visitor-init.js`, or `signal-owner-init.js` — they all call `buildContextText()` and `buildProfileSection()` which are updated here.

---

## Part A: Weighted Aggregation (`signal-context-synthesize.js`)

### Replace frequency maps with weighted score maps

Add this helper at the top of the file:

```js
function recencyWeight(dateStr) {
  const ageInDays = (Date.now() - new Date(dateStr).getTime()) / 86400000;
  return Math.exp(-ageInDays / 180); // half-life ~180 days
}
```

For every chunk, for every signal/skill/want, replace `freq[item]++` with:

```js
const weight = (chunk.evidenceStrength || 3) * recencyWeight(chunk.date || chunk._createdAt);
scoreMap[item] = (scoreMap[item] || 0) + weight;
sessionCount[item] = (sessionCount[item] || 0) + 1;
```

Apply to: `skillFreq` → `skillScore`, `techFreq` → `techScore`, `domainFreq` → `domainScore`, `projectFreq` → `projectScore`, `wantFreq` → `wantScore`.

### Add minimum confidence filter

Add this helper:

```js
function filterByConfidence(scoreMap, sessionCount) {
  // Only keep signals seen in ≥2 sessions
  // Single-mention signals remain in raw* arrays but don't surface in top-level profile arrays
  return Object.fromEntries(
    Object.entries(scoreMap).filter(([signal]) => sessionCount[signal] >= 2)
  );
}
```

Call before `topN()` for all five dimensions. Single-mention items still go into `rawWants` etc. — just not into `workTypes`, `coreSkills`, or the arrays fed to prompts.

### Fix personality aggregation — remove regex label derivation entirely

**Delete:** the `is()` helper function and all uses of it. Delete the derivation of `communicationStyle`, `intellectualStyle`, `problemApproach`.

**Replace** the personality loop with:

```js
const strengthScore = {};
const edgeScore = {};
const signalSessionCount = {};

for (const chunk of chunks) {
  const w = (chunk.evidenceStrength || 3) * recencyWeight(chunk.date || chunk._createdAt);
  for (const raw of (chunk.personalitySignals || [])) {
    // Handle plain strings (pre-reflection-mode) and { signal, polarity } objects
    const signal = typeof raw === 'string' ? raw : raw.signal;
    const polarity = typeof raw === 'string' ? 'strength' : (raw.polarity || 'strength');
    const map = polarity === 'edge' ? edgeScore : strengthScore;
    map[signal] = (map[signal] || 0) + w;
    signalSessionCount[signal] = (signalSessionCount[signal] || 0) + 1;
  }
  if (Object.keys(strengthScore).length > 0 || Object.keys(edgeScore).length > 0) {
    personalityCoverage++;
  }
}

const filteredStrength = filterByConfidence(strengthScore, signalSessionCount);
const filteredEdge = filterByConfidence(edgeScore, signalSessionCount);

const strengthSignals = topN(filteredStrength, 10);
const edgeSignals = topN(filteredEdge, 6); // empty array until reflection mode ships

// signalMeta: session count + confidence ratio for each top signal
const signalMeta = {};
for (const sig of [...strengthSignals, ...edgeSignals]) {
  signalMeta[sig] = {
    sessions: signalSessionCount[sig] || 0,
    confidence: (signalSessionCount[sig] || 0) / totalChunks
  };
}

const personalityProfile = {
  strengthSignals,
  edgeSignals,
  signalMeta,
  completeness: Math.min(1, personalityCoverage / totalChunks)
};
```

Apply the same `signalMeta` pattern for skills and wants:

```js
// After computing coreSkills, technologies, etc:
const skillSignalMeta = {};
for (const skill of [...coreSkills, ...technologies]) {
  skillSignalMeta[skill] = {
    sessions: skillSessionCount[skill] || 0,
    confidence: (skillSessionCount[skill] || 0) / totalChunks
  };
}
// Add signalMeta to skillsProfile and wantsProfile writes
```

### Update owner doc write

```js
await updateOwner(signalId, {
  skillsProfile: { coreSkills, technologies, domains, projectTypes, signalMeta: skillSignalMeta, completeness: skillsCompleteness },
  wantsProfile: { workTypes, opportunities, excitedBy, workStyle, openTo, notLookingFor, rawWants, signalMeta: wantSignalMeta, completeness: wantsCompleteness },
  personalityProfile,  // has strengthSignals, edgeSignals, signalMeta, completeness
  contextStats: { totalChunks, processedChunks, bySource, conceptGraph }
});
```

---

## Part B: Narrative Generation (`signal-context-synthesize.js`)

Add this block after the owner doc update. Read the freshly computed profiles (use local variables, not a re-fetch).

### Change detection — only regenerate when signals change

```js
const signalFingerprint = [
  ...strengthSignals.slice(0, 10),
  ...(skillsProfile.coreSkills || []).slice(0, 10),
  ...(wantsProfile.rawWants || []).slice(0, 10)
].join('|');
const newHash = require('crypto').createHash('md5').update(signalFingerprint).digest('hex');
const needsNarrative = !owner.synthesizedContextHash || owner.synthesizedContextHash !== newHash;
```

### Anthropic client setup

Use the same pattern as `signal-context-process.js` — look at how it imports and initializes the Anthropic client. Get the API key from `process.env.ANTHROPIC_API_KEY` or decrypt `owner.anthropicApiKey` (same decryption logic as `signal-evaluate.js`).

### Narrative generation

```js
if (needsNarrative && strengthSignals.length > 0) {
  const narrativePrompt = `You are building a behavioral profile for ${owner.displayName} from ${totalChunks} work sessions.

SKILLS (top weighted):
${(skillsProfile.coreSkills || []).slice(0, 10).join(', ')}

TECHNOLOGIES:
${(skillsProfile.technologies || []).slice(0, 10).join(', ')}

PERSONALITY signals (top weighted, by observed frequency):
${strengthSignals.slice(0, 8).map(s => `• ${s}`).join('\n')}

ALIGNMENT (what they're moving toward):
${(wantsProfile.rawWants || []).slice(0, 8).join(', ')}

Write exactly three paragraphs:
1. Skills & technical depth — what they've demonstrably built and where they're strongest
2. How they work — behavioral patterns, working style, how they handle friction and decisions
3. Direction — what they're moving toward professionally

Ground every claim in the signal data above. Do not invent anything not supported by the signals. Write in third person. Approximately 100 words per paragraph.`;

  try {
    const narrativeResponse = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      messages: [{ role: 'user', content: narrativePrompt }]
    });

    const synthesizedContext = narrativeResponse.content[0]?.text?.trim().substring(0, 1400) || null;

    if (synthesizedContext) {
      await updateOwner(signalId, {
        synthesizedContext,
        synthesizedContextGeneratedAt: new Date().toISOString(),
        synthesizedContextHash: newHash
      });
    }
  } catch (err) {
    // Narrative generation failure is non-fatal — log and continue
    console.error('Narrative generation failed:', err.message);
  }
}
```

---

## Part C: Update `signal-init-shared.cjs`

### Update `buildContextText(owner)`

Current function returns LinkedIn + contextText. Update to include `synthesizedContext`:

```js
function buildContextText(owner) {
  const parts = [];
  if (owner.sources?.linkedin) {
    parts.push(`== LINKEDIN PROFILE ==\n${owner.sources.linkedin.substring(0, 6000)}`);
  }
  if (owner.contextText) {
    parts.push(owner.contextText.substring(0, 3000));
  }
  if (owner.synthesizedContext) {
    const sessionCount = owner.contextStats?.processedChunks || 0;
    parts.push(`== BEHAVIORAL PROFILE (synthesized from ${sessionCount} work sessions) ==\n${owner.synthesizedContext}`);
  }
  return parts.join('\n\n');
}
```

Token budget: LinkedIn ~6k chars + contextText ~3k + synthesizedContext ~1.4k = ~10.4k chars total. Acceptable.

### Update `buildProfileSection()` — personality block

Find the personality block in `buildProfileSection`. Replace the `communicationStyle` / `intellectualStyle` / `problemApproach` output with:

```js
// Replace personality section with weighted signal list
function buildPersonalityBlock(personalityProfile, isOwner = false) {
  const { strengthSignals = [], edgeSignals = [], signalMeta = {} } = personalityProfile || {};
  if (!strengthSignals.length) return '';

  const lines = strengthSignals.map(sig => {
    const meta = signalMeta[sig];
    const suffix = meta ? ` (${meta.sessions} sessions, ${Math.round(meta.confidence * 100)}% of history)` : '';
    return `  • ${sig}${suffix}`;
  }).join('\n');

  let block = `== PERSONALITY (from work history) ==\nBehavioral signals (weighted by recency + session richness):\n${lines}`;

  if (isOwner && edgeSignals.length > 0) {
    const edgeLines = edgeSignals.map(sig => {
      const meta = signalMeta[sig];
      const suffix = meta ? ` (${meta.sessions} sessions)` : '';
      return `  • ${sig}${suffix}`;
    }).join('\n');
    block += `\n\nEdges (owner context only — do not surface to visitors):\n${edgeLines}`;
  }

  return block;
}
```

Update `buildProfileSection` signature to accept `isOwner = false` and pass it to `buildPersonalityBlock`.

Update the call site in `signal-owner-init.js`: pass `isOwner: true` (or add the boolean as the last argument, depending on how `buildProfileSection` is called there).

---

## Schema Changes (owner doc)

```
// Added
synthesizedContext: string                   // Claude-generated 3-paragraph narrative, ~1200 chars
synthesizedContextGeneratedAt: ISO string    // timestamp of last generation
synthesizedContextHash: string               // MD5 fingerprint for change detection
personalityProfile.strengthSignals: string[] // replaces rawSignals — weighted, specific signal text
personalityProfile.edgeSignals: string[]     // empty until reflection mode ships
personalityProfile.signalMeta: object        // { [signalText]: { sessions: n, confidence: 0-1 } }
skillsProfile.signalMeta: object             // same pattern
wantsProfile.signalMeta: object              // same pattern

// Removed from personalityProfile
communicationStyle
intellectualStyle
problemApproach
// (rawSignals also removed — replaced by strengthSignals)
```

---

## Verification

1. Ingest 3+ sessions with varying `evidenceStrength` (e.g. one with strength 2, one with strength 5)
2. Run `POST /api/signal-context-synthesize` — verify higher-strength sessions rank their signals higher in `strengthSignals`
3. Verify a signal appearing in only 1 session is NOT in `strengthSignals` (check Firestore directly)
4. Verify `personalityProfile` in Firestore has no `communicationStyle`, `intellectualStyle`, `problemApproach` fields
5. Verify `synthesizedContext` on owner doc is populated and reads as 3 coherent paragraphs
6. Run synthesis again with no new data — verify `synthesizedContext` was NOT regenerated (`synthesizedContextHash` unchanged)
7. Ingest a new session, run synthesis again — verify `synthesizedContext` was regenerated (hash changed)
8. Call `POST /api/signal-evaluate` — verify assembled prompt text includes `== BEHAVIORAL PROFILE ==` section
9. Verify `buildProfileSection` personality output shows bullet list with session counts, not "direct, warm"
