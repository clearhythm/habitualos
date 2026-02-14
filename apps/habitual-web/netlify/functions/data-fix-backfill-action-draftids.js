require('dotenv').config();
const { getActionsByUserId, updateAction } = require('./_services/db-actions.cjs');
const { getDraftsByAgent } = require('./_services/db-agent-drafts.cjs');

const USER_ID = 'u-mgpqwa49';

/**
 * POST /api/data-fix-backfill-action-draftids
 *
 * One-time fix: backfills draftIds onto open review actions that don't have them.
 * For each review action, finds pending/reviewed drafts for that agent and assigns them.
 *
 * Safe to run multiple times (skips actions that already have draftIds).
 */
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const allActions = await getActionsByUserId(USER_ID);
    const reviewActions = allActions.filter(a =>
      a.taskType === 'review' &&
      ['open', 'defined', 'scheduled', 'in_progress'].includes(a.state) &&
      !a.taskConfig?.draftIds
    );

    console.log(`[data-fix] Found ${reviewActions.length} review actions without draftIds`);

    const results = { patched: 0, details: [] };

    // Track which drafts have been assigned to avoid double-assignment
    const assignedDraftIds = new Set();

    for (const action of reviewActions) {
      const agentId = action.taskConfig?.sourceAgentId || action.agentId;
      if (!agentId) {
        results.details.push({ actionId: action.id, skipped: 'no agentId' });
        continue;
      }

      // Get all pending + reviewed drafts for this agent
      const pendingDrafts = await getDraftsByAgent(agentId, USER_ID, { status: 'pending' });
      const reviewedDrafts = await getDraftsByAgent(agentId, USER_ID, { status: 'reviewed' });
      const allDrafts = [...pendingDrafts, ...reviewedDrafts];

      // Filter out already-assigned drafts
      const unassigned = allDrafts.filter(d => !assignedDraftIds.has(d.id));

      if (unassigned.length === 0) {
        results.details.push({ actionId: action.id, skipped: 'no unassigned drafts' });
        continue;
      }

      // Try to match by count from action title (e.g. "Review 5 new company recommendations")
      const countMatch = action.title?.match(/Review (\d+)/);
      const expectedCount = countMatch ? parseInt(countMatch[1]) : unassigned.length;

      // Take the oldest unassigned drafts up to expectedCount
      const toAssign = unassigned.slice(-expectedCount);
      const draftIds = toAssign.map(d => d.id);

      // Mark as assigned
      draftIds.forEach(id => assignedDraftIds.add(id));

      await updateAction(action.id, {
        taskConfig: { ...action.taskConfig, draftIds }
      });

      console.log(`[data-fix] Patched ${action.id} with ${draftIds.length} draftIds`);
      results.patched++;
      results.details.push({ actionId: action.id, draftIds });
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, ...results })
    };

  } catch (error) {
    console.error('[data-fix-backfill-draftids] ERROR:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: error.message })
    };
  }
};
