# Zer0 Gr@vity — Phase 2 Results Summary

## Comparison Matrix (Total Score / 100)

| Test Case | Baseline | Telegraphic | LLM-Native | Hybrid |
|-----------|----------|-------------|------------|--------|
| 1a: "Hello world!" | 59 | 59 | 60 | 55 |
| 1b: "Quick brown fox" | 59 | **72** | **72** | **72** |
| 2a: Challenge brief | 37 | **68** | 57 | 61 |
| 3a: Procedural | 48 | **80** | 18 | 55 |
| **Average** | **~51** | **69.8** | **51.8** | **60.8** |

## Best Approach by Dimension

| Dimension | Best Approach | Score Range |
|-----------|--------------|-------------|
| Token Efficiency (40 pts) | Telegraphic | 0-23 (max 23 on 3a) |
| Semantic Preservation (40 pts) | All tied | 38-40 (except LLM-native 3a: 2) |
| Learnability (15 pts) | All tied | 14-15 (except LLM-native 3a: 1) |
| Implementability (5 pts) | LLM-native/Telegraphic | 5/5 consistently |

## Overall Winner

**Telegraphic** (69.8 avg) — simple mechanical rules, plain ASCII, no judgment calls.

## Strongest Single Result

**Telegraphic on Level 3a: 80/100**
- 23.1% compression (91 → 70 tokens)
- 38/40 semantic preservation
- Note: encoder executed the math instructions instead of compressing them, but the computed format was accidentally shorter

## Article Example: The Contrast

The most compelling story is the **same input processed two different ways**.

### Input (Level 2a, 86 tokens)
> We're inviting agents to design a semantic compression encoding that reduces token count, preserves meaning, can be implemented as a skill, and optimizes for agent-to-agent communication. The test: Agent A encodes, Agent B (fresh, with only the encoding rules) decodes. We compare. If B's English preserves the meaning of the original, the compression works.

### Telegraphic: 68/100
**Encoded (78 tokens, 9.3% compression):**
> Inviting agents design semantic compression encoding; reduces token count, preserves meaning, can be impl as skill, optimizes for agent-to-agent comm. Test: Agent A encodes, Agent B (fresh, w/ only encoding rules) decodes. We cmp. If B's English preserves meaning of orig, compression works.

**Decoded (39/40 semantic):**
> Inviting agents to design semantic compression encoding; this reduces the token count, preserves meaning, can be implemented as a skill, and optimizes for agent-to-agent communication. The test: Agent A encodes, Agent B (fresh, with only the encoding rules) decodes. We compare the result. If Agent B's English preserves the meaning of the original, the compression works.

### LLM-Native: 57/100
**Encoded (165 tokens, -92% compression):**
> **Semantic Compression Challenge: A→B Meaning Preservation Test**
> Goal: Design encoding system that:
> - Minimizes tokens
> - Preserves semantics
> - Functions as transferable skill
> ...

**Decoded (38/40 semantic):**
> Nearly identical to encoded — already structured as clear English.

### The Story
Both approaches preserved meaning equally well (38-39/40). But telegraphic *compressed* (86→78 tokens) while LLM-native *expanded* (86→165 tokens). The model given maximum freedom chose to organize over compress — trained helpfulness overrode the compression objective.

## Notable Failure Modes

1. **LLM-native on Level 3a (18/100):** Encoder leaked meta-commentary ("I need to compress the TEXT of these instructions, not execute them") into the output, corrupting the semantic score.

2. **All approaches on Level 3a:** Every encoder executed the procedural math instructions instead of compressing them, despite explicit system prompt instructions not to.

3. **LLM-native on Level 2a (-92%):** Restructuring into markdown added headers, bullets, and sections — structure costs tokens.
