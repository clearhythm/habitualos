require('dotenv').config();
const { getActionsByUserId, updateAction } = require('./_services/db-actions.cjs');
const { getAgent } = require('./_services/db-agents.cjs');
const { getDraftsByAgent } = require('./_services/db-agent-drafts.cjs');
const { getProfile, saveProfile } = require('./_services/db-preference-profile.cjs');
const Anthropic = require('@anthropic-ai/sdk');

const anthropic = new Anthropic();

// Hardcoded — same as discovery-scheduled.js
const USER_ID = 'u-mgpqwa49';
const AGENT_ID = 'agent-mk3jq2dqjbfy';

/**
 * POST /api/data-fix-seed-profiles
 *
 * One-time data fix:
 * 1. Patches existing review actions with sourceAgentId in taskConfig
 * 2. Seeds preference profile from existing feedback + agent definition
 *
 * Safe to run multiple times (idempotent).
 */
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const results = { patchedActions: 0, profileSeeded: false };

    // --- Step 1: Patch existing review actions with sourceAgentId ---
    const allActions = await getActionsByUserId(USER_ID);
    const reviewActions = allActions.filter(a => a.taskType === 'review' && !a.taskConfig?.sourceAgentId);

    for (const action of reviewActions) {
      const updatedConfig = { ...action.taskConfig, sourceAgentId: AGENT_ID };
      await updateAction(action.id, { taskConfig: updatedConfig });
      console.log(`[data-fix] Patched action ${action.id} with sourceAgentId`);
      results.patchedActions++;
    }

    // --- Step 2: Seed preference profile ---
    const agent = await getAgent(AGENT_ID);
    const reviewedDrafts = await getDraftsByAgent(AGENT_ID, USER_ID, { status: 'reviewed' });
    const existingProfile = await getProfile(AGENT_ID);

    const goal = agent?.instructions?.goal || '';
    const successCriteria = agent?.instructions?.success_criteria || [];

    // Build prompt incorporating agent definition + any existing feedback
    let prompt = `Generate an initial preference profile for a user's career search.

AGENT DEFINITION (what the user is looking for):
Goal: ${goal}
Success Criteria:
${successCriteria.map(c => `- ${c}`).join('\n') || 'None specified'}
`;

    const draftsWithReview = reviewedDrafts.filter(d => d.review);
    if (draftsWithReview.length > 0) {
      const feedbackSummary = draftsWithReview.map(d =>
        `- ${d.data?.name || 'Unknown'}: ${d.review.feedback || 'No feedback'} (score: ${d.review.score}/10, tags: ${(d.review.user_tags || []).join(', ') || 'none'})`
      ).join('\n');
      prompt += `
EXISTING FEEDBACK (${draftsWithReview.length} reviews):
${feedbackSummary}
`;
    }

    prompt += `
Generate a preference profile as a JSON object with these fields:
- summary: 2-3 sentence overview of what this user is looking for
- likes: Array of specific things they want (from goal + positive feedback)
- dislikes: Array of things to avoid (from negative feedback, or inferred from goal)
- dealBreakers: Array of absolute no-gos (if any clear from feedback)
- patterns: 2-3 sentences describing what stands out

Be specific and concrete. Use the agent definition as the foundation, refined by any feedback data.

Return ONLY the JSON object, no other text.`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }]
    });

    const text = response.content[0]?.text || '{}';
    const match = text.match(/\{[\s\S]*\}/);

    if (match) {
      const profile = JSON.parse(match[0]);
      await saveProfile(AGENT_ID, USER_ID, {
        profile,
        reviewCount: draftsWithReview.length
      });
      results.profileSeeded = true;
      results.profile = profile;
      console.log(`[data-fix] Seeded preference profile with ${draftsWithReview.length} reviews`);
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, ...results })
    };

  } catch (error) {
    console.error('[data-fix-seed-profiles] ERROR:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: error.message })
    };
  }
};
