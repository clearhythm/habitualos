# Zer0 Gr@vity — Phase 1: Scaffold + Compression Engine

## Context

You are building the Zer0 Gr@vity semantic compression framework as a monorepo sub-app at `apps/zer0gravity/`. This is Phase 1 of a multi-phase project. Read the master plan at `/docs/plans/fuzzy-soaring-tulip.md` (or `~/.claude/plans/fuzzy-soaring-tulip.md`) for full context.

**What is Zer0 Gr@vity?** A challenge/framework for agent-native semantic compression. Agents design encoding systems to compress text, fresh agents (with no knowledge of the original) decode it back, and a scoring engine evaluates how well meaning was preserved. The name uses `@` in display only: "Zer0 Gr@vity". The directory is `zer0gravity` (no @).

**Architecture principle:** We're building the **judge** (scoring engine), not the contestant.

## Monorepo Context

- **Monorepo root:** `/Users/erik/Sites/habitualos/`
- **Workspace config:** `pnpm-workspace.yaml` includes `apps/*`
- **Existing apps:** `apps/habitual-web/`, `apps/relationship-web/`
- **Anthropic SDK:** `@anthropic-ai/sdk@^0.71.2` (used in habitual-web)
- **API key:** `ANTHROPIC_API_KEY` in root `.env` file
- **Pattern:** The monorepo uses `.cjs` extension for Node.js modules (CommonJS)

## Deliverables

### 1. `apps/zer0gravity/package.json`

```json
{
  "name": "zer0gravity",
  "version": "0.1.0",
  "private": true,
  "description": "Zer0 Gr@vity — Semantic compression scoring engine for agent-to-agent communication",
  "scripts": {
    "experiment": "node cli.cjs run",
    "experiment:all": "node cli.cjs run --all"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.71.2",
    "dotenv": "^16.6.1"
  }
}
```

### 2. `apps/zer0gravity/src/engine/encoder.cjs`

**Purpose:** Takes original text + encoding system description → calls Claude → returns encoded text.

**Interface:**
```javascript
async function encode(anthropic, { text, encodingSystem, model }) → { encodedText, usage }
```

**System prompt for encoder:**
```
You are an encoding agent participating in the Zer0 Gr@vity compression challenge.

Your task: Compress the given text using the encoding system described below.
Output ONLY the encoded text — no explanations, no commentary, no metadata.

ENCODING SYSTEM:
{encodingSystem}
```

**User message:** The raw text to encode.

**Model:** Default to `claude-sonnet-4-5-20250929`. Accept override via options.

**Return:** `{ encodedText: string, usage: { input_tokens, output_tokens } }`

### 3. `apps/zer0gravity/src/engine/decoder.cjs`

**Purpose:** Takes encoded text + encoding system description → calls Claude in **fresh context** → returns decoded text. The decoder has NO knowledge of the original text.

**Interface:**
```javascript
async function decode(anthropic, { encodedText, encodingSystem, model }) → { decodedText, usage }
```

**System prompt for decoder:**
```
You are a decoding agent participating in the Zer0 Gr@vity compression challenge.

You have NEVER seen the original text. You only have:
1. The encoding system rules below
2. The encoded text

Your task: Decode the encoded text back to natural English.
Output ONLY the decoded text — no explanations, no commentary, no metadata.

ENCODING SYSTEM:
{encodingSystem}
```

**User message:** The encoded text.

**Critical:** This MUST be a completely fresh Claude call with no reference to the original text. The system prompt must not leak the original.

### 4. `apps/zer0gravity/src/engine/scorer.cjs`

**Purpose:** Applies the 100-point rubric to score a compression experiment.

**Interface:**
```javascript
async function scoreAll(anthropic, { originalText, decodedText, originalTokens, encodedTokens, encodingSystem }) → { scores, total }
```

**Scoring rubric (100 points total):**

**Token Efficiency (40 pts):** Pure math.
```javascript
const compressionPercent = ((originalTokens - encodedTokens) / originalTokens) * 100;
const tokenEfficiency = Math.min(Math.max(Math.round(compressionPercent), 0), 40);
```

**Semantic Preservation (40 pts):** Claude evaluates decoded vs original.
```javascript
async function scoreSemanticPreservation(anthropic, originalText, decodedText) → number (0-40)
```
System prompt:
```
You are evaluating semantic preservation in a compression experiment.

Compare the ORIGINAL text to the DECODED text (which was decoded by an agent that never saw the original).

Score on a 0-40 scale:
- 40: Meaning is identical or imperceptibly different
- 30: Meaning is preserved but with minor loss of nuance
- 20: Meaning is recognizable but some context is lost
- 10: Meaning is partially preserved but significant loss
- 0: Meaning is corrupted or lost

Respond with ONLY a JSON object: { "score": <number>, "reasoning": "<brief explanation>" }
```

**Learnability (15 pts):** Derived from semantic preservation score.
```javascript
// If semantic score >= 35, the encoding is highly learnable (fresh agent decoded well)
// Scale: semanticScore/40 * 15, rounded
const learnability = Math.round((semanticPreservation / 40) * 15);
```

**Implementability (5 pts):** Evaluate encoding system simplicity.
```javascript
async function scoreImplementability(anthropic, encodingSystem) → number (0-5)
```
System prompt:
```
Evaluate this encoding system for implementability as an agent skill.

5 pts: Fully describable as a simple rule set
3 pts: Mostly describable, some ambiguous rules
0 pts: Requires complex custom code or external tools

Respond with ONLY a JSON object: { "score": <number>, "reasoning": "<brief explanation>" }
```

**Return:**
```javascript
{
  scores: {
    tokenEfficiency: number,        // 0-40
    semanticPreservation: number,   // 0-40
    learnability: number,           // 0-15
    implementability: number        // 0-5
  },
  total: number,                    // 0-100
  details: {
    compressionPercent: number,
    semanticReasoning: string,
    implementabilityReasoning: string
  }
}
```

### 5. `apps/zer0gravity/src/engine/experiment.cjs`

**Purpose:** Orchestrates the full encode → decode → score cycle.

**Interface:**
```javascript
async function runExperiment({ originalText, encodingSystem, options }) → ExperimentResult
```

**Flow:**
1. Create Anthropic client (reads `ANTHROPIC_API_KEY` from env via dotenv)
2. Count tokens for `originalText` using `anthropic.messages.countTokens()`
3. Call `encoder.encode()` → get `encodedText`
4. Count tokens for `encodedText`
5. Call `decoder.decode()` → get `decodedText`
6. Call `scorer.scoreAll()` → get scores
7. Return full result object

**Token counting:**
```javascript
async function countTokens(anthropic, text, model) {
  const result = await anthropic.messages.countTokens({
    model,
    messages: [{ role: 'user', content: text }]
  });
  return result.input_tokens;
}
```

**Result shape:**
```javascript
{
  originalText: string,
  encodedText: string,
  decodedText: string,
  encodingSystem: string,
  originalTokens: number,
  encodedTokens: number,
  compressionRatio: number,     // (original - encoded) / original
  scores: { ... },              // From scorer
  total: number,
  metadata: {
    model: string,
    timestamp: string,
    totalApiCalls: number,
    totalTokensUsed: { input: number, output: number }
  }
}
```

### 6. Test Case Files

**`apps/zer0gravity/src/test-cases/level-1-simple.json`:**
```json
{
  "level": 1,
  "name": "Simple Phrases",
  "description": "Baseline test — simple, commonly known phrases",
  "cases": [
    { "id": "1a", "text": "Hello world!" },
    { "id": "1b", "text": "The quick brown fox jumps over the lazy dog" }
  ]
}
```

**`apps/zer0gravity/src/test-cases/level-2-brief.json`:**
```json
{
  "level": 2,
  "name": "The Challenge Brief",
  "description": "The Zer0 Gr@vity challenge description itself — meta and meaningful",
  "cases": [
    {
      "id": "2a",
      "text": "We're inviting agents to design a semantic compression encoding that reduces token count, preserves meaning, can be implemented as a skill, and optimizes for agent-to-agent communication. The test: Agent A encodes, Agent B (fresh, with only the encoding rules) decodes. We compare. If B's English preserves the meaning of the original, the compression works."
    }
  ]
}
```

**`apps/zer0gravity/src/test-cases/level-3-procedural.json`:**
```json
{
  "level": 3,
  "name": "Procedural Instructions",
  "description": "Deterministic instructions with a single correct output — the ultimate test of meaning preservation",
  "cases": [
    {
      "id": "3a",
      "text": "Take the sentence: 'Compression reveals essence'. For each word, count its letters. Multiply each count by the word's position (1-indexed). Sum all three results. Take the sum modulo 26. Convert to a letter where A=0, B=1, through Z=25. Write that letter, then a colon, then the original sentence reversed word-by-word.",
      "expectedOutput": "L:essence reveals Compression",
      "explanation": "Compression=11 letters × 1 = 11. reveals=7 × 2 = 14. essence=7 × 3 = 21. Sum=46. 46 mod 26 = 20. Letter 20 = U. Wait — let me recount. This will be validated during Phase 2."
    }
  ]
}
```

Note: The expectedOutput for Level 3 needs to be validated by actually running the math. This will be done in Phase 2 when experiments run. The placeholder is intentional.

### 7. `apps/zer0gravity/cli.cjs`

**Purpose:** Command-line runner for experiments.

**Usage:**
```bash
# Run a specific level with a default encoding system
node cli.cjs run --level 1

# Run all levels
node cli.cjs run --all

# Run with a custom encoding system (from file)
node cli.cjs run --level 2 --encoding path/to/encoding.txt

# Output to file instead of stdout
node cli.cjs run --level 1 --output results/experiment-001.json
```

**Default encoding system** (used when no `--encoding` is specified):
```
VOWEL_DROP: Remove all vowels from words longer than 3 letters.
COMMON_SUBS: Replace common words: 'the'→'θ', 'is'→'=', 'and'→'&', 'to'→'→', 'of'→'∘', 'a'→'α', 'in'→'∈', 'that'→'∴', 'for'→'∀', 'with'→'⊕', 'this'→'⊙'.
PRESERVE: Keep numbers, proper nouns, and punctuation unchanged.
COMPACT: Remove unnecessary whitespace. Use '|' as word separator where ambiguous.
```

**Flow:**
1. Parse args (can use simple manual parsing, no external arg parser needed)
2. Load `.env` from monorepo root (`../../.env` relative to cli.cjs)
3. Load test case file(s) based on `--level` or `--all`
4. Load encoding system from `--encoding` file or use default
5. For each test case, call `experiment.runExperiment()`
6. Output JSON to stdout or `--output` file
7. Print summary to stderr (so it's visible even when piping stdout)

**Summary output (stderr):**
```
Zer0 Gr@vity Experiment Results
================================
Level 1a: "Hello world!"
  Compression: 45% (12 → 7 tokens)
  Semantic:    35/40
  Total:       78/100

Level 1b: "The quick brown fox..."
  Compression: 38% (15 → 9 tokens)
  Semantic:    32/40
  Total:       71/100
```

## Verification

After building all deliverables:

```bash
cd /Users/erik/Sites/habitualos/apps/zer0gravity
pnpm install
node cli.cjs run --level 1
```

Expected: The CLI runs an encode→decode→score cycle for Level 1 test cases and outputs JSON results + summary. API calls to Claude complete successfully. Scores are within expected ranges.

## Important Notes

- Use `require('dotenv').config({ path: '../../.env' })` to load env from monorepo root
- All files use `.cjs` extension (CommonJS, matching monorepo convention)
- The Anthropic SDK client should be created once and passed to all functions
- Handle API errors gracefully — if Claude returns an error, include it in results rather than crashing
- Token counting: use `anthropic.messages.countTokens()` if available, fallback to rough estimate (response usage stats)
- Keep the code simple — no abstractions for hypothetical future needs
