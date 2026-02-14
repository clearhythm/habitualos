require('dotenv').config();
const { createProject, updateProject, getProject } = require('./_services/db-projects.cjs');
const { generateProjectId } = require('./_utils/data-utils.cjs');
const { getDraftsByUser, getDraftById, updateDraft } = require('./_services/db-agent-drafts.cjs');
const { getAction, updateActionState } = require('./_services/db-actions.cjs');
const { generatePreferenceProfile } = require('./_utils/preference-profile-generator.cjs');

/**
 * Handle tool calls from Claude for Fox-EA
 */
async function handleToolCall(toolUse, userId) {
  const { name, input } = toolUse;

  if (name === 'create_project') {
    const { name: projectName, description, success_criteria, timeline, status } = input;

    if (!projectName) {
      return { error: 'Project name is required' };
    }

    const projectId = generateProjectId();
    const projectData = {
      _userId: userId,
      name: projectName,
      description: description || '',
      success_criteria: success_criteria || [],
      timeline: timeline || 'ongoing',
      status: status || 'open'
    };
    await createProject(projectId, projectData);

    return {
      success: true,
      project: {
        id: projectId,
        ...projectData
      },
      message: `Created project "${projectName}"`
    };
  }

  if (name === 'update_project') {
    const { project_id, updates } = input;

    if (!project_id || !project_id.startsWith('project-')) {
      return { error: 'Invalid project ID format' };
    }

    const project = await getProject(project_id);
    if (!project) {
      return { error: 'Project not found' };
    }
    if (project._userId !== userId) {
      return { error: 'Access denied' };
    }

    // Build safe updates
    const safeUpdates = {};
    if (updates.name) safeUpdates.name = updates.name;
    if (updates.description !== undefined) safeUpdates.description = updates.description;
    if (updates.success_criteria !== undefined) safeUpdates.success_criteria = updates.success_criteria;
    if (updates.timeline !== undefined) safeUpdates.timeline = updates.timeline;
    if (updates.status && ['open', 'completed', 'archived', 'deleted'].includes(updates.status)) {
      safeUpdates.status = updates.status;
    }

    if (Object.keys(safeUpdates).length === 0) {
      return { error: 'No valid updates provided' };
    }

    await updateProject(project_id, safeUpdates);

    return {
      success: true,
      message: `Updated project "${project.name}"`,
      updatedFields: Object.keys(safeUpdates)
    };
  }

  // --- Review Tools ---

  if (name === 'get_pending_drafts') {
    const drafts = await getDraftsByUser(userId, {
      status: 'pending',
      type: input.type || undefined
    });

    return {
      success: true,
      count: drafts.length,
      drafts: drafts.map(d => ({
        id: d.id,
        type: d.type,
        agentId: d.agentId,
        data: d.data
      }))
    };
  }

  if (name === 'submit_draft_review') {
    const { draftId, score, feedback, user_tags } = input;

    if (!draftId || !draftId.startsWith('draft-')) {
      return { error: 'Invalid draft ID format' };
    }
    if (score === undefined || score === null || typeof score !== 'number') {
      return { error: 'Score is required (0-10)' };
    }
    if (score < 0 || score > 10) {
      return { error: 'Score must be between 0 and 10' };
    }
    if (!feedback || typeof feedback !== 'string' || feedback.trim().length === 0) {
      return { error: 'Feedback summary is required' };
    }

    const draft = await getDraftById(draftId);
    if (!draft) {
      return { error: 'Draft not found' };
    }
    if (draft._userId !== userId) {
      return { error: 'Access denied' };
    }

    const derivedStatus = score >= 5 ? 'accepted' : 'rejected';

    // Store review data directly on the draft document
    await updateDraft(draftId, {
      status: 'reviewed',
      review: {
        score,
        feedback,
        status: derivedStatus,
        user_tags: user_tags || [],
        reviewedAt: new Date().toISOString()
      }
    });

    return {
      success: true,
      draftId,
      draftStatus: 'reviewed',
      derivedStatus
    };
  }

  if (name === 'complete_review_action') {
    const { actionId } = input;

    if (!actionId || !actionId.startsWith('action-')) {
      return { error: 'Invalid action ID format' };
    }

    const action = await getAction(actionId);
    if (!action) {
      return { error: 'Action not found' };
    }
    if (action._userId !== userId) {
      return { error: 'Access denied' };
    }

    await updateActionState(actionId, 'completed');

    // Trigger preference profile regeneration (fire-and-forget)
    const sourceAgentId = action.taskConfig?.sourceAgentId;
    if (sourceAgentId) {
      generatePreferenceProfile(sourceAgentId, userId).catch(err => {
        console.error('[fox-ea-tool-execute] Preference profile generation failed:', err.message);
      });
    }

    return {
      success: true,
      message: 'Review action completed'
    };
  }

  return { error: `Unknown tool: ${name}` };
}

/**
 * POST /api/fox-ea-tool-execute
 *
 * Executes Fox-EA tools (projects, draft review).
 * Called by edge function during streaming when tool use is detected.
 */
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ success: false, error: 'Method not allowed' })
    };
  }

  try {
    const { userId, toolUse } = JSON.parse(event.body);

    // Validate inputs
    if (!userId || typeof userId !== 'string' || !userId.startsWith('u-')) {
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, error: 'Valid userId is required' })
      };
    }

    if (!toolUse || !toolUse.name) {
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, error: 'Tool use object is required' })
      };
    }

    const result = await handleToolCall(toolUse, userId);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, result })
    };

  } catch (error) {
    console.error('[fox-ea-tool-execute] ERROR:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: 'Internal server error' })
    };
  }
};
