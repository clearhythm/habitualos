require('dotenv').config();
const { createProject, updateProject, getProject } = require('./_services/db-projects.cjs');
const { generateProjectId } = require('./_utils/data-utils.cjs');

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

  return { error: `Unknown tool: ${name}` };
}

/**
 * POST /api/fox-ea-tool-execute
 *
 * Executes Fox-EA tools (create_project, update_project).
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
