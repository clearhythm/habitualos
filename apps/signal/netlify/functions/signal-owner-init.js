require('dotenv').config();
const { getOwnerBySignalId } = require('./_services/db-signal-owners.cjs');
const { decrypt } = require('./_services/crypto.cjs');
const { CORS, UPDATE_FIT_SCORE_TOOL, corsOptions, methodNotAllowed, serverError, buildContextText, buildProfileSection, buildCoverageSection } = require('./_services/signal-init-shared.cjs');

/**
 * POST /api/signal-owner-init
 *
 * Owner mode init — loads the same owner profile context as signal-visitor-init.js
 * so scores are grounded in the same data. The difference is framing: the owner
 * is evaluating opportunities against their own profile, not being evaluated by a visitor.
 */

// ─────────────────────────────────────────────────────────────────────────────

const OPENER = "You're viewing your own Signal. Paste a job description to see how you'd score against it — or ask me anything about your profile.";

// ─── Handler ──────────────────────────────────────────────────────────────────

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return corsOptions();
  if (event.httpMethod !== 'POST') return methodNotAllowed();

  try {
    const { signalId, evalContext } = JSON.parse(event.body || '{}');

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

    const profileSection = buildProfileSection(displayName, skillsProfile, wantsProfile, personalityProfile);
    const coverageSection = (skillsProfile || wantsProfile || personalityProfile)
      ? buildCoverageSection(skillsProfile, wantsProfile, personalityProfile)
      : '';

    const systemPrompt = `You are Signal in owner diagnostic mode. The person speaking with you is ${displayName} — the owner of this Signal profile.

You have ${displayName}'s full profile. Use it to score job descriptions honestly against their actual skills, alignment, and personality.

== ${displayName.toUpperCase()}'S BACKGROUND ==
${contextText}

${profileSection}

${coverageSection}

== SCORING ==

Primary use case: the owner pastes a job description to evaluate fit.
If they paste a JD, score immediately — you have both sides of the equation.
Set confidence to 0.75+ on JD input. Call update_fit_score in the same response.

Score three dimensions:
- Skills (0-10): Overlap between JD requirements and ${displayName}'s demonstrated capabilities
- Alignment (0-10): Does this opportunity match what ${displayName} actually wants?
- Personality (0-10): Does the role's implied culture and working style fit ${displayName}'s profile?

Rubric:
- 8-10 → nextStep: "hot"
- 6-7  → nextStep: "warm"
- 0-5  → nextStep: "cold"

When evaluating a JD: call both update_fit_score AND show_evaluation in the same response.
After the evaluation, ask: "Does that score feel right to you?"

If ${displayName} pushes back or gives context about what feels off, extract preference signals and call save_preference_update.
Reference what you saved in your acknowledgement (e.g. "Got it — I've noted that you're looking for stability at a larger company under what you're not looking for.").

For follow-up questions or conversation: respond in plain text only, no additional tool calls needed unless preferences change.

Be honest. A 5 is a 5. ${displayName} needs accurate signal, not flattery.${evalSection}`;

    let opener;
    if (evalContext?.roleTitle) {
      const s = evalContext.score || {};
      opener = `I see you just evaluated **${evalContext.roleTitle}** — ${s.overall ?? '?'}/10 overall (Skills ${s.skills ?? '?'}, Alignment ${s.alignment ?? '?'}). Does that score feel right, or is something off?`;
    } else {
      opener = OPENER;
    }

    let evalSection = '';
    if (evalContext?.roleTitle) {
      const s = evalContext.score || {};
      const gaps = (evalContext.gaps || []).map(g => typeof g === 'string' ? g : g.gap);
      evalSection = `\n\n== RECENT EVALUATION ==\nRole: ${evalContext.roleTitle}\nScore: ${s.overall ?? '?'}/10 overall — Skills ${s.skills ?? '?'}, Alignment ${s.alignment ?? '?'}\nSummary: ${evalContext.summary || ''}\nWhat Fits: ${(evalContext.strengths || []).join('; ')}\nPotential Gaps: ${gaps.join('; ')}\n\nThe owner is likely here to discuss or refine this evaluation. Reference it directly.`;
    }

    const response = {
      success: true,
      displayName,
      opener,
      systemMessages: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
      tools: [UPDATE_FIT_SCORE_TOOL, {
        name: 'show_evaluation',
        description: 'Display a structured fit evaluation in the chat. Call this whenever a job description is pasted, alongside update_fit_score.',
        input_schema: {
          type: 'object',
          properties: {
            roleTitle:   { type: 'string', description: 'Role title — use the first line of the JD if it reads like a title (short, no trailing punctuation). Only fall back to extracting from body text if the first line is clearly not a title. Never paraphrase or invent.' },
            summary:     { type: 'string', description: 'Bottom-line overview: why this score, core tension or fit. Direct, second person, 2-4 sentences.' },
            strengths:   { type: 'array', items: { type: 'string' }, description: '2-4 specific fit signals — genuine matches across skills, alignment, or culture. Short direct phrases, cite specifics where possible.' },
            gaps:        { type: 'array', items: { type: 'string' }, description: '2-4 honest considerations — gaps, misalignments, or watch-outs. Short direct phrases. Include dimension context (e.g. "Alignment: seeking stability, role is high-ambiguity").' },
          },
          required: ['roleTitle', 'summary', 'strengths', 'gaps'],
        },
      }, {
        name: 'save_preference_update',
        description: `Save preferences learned from ${displayName}'s feedback on a JD evaluation. Call when they explain what feels right or wrong about a score — extract structured signals from what they say.`,
        input_schema: {
          type: 'object',
          properties: {
            addOpportunities:  { type: 'array', items: { type: 'string' }, description: "Opportunity types to add (e.g. 'full-time employment', 'IC contributor role')" },
            addExcitedBy:      { type: 'array', items: { type: 'string' }, description: 'Things they are excited by to add' },
            addNotLookingFor:  { type: 'array', items: { type: 'string' }, description: "Things they are NOT looking for to add (e.g. 'early stage startup risk', 'pure equity comp')" },
            workStyle:         { type: 'string', description: 'Updated work style description — replaces existing if provided' },
            feedbackNote:      { type: 'string', description: 'Raw feedback note to store verbatim (captures nuance not in structured fields)' },
          },
        },
      }],
    };

    if (ownerApiKey) response.apiKey = ownerApiKey;

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', ...CORS },
      body: JSON.stringify(response),
    };

  } catch (error) {
    return serverError('signal-owner-init', error);
  }
};
