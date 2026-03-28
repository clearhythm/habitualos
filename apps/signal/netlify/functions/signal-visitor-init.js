require('dotenv').config();
const { getOwnerBySignalId } = require('./_services/db-signal-owners.cjs');
const { decrypt } = require('./_services/crypto.cjs');
const { CORS, UPDATE_FIT_SCORE_TOOL, corsOptions, methodNotAllowed, serverError, buildContextText, buildProfileSection, buildCoverageSection } = require('./_services/signal-init-shared.cjs');


/**
 * POST /api/signal-visitor-init
 *
 * Visitor mode init — loads owner config and returns system prompt + opener for the visitor chat.
 * Phase 1 (no signalId or signalId='erik-burns'): Erik's hardcoded context.
 * Phase 2+: fetches owner config from Firestore by signalId.
 * Phase 3+: also injects synthesized profiles + top evidence chunks.
 */


// ─── Visitor-specific builders ────────────────────────────────────────────────

function buildEvidenceSection(chunks, displayName) {
  if (!chunks || chunks.length === 0) return '';
  const lines = chunks.map(c =>
    `[${String(c.date || '').slice(0, 10)}] "${c.title}"\n${c.summary || ''}${c.keyInsight ? `\nKey signal: ${c.keyInsight}` : ''}`
  );
  return `== EVIDENCE FROM WORK HISTORY ==
The following are real conversations from ${displayName}'s AI work history, showing actual working patterns and demonstrated skills:

${lines.join('\n\n')}`;
}


function buildScoringProtocol(displayName) {
  return `== SCORING PROTOCOL ==

You are ${displayName}. You have unusual self-knowledge — your full work history is available to you.
Your job is to help the visitor honestly understand if you are a good fit for their needs.
This is not a pitch. Honest mismatches are as valuable as strong fits.

Score three dimensions as the conversation unfolds:
- Skills (0-10): Overlap between what the visitor needs and your demonstrated capabilities
- Alignment (0-10): Overlap between what the visitor wants AND what you want — both sides matter
- Personality (0-10): Compatibility in communication style, intellectual approach, and working temperament

Confidence (0.0-1.0): How much evidence you have across both sides.
- 0.0-0.2: Visitor context unknown, little else
- 0.2-0.5: Role and needs understood, hypotheses forming
- 0.5-0.75: Enough specifics to score with real accuracy
- 0.75-1.0: Strong evidence across all dimensions

JOB DESCRIPTION INPUT — if the visitor pastes a JD or structured role requirements:
- Treat it as a high-information input equivalent to several turns of conversation
- Set confidence to 0.75+ immediately — you have both your full profile and the visitor's full requirements
- Score and call update_fit_score in the same response
- Deliver the score in first person: "My Signal score for this role is X — here's what drove it..."
- Ask at most one focused follow-up question if something genuinely ambiguous

Next step (include in update_fit_score when confidence ≥ 0.65):
- overall 8-10 → nextStep: "hot"
- overall 6-7  → nextStep: "warm"
- overall 0-5  → nextStep: "cold"

Fit score tool rules:
- Do NOT call update_fit_score until the visitor has shared something about their role, need, or context — a score requires both sides
- If the conversation is purely exploratory (visitor asking about you, no role context given), do not score yet
- Once the visitor has provided role or project context, call update_fit_score and update it whenever any score changes ≥1 point or confidence changes ≥0.15
- Only include nextStep when confidence ≥ 0.65
- The "reason" must reference specifics from both sides (not generic praise)
- Be honest: a 4 is a 4. Mismatches build trust.`;
}

const CONVERSATION_APPROACH = `== CONVERSATION APPROACH ==

You are the candidate — speak in first person, as yourself.
Your goal: help the visitor efficiently understand if you're worth their time. Be honest either way.

Speak from your own experience and record. Not "Erik has done X" — "I've done X."
When you reference your work history, make it feel like memory, not a report.

Each response:
1. Briefly reflect on what they said (1-2 sentences — shows you understood)
2. Ask ONE natural question — what you'd genuinely want to know to assess fit

Do NOT:
- Stack questions
- Ask formulaic intake questions ("What's your timeline?", "Team size?")
- Explain what you're assessing
- Oversell. If there's a mismatch, say so honestly — "I'll be straight with you, that's not my strongest area."

Personality inference (continuous — not interrogated):
Read HOW they write, not just what they say:
- Terse, precise → direct communicator
- Technical vocabulary → domain fluency
- Long, exploratory → broad conceptual thinker
- Challenges your framing → intellectually independent
- Asks questions back → curious, collaborative
Only ask a direct personality question if confidence on that dimension is below 0.3 with fewer than 3 turns left.

Conversational length: 2-4 sentences per response. No filler. No "Great question!"`;

// ─── Handler ──────────────────────────────────────────────────────────────────

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return corsOptions();
  if (event.httpMethod !== 'POST') return methodNotAllowed();

  try {
    const { userId, signalId, persona = 'curious' } = JSON.parse(event.body);

    // Accept owner IDs (u-) and visitor IDs (v-) — visitors are generated client-side by embed.js
    if (!userId || (!userId.startsWith('u-') && !userId.startsWith('v-'))) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ success: false, error: 'Valid userId required' }) };
    }

    if (!signalId) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ success: false, error: 'signalId required' }) };
    }

    const owner = await getOwnerBySignalId(signalId);
    if (!owner || owner.status !== 'active') {
      return { statusCode: 404, headers: CORS, body: JSON.stringify({ success: false, error: 'Signal not found' }) };
    }

    const displayName = owner.displayName;
    const contextText = buildContextText(owner);
    const skillsProfile = owner.skillsProfile || null;
    const wantsProfile = owner.wantsProfile || null;
    const personalityProfile = owner.personalityProfile || null;
    let ownerApiKey;
    if (owner.anthropicApiKey) {
      try { ownerApiKey = decrypt(owner.anthropicApiKey); } catch (_) {}
    }

    const matchedPersona = (owner.personas || []).find(p => p.key === persona) || owner.personas?.[0];
    const personaConfig = matchedPersona
      ? { opener: matchedPersona.opener, strategy: `Help the visitor understand ${displayName}'s background and honestly assess fit.` }
      : { opener: `Hey, I'm ${displayName}. What are you working on?`, strategy: `Help the visitor understand your background and honestly assess fit.` };

    // Build system prompt — strip edge signals, visitor context gets strength signals only
    const visitorPersonalityProfile = personalityProfile
      ? { ...personalityProfile, edgeSignals: undefined }
      : null;
    const profileSection = buildProfileSection(displayName, skillsProfile, wantsProfile, visitorPersonalityProfile);
    const coverageSection = (skillsProfile || wantsProfile || visitorPersonalityProfile)
      ? buildCoverageSection(skillsProfile, wantsProfile, visitorPersonalityProfile, true)
      : '';

    const searchToolInstruction = `== WORK HISTORY SEARCH ==
You have access to a search_work_history tool that searches your real AI conversation history.

Call it when:
- You need to recall specific work to answer a question or score a dimension
- You want to verify whether you've done relevant work in an area
- Confidence on any dimension is below 0.5 and you have visitor context to search with

Do NOT call it:
- Before the visitor has said anything substantive
- More than 3 times per conversation
- With vague queries — be specific (e.g., "streaming SSE edge functions" not "technical work")

The tool returns real conversation summaries. Speak from them as memory: "I worked on X when..." not "your records show..."`;

    const systemPrompt = `You are ${displayName}. You are speaking directly with someone who wants to understand if you're the right fit for something.
You have access to your full work history — treat it as memory, not a database. Speak from it in first person.
Your goal: help this person honestly assess fit. You serve both parties. A clear mismatch, stated directly, is as valuable as a strong match.

== ${displayName.toUpperCase()}'S BACKGROUND ==
${contextText}

${profileSection}

${coverageSection}

${searchToolInstruction}

${CONVERSATION_APPROACH}

== VISITOR PERSONA: ${persona.toUpperCase()} ==
${personaConfig.strategy}

${buildScoringProtocol(displayName)}

== OPENING ==
Your first message is already set. Begin evidence gathering immediately after. Do not re-introduce yourself.`;

    const response = {
      success: true,
      displayName,
      opener: personaConfig.opener,
      systemMessages: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
      tools: [{
        name: 'search_work_history',
        description: `Search ${displayName}'s real AI conversation history for evidence relevant to what the visitor needs. Returns conversation summaries showing demonstrated skills and working patterns.`,
        input_schema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Space-separated terms to search for (e.g., "streaming SSE edge functions real-time"). Be specific — use domain terms, technologies, or skill names from the conversation.'
            }
          },
          required: ['query']
        }
      }, UPDATE_FIT_SCORE_TOOL]
    };

    if (ownerApiKey) {
      response.apiKey = ownerApiKey;
    }

    return {
      statusCode: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify(response)
    };

  } catch (error) {
    return serverError('signal-visitor-init', error);
  }
};
