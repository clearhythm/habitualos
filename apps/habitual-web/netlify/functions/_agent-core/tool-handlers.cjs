/**
 * Tool Handlers Module
 *
 * Handles tool calls from Claude responses for agent chat.
 * Includes action management, note capture, filesystem, and review tools.
 */

const { getAction, updateActionState, createAction } = require('../_services/db-actions.cjs');
const { generateActionId } = require('../_utils/data-utils.cjs');
const { createNote, getNotesByAgent, getNoteById, updateNote } = require('../_services/db-agent-notes.cjs');
const { getDraftsByAgent, getDraftById, updateDraft } = require('../_services/db-agent-drafts.cjs');
const { incrementAgentActionCount } = require('../_services/db-agents.cjs');
const agentFilesystem = require('../_utils/agent-filesystem.cjs');

/**
 * Handle tool calls from Claude
 * @param {Object} toolBlock - The tool_use block from Claude's response
 * @param {string} userId - User ID for ownership validation
 * @param {string} agentId - Agent ID for context
 * @param {Object} agent - Full agent object (for localDataPath access)
 * @returns {Promise<Object>} Tool result
 */
async function handleToolCall(toolBlock, userId, agentId, agent) {
  const { name, input } = toolBlock;

  // Action tools
  if (name === 'create_action') {
    return handleCreateAction(input, userId, agentId);
  }

  if (name === 'get_action_details') {
    return handleGetActionDetails(input, userId);
  }

  if (name === 'update_action') {
    return handleUpdateAction(input, userId);
  }

  if (name === 'complete_action') {
    return handleCompleteAction(input, userId);
  }

  // Note tools
  if (name === 'create_note') {
    return handleCreateNote(input, userId, agentId);
  }

  if (name === 'get_notes') {
    return handleGetNotes(input, userId, agentId);
  }

  if (name === 'update_note') {
    return handleUpdateNote(input, userId);
  }

  // Filesystem tools
  if (name === 'read_file') {
    return handleReadFile(input, agent);
  }

  if (name === 'write_file') {
    return handleWriteFile(input, agent);
  }

  if (name === 'list_files') {
    return handleListFiles(input, agent);
  }

  // Review tools
  if (name === 'get_pending_drafts') {
    return handleGetPendingDrafts(input, userId, agentId);
  }

  if (name === 'submit_draft_review') {
    return handleSubmitDraftReview(input, userId, agentId);
  }

  return { error: `Unknown tool: ${name}` };
}

// --- Action Tool Handlers ---

async function handleCreateAction(input, userId, agentId) {
  const { title, description, priority, taskType, taskConfig } = input;

  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    return { error: 'Title is required' };
  }

  const actionId = generateActionId();

  const actionData = {
    _userId: userId,
    agentId: agentId,
    projectId: null,
    goalId: null,
    title: title.trim(),
    description: description || '',
    state: 'open',
    priority: priority || 'medium',
    taskType: taskType || 'scheduled',
    assignedTo: 'user',
    taskConfig: taskConfig || {},
    scheduleTime: null,
    dueDate: null,
    startedAt: null,
    completedAt: null,
    dismissedAt: null,
    dismissedReason: null,
    errorMessage: null,
    type: null,
    content: null
  };

  await createAction(actionId, actionData);

  return {
    success: true,
    message: `Created action: "${title.trim()}"`,
    action: {
      id: actionId,
      title: title.trim(),
      description: description || '',
      priority: priority || 'medium',
      taskType: taskType || 'scheduled',
      state: 'open'
    }
  };
}

async function handleGetActionDetails(input, userId) {
  const actionId = input.action_id;

  if (!actionId || !actionId.startsWith('action-')) {
    return { error: 'Invalid action ID format. Expected format: action-{timestamp}-{random}' };
  }

  const action = await getAction(actionId);

  if (!action) {
    return { error: 'Action not found' };
  }

  if (action._userId !== userId) {
    return { error: 'Access denied' };
  }

  return {
    success: true,
    action: {
      id: action.id,
      title: action.title,
      description: action.description,
      state: action.state,
      priority: action.priority,
      taskType: action.taskType,
      taskConfig: action.taskConfig,
      content: action.content || null,
      type: action.type || null,
      _createdAt: action._createdAt,
      _updatedAt: action._updatedAt
    }
  };
}

async function handleUpdateAction(input, userId) {
  const { action_id, updates } = input;

  if (!action_id || !action_id.startsWith('action-')) {
    return { error: 'Invalid action ID format. Expected format: action-{timestamp}-{random}' };
  }

  const action = await getAction(action_id);

  if (!action) {
    return { error: 'Action not found' };
  }

  if (action._userId !== userId) {
    return { error: 'Access denied' };
  }

  // Build safe updates (whitelist allowed fields)
  const safeUpdates = {};
  if (updates.title) safeUpdates.title = updates.title;
  if (updates.description) safeUpdates.description = updates.description;
  if (updates.priority && ['low', 'medium', 'high'].includes(updates.priority)) {
    safeUpdates.priority = updates.priority;
  }
  if (updates.taskConfig) {
    safeUpdates.taskConfig = { ...action.taskConfig };
    if (updates.taskConfig.instructions) {
      safeUpdates.taskConfig.instructions = updates.taskConfig.instructions;
    }
    if (updates.taskConfig.expectedOutput) {
      safeUpdates.taskConfig.expectedOutput = updates.taskConfig.expectedOutput;
    }
  }

  if (Object.keys(safeUpdates).length === 0) {
    return { error: 'No valid updates provided' };
  }

  await updateActionState(action_id, action.state, safeUpdates);

  return {
    success: true,
    message: `Updated action: ${Object.keys(safeUpdates).join(', ')}`,
    updatedFields: Object.keys(safeUpdates)
  };
}

async function handleCompleteAction(input, userId) {
  const actionId = input.action_id;

  if (!actionId || !actionId.startsWith('action-')) {
    return { error: 'Invalid action ID format. Expected format: action-{timestamp}-{random}' };
  }

  const action = await getAction(actionId);

  if (!action) {
    return { error: 'Action not found' };
  }

  if (action._userId !== userId) {
    return { error: 'Access denied' };
  }

  if (action.state === 'completed') {
    return { error: 'Action is already completed' };
  }

  if (action.state === 'dismissed') {
    return { error: 'Cannot complete a dismissed action' };
  }

  await updateActionState(actionId, 'completed', {
    completedAt: new Date().toISOString()
  });

  // Increment agent's completedActions counter
  if (action.agentId) {
    await incrementAgentActionCount(action.agentId, 'completedActions', 1);

    if (action.state === 'in_progress') {
      await incrementAgentActionCount(action.agentId, 'inProgressActions', -1);
    }
  }

  return {
    success: true,
    message: `Action "${action.title}" marked as complete`,
    actionId: actionId,
    title: action.title
  };
}

// --- Note Tool Handlers ---

async function handleCreateNote(input, userId, agentId) {
  const { type, title, content, metadata } = input;

  if (!type || !title || !content) {
    return { error: 'Missing required fields: type, title, and content are required' };
  }

  const note = await createNote({
    _userId: userId,
    agentId: agentId,
    type,
    title,
    content,
    metadata: metadata || {}
  });

  return {
    success: true,
    message: `Note saved: "${title}"`,
    note: {
      id: note.id,
      type: note.type,
      title: note.title
    }
  };
}

async function handleGetNotes(input, userId, agentId) {
  const { status, type, limit } = input;

  const filters = {};
  if (status) filters.status = status;
  if (type) filters.type = type;
  if (limit && typeof limit === 'number' && limit > 0) {
    filters.limit = limit;
  } else {
    filters.limit = 20;
  }

  const notes = await getNotesByAgent(agentId, userId, filters);

  return {
    success: true,
    count: notes.length,
    notes: notes.map(n => ({
      id: n.id,
      type: n.type,
      title: n.title,
      content: n.content,
      metadata: n.metadata,
      status: n.status,
      createdAt: n._createdAt
    }))
  };
}

async function handleUpdateNote(input, userId) {
  const { note_id, updates } = input;

  if (!note_id || !note_id.startsWith('note-')) {
    return { error: 'Invalid note ID format. Expected format: note-{timestamp}-{random}' };
  }

  const note = await getNoteById(note_id);

  if (!note) {
    return { error: 'Note not found' };
  }

  if (note._userId !== userId) {
    return { error: 'Access denied' };
  }

  const result = await updateNote(note_id, updates);

  return {
    success: true,
    message: `Updated note: ${result.updated.join(', ')}`,
    updatedFields: result.updated
  };
}

// --- Filesystem Tool Handlers ---

async function handleReadFile(input, agent) {
  if (!agentFilesystem.isFilesystemAvailable()) {
    return { error: 'Filesystem tools not available in this environment' };
  }
  if (!agent?.localDataPath || !agent?.capabilities?.filesystem) {
    return { error: 'Agent does not have filesystem access configured' };
  }

  const agentDataPath = agentFilesystem.getAgentDataPath(agent.localDataPath);
  if (!agentDataPath) {
    return { error: 'Invalid agent data path configuration' };
  }

  return await agentFilesystem.readFile(agentDataPath, input.path);
}

async function handleWriteFile(input, agent) {
  if (!agentFilesystem.isFilesystemAvailable()) {
    return { error: 'Filesystem tools not available in this environment' };
  }
  if (!agent?.localDataPath || !agent?.capabilities?.filesystem) {
    return { error: 'Agent does not have filesystem access configured' };
  }

  const agentDataPath = agentFilesystem.getAgentDataPath(agent.localDataPath);
  if (!agentDataPath) {
    return { error: 'Invalid agent data path configuration' };
  }

  return await agentFilesystem.writeFile(
    agentDataPath,
    input.path,
    input.content,
    input.mode || 'overwrite'
  );
}

async function handleListFiles(input, agent) {
  if (!agentFilesystem.isFilesystemAvailable()) {
    return { error: 'Filesystem tools not available in this environment' };
  }
  if (!agent?.localDataPath || !agent?.capabilities?.filesystem) {
    return { error: 'Agent does not have filesystem access configured' };
  }

  const agentDataPath = agentFilesystem.getAgentDataPath(agent.localDataPath);
  if (!agentDataPath) {
    return { error: 'Invalid agent data path configuration' };
  }

  return await agentFilesystem.listFiles(agentDataPath, input.path || '');
}

// --- Review Tool Handlers ---

async function handleGetPendingDrafts(input, userId, agentId) {
  const drafts = await getDraftsByAgent(agentId, userId, {
    status: 'pending',
    type: input.type || undefined
  });

  return {
    success: true,
    count: drafts.length,
    drafts: drafts.map(d => ({
      id: d.id,
      type: d.type,
      status: d.status,
      data: d.data
    }))
  };
}

async function handleSubmitDraftReview(input, userId, agentId) {
  const { draftId, score, feedback, user_tags } = input;

  if (!draftId || !draftId.startsWith('draft-')) {
    return { error: 'Invalid draft ID format' };
  }

  if (score === undefined || score === null || typeof score !== 'number') {
    return { error: 'Score is required (0-10). Extract from user conversation based on their expressed interest level.' };
  }
  if (score < 0 || score > 10) {
    return { error: 'Score must be between 0 and 10.' };
  }

  if (!feedback || typeof feedback !== 'string' || feedback.trim().length === 0) {
    return { error: 'Feedback summary is required. Summarize what the user said about this recommendation.' };
  }

  const draft = await getDraftById(draftId);
  if (!draft) {
    return { error: 'Draft not found' };
  }
  if (draft._userId !== userId) {
    return { error: 'Access denied' };
  }

  // Derive status from score
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
    derivedStatus,
    shouldSaveChat: true
  };
}

module.exports = {
  handleToolCall
};
