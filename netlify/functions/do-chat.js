require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');
const { getProjectsByUserId, createProject, updateProject, getProject } = require('./_services/db-projects.cjs');
const { getWorkLogsByUserId } = require('./_services/db-work-logs.cjs');
const { getAgentsByUserId } = require('./_services/db-agents.cjs');
const { getActionsByUserId } = require('./_services/db-actions.cjs');
const { generateProjectId } = require('./_utils/data-utils.cjs');

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

/**
 * Handle tool calls from Claude
 */
async function handleToolCall(toolBlock, userId) {
  const { name, input } = toolBlock;

  if (name === 'create_project') {
    const { name: projectName, goal, status } = input;

    if (!projectName) {
      return { error: 'Project name is required' };
    }

    const projectId = generateProjectId();
    await createProject(projectId, {
      _userId: userId,
      name: projectName,
      goal: goal || '',
      status: status || 'active'
    });

    return {
      success: true,
      project: {
        id: projectId,
        name: projectName,
        goal: goal || '',
        status: status || 'active'
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
    if (updates.goal !== undefined) safeUpdates.goal = updates.goal;
    if (updates.status && ['active', 'paused', 'completed'].includes(updates.status)) {
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
 * POST /api/do-chat
 * Executive Assistant chat endpoint - helps user focus and prioritize
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
    const { userId, message, chatHistory = [], timezone = 'America/Los_Angeles' } = JSON.parse(event.body);

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

    if (!message || !message.trim()) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          error: 'Message is required'
        })
      };
    }

    // Fetch all context for the EA
    const [projects, agents, allActions, workLogs] = await Promise.all([
      getProjectsByUserId(userId),
      getAgentsByUserId(userId),
      getActionsByUserId(userId),
      getWorkLogsByUserId(userId)
    ]);

    // Filter to open actions only
    const openActions = allActions.filter(a =>
      ['defined', 'scheduled', 'in_progress'].includes(a.state)
    );

    // Get recent work logs (last 10)
    const recentWorkLogs = workLogs.slice(0, 10);

    // Get active agents (excluding any "executive" type)
    const activeAgents = agents.filter(a => a.status === 'active' && a.type !== 'executive');

    // Build context strings
    const projectsContext = projects.length > 0
      ? projects.map(p => `- ${p.name} (${p.id}): ${p.goal || 'No goal set'} [${p.status || 'active'}]`).join('\n')
      : 'No projects yet';

    const agentsContext = activeAgents.length > 0
      ? activeAgents.map(a => `- ${a.name}: ${a.instructions?.goal || 'No goal'}`).join('\n')
      : 'No active agents';

    // Group actions by agent
    const actionsByAgent = {};
    openActions.forEach(a => {
      const agentName = agents.find(ag => ag.id === a.agentId)?.name || 'Unassigned';
      if (!actionsByAgent[agentName]) actionsByAgent[agentName] = [];
      actionsByAgent[agentName].push({
        id: a.id,
        title: a.title,
        priority: a.priority || 'normal',
        state: a.state
      });
    });

    const workLogsContext = recentWorkLogs.length > 0
      ? recentWorkLogs.map(w => {
          const projectName = w.projectId
            ? projects.find(p => p.id === w.projectId)?.name || 'Unknown project'
            : null;
          return `- ${w.title}${projectName ? ` (${projectName})` : ''}`;
        }).join('\n')
      : 'No recent work logged';

    // Get current time in user's timezone
    const now = new Date();
    const timeOfDay = now.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: timezone
    });

    const dayOfWeek = now.toLocaleDateString('en-US', {
      weekday: 'long',
      timeZone: timezone
    });

    // Build system prompt
    const systemPrompt = `You are an Executive Assistant with visibility across all projects and work.

YOUR STANCE (critical):
- Observational, not directive: "I notice...", "I see...", "What I'm observing..."
- Calm, present, reflective
- Brief responses (2-3 sentences unless more is needed)
- Never cheerleading or pressuring
- Help the user notice patterns they might miss
- When they seem overwhelmed, help narrow to ONE thing

CURRENT TIME: ${timeOfDay}, ${dayOfWeek}

WHAT YOU SEE:

Projects:
${projectsContext}

Active Agents (tactical workers that can do autonomous work):
${agentsContext}

Open Actions (${openActions.length} total):
${Object.keys(actionsByAgent).length > 0 ? JSON.stringify(actionsByAgent, null, 2) : 'None'}

Recent Work (what they've been doing):
${workLogsContext}

YOUR CAPABILITIES:
- Notice patterns across projects (overlap, imbalance, neglect)
- Help prioritize when asked - but through questions, not mandates
- Surface what seems most alive or urgent
- Ask about energy level to calibrate suggestions
- Help them decide what to work on next
- Create and update projects when they discuss new initiatives or want to reorganize

PROJECT MANAGEMENT TOOLS:
You have access to these tools:

1. create_project(name, goal?, status?) - Create a new project
   - Use when user discusses a new initiative, area of focus, or project
   - Goal should capture what success looks like
   - Status defaults to "active"
   - After creating, mention the project naturally and include a link: [Project Name](/do/projects)

2. update_project(project_id, updates) - Update an existing project
   - Can update: name, goal, status (active/paused/completed)
   - Use when user wants to refine a project's focus or change its status

When to create projects:
- User explicitly asks to create/add a project
- User describes a new area of work that deserves its own container
- A natural conversation reveals a new initiative worth tracking

When NOT to create projects:
- User is just exploring or thinking out loud
- It's a small task, not a project-level initiative
- You're unsure - ask first

CONVERSATIONAL APPROACH:
- If this is the start of a conversation, open with a brief observation about what you see, then ask an open question
- Good openers: "What feels most alive right now?", "Where's your energy today?", "I notice [pattern] - how does that land?"
- When overwhelmed, help narrow to ONE thing
- Respect "later" - don't pressure immediate action
- Trust them to know what they need - your job is to help them see clearly
- When you create or update a project, mention it naturally in conversation with a link`;

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

    // Define tools for project management
    const tools = [
      {
        name: "create_project",
        description: "Create a new project to track an initiative or area of work. Use when the user discusses a new project-level initiative.",
        input_schema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Project name (concise, 2-5 words)"
            },
            goal: {
              type: "string",
              description: "What success looks like for this project"
            },
            status: {
              type: "string",
              enum: ["active", "paused", "completed"],
              description: "Project status (default: active)"
            }
          },
          required: ["name"]
        }
      },
      {
        name: "update_project",
        description: "Update an existing project's details or status.",
        input_schema: {
          type: "object",
          properties: {
            project_id: {
              type: "string",
              description: "The project ID (format: project-{random})"
            },
            updates: {
              type: "object",
              description: "Fields to update",
              properties: {
                name: { type: "string", description: "New project name" },
                goal: { type: "string", description: "Updated goal" },
                status: {
                  type: "string",
                  enum: ["active", "paused", "completed"],
                  description: "New status"
                }
              }
            }
          },
          required: ["project_id", "updates"]
        }
      }
    ];

    // Call Claude API with tools
    let apiResponse = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 1000,
      system: systemPrompt,
      messages: conversationHistory,
      tools: tools
    });

    // Handle tool calls if present
    let assistantResponse = '';
    const toolUseBlocks = apiResponse.content.filter(block => block.type === 'tool_use');

    if (toolUseBlocks.length > 0) {
      // Execute tool calls and collect results
      const toolResults = [];
      for (const toolBlock of toolUseBlocks) {
        const toolResult = await handleToolCall(toolBlock, userId);
        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolBlock.id,
          content: JSON.stringify(toolResult)
        });
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
      const followUpResponse = await anthropic.messages.create({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 1000,
        system: systemPrompt,
        messages: conversationHistory,
        tools: tools
      });

      // Extract text from follow-up response
      const followUpText = followUpResponse.content.find(b => b.type === 'text');
      assistantResponse = followUpText ? followUpText.text : '';
    } else {
      // No tool calls - extract text directly
      const textBlock = apiResponse.content.find(block => block.type === 'text');
      assistantResponse = textBlock ? textBlock.text : '';
    }

    // Return response
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        response: assistantResponse,
        usage: {
          inputTokens: apiResponse.usage?.input_tokens,
          outputTokens: apiResponse.usage?.output_tokens
        }
      })
    };

  } catch (error) {
    console.error('Error in do-chat:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message || 'Internal server error'
      })
    };
  }
};
