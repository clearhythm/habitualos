/**
 * Shared helpers for signal *-init functions.
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/**
 * The update_fit_score tool definition used by all three Signal modes.
 * Claude sends dimension scores only — overall is computed client-side.
 */
const UPDATE_FIT_SCORE_TOOL = {
  name: 'update_fit_score',
  description: 'Update the fit score display based on what you\'ve learned in the conversation. Call this after your initial response, and again whenever your assessment changes significantly (score change ≥1 or confidence change ≥0.15).',
  input_schema: {
    type: 'object',
    properties: {
      skills:      { type: 'number', description: 'Technical skills fit score 0-10' },
      alignment:   { type: 'number', description: 'Values/working style alignment score 0-10' },
      personality: { type: 'number', description: 'Personality/culture fit score 0-10' },
      confidence:  { type: 'number', description: 'Confidence in this assessment 0-1' },
      reason:      { type: 'string', description: 'Brief explanation of the current assessment' },
      nextStep:    { type: 'string', description: 'What should happen next (only include when confidence ≥ 0.65)' },
    },
    required: ['skills', 'alignment', 'personality', 'confidence'],
  },
};

function corsOptions() {
  return { statusCode: 204, headers: CORS, body: '' };
}

function methodNotAllowed() {
  return { statusCode: 405, headers: CORS, body: JSON.stringify({ success: false, error: 'Method not allowed' }) };
}

function ok(data, extra = {}) {
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json', ...CORS },
    body: JSON.stringify({ success: true, ...data }),
  };
}

function serverError(label, error) {
  console.error(`[${label}] ERROR:`, error);
  return { statusCode: 500, headers: CORS, body: JSON.stringify({ success: false, error: 'Internal server error' }) };
}

// ─── Owner profile builders (shared across all init + eval endpoints) ─────────

/**
 * Builds the linkedin + contextText block injected as "background" in every prompt.
 * Caps LinkedIn at 6000 chars and contextText at 3000 to stay within prompt budgets.
 */
function buildContextText(owner) {
  const linkedin = owner.sources?.linkedin || '';
  const contextText = owner.contextText || '';
  return [
    linkedin ? `== LINKEDIN PROFILE ==\n${linkedin.slice(0, 6000)}` : '',
    contextText ? contextText.slice(0, 3000) : '',
  ].filter(Boolean).join('\n\n');
}

/**
 * Builds the structured SKILLS / ALIGNMENT / PERSONALITY sections from synthesized profiles.
 */
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

/**
 * Builds the dimension confidence/coverage section.
 */
function buildCoverageSection(skillsProfile, wantsProfile, personalityProfile, includeNote = false) {
  const pct = (v) => v != null ? `${Math.round((v || 0) * 100)}%` : 'not yet synthesized';
  const note = includeNote ? '\n(Low % means gaps were filled by manual input or defaults — be transparent when scoring)' : '';
  return `== DIMENSION COVERAGE FROM HISTORY ==
Skills: ${pct(skillsProfile?.completeness)} confidence
Alignment: ${pct(wantsProfile?.completeness)} confidence
Personality: ${pct(personalityProfile?.completeness)} confidence${note}`;
}

/**
 * The evaluate_fit tool definition used by owner mode.
 * Combines show_evaluation + update_fit_score into one atomic call.
 * Claude provides full eval data; server saves to Firestore and returns evalId.
 */
const EVALUATE_FIT_TOOL = {
  name: 'evaluate_fit',
  description: 'Evaluate and display a complete fit assessment for a job description. Call this when a JD is pasted — covers scoring, display, and saving in one call.',
  input_schema: {
    type: 'object',
    properties: {
      roleTitle:      { type: 'string', description: 'Role title — use the first line of the JD if it reads like a title. Never paraphrase or invent.' },
      summary:        { type: 'string', description: 'Bottom-line overview: why this score, core tension or fit. 2-4 sentences, second person.' },
      strengths:      { type: 'array', items: { type: 'string' }, description: '2-4 specific fit signals — genuine matches across skills, alignment, or culture.' },
      gaps:           { type: 'array', items: { type: 'string' }, description: '2-4 honest considerations — gaps, misalignments, or watch-outs. Include dimension context (e.g. "Alignment: seeking stability, role is high-ambiguity").' },
      skills:         { type: 'number', description: 'Technical skills fit score 0-10' },
      alignment:      { type: 'number', description: 'Values/working style alignment score 0-10' },
      personality:    { type: 'number', description: 'Personality/culture fit score 0-10, or null if insufficient info' },
      confidence:     { type: 'number', description: 'Confidence in this assessment 0-1' },
      recommendation: { type: 'string', description: 'strong-candidate|worth-applying|stretch|poor-fit' },
      nextStep:       { type: 'string', description: 'hot|warm|cold (only include when confidence ≥ 0.65)' },
    },
    required: ['roleTitle', 'summary', 'strengths', 'gaps', 'skills', 'alignment', 'confidence'],
  },
};

module.exports = {
  CORS, UPDATE_FIT_SCORE_TOOL, EVALUATE_FIT_TOOL, corsOptions, methodNotAllowed, ok, serverError,
  buildContextText, buildProfileSection, buildCoverageSection,
};
