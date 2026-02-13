require('dotenv').config();
const { getProjectsByUserId } = require('./_services/db-projects.cjs');
const { getWorkLogsByUserId } = require('./_services/db-work-logs.cjs');
const { getAgentsByUserId } = require('./_services/db-agents.cjs');
const { getActionsByUserId } = require('./_services/db-actions.cjs');
const { getDraftsByUser } = require('./_services/db-agent-drafts.cjs');

/**
 * POST /api/fox-ea-chat-init
 *
 * Returns system prompt and tools configuration for Fox-EA streaming chat.
 * Called by edge function to initialize a streaming session.
 */
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ success: false, error: 'Method not allowed' })
    };
  }

  try {
    const { userId, timezone = 'America/Los_Angeles' } = JSON.parse(event.body);

    // Validate inputs
    if (!userId || typeof userId !== 'string' || !userId.startsWith('u-')) {
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, error: 'Valid userId is required' })
      };
    }

    // Fetch all context for the EA
    const [projects, agents, allActions, workLogs, pendingDrafts] = await Promise.all([
      getProjectsByUserId(userId),
      getAgentsByUserId(userId),
      getActionsByUserId(userId),
      getWorkLogsByUserId(userId),
      getDraftsByUser(userId, { status: 'pending' })
    ]);

    // Filter to open actions only
    const openActions = allActions.filter(a =>
      ['open', 'defined', 'scheduled', 'in_progress'].includes(a.state)
    );

    // Get recent work logs (last 10)
    const recentWorkLogs = workLogs.slice(0, 10);

    // Get active agents (excluding any "executive" type)
    const activeAgents = agents.filter(a => a.status === 'active' && a.type !== 'executive');

    // Build context strings
    const projectsContext = projects.length > 0
      ? projects.map(p => `- ${p.name} (${p.id}): ${p.description || 'No description'} [${p.status || 'open'}]`).join('\n')
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

${pendingDrafts.length > 0 ? `PENDING RESEARCH REVIEWS (${pendingDrafts.length} items):
Your research agents have found items awaiting the user's review.
When the user wants to review them, present each one conversationally — share the key details, why it was recommended, and the agent's fit score. Then ask the user what they think.

After the user shares their thoughts on each item, use submit_draft_review to record their feedback:
- score (0-10): Based on the user's expressed interest (8-10 excited, 5-7 interested with reservations, 1-4 not interested, 0 rejected)
- feedback: 1-2 sentence summary of what the user said (NEVER empty or generic)
- user_tags: Optional tags from conversation

Go through items one at a time. Wait for user response before recording feedback.
After all items are reviewed, use complete_review_action with the review action ID to mark it done.

Pending items:
${JSON.stringify(pendingDrafts.map(d => ({ id: d.id, type: d.type, agentId: d.agentId, data: d.data })), null, 2)}
` : ''}YOUR CAPABILITIES:
- Notice patterns across projects (overlap, imbalance, neglect)
- Help prioritize when asked - but through questions, not mandates
- Surface what seems most alive or urgent
- Ask about energy level to calibrate suggestions
- Help them decide what to work on next
- Create and update projects when they discuss new initiatives or want to reorganize

PROJECT MANAGEMENT TOOLS:
You have access to these tools:

1. create_project(name, description?, success_criteria?, timeline?, status?) - Create a new project
   - Use when user discusses a new initiative, area of focus, or project
   - description: Brief description of the project
   - success_criteria: Array of specific outcomes that define success
   - timeline: Target date (YYYY-MM-DD) or "ongoing" for indefinite projects
   - Status defaults to "open"
   - After creating, mention the project naturally and include a link: [Project Name](/do/projects)

2. update_project(project_id, updates) - Update an existing project
   - Can update: name, description, success_criteria, timeline, status
   - Status values: open, completed, archived, deleted
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

    // Define tools
    const tools = [
      // Review tools (only when pending drafts exist)
      ...(pendingDrafts.length > 0 ? [
        {
          name: "get_pending_drafts",
          description: "Retrieve pending research drafts awaiting user review. Returns items from all research agents.",
          input_schema: {
            type: "object",
            properties: {
              type: {
                type: "string",
                description: "Filter by draft type (e.g., 'company', 'person', 'article', 'job')"
              }
            },
            required: []
          }
        },
        {
          name: "submit_draft_review",
          description: "Record the user's review of a research draft. Call AFTER the user has shared their thoughts — never before.",
          input_schema: {
            type: "object",
            properties: {
              draftId: {
                type: "string",
                description: "The draft ID being reviewed (format: draft-...)"
              },
              score: {
                type: "number",
                description: "User's interest score 0-10. 8-10: excited, 5-7: interested with reservations, 1-4: not interested, 0: rejected"
              },
              feedback: {
                type: "string",
                description: "1-2 sentence summary of the user's actual opinion in their own words"
              },
              user_tags: {
                type: "array",
                items: { type: "string" },
                description: "Optional tags from conversation (e.g., 'too-large', 'great-mission', 'remote-friendly')"
              }
            },
            required: ["draftId", "score", "feedback"]
          }
        },
        {
          name: "complete_review_action",
          description: "Mark a review action as completed after all drafts have been reviewed.",
          input_schema: {
            type: "object",
            properties: {
              actionId: {
                type: "string",
                description: "The review action ID to complete (format: action-...)"
              }
            },
            required: ["actionId"]
          }
        }
      ] : []),
      // Project management tools
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
            description: {
              type: "string",
              description: "Brief description of what this project is about"
            },
            success_criteria: {
              type: "array",
              items: { type: "string" },
              description: "List of specific outcomes that define success"
            },
            timeline: {
              type: "string",
              description: "Target date (YYYY-MM-DD) or 'ongoing' for indefinite projects"
            },
            status: {
              type: "string",
              enum: ["open", "completed", "archived", "deleted"],
              description: "Project status (default: open)"
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
                description: { type: "string", description: "Updated description" },
                success_criteria: { type: "array", items: { type: "string" }, description: "Updated success criteria" },
                timeline: { type: "string", description: "Updated timeline (YYYY-MM-DD or 'ongoing')" },
                status: {
                  type: "string",
                  enum: ["open", "completed", "archived", "deleted"],
                  description: "New status"
                }
              }
            }
          },
          required: ["project_id", "updates"]
        }
      }
    ];

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        systemMessages: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
        tools
      })
    };

  } catch (error) {
    console.error('[fox-ea-chat-init] ERROR:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: 'Internal server error' })
    };
  }
};
