require('dotenv').config();
const { getOwnerBySignalId } = require('./_services/db-signal-owners.cjs');
const { decrypt } = require('./_services/crypto.cjs');

/**
 * POST /api/signal-owner-init
 *
 * Owner mode init — loads the same owner profile context as signal-visitor-init.js
 * so scores are grounded in the same data. The difference is framing: the owner
 * is evaluating opportunities against their own profile, not being evaluated by a visitor.
 */

// ─── Erik's hardcoded context (mirrors signal-visitor-init.js) ───────────────

const ERIK_CONTEXT = `
== BACKGROUND ==

Education & Research:
- Stanford University, biological sciences — ranked first in class
- Beckman Scholar; published research in neuroscience and cognitive science
- Deep foundation in how humans learn, change behavior, and form habits

Enterprise Product (25+ years, 100M+ users):
- Apple: product work on consumer and developer experiences
- Intuit: led UX and product improvements, 20% support call reduction
- Realtor.com: drove $45M revenue impact, 14% paid conversion lift
- Capital One: 300% ROI increase on product initiatives

Behavioral Health:
- Founded Healify in 2020 — behavioral health platform, 1M+ mood assessments processed
- Licensed somatic therapist — treated 100+ patients through hypnotherapy and nervous system regulation
- Rare combination: trained clinician who can also ship

Agentic AI (current, production):
- Building HabitualOS since 2024 — a production multi-agent AI system he uses daily
- Builds with Claude API, Netlify edge functions, Firestore, 11ty
- Real agentic systems: tools, streaming, multi-turn, signal protocols — not demos
- Signal (this conversation) is itself a live example of that work
`;

const ERIK_SKILLS_PROFILE = {
  coreSkills: [
    'Agentic AI systems', 'Product strategy', 'Behavioral science',
    'System prompt design', 'Streaming architecture', 'Firestore data modeling',
    'Edge function development', 'Consumer product', 'Clinical therapy',
    'UX leadership', 'Revenue-tied product decisions', 'Founding-level product work'
  ],
  domains: ['Agentic AI', 'Behavioral health', 'Consumer product', 'Enterprise software', 'Neuroscience'],
  technologies: ['Claude API', 'Netlify edge functions', 'Firestore', '11ty', 'TypeScript', 'Node.js', 'SCSS'],
  projectTypes: ['Production AI systems', 'Behavioral health platforms', 'Consumer apps at scale', 'Clinical validation'],
  completeness: 0.9
};

const ERIK_WANTS_PROFILE = {
  workTypes: ['Agentic AI systems', 'Behavioral product', 'AI-native products'],
  opportunities: ['Senior product leadership', 'AI leadership', 'Fractional CPO', 'Advisory'],
  excitedBy: ['Behavioral science + AI intersection', 'Production systems that help people', 'Founding-stage work'],
  workStyle: 'Collaborative, direct, async-friendly. Prefers real outcomes over polished decks.',
  openTo: ['Remote', 'Hybrid', 'SF / LA'],
  notLookingFor: ['Pure management without craft', 'Pre-product-market-fit pivoting without clear thesis'],
  completeness: 0.85
};

const ERIK_PERSONALITY_PROFILE = {
  communicationStyle: 'direct, warm, intellectually honest',
  intellectualStyle: 'systems thinker, first-principles, empirical',
  problemApproach: 'Challenges assumptions before building; asks clarifying questions; moves fast once direction is clear',
  completeness: 0.85
};

// ─── Profile section builders (mirrors signal-visitor-init.js) ───────────────

function buildProfileSection(displayName, skillsProfile, wantsProfile, personalityProfile) {
  const sections = [];
  if (skillsProfile) {
    sections.push(`== SKILLS (demonstrated) ==
Core: ${(skillsProfile.coreSkills || []).join(', ')}
Domains: ${(skillsProfile.domains || []).join(', ')}
Stack: ${(skillsProfile.technologies || []).join(', ')}`);
  }
  if (wantsProfile) {
    const parts = [];
    if ((wantsProfile.opportunities || []).length) parts.push(`Open to: ${wantsProfile.opportunities.join(', ')}`);
    if ((wantsProfile.excitedBy || []).length) parts.push(`Excited by: ${wantsProfile.excitedBy.join(', ')}`);
    if (wantsProfile.workStyle) parts.push(`Style: ${wantsProfile.workStyle}`);
    if ((wantsProfile.notLookingFor || []).length) parts.push(`Not looking for: ${wantsProfile.notLookingFor.join(', ')}`);
    if (parts.length) sections.push(`== ALIGNMENT (what ${displayName} wants) ==\n${parts.join('\n')}`);
  }
  if (personalityProfile) {
    sections.push(`== PERSONALITY (from work history) ==
Communication: ${personalityProfile.communicationStyle || ''}
Intellectual: ${personalityProfile.intellectualStyle || ''}
Approach: ${personalityProfile.problemApproach || ''}`);
  }
  return sections.join('\n\n');
}

function buildCoverageSection(skillsProfile, wantsProfile, personalityProfile) {
  const pct = (v) => v != null ? `${Math.round((v || 0) * 100)}%` : 'not yet synthesized';
  return `== DIMENSION COVERAGE FROM HISTORY ==
Skills: ${pct(skillsProfile?.completeness)} confidence
Alignment: ${pct(wantsProfile?.completeness)} confidence
Personality: ${pct(personalityProfile?.completeness)} confidence`;
}

// ─── CORS ─────────────────────────────────────────────────────────────────────

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const OPENER = "You're viewing your own Signal. Paste a job description to see how you'd score against it — or ask me anything about your profile.";

// ─── Handler ──────────────────────────────────────────────────────────────────

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ success: false, error: 'Method not allowed' }) };
  }

  try {
    const { signalId } = JSON.parse(event.body || '{}');

    const useOwnerConfig = signalId && signalId !== 'erik-burns';
    let displayName, contextText, ownerApiKey;
    let skillsProfile, wantsProfile, personalityProfile;

    if (useOwnerConfig) {
      const owner = await getOwnerBySignalId(signalId);
      if (!owner || owner.status !== 'active') {
        return { statusCode: 404, headers: CORS, body: JSON.stringify({ success: false, error: 'Signal not found' }) };
      }
      displayName = owner.displayName;
      contextText = owner.contextText || '';
      skillsProfile = owner.skillsProfile || null;
      wantsProfile = owner.wantsProfile || null;
      personalityProfile = owner.personalityProfile || null;
      if (owner.anthropicApiKey) {
        try { ownerApiKey = decrypt(owner.anthropicApiKey); } catch (_) {}
      }
    } else {
      displayName = 'Erik Burns';
      contextText = ERIK_CONTEXT;
      skillsProfile = ERIK_SKILLS_PROFILE;
      wantsProfile = ERIK_WANTS_PROFILE;
      personalityProfile = ERIK_PERSONALITY_PROFILE;
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

Call update_fit_score after your first substantive response, and again whenever scores change meaningfully.
Include nextStep when confidence ≥ 0.65.

Be honest. A 5 is a 5. ${displayName} needs accurate signal, not flattery.
Keep responses concise. This is a diagnostic tool, not an interview.`;

    const response = {
      success: true,
      opener: OPENER,
      systemMessages: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
      tools: [{
        name: 'update_fit_score',
        description: 'Update the fit score display based on what you\'ve learned in the conversation. Call this after your initial response, and again whenever your assessment changes significantly (score change ≥1 or confidence change ≥0.15).',
        input_schema: {
          type: 'object',
          properties: {
            skills: { type: 'number', description: 'Technical skills fit score 0-10' },
            alignment: { type: 'number', description: 'Values/working style alignment score 0-10' },
            personality: { type: 'number', description: 'Personality/culture fit score 0-10' },
            overall: { type: 'number', description: 'Overall fit score 0-10' },
            confidence: { type: 'number', description: 'Confidence in this assessment 0-1' },
            reason: { type: 'string', description: 'Brief explanation of the current assessment' },
            nextStep: { type: 'string', description: 'What should happen next (only include when confidence ≥ 0.65)' }
          },
          required: ['skills', 'alignment', 'personality', 'overall', 'confidence']
        }
      }],
    };

    if (ownerApiKey) response.apiKey = ownerApiKey;

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', ...CORS },
      body: JSON.stringify(response),
    };

  } catch (error) {
    console.error('[signal-owner-init] ERROR:', error);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ success: false, error: 'Internal server error' }) };
  }
};
