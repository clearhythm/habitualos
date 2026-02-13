//
// netlify/functions/_utils/preference-profile-generator.cjs
// ------------------------------------------------------
// Generates structured preference profiles from user feedback history.
// Called after review sessions complete. Uses Claude to synthesize
// feedback into a structured profile that informs future discovery.
// ------------------------------------------------------

const Anthropic = require('@anthropic-ai/sdk');
const { getFeedbackByAgent } = require('../_services/db-user-feedback.cjs');
const { getProfile, saveProfile } = require('../_services/db-preference-profile.cjs');

const anthropic = new Anthropic();

/**
 * Generate (or regenerate) a preference profile for a discovery agent
 * @param {string} agentId - Discovery agent ID (source of drafts)
 * @param {string} userId - User ID
 * @returns {Promise<Object>} The saved profile
 */
async function generatePreferenceProfile(agentId, userId) {
  console.log(`[preference-profile] Generating for agent=${agentId}, user=${userId}`);

  // Fetch all feedback for this agent
  const allFeedback = await getFeedbackByAgent(agentId, userId);

  if (allFeedback.length === 0) {
    console.log('[preference-profile] No feedback found, skipping generation');
    return null;
  }

  // Fetch current profile (if exists)
  const currentProfile = await getProfile(agentId);

  // Build prompt for Claude
  const feedbackSummary = allFeedback.map(f =>
    `- ${f.feedback || 'No feedback'} (score: ${f.score}/10, type: ${f.type}, tags: ${(f.user_tags || []).join(', ') || 'none'})`
  ).join('\n');

  let prompt = `Analyze this user's feedback history on research recommendations and generate a structured preference profile.

FEEDBACK HISTORY (${allFeedback.length} reviews, newest first):
${feedbackSummary}
`;

  if (currentProfile?.profile) {
    prompt += `
CURRENT PROFILE (to be updated, not replaced blindly):
${JSON.stringify(currentProfile.profile, null, 2)}
`;
  }

  prompt += `
Generate an updated preference profile as a JSON object with these fields:
- summary: 2-3 sentence overview of what this user is looking for
- likes: Array of specific things they consistently rate highly
- dislikes: Array of specific things they consistently rate poorly
- dealBreakers: Array of things that are absolute no-gos (scored 0-2 consistently)
- patterns: 2-3 sentences describing scoring patterns, trends, or shifts in preference

Be specific and concrete — use the actual feedback language. If preferences have evolved over time, the profile should reflect the most recent direction.

Return ONLY the JSON object, no other text.`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 1000,
    messages: [{ role: 'user', content: prompt }]
  });

  const text = response.content[0]?.text || '{}';

  let profile;
  try {
    // Extract JSON from response
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      profile = JSON.parse(match[0]);
    } else {
      throw new Error('No JSON object found in response');
    }
  } catch (e) {
    console.error('[preference-profile] Failed to parse profile:', e);
    return null;
  }

  // Save the profile
  const saved = await saveProfile(agentId, userId, {
    profile,
    reviewCount: allFeedback.length
  });

  console.log(`[preference-profile] Saved profile with ${allFeedback.length} reviews`);
  return saved;
}

module.exports = { generatePreferenceProfile };
