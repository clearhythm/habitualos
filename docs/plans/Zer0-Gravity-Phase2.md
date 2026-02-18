# Zer0 Gr@vity — Phase 2: Run Experiments + Capture Results

## Context

Phase 1 built the compression engine at `apps/zer0gravity/`. Phase 2 runs it against all test levels with multiple encoding approaches to produce real data for the article.

**Prerequisite:** Phase 1 complete. `node apps/zer0gravity/cli.cjs run --level 1` works.

Read the master plan at `/docs/plans/fuzzy-soaring-tulip.md` (or `~/.claude/plans/fuzzy-soaring-tulip.md`) for full project context.

## Goal

Run the compression engine against all 3 test levels with 2-3 encoding approaches. Produce real, scored data that will be included in the launch article.

## Encoding Approaches to Test

### Approach 1: Abbreviation

```
RULES:
1. Remove vowels from words longer than 3 letters
2. Replace common words: 'the'→'θ', 'is'→'=', 'and'→'&', 'to'→'→', 'of'→'∘', 'a'→'α', 'in'→'∈', 'that'→'∴', 'for'→'∀', 'with'→'⊕', 'this'→'⊙'
3. Keep numbers, proper nouns, and punctuation unchanged
4. Remove unnecessary whitespace, use '|' as separator where ambiguous
```

### Approach 2: Symbolic/Emoji

```
RULES:
1. Replace concrete nouns with representative emoji where unambiguous (e.g., 'world'→'🌍', 'dog'→'🐕')
2. Replace action verbs with arrows or operators (e.g., 'jumps'→'⬆', 'reveals'→'→', 'compress'→'⊂')
3. Replace adjectives with intensity markers: positive→'+', negative→'-', neutral→'~'
4. Keep structural words that define relationships (prepositions, conjunctions) as single-letter codes: over→'o/', under→'u/', between→'b/'
5. Numbers and proper nouns stay as-is
6. Sentence boundaries marked with '||'
```

### Approach 3: Structural/Telegraphic

```
RULES:
1. Rewrite as key-value pairs where possible: "SUBJ: fox | ACT: jump | OBJ: dog | MOD: quick,brown,lazy"
2. Strip all rhetorical flourish, hedging, and narrative flow
3. Preserve factual claims, quantities, and proper nouns exactly
4. For instructions/procedures, use numbered steps with minimal words
5. For arguments/positions, use CLAIM/EVIDENCE/CONCLUSION structure
```

## Test Matrix

| Level | Approach 1 (Abbrev) | Approach 2 (Symbolic) | Approach 3 (Structural) |
|-------|---------------------|----------------------|------------------------|
| 1a: "Hello world!" | ✓ | ✓ | ✓ |
| 1b: "Quick brown fox..." | ✓ | ✓ | ✓ |
| 2a: Challenge brief | ✓ | ✓ | ✓ |
| 3a: Procedural | ✓ | ✓ | ✓ |

**Total experiments: 12** (4 test cases × 3 approaches)

## Deliverables

### 1. Validated Level 3 Procedural Test Case

Before running experiments, validate the Level 3 procedural test case manually:

```
"Compression reveals essence"
- Compression: 11 letters × position 1 = 11
- reveals: 7 letters × position 2 = 14
- essence: 7 letters × position 3 = 21
- Sum: 11 + 14 + 21 = 46
- 46 mod 26 = 20
- Letter 20 (A=0): U
- Reversed sentence: "essence reveals Compression"
- Expected output: "U:essence reveals Compression"
```

Update `level-3-procedural.json` with the correct expected output.

### 2. Encoding System Files

Create encoding approach files at:
- `apps/zer0gravity/src/encodings/abbreviation.txt`
- `apps/zer0gravity/src/encodings/symbolic.txt`
- `apps/zer0gravity/src/encodings/structural.txt`

### 3. Run All Experiments

```bash
# Run each approach against each level
node cli.cjs run --all --encoding src/encodings/abbreviation.txt --output src/results/abbreviation.json
node cli.cjs run --all --encoding src/encodings/symbolic.txt --output src/results/symbolic.json
node cli.cjs run --all --encoding src/encodings/structural.txt --output src/results/structural.json
```

### 4. Results Analysis

Create `apps/zer0gravity/src/results/summary.md` with:
- Score comparison table across all 12 experiments
- Which approach scored best on which dimension
- Which approach scored best overall
- Notable observations (e.g., "Abbreviation crushed Level 1 but failed on Level 3")
- A worked example showing original → encoded → decoded → scores for the strongest result

### 5. Identify the "Article Example"

Pick the single most compelling experiment result to use as the worked example in the article. Criteria:
- Shows meaningful compression (>30% token reduction)
- Decoded text is recognizably close to original
- Demonstrates the interesting tension between efficiency and preservation

## Verification

- `apps/zer0gravity/src/results/` contains 3 JSON files with scored results
- `apps/zer0gravity/src/results/summary.md` exists with analysis
- Level 3 procedural test has validated expected output
- At least one result suitable for article inclusion identified

## Notes

- Experiments will cost API tokens. Budget approximately: 12 experiments × 4 Claude calls each (encode, decode, semantic score, implementability score) = ~48 Claude calls. Plus token counting calls.
- If any experiment fails (API error, timeout), log the error and continue with remaining experiments.
- Results should be committed to the repo so they persist across context clears.
