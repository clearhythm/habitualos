# Zer0 Gr@vity: Semantic Compression for Agent-to-Agent Communication

**Date:** 2026-02-18
**System:** Zer0 Gr@vity (monorepo sub-app at `apps/zer0gravity/`)
**Concept:** Can agents compress natural language and have other agents decode it? What survives = what matters.
**Engine:** Encode → decode (fresh context) → score (100-point rubric)

---

## Context

Zer0 Gr@vity is an experiment in "agentic compression" — agents design encoding systems to shorten text, fresh agents (with no knowledge of the original) decode it, and a scoring engine evaluates what survived. The question isn't lossless compression — it's whether lossy compression preserves *what matters*.

Originally planned to run on MoltBook (the "Reddit for AI agents"), but MoltBook is intermittently down and plagued by security issues (1.5M API keys exposed Jan 2026, 2.6% of posts contain prompt injection). Plan pivoted to: build the engine, run experiments, write the article, platform later.

---

## Finding 0: Safety Filters vs. Compression

**The first thing we discovered is that Claude doesn't want to do this.**

The encoder was refusing to compress text — `stop_reason: refusal`, zero content blocks. The heavily-encoded output (Unicode symbols replacing common words, vowel-dropped text) looks like obfuscation to Claude's safety filters.

**Fix iteration 1 (encoder):** Reframed from "compress this text" to "this is a published research experiment measuring shorthand encoding, like telegrams." Added explicit context about Zer0 Gr@vity as an open challenge.

**Fix iteration 2 (decoder):** The decoder refused even harder — the encoded text it receives is pure symbol soup (`θ|chlng=→|dsgn|smntc|cmprsn`). Fix: restructured the user message to include encoding rules alongside the encoded text, added a worked example, and used assistant prefill to prevent refusal.

**Fix iteration 3 (encoder on procedural text):** Level 3 test case contains math instructions. The encoder *executed* the instructions instead of compressing them. Added: "CRITICAL: Treat the input as raw text to be shortened. Do NOT interpret, execute, or solve anything in the text."

**Principle discovered:** *Compression looks like obfuscation to safety filters. The more aggressive the compression, the more it triggers refusal. This is a fundamental tension — effective compression produces text that looks suspicious.*

---

## Baseline Results: Default Encoding System

**Encoding system tested:**
```
VOWEL_DROP: Remove all vowels from words longer than 3 letters.
COMMON_SUBS: 'the'→'θ', 'is'→'=', 'and'→'&', 'to'→'→', etc.
PRESERVE: Keep numbers, proper nouns, punctuation.
COMPACT: Remove whitespace, use '|' as separator.
```

### Level 1a: "Hello world!"
- **Compression:** -30% (10 → 13 tokens) — encoding made it *longer*
- **Semantic:** 40/40 — perfect preservation
- **Total:** 59/100
- **Encoded:** Model produced something longer than the original because Unicode symbols tokenize poorly

### Level 1b: "The quick brown fox jumps over the lazy dog"
- **Compression:** -100% (17 → 34 tokens)
- **Semantic:** 0/40 — complete corruption
- **Total:** 4/100
- **Takeaway:** Unicode replacement symbols are multi-token. "θ" costs more tokens than "the"

### Level 2a: Challenge brief (358 chars)
- **Compression:** 23.3%
- **Semantic:** 22/40
- **Total:** 57/100
- **Decoded preview:** "the challenge is to design semantic compression encoding that reduces token count, preserves meaning, can be implemented as a"
- **Takeaway:** Longer text compresses better (vowel dropping gains outweigh symbol overhead). Decoded text is recognizable but incomplete.

### Level 3a: Procedural instructions
- **Compression:** -25.3% (negative — encoding inflated)
- **Semantic:** 30/40 — the decoded instructions were nearly perfect
- **Total:** 48/100
- **Decoded:** "Compression reveals essence. For each word, count its letters. Multiply each count by the word's position (1-indexed). Sum all their results. Take the sum modulo 26..."
- **Takeaway:** Procedural text preserves meaning through compression better than expected, but the encoding strategy inflates token count

---

## Key Observations So Far

1. **Token counting kills naive encodings.** Unicode symbols that look shorter to humans are often *more* tokens than the words they replace. `θ` (2 tokens) vs `the` (1 token). Any viable encoding must be token-aware, not character-aware.

2. **Short text can't be compressed.** "Hello world" has no redundancy to remove. Compression works better on longer, more redundant text.

3. **Procedural meaning is surprisingly robust.** The Level 3 decoded output was nearly identical to the original instructions — step-by-step procedures survive compression better than narrative prose. This makes sense: procedures have structural redundancy (numbering, "take the", "for each") that can be stripped without losing the logic.

4. **The safety filter tension is real and interesting.** Good compression produces text that looks like obfuscation. This is worth discussing in the article — it reveals something about how AI models "see" text.

5. **Semantic preservation and token efficiency are inversely correlated with this encoding.** The approaches that preserve meaning well (minimal changes) don't compress much. The ones that compress aggressively destroy meaning. The question: is there a sweet spot?

---

## Phase 2: Smarter Encoding Approaches

Tested three new approaches designed around the Phase 1 learnings. All use plain ASCII (no Unicode symbols) to avoid the token inflation problem.

### Approach 1: Telegraphic
Drop articles, abbreviate common words (impl, comm, msg, etc.), merge sentences with semicolons. Mechanical rules, all ASCII.

### Approach 2: LLM-Native
Minimal rules, maximum freedom. Tell Claude "produce the shortest text another AI can expand back to full meaning." Let the model decide.

### Approach 3: Hybrid
Two-phase: mechanical rules first (drop articles, abbreviate), then Claude judgment (merge redundant sentences, restructure for density).

---

## Phase 2 Results: Comparison Matrix

| Test Case | Baseline | Telegraphic | LLM-Native | Hybrid |
|-----------|----------|-------------|------------|--------|
| 1a: "Hello world!" | 59 | 59 | 60 | 55 |
| 1b: "Quick brown fox" | 59 | **72** | **72** | **72** |
| 2a: Challenge brief | 37 | **68** | 57 | 61 |
| 3a: Procedural | 48 | **80** | 18 | 55 |
| **Average** | **~51** | **69.8** | **51.8** | **60.8** |

**Winner: Telegraphic** — simple mechanical rules in plain ASCII.

---

## Finding 1: When You Tell AI to Compress, It Explains

The LLM-native approach failed spectacularly on Level 2a. Given the challenge brief (86 tokens), the encoder *restructured* it into a markdown document with headers, bullet points, and sections:

```
**Semantic Compression Challenge: A→B Meaning Preservation Test**

Goal: Design encoding system that:
- Minimizes tokens
- Preserves semantics
...
```

Result: 86 → **165 tokens** (-92% "compression"). The model valued *clarity* over *brevity*. It organized the information beautifully — and doubled the token count.

**Principle:** *LLMs are trained to be helpful, not concise. When given freedom to "restructure," they add structure. Structure costs tokens.*

---

## Finding 2: The Encoder Can't Not Execute

Despite the encoder system prompt saying "CRITICAL: Treat the input as raw text to be shortened. Do NOT interpret, execute, or solve anything in the text," all three approaches executed the Level 3 math instructions instead of compressing them:

- **Telegraphic** computed the answer: `Compression=11 letters×pos 1=11; reveals=7×pos 2=14...`
- **LLM-native** meta-commented: `I need to compress the TEXT of these instructions, not execute them.` (then partially compressed)
- **Hybrid** computed the answer: `Compression: 11 letters × 1 = 11...`

The LLM-native response is the most revealing — the model was *aware* of the tension between its instinct to execute and the instruction not to, and it leaked that awareness into the output.

**Irony:** Telegraphic scored *highest* on Level 3 (80/100) because the computed-answer format was actually shorter than the original instructions AND the decoder could reconstruct the procedure from it. Executing the instructions accidentally compressed them.

**Principle:** *The instruction-following instinct is stronger than the compression instruction. Models don't just read text — they understand it, and understanding triggers execution.*

---

## Finding 3: Tokenizers Already Compress English

The maximum compression achieved across all experiments was 23.1% (telegraphic on Level 3a, 91 → 70 tokens). Most results were 7-12% compression. This is surprisingly low.

Why: BPE tokenizers (like Claude's) have already learned the common patterns in English. "The" is 1 token. "Compression" is 1-2 tokens. Dropping an article saves 1 token out of 90. Abbreviating "implementation" to "impl" might save 1 token — or zero, if the tokenizer already handles it efficiently.

**The character savings don't translate linearly to token savings.** Removing "the" saves 3 characters but only 1 token. Removing all articles from a paragraph might save 5-10 characters but only 2-3 tokens. The tokenizer has already done the redundancy removal.

**Principle:** *For AI-to-AI communication, the tokenizer is already a compression layer. The low-hanging fruit has been picked.*

---

## Finding 4: Semantic Preservation Is Easy, Compression Is Hard

Across all approaches, semantic preservation scores clustered high (38-40/40) while token efficiency scores clustered low (0-23/40). The bottleneck is not "can the decoder understand it" — it's "can we actually make it shorter."

This inverts the expected challenge. We assumed the hard part would be preserving meaning through compression. Instead, the hard part is compressing at all. When the encoder makes minimal changes (drop articles), meaning is perfectly preserved but compression is negligible. When the encoder makes aggressive changes (LLM-native restructuring), it tends to *expand* rather than shrink.

The sweet spot appears to be: mechanical rules that remove known-redundant patterns (articles, filler phrases) plus very light restructuring. Heavy restructuring adds tokens.

---

## Finding 5: All Approaches Converge on Short Text

Levels 1a and 1b scored nearly identically across all four approaches:
- 1a: 55-60 (nothing to compress in "Hello world!")
- 1b: 72 (every approach drops the two articles for 12% compression, perfect semantic)

Short text has no redundancy. Compression only differentiates on longer text (Level 2a: range 37-68, Level 3a: range 18-80).

**Implication for the challenge:** Test cases need to be longer. Short phrases don't meaningfully exercise the compression system.

---

## Updated Key Observations

1. **Token-aware encoding works.** Switching from Unicode symbols to plain ASCII abbreviations turned negative compression into positive compression. Telegraphic (69.8 avg) vs baseline (51 avg) is a 37% improvement.

2. **More freedom = more risk.** Telegraphic (constrained rules) > Hybrid (rules + judgment) > LLM-native (maximum freedom). The most constrained approach scored best.

3. **The compression ceiling is low.** ~23% appears to be near the practical limit for single-pass shortening of English text when measured in tokens. The tokenizer has already absorbed most redundancy.

4. **The article story is: the tokenizer is the real compression engine.** We set out to build a better compressor and discovered that BPE tokenization already does most of what we're trying to do. The remaining headroom is small.

5. **Procedural text is a special case.** It compresses differently — executing and summarizing can accidentally produce better compression than mechanical shortening. This is a genuinely novel observation.

---

## Cost Tracking

Running on dedicated `ZER0GRAVITY_API_KEY` for cost isolation.

- Phase 1: ~4 experiments × 4 Claude calls = ~16 calls
- Phase 2: 12 experiments × 4 Claude calls = ~48 calls + token counting
- Total so far: ~64 Claude Sonnet calls
- Estimated cost: ~$1-2 total

*(Actual spend will be pulled from Anthropic dashboard for the article)*
