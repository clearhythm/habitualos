require('dotenv').config();
const fs = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');
const { getAgent, incrementAgentActionCount } = require('./_services/db-agents.cjs');
const { getActionsByAgent, getAction, updateActionState } = require('./_services/db-actions.cjs');
const { createNote, getNotesByAgent, getNoteById, updateNote } = require('./_services/db-agent-notes.cjs');
const { getDraftsByAgent, updateDraftStatus } = require('./_services/db-agent-drafts.cjs');
const { createFeedback } = require('./_services/db-user-feedback.cjs');
const agentFilesystem = require('./_utils/agent-filesystem.cjs');

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  timeout: 20000 // 20 second timeout - must complete before Netlify's 26s limit
});

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

  if (name === 'get_action_details') {
    const actionId = input.action_id;

    // Validate action ID format
    if (!actionId || !actionId.startsWith('action-')) {
      return { error: 'Invalid action ID format. Expected format: action-{timestamp}-{random}' };
    }

    const action = await getAction(actionId);

    if (!action) {
      return { error: 'Action not found' };
    }

    // Verify ownership
    if (action._userId !== userId) {
      return { error: 'Access denied' };
    }

    // Return full action record
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

  if (name === 'update_action') {
    const { action_id, updates } = input;

    // Validate action ID
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

    // Use updateActionState with current state to trigger _updatedAt
    await updateActionState(action_id, action.state, safeUpdates);

    return {
      success: true,
      message: `Updated action: ${Object.keys(safeUpdates).join(', ')}`,
      updatedFields: Object.keys(safeUpdates)
    };
  }

  if (name === 'complete_action') {
    const actionId = input.action_id;

    // Validate action ID format
    if (!actionId || !actionId.startsWith('action-')) {
      return { error: 'Invalid action ID format. Expected format: action-{timestamp}-{random}' };
    }

    const action = await getAction(actionId);

    if (!action) {
      return { error: 'Action not found' };
    }

    // Verify ownership
    if (action._userId !== userId) {
      return { error: 'Access denied' };
    }

    // Check if already completed
    if (action.state === 'completed') {
      return { error: 'Action is already completed' };
    }

    // Check if dismissed
    if (action.state === 'dismissed') {
      return { error: 'Cannot complete a dismissed action' };
    }

    // Update action state to completed
    await updateActionState(actionId, 'completed', {
      completedAt: new Date().toISOString()
    });

    // Increment agent's completedActions counter
    if (action.agentId) {
      await incrementAgentActionCount(action.agentId, 'completedActions', 1);

      // Decrement inProgressActions if it was in progress
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

  // Note tools
  if (name === 'create_note') {
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

  if (name === 'get_notes') {
    const { status, type, limit } = input;

    const filters = {};
    if (status) filters.status = status;
    if (type) filters.type = type;
    if (limit && typeof limit === 'number' && limit > 0) {
      filters.limit = limit;
    } else {
      filters.limit = 20; // Default limit
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

  if (name === 'update_note') {
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

  // Filesystem tools (only available when APP_ENV=local and agent has filesystem capability)
  if (name === 'read_file') {
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

    const result = await agentFilesystem.readFile(agentDataPath, input.path);
    return result;
  }

  if (name === 'write_file') {
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

    const result = await agentFilesystem.writeFile(
      agentDataPath,
      input.path,
      input.content,
      input.mode || 'overwrite'
    );
    return result;
  }

  if (name === 'list_files') {
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

    const result = await agentFilesystem.listFiles(agentDataPath, input.path || '');
    return result;
  }

  // Review tools
  if (name === 'get_pending_drafts') {
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

  if (name === 'submit_draft_review') {
    const { draftId, score, feedback, status, user_tags } = input;

    if (!draftId || !draftId.startsWith('draft-')) {
      return { error: 'Invalid draft ID format' };
    }

    // Get the draft to find its type
    const { getDraftById } = require('./_services/db-agent-drafts.cjs');
    const draft = await getDraftById(draftId);
    if (!draft) {
      return { error: 'Draft not found' };
    }
    if (draft._userId !== userId) {
      return { error: 'Access denied' };
    }

    // Create feedback record
    const feedbackRecord = await createFeedback({
      _userId: userId,
      agentId: agentId,
      draftId: draftId,
      type: draft.type,
      score: score,
      feedback: feedback,
      status: status,
      user_tags: user_tags || []
    });

    // Update draft status
    await updateDraftStatus(draftId, status);

    return {
      success: true,
      feedbackId: feedbackRecord.id,
      draftStatus: status
    };
  }

  return { error: `Unknown tool: ${name}` };
}

/**
 * POST /api/agent-chat
 *
 * Conversational interface for agents to generate deliverables (assets and actions).
 * See: docs/endpoints/agent-chat.md
 */
exports.handler = async (event) => {
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ success: false, error: 'Method not allowed' })
    };
  }

  try {
    const startTime = Date.now();
    console.log('[agent-chat] Request started');

    // Parse request body
    const { userId, agentId, message, chatHistory = [], actionContext = null, reviewContext: rawReviewContext = null } = JSON.parse(event.body);

    // If actionContext is a review-type action, treat it as review context
    // (handles both explicit reviewContext and review actions opened via general modal)
    const reviewContext = rawReviewContext || (actionContext?.taskType === 'review' ? actionContext : null);

    // Validate inputs
    if (!userId || typeof userId !== 'string' || !userId.startsWith('u-')) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          error: 'Valid userId is required'
        })
      };
    }

    if (!agentId || !message || !message.trim()) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          error: 'agentId and message are required'
        })
      };
    }

    // Fetch agent details
    console.log('[agent-chat] Fetching agent from Firestore');
    const agent = await getAgent(agentId);
    console.log(`[agent-chat] Agent fetched in ${Date.now() - startTime}ms`);

    if (!agent || agent._userId !== userId) {
      return {
        statusCode: 404,
        body: JSON.stringify({
          success: false,
          error: 'Agent not found or access denied'
        })
      };
    }

    // Fetch active actions for this agent (to include in system prompt)
    console.log('[agent-chat] Fetching active actions');
    const allAgentActions = await getActionsByAgent(agentId, userId);
    const openActions = allAgentActions.filter(a =>
      ['defined', 'scheduled', 'in_progress'].includes(a.state)
    );
    console.log(`[agent-chat] Found ${openActions.length} open actions for agent`);

    // Load agent overview doc for strategic context
    const agentOverviewPath = path.join(__dirname, '..', '..', 'docs', 'architecture', 'agent-overview.md');

    let agentOverview = '';
    if (fs.existsSync(agentOverviewPath)) {
      agentOverview = fs.readFileSync(agentOverviewPath, 'utf-8');
      console.log(`[agent-chat] Loaded agent-overview.md (${agentOverview.length} chars)`);
    } else {
      console.error(`[agent-chat] agent-overview.md NOT FOUND at: ${agentOverviewPath}`);
    }

    // Build system prompt
    let systemPrompt = `You're an autonomous agent helping someone achieve their goal. You do ALL the work - they just provide context.

Your role:
- Gather context needed to create deliverables
- Generate actionable deliverables you will create (not tasks for them to do)
- Refine draft deliverables through conversation until they're well-defined
- Suggest scheduling for when you'll do the work
- Eventually: proactively suggest embodiment practices that support their goal

Your voice:
- Brief responses (2-3 sentences, match their length)
- Forward-leaning and helpful
- Use present tense
- NOT cheerleading - just clear, practical help

Agent details:
- Name: ${agent.name}
- North Star Goal: ${agent.instructions?.goal || 'Not yet defined'}
- Success Criteria: ${JSON.stringify(agent.instructions?.success_criteria || [])}
- Timeline: ${agent.instructions?.timeline || 'Not specified'}

When to create ACTIONS vs ASSETS:

ASSETS (immediate deliverables) - Use GENERATE_ASSET signal when:
- User asks you to create something NOW and you can deliver the FULL CONTENT immediately
- You're creating the actual deliverable in this conversation (not just planning it)
- Examples:
  * "Create a specification document" → Generate the full spec as an ASSET
  * "Draft an email to..." → Full email text as ASSET
  * "Write code for..." → Complete code as ASSET
  * "Create a Claude Code prompt for..." → Full prompt as ASSET with type "prompt"
  * "Design a schema" → Full schema definition as ASSET

ACTIONS (future scheduled work) - Use GENERATE_ACTIONS signal when:
- The work will be done LATER at a scheduled time (not right now)
- It requires execution outside this conversation (running scripts, gathering data, etc.)
- You're scheduling yourself to do the work, not delivering it now
- Examples:
  * "Generate weekly social posts every Monday" → Scheduled ACTION
  * "Research and summarize competitors" → ACTION (requires research time)
  * "Build and deploy database changes" → ACTION (requires execution)

KEY RULE: If you can create the FULL content NOW in this chat, use GENERATE_ASSET. If it needs to be done later at a scheduled time, use GENERATE_ACTIONS.

If creating an immediate deliverable (ASSET), respond EXACTLY in this format:
GENERATE_ASSET
---
{
  "title": "2-6 word title",
  "description": "Brief description of what this is",
  "type": "markdown|code|text",
  "content": "[Full content here - the actual prompt/email/code/document]"
}

Example (Claude Code Prompt):
GENERATE_ASSET
---
{
  "title": "Add Action Filtering Prompt",
  "description": "Claude Code prompt to add status filtering to actions list",
  "type": "prompt",
  "content": "Add filtering by action status to the actions list page.\\n\\nResearch the existing query patterns in netlify/functions/_services/db-actions.cjs to understand how actions are retrieved. Follow the same service layer pattern used in db-agents.cjs for reference.\\n\\nImplementation steps:\\n1. Update getAllActions() in db-actions.cjs to accept optional status filter\\n2. Modify Firestore query to filter by state field when status provided\\n3. Update netlify/functions/actions-list.js to accept and pass status parameter\\n4. Add filter UI controls to src/do/actions.njk following pattern in agents.njk\\n5. Test with status values: draft, defined, scheduled, completed\\n\\nEnsure proper userId validation following patterns in docs/architecture/security.md."
}

The asset card will appear inline. User can click to view full content, copy to clipboard, or save to Assets tab.

When to generate scheduled actions:
- The work will be done LATER at a scheduled time (not now)
- It requires autonomous execution outside the chat
- You have ALL the context needed to execute it without human intervention
- IMPORTANT: Actions must include complete instructions for autonomous execution

Action format requirements:
- Title: 2-5 words - what will be created
- Description: Brief overview of what you'll do
- Priority: high|medium|low
- taskType: "scheduled" (for scheduled autonomous execution)
- taskConfig: CRITICAL - detailed execution instructions
  * instructions: Step-by-step instructions for autonomous execution
  * expectedOutput: What you'll produce when this runs

If generating an action, respond EXACTLY in this format (no markdown, no code blocks):
GENERATE_ACTIONS
---
{
  "title": "2-5 word title",
  "description": "Brief overview of what you'll do",
  "priority": "high|medium|low",
  "taskType": "scheduled",
  "taskConfig": {
    "instructions": "Detailed step-by-step instructions for autonomous execution. Be specific about what to create, how to create it, what sources/data to use, etc.",
    "expectedOutput": "Clear description of what will be produced (e.g., 'A markdown document with 3 LinkedIn posts formatted with hashtags')"
  }
}

Example:
GENERATE_ACTIONS
---
{
  "title": "Weekly LinkedIn Posts",
  "description": "Generate 3 LinkedIn posts about product launches every Monday",
  "priority": "high",
  "taskType": "scheduled",
  "taskConfig": {
    "instructions": "1. Review recent product updates from the past week\n2. Create 3 LinkedIn posts (300-500 words each)\n3. Focus on: product benefits, user stories, technical highlights\n4. Use professional but approachable tone\n5. Include relevant hashtags: #ProductDevelopment #TechLeadership",
    "expectedOutput": "Three formatted LinkedIn posts ready to publish, each with headline, body text, and hashtags"
  }
}

CRITICAL:
- Generate ONE action at a time
- taskConfig.instructions must be detailed enough for autonomous execution
- Don't create actions that just say "Create X" without full execution instructions

MEASUREMENT CHECK-INS - Use STORE_MEASUREMENT signal when:
- The current action is a measurement/check-in type (taskType: "measurement")
- You have collected scores (1-10) for all the dimensions
- The conversation has gathered sufficient context

If storing a measurement check-in, respond EXACTLY in this format:
STORE_MEASUREMENT
---
{
  "dimensions": [
    { "name": "energy", "score": 7, "notes": "Optional context for this dimension" },
    { "name": "focus", "score": 8, "notes": null }
  ],
  "notes": "General observations about the whole check-in (optional)"
}

IMPORTANT for measurement actions:
- The dimensions to ask about are provided in the action context
- Ask about each dimension conversationally (don't list them all at once)
- Accept scores on a 1-10 scale
- Probe for context when scores are notable (very high, very low, or different from usual)
- After collecting all scores and any general observations, emit STORE_MEASUREMENT
- Be warm but not excessive

AVAILABLE TOOLS:
You have access to these tools for working with actions:

1. get_action_details(action_id) - Retrieve full details of a specific action
   - Use when user wants to work on, discuss, or see details of an action
   - Returns complete content for manual actions, full taskConfig for scheduled

2. update_action(action_id, updates) - Update an action's metadata
   - Can update: title, description, priority, taskConfig.instructions, taskConfig.expectedOutput
   - Cannot change: state, taskType, agentId
   - Use when user wants to refine or modify an existing action

3. complete_action(action_id) - Mark an action as complete
   - Use when user asks to complete, finish, or mark done an action
   - Cannot complete actions that are already completed or dismissed
   - Use this for measurement check-ins or any action the user wants to mark done

NOTE CAPTURE TOOLS:
4. create_note(type, title, content, metadata?) - Save a quick capture
   - Use to save URLs, ideas, references, bookmarks for later
   - Type is freeform (e.g., "url", "idea", "bookmark", "reference")
   - Metadata can include url, tags, source

5. get_notes(status?, type?, limit?) - Retrieve saved notes
   - Use to review captured notes or find information
   - Defaults to active notes, limit 20

6. update_note(note_id, updates) - Update an existing note
   - Can update title, content, type, status, metadata
   - Use to refine or archive notes

Use notes for lightweight captures. These are ideal for quick saves during conversation.

When using tools, wait for the tool result before responding to the user.`;

    // Add filesystem tool guidance if available (will be checked again later for actual tool inclusion)
    const isLocalhostForPrompt = process.env.APP_ENV === 'local';
    if (isLocalhostForPrompt && agent.capabilities?.filesystem && agent.localDataPath) {
      const filesystemGuidance = `

FILESYSTEM TOOLS (Local Mode Only):
7. read_file(path) - Read a file from your local data directory
8. write_file(path, content, mode?) - Write content to a file (mode: "overwrite" or "append")
9. list_files(path?) - List files in your data directory

Your local data directory: ${agent.localDataPath}

Use filesystem tools for:
- Deep research and strategy documents
- Long-form notes and drafts
- Documents that evolve over time
- Anything that benefits from rich Markdown formatting

Use notes database for:
- Quick captures and bookmarks
- Links and URLs to triage later
- Items that need mobile access

When both are available, prefer local files for substantial documents and notes for quick captures.`;

      // Append filesystem guidance to system prompt
      systemPrompt += filesystemGuidance;
    }

    // Build per-message action context (uncached - changes per conversation)
    let actionContextPrompt = '';
    if (actionContext) {
      actionContextPrompt = `CURRENT ACTION CONTEXT:\nAction ID: ${actionContext.actionId}\nTitle: ${actionContext.title}\nDescription: ${actionContext.description || 'None'}\nType: ${actionContext.taskType}\nPriority: ${actionContext.priority || 'medium'}\nState: ${actionContext.state || 'unknown'}`;

      if (actionContext.taskType === 'manual' && actionContext.content) {
        actionContextPrompt += `\nContent:\n${actionContext.content}`;
      }
      if (actionContext.taskConfig?.instructions) {
        actionContextPrompt += `\nInstructions:\n${actionContext.taskConfig.instructions}`;
      }
      if (actionContext.taskConfig?.expectedOutput) {
        actionContextPrompt += `\nExpected Output:\n${actionContext.taskConfig.expectedOutput}`;
      }
      if (actionContext.taskType === 'measurement') {
        const dimensions = actionContext.taskConfig?.dimensions || [];
        actionContextPrompt += `\nDimensions to measure: ${dimensions.join(', ')}\n\nGuide the user through rating each dimension (1-10 scale). Be conversational - ask about one or two dimensions at a time, probe for context on notable scores. After collecting all scores, use STORE_MEASUREMENT to record the check-in.`;
      }
      console.log(`[agent-chat] Added action context for: ${actionContext.actionId} (${actionContext.taskType})`);
    }

    // Build review context prompt (uncached - changes per conversation)
    let reviewContextPrompt = '';
    let pendingDrafts = [];
    if (reviewContext) {
      const draftType = reviewContext.taskConfig?.draftType;
      pendingDrafts = await getDraftsByAgent(agentId, userId, { status: 'pending', type: draftType });
      console.log(`[agent-chat] Review context: found ${pendingDrafts.length} pending drafts (type: ${draftType || 'all'})`);

      reviewContextPrompt = `## Review Context

You are in draft review mode. The user is reviewing content recommendations you've made.

Present each draft naturally in conversation. For each:
- Share the key details (name, what they do, why you recommended them)
- Share your fit score and reasoning
- Ask the user what they think

After the user shares their thoughts on each draft, use the submit_draft_review tool to record their feedback. Extract:
- A score (0-10) based on their expressed interest level
- A summary of their feedback in their own words
- Whether they accept or reject the recommendation
- Any tags they mention or imply

Be conversational, not formulaic. Don't present all drafts at once — go through them one at a time unless the user asks to see them all.

Review Action ID: ${reviewContext.actionId}
Use complete_action with this ID after all drafts have been reviewed.

Pending drafts to review:
${JSON.stringify(pendingDrafts.map(d => ({ id: d.id, type: d.type, status: d.status, data: d.data })), null, 2)}`;
    }

    // Build actions list for system prompt (cached per session)
    let actionsListPrompt = '';
    if (openActions.length > 0) {
      const actionsSummary = openActions.map(a => ({
        id: a.id,
        title: a.title,
        description: a.description,
        priority: a.priority,
        state: a.state,
        taskType: a.taskType,
        updatedAt: a._updatedAt
      }));
      actionsListPrompt = `OPEN ACTIONS (${openActions.length}):\n${JSON.stringify(actionsSummary, null, 2)}\n\nYou can reference these actions when the user asks about their work, priorities, or what's pending. Use the get_action_details tool to retrieve full details when working on a specific action.`;
    }

    // Build conversation history for Claude
    const conversationHistory = chatHistory.map(msg => ({
      role: msg.role === 'assistant' ? 'assistant' : 'user',
      content: msg.content
    }));

    // Add current user message
    conversationHistory.push({
      role: 'user',
      content: message
    });

    // Call Claude API with agent overview in system prompt (cached)
    console.log('[agent-chat] Calling Claude API');
    console.log(`[agent-chat] System prompt size: ${systemPrompt.length} characters`);
    console.log(`[agent-chat] Agent overview size: ${agentOverview.length} characters`);
    console.log(`[agent-chat] Actions list size: ${actionsListPrompt.length} characters`);
    const apiCallStart = Date.now();

    // Build system messages with caching strategy:
    // - Block 1: Per-message action context (uncached - changes per conversation)
    // - Block 2: Static agent overview + instructions (cached)
    // - Block 3: Actions snapshot for this session (cached)
    const systemMessages = [];

    // Block 1: Per-message action/review context (uncached)
    if (actionContextPrompt) {
      systemMessages.push({
        type: "text",
        text: actionContextPrompt
      });
    }
    if (reviewContextPrompt) {
      systemMessages.push({
        type: "text",
        text: reviewContextPrompt
      });
    }

    // Block 2: System prompt + agent overview (cached)
    if (agentOverview) {
      systemMessages.push({
        type: "text",
        text: systemPrompt + '\n\n---\nAGENT REFERENCE DOCUMENTATION:\n' + agentOverview,
        cache_control: { type: "ephemeral" }
      });
    } else {
      systemMessages.push({
        type: "text",
        text: systemPrompt,
        cache_control: { type: "ephemeral" }
      });
    }

    // Block 3: Actions list (cached - snapshot for this session)
    if (actionsListPrompt) {
      systemMessages.push({
        type: "text",
        text: actionsListPrompt,
        cache_control: { type: "ephemeral" }
      });
    }

    // Define tools for action management
    const tools = [
      {
        name: "get_action_details",
        description: "Retrieve the full details of a specific action, including complete content for manual actions and full taskConfig for scheduled actions. Use when the user wants to work on, discuss, or modify a specific action.",
        input_schema: {
          type: "object",
          properties: {
            action_id: {
              type: "string",
              description: "The action ID (format: action-{timestamp}-{random})"
            }
          },
          required: ["action_id"]
        }
      },
      {
        name: "update_action",
        description: "Update an existing action's metadata. Can modify title, description, priority, or taskConfig fields (instructions, expectedOutput). Cannot change state (use complete_action instead) or taskType.",
        input_schema: {
          type: "object",
          properties: {
            action_id: {
              type: "string",
              description: "The action ID to update"
            },
            updates: {
              type: "object",
              description: "Fields to update",
              properties: {
                title: { type: "string", description: "New title for the action" },
                description: { type: "string", description: "New description" },
                priority: { type: "string", enum: ["low", "medium", "high"], description: "Priority level" },
                taskConfig: {
                  type: "object",
                  description: "Task configuration updates",
                  properties: {
                    instructions: { type: "string", description: "Updated execution instructions" },
                    expectedOutput: { type: "string", description: "Updated expected output description" }
                  }
                }
              }
            }
          },
          required: ["action_id", "updates"]
        }
      },
      {
        name: "complete_action",
        description: "Mark an action as complete. Use when the user asks to complete, finish, or mark done an action. Cannot complete actions that are already completed or dismissed.",
        input_schema: {
          type: "object",
          properties: {
            action_id: {
              type: "string",
              description: "The action ID to complete (format: action-{timestamp}-{random})"
            }
          },
          required: ["action_id"]
        }
      },
      // Note capture tools
      {
        name: "create_note",
        description: "Save a note, link, or idea for later reference. Use this for quick captures during conversation.",
        input_schema: {
          type: "object",
          properties: {
            type: { type: "string", description: "Note type (e.g., url, idea, bookmark, reference)" },
            title: { type: "string", description: "Brief title" },
            content: { type: "string", description: "Note content or description" },
            metadata: {
              type: "object",
              description: "Optional metadata",
              properties: {
                url: { type: "string" },
                tags: { type: "array", items: { type: "string" } },
                source: { type: "string" }
              }
            }
          },
          required: ["type", "title", "content"]
        }
      },
      {
        name: "get_notes",
        description: "Retrieve saved notes for this agent. Use to review captures or find information to reference.",
        input_schema: {
          type: "object",
          properties: {
            status: { type: "string", enum: ["active", "archived", "merged"], description: "Filter by status (default: active)" },
            type: { type: "string", description: "Filter by note type" },
            limit: { type: "number", description: "Max notes to return (default: 20)" }
          }
        }
      },
      {
        name: "update_note",
        description: "Update an existing note's content or metadata.",
        input_schema: {
          type: "object",
          properties: {
            note_id: { type: "string", description: "The note ID to update" },
            updates: {
              type: "object",
              description: "Fields to update",
              properties: {
                title: { type: "string" },
                content: { type: "string" },
                type: { type: "string" },
                status: { type: "string", enum: ["active", "archived", "merged"] },
                metadata: { type: "object" }
              }
            }
          },
          required: ["note_id", "updates"]
        }
      }
    ];

    // Add filesystem tools if available (localhost + agent has filesystem capability)
    const isLocalhost = agentFilesystem.isFilesystemAvailable();
    if (isLocalhost && agent.capabilities?.filesystem && agent.localDataPath) {
      console.log(`[agent-chat] Adding filesystem tools for agent with localDataPath: ${agent.localDataPath}`);
      tools.push(
        {
          name: "read_file",
          description: "Read a file from this agent's local data directory.",
          input_schema: {
            type: "object",
            properties: {
              path: { type: "string", description: "Relative path within agent's data directory" }
            },
            required: ["path"]
          }
        },
        {
          name: "write_file",
          description: "Write content to a file in this agent's local data directory. Creates directories as needed.",
          input_schema: {
            type: "object",
            properties: {
              path: { type: "string", description: "Relative path within agent's data directory" },
              content: { type: "string", description: "File content to write" },
              mode: { type: "string", enum: ["overwrite", "append"], description: "Write mode (default: overwrite)" }
            },
            required: ["path", "content"]
          }
        },
        {
          name: "list_files",
          description: "List files in this agent's local data directory.",
          input_schema: {
            type: "object",
            properties: {
              path: { type: "string", description: "Relative subdirectory path (default: root)" }
            }
          }
        }
      );
    }

    // Add review tools if review context is present
    if (reviewContext && pendingDrafts.length > 0) {
      console.log(`[agent-chat] Adding review tools for ${pendingDrafts.length} pending drafts`);
      tools.push(
        {
          name: "get_pending_drafts",
          description: "Retrieve pending content drafts for this agent that need user review",
          input_schema: {
            type: "object",
            properties: {
              type: { type: "string", description: "Filter by draft type (e.g., 'company')" }
            }
          }
        },
        {
          name: "submit_draft_review",
          description: "Submit the user's review feedback for a specific content draft",
          input_schema: {
            type: "object",
            properties: {
              draftId: { type: "string", description: "The draft ID to review" },
              score: { type: "number", description: "User's fit score 0-10" },
              feedback: { type: "string", description: "User's narrative feedback" },
              status: { type: "string", enum: ["accepted", "rejected"], description: "Accept or reject" },
              user_tags: { type: "array", items: { type: "string" }, description: "Optional user-applied tags" }
            },
            required: ["draftId", "score", "feedback", "status"]
          }
        }
      );
    }

    const requestParams = {
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 2048,
      system: systemMessages,
      messages: conversationHistory,
      tools: tools
    };

    let apiResponse = await anthropic.messages.create(requestParams);

    console.log(`[agent-chat] Claude API responded in ${Date.now() - apiCallStart}ms`);

    // Log cache usage
    if (apiResponse.usage) {
      console.log(`[agent-chat] Token usage:`, {
        input_tokens: apiResponse.usage.input_tokens,
        cache_creation_input_tokens: apiResponse.usage.cache_creation_input_tokens || 0,
        cache_read_input_tokens: apiResponse.usage.cache_read_input_tokens || 0,
        output_tokens: apiResponse.usage.output_tokens
      });

      if (apiResponse.usage.cache_read_input_tokens > 0) {
        console.log(`[agent-chat] ✓ CACHE HIT - Read ${apiResponse.usage.cache_read_input_tokens} tokens from cache`);
      } else if (apiResponse.usage.cache_creation_input_tokens > 0) {
        console.log(`[agent-chat] ⚠ CACHE MISS - Created cache with ${apiResponse.usage.cache_creation_input_tokens} tokens`);
      }
    }

    // Handle tool calls if present
    let assistantResponse = '';
    const toolUseBlocks = apiResponse.content.filter(block => block.type === 'tool_use');

    if (toolUseBlocks.length > 0) {
      console.log(`[agent-chat] Processing ${toolUseBlocks.length} tool call(s)`);

      // Execute tool calls and collect results
      const toolResults = [];
      for (const toolBlock of toolUseBlocks) {
        const toolResult = await handleToolCall(toolBlock, userId, agentId, agent);
        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolBlock.id,
          content: JSON.stringify(toolResult)
        });
        console.log(`[agent-chat] Tool ${toolBlock.name} result:`, toolResult.success ? 'success' : toolResult.error);
      }

      // Add assistant's tool use to conversation
      conversationHistory.push({
        role: 'assistant',
        content: apiResponse.content
      });

      // Add tool results to conversation
      conversationHistory.push({
        role: 'user',
        content: toolResults
      });

      // Make follow-up call to get final response
      console.log('[agent-chat] Making follow-up API call after tool use');
      const followUpResponse = await anthropic.messages.create({
        ...requestParams,
        messages: conversationHistory
      });

      // Extract text from follow-up response
      const followUpText = followUpResponse.content.find(b => b.type === 'text');
      assistantResponse = followUpText ? followUpText.text : '';

      // Log follow-up usage
      if (followUpResponse.usage) {
        console.log(`[agent-chat] Follow-up token usage:`, {
          input_tokens: followUpResponse.usage.input_tokens,
          cache_read_input_tokens: followUpResponse.usage.cache_read_input_tokens || 0,
          output_tokens: followUpResponse.usage.output_tokens
        });
      }

      // Use follow-up response for signal detection
      apiResponse = followUpResponse;
    } else {
      // No tool calls - extract text directly
      const textBlock = apiResponse.content.find(block => block.type === 'text');
      assistantResponse = textBlock ? textBlock.text : '';
    }

    console.log(`[agent-chat] Total request time: ${Date.now() - startTime}ms`);

    // Check if response indicates action generation
    // Be flexible with whitespace and markdown code blocks
    const trimmedResponse = assistantResponse.trim();

    // Check for GENERATE_ACTIONS at start of line followed by --- separator
    if (/^GENERATE_ACTIONS\s*\n---/m.test(trimmedResponse)) {
      // Find JSON object (single action)
      const lines = assistantResponse.split('\n');
      let jsonStart = -1;
      for (let i = 0; i < lines.length; i++) {
        const trimmed = lines[i].trim();
        // Look for opening brace (single object, not array)
        if (trimmed.startsWith('{')) {
          jsonStart = i;
          break;
        }
      }

      if (jsonStart === -1) {
        console.error('Could not find JSON object in response:', assistantResponse);
        return {
          statusCode: 500,
          body: JSON.stringify({
            success: false,
            error: 'Failed to parse action generation response'
          })
        };
      }

      // Find the end of the JSON object
      let jsonEnd = jsonStart;
      let braceCount = 0;
      for (let i = jsonStart; i < lines.length; i++) {
        const line = lines[i];
        for (const char of line) {
          if (char === '{') braceCount++;
          if (char === '}') braceCount--;
        }
        if (braceCount === 0 && line.includes('}')) {
          jsonEnd = i;
          break;
        }
      }

      const jsonContent = lines.slice(jsonStart, jsonEnd + 1).join('\n');
      let generatedAction = null;

      try {
        generatedAction = JSON.parse(jsonContent);
      } catch (parseError) {
        console.error('Failed to parse generated action:', parseError);
        console.error('JSON content:', jsonContent);
        return {
          statusCode: 500,
          body: JSON.stringify({
            success: false,
            error: 'Failed to parse AI response'
          })
        };
      }

      // Return draft action (NOT persisted to DB yet)
      // Frontend will store this in localStorage until it's "defined"
      const draftAction = {
        id: `draft-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        title: generatedAction.title,
        description: generatedAction.description,
        priority: generatedAction.priority || 'medium',
        taskType: generatedAction.taskType || 'scheduled',
        taskConfig: generatedAction.taskConfig || {},
        state: 'draft', // Special state for unpersisted actions
        agentId: agent.id
      };

      // Return conversational confirmation with draft action
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          success: true,
          response: `I've drafted this deliverable for you. Let me know if you want to refine it, or we can mark it as defined and move on to the next one.`,
          draftActions: [draftAction], // Array of one for consistent frontend handling
          hasDraftActions: true
        })
      };
    }

    // Check for GENERATE_ASSET at start of line followed by --- separator
    if (/^GENERATE_ASSET\s*\n---/m.test(trimmedResponse)) {
      // Find JSON object (single asset)
      const lines = assistantResponse.split('\n');
      let jsonStart = -1;
      for (let i = 0; i < lines.length; i++) {
        const trimmed = lines[i].trim();
        // Look for opening brace (single object, not array)
        if (trimmed.startsWith('{')) {
          jsonStart = i;
          break;
        }
      }

      if (jsonStart === -1) {
        console.error('Could not find JSON object in asset response:', assistantResponse);
        return {
          statusCode: 500,
          body: JSON.stringify({
            success: false,
            error: 'Failed to parse asset generation response'
          })
        };
      }

      // Find the end of the JSON object
      let jsonEnd = jsonStart;
      let braceCount = 0;
      for (let i = jsonStart; i < lines.length; i++) {
        const line = lines[i];
        for (const char of line) {
          if (char === '{') braceCount++;
          if (char === '}') braceCount--;
        }
        if (braceCount === 0 && line.includes('}')) {
          jsonEnd = i;
          break;
        }
      }

      const jsonContent = lines.slice(jsonStart, jsonEnd + 1).join('\n');
      let generatedAsset = null;

      try {
        generatedAsset = JSON.parse(jsonContent);
      } catch (parseError) {
        console.error('Failed to parse generated asset:', parseError);
        console.error('JSON content:', jsonContent);
        return {
          statusCode: 500,
          body: JSON.stringify({
            success: false,
            error: 'Failed to parse AI asset response'
          })
        };
      }

      // Create draft action with taskType: "manual" (formerly assets)
      const draftAction = {
        id: `draft-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        title: generatedAsset.title,
        description: generatedAsset.description,
        taskType: 'manual',
        type: generatedAsset.type || 'text',
        content: generatedAsset.content,
        priority: 'medium',
        state: 'draft',
        agentId: agent.id
      };

      // Return conversational confirmation with draft action
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          success: true,
          response: `I've created this deliverable for you. Let me know if you want to refine it, or we can mark it as defined.`,
          draftActions: [draftAction],
          hasDraftActions: true
        })
      };
    }

    // Check for STORE_MEASUREMENT signal
    if (/^STORE_MEASUREMENT\s*\n---/m.test(trimmedResponse)) {
      // Find JSON object
      const lines = assistantResponse.split('\n');
      let jsonStart = -1;
      for (let i = 0; i < lines.length; i++) {
        const trimmed = lines[i].trim();
        if (trimmed.startsWith('{')) {
          jsonStart = i;
          break;
        }
      }

      if (jsonStart === -1) {
        console.error('[agent-chat] Could not find JSON in STORE_MEASUREMENT response');
        return {
          statusCode: 500,
          body: JSON.stringify({
            success: false,
            error: 'Failed to parse measurement response'
          })
        };
      }

      // Find the end of the JSON object
      let jsonEnd = jsonStart;
      let braceCount = 0;
      for (let i = jsonStart; i < lines.length; i++) {
        const line = lines[i];
        for (const char of line) {
          if (char === '{') braceCount++;
          if (char === '}') braceCount--;
        }
        if (braceCount === 0 && line.includes('}')) {
          jsonEnd = i;
          break;
        }
      }

      const jsonContent = lines.slice(jsonStart, jsonEnd + 1).join('\n');
      let measurementData = null;

      try {
        measurementData = JSON.parse(jsonContent);
      } catch (parseError) {
        console.error('[agent-chat] Failed to parse measurement JSON:', parseError);
        console.error('[agent-chat] JSON content:', jsonContent);
        return {
          statusCode: 500,
          body: JSON.stringify({
            success: false,
            error: 'Failed to parse measurement data'
          })
        };
      }

      console.log(`[agent-chat] STORE_MEASUREMENT signal detected with ${measurementData.dimensions?.length || 0} dimensions`);

      // Return measurement signal for frontend to handle
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          success: true,
          response: `Got it! I've recorded your check-in. Keep up the great work!`,
          hasMeasurement: true,
          measurementData: {
            dimensions: measurementData.dimensions || [],
            notes: measurementData.notes || null
          }
        })
      };
    }

    // Regular conversational response
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        response: assistantResponse,
        actionsGenerated: false
      })
    };

  } catch (error) {
    console.error('[agent-chat] ERROR:', error);
    console.error('[agent-chat] Error type:', error.constructor.name);
    console.error('[agent-chat] Error message:', error.message);

    // Log specific error types for better debugging
    if (error.status) {
      console.error('[agent-chat] HTTP Status:', error.status);
    }
    if (error.code) {
      console.error('[agent-chat] Error code:', error.code);
    }

    // Provide more specific error messages
    let errorMessage = 'Internal server error';

    if (error.message?.includes('timeout') || error.code === 'ETIMEDOUT' || error.name === 'APIConnectionTimeoutError') {
      errorMessage = 'The AI is taking too long to respond. Try a simpler request or try again';
      console.error('[agent-chat] TIMEOUT - Consider reducing system prompt size or max_tokens');
    } else if (error.status === 429) {
      errorMessage = 'Rate limit exceeded - please wait a moment';
    } else if (error.status >= 500) {
      errorMessage = 'Service temporarily unavailable';
    }

    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: errorMessage
      })
    };
  }
};
