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

    // Recently completed actions (last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentlyCompleted = allActions.filter(a => {
      if (a.state !== 'completed') return false;
      const completedAt = a.completedAt?.toDate?.() || (a.completedAt ? new Date(a.completedAt) : null);
      return completedAt && completedAt > sevenDaysAgo;
    });

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

    const recentlyCompletedContext = recentlyCompleted.length > 0
      ? recentlyCompleted.map(a => {
          const agentName = agents.find(ag => ag.id === a.agentId)?.name || 'Unknown';
          return `- ${a.title} (${agentName}) — completed`;
        }).join('\n')
      : null;

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

    // Build review mode prompt
    let reviewModePrompt = '';
    const reviewActions = openActions.filter(a => a.taskType === 'review' && a.state === 'open');
    let hasReviewWork = false;

    if (pendingDrafts.length > 0 || reviewActions.length > 0) {
      // Build a pending drafts lookup
      const pendingDraftMap = {};
      pendingDrafts.forEach(d => { pendingDraftMap[d.id] = d; });

      // Group drafts by review action using taskConfig.draftIds
      const reviewTasks = [];
      const completableActions = [];
      const assignedDraftIds = new Set();

      for (const action of reviewActions) {
        const actionDraftIds = action.taskConfig?.draftIds || [];
        // Only include drafts that are still pending
        const taskDrafts = actionDraftIds
          .filter(id => pendingDraftMap[id])
          .map(id => {
            assignedDraftIds.add(id);
            return pendingDraftMap[id];
          });

        if (taskDrafts.length > 0) {
          reviewTasks.push({
            actionId: action.id,
            title: action.title,
            description: action.description,
            drafts: taskDrafts
          });
        } else if (actionDraftIds.length > 0) {
          // All drafts already reviewed — needs completion
          completableActions.push({
            actionId: action.id,
            title: action.title,
            description: action.description,
            totalDrafts: actionDraftIds.length
          });
        }
      }

      // Any pending drafts not linked to an action (legacy data)
      const unassignedDrafts = pendingDrafts.filter(d => !assignedDraftIds.has(d.id));
      if (unassignedDrafts.length > 0) {
        reviewTasks.push({
          actionId: null,
          title: `Review ${unassignedDrafts.length} unassigned recommendation${unassignedDrafts.length > 1 ? 's' : ''}`,
          description: null,
          drafts: unassignedDrafts
        });
      }

      hasReviewWork = reviewTasks.length > 0 || completableActions.length > 0;

      if (hasReviewWork) {
        // Build completable actions section
        let completableSection = '';
        if (completableActions.length > 0) {
          const completableList = completableActions.map(a =>
            `- ${a.actionId}: "${a.title}"${a.description ? ` (${a.description})` : ''} — all ${a.totalDrafts} items already reviewed`
          ).join('\n');
          completableSection = `COMPLETED TASKS TO CLOSE:
These review tasks have all items reviewed but weren't marked complete.
Call complete_review_action for each at the start of the conversation:
${completableList}

`;
        }

        // Build the task list for the prompt
        let taskSection = '';
        if (reviewTasks.length > 0) {
          const taskDescriptions = reviewTasks.map((task, i) => {
            const draftSummary = JSON.stringify(
              task.drafts.map(d => ({ id: d.id, type: d.type, agentId: d.agentId, data: d.data })),
              null, 2
            );
            return `TASK ${i + 1}${task.actionId ? ` (${task.actionId})` : ''}: ${task.title}${task.description ? `\n${task.description}` : ''}
Items (${task.drafts.length}):
${draftSummary}`;
          }).join('\n\n');

          taskSection = `You have ${reviewTasks.length} review task${reviewTasks.length > 1 ? 's' : ''} with ${pendingDrafts.length} total item${pendingDrafts.length > 1 ? 's' : ''} awaiting the user's review.

When the user is ready to review (or if you sense it's a good time to mention them), enter review mode.

${taskDescriptions}

`;
        }

        reviewModePrompt = `== REVIEW TASKS ==

${completableSection}${taskSection}WORKING THROUGH TASKS:
- Work through ONE task at a time. Start with the first.
- Present items one-by-one within that task.
- When all items in a task are reviewed, call complete_review_action with that task's action ID.
- If they want to stop mid-task or between tasks, that's fine — remaining tasks stay open for next time.

PRESENTATION RULES:
- Present items ONE AT A TIME. Never list them all at once.
- For each item, share: what the company does, why it was recommended, the agent's fit score, and any notable details.
- ALWAYS include a clickable link to the company's website using this exact HTML format:
  <a href="https://[domain]" target="_blank"><strong>[Company Name] →</strong></a>
  This opens in a new tab so the user can glance at it and close it.
- After presenting, ask the user what they think. Keep it conversational — "What do you think?" or "Does this one resonate?"
- Wait for the user's response before calling submit_draft_review. NEVER call it preemptively.

RECORDING FEEDBACK:
After the user shares their thoughts, use submit_draft_review:
- score (0-10): Based on the user's expressed interest level
  8-10: User is excited, wants to learn more
  5-7: Interested but has reservations
  1-4: Not interested or significant concerns
  0: Explicitly rejected
- feedback: 1-2 sentence summary capturing what the user actually said (NEVER empty or generic)
- user_tags: Optional tags that emerged from conversation (e.g., "too-large", "great-mission", "remote-friendly")

AFTER COMPLETING A REVIEW TASK:
- Acknowledge completion naturally: "That's all [N] companies from that batch reviewed!"
- If there are more review tasks: "There's another batch of [M] companies whenever you're ready. Want to keep going, or would you like to do something else?"
- If no more review tasks: "All caught up on reviews! Want to look at what else is on your plate?"
- Always respect "I'm done" — never pressure to continue.

`;
      }
    }

    // Build system prompt
    const systemPrompt = `You are an Executive Assistant with visibility across all projects and work.

YOUR STANCE (critical):
- Editorial, not encyclopedic: have a point of view about what matters most right now. Use priority, deadlines, and recent momentum to decide. Don't present a balanced overview of everything — pick ONE thread and pull on it.
- Calm, present, reflective
- Brief responses (2-3 sentences). Never give a project-by-project rundown unless asked.
- Never cheerleading or pressuring
- Lead with momentum: acknowledge what's been accomplished before surfacing what's next
- When you see momentum on a project, look for what's still stuck *within that same project*. The most useful tension is internal ("you've been building career search infrastructure, but the publishing piece is still parked") not cross-project ("career vs. maintenance").
- When surfacing tension, frame as curiosity not criticism: "is that intentional?" not "you're behind"
- After surfacing a tension, offer a concrete next step. "Want to pick one of those draft ideas and sketch it out?" is better than "what feels most alive?"
- When they seem overwhelmed, help narrow to ONE thing

CURRENT TIME: ${timeOfDay}, ${dayOfWeek}

WHAT YOU SEE:

Projects:
${projectsContext}

Active Agents (tactical workers that can do autonomous work):
${agentsContext}

Open Actions (${openActions.length} total):
${Object.keys(actionsByAgent).length > 0 ? JSON.stringify(actionsByAgent, null, 2) : 'None'}
${recentlyCompletedContext ? `
Recently Completed:
${recentlyCompletedContext}
` : ''}
Recent Work (what they've been doing):
${workLogsContext}

${reviewModePrompt}YOUR CAPABILITIES:
- Identify the ONE project or thread that has the most energy, urgency, or momentum right now — and focus there
- Within that thread, notice what's moving and what's stuck. Surface the internal tension.
- Offer concrete next steps, not open-ended questions. Help them start the hard thing.
- Ask about energy level to calibrate — but still have a suggestion ready
- Create and update projects when they discuss new initiatives or want to reorganize

ACTION & PROJECT MANAGEMENT TOOLS:
You have access to these tools:

1. create_action(title, description?, priority?, taskType?, taskConfig?) - Create a new action
   - Use when user asks to add, create, or set up a new action/task
   - Action is created in 'open' state, ready for scheduling
   - You CAN and SHOULD create actions directly — do not tell the user they need to create actions themselves
   - You can include taskConfig with instructions and expectedOutput for scheduled actions

2. create_project(name, description?, success_criteria?, timeline?, status?) - Create a new project
   - Use when user discusses a new initiative, area of focus, or project
   - description: Brief description of the project
   - success_criteria: Array of specific outcomes that define success
   - timeline: Target date (YYYY-MM-DD) or "ongoing" for indefinite projects
   - Status defaults to "open"
   - After creating, mention the project naturally and include a link: [Project Name](/do/projects)

3. update_project(project_id, updates) - Update an existing project
   - Can update: name, description, success_criteria, timeline, status
   - Status values: open, completed, archived, deleted
   - Use when user wants to refine a project's focus or change its status

When to create actions:
- User explicitly asks to create/add an action or task
- User describes specific work that should be tracked
- A conversation reveals a concrete next step worth capturing

When to create projects:
- User explicitly asks to create/add a project
- User describes a new area of work that deserves its own container
- A natural conversation reveals a new initiative worth tracking

When NOT to create projects:
- User is just exploring or thinking out loud
- It's a small task, not a project-level initiative
- You're unsure - ask first

CONVERSATIONAL APPROACH:
- Opening messages: 2-3 sentences max. One acknowledgment of recent momentum, one tension or nudge, one concrete offer. Match the user's tone.
- DON'T open with a project-by-project status report. DON'T list everything that's open. Pick the one thread that matters most and go there.
- End with a concrete offer to help, not an open-ended question. "Want to pick one of those drafts and rough it out?" beats "What feels most alive?"
- When overwhelmed, help narrow to ONE thing
- Respect "later" - don't pressure immediate action
- Trust them to know what they need - your job is to help them see clearly and take the next step
- When you create or update a project, mention it naturally in conversation with a link`;

    // Define tools
    const tools = [
      // Draft review tools (only when pending drafts exist)
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
        }
      ] : []),
      // Complete review action tool (available when there's any review work)
      ...(hasReviewWork ? [
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
      // Action management tools
      {
        name: "create_action",
        description: "Create a new action/task. Use when the user asks to add, create, or set up a new action. The action will be created in 'open' state.",
        input_schema: {
          type: "object",
          properties: {
            title: { type: "string", description: "2-5 word title for the action" },
            description: { type: "string", description: "Brief overview of what this action involves" },
            priority: { type: "string", enum: ["low", "medium", "high"], description: "Priority level (default: medium)" },
            taskType: { type: "string", enum: ["scheduled", "manual", "measurement", "interactive"], description: "Type of action (default: scheduled)" },
            taskConfig: {
              type: "object",
              description: "Task configuration",
              properties: {
                instructions: { type: "string", description: "Detailed execution instructions" },
                expectedOutput: { type: "string", description: "What this action will produce" }
              }
            },
            agentId: { type: "string", description: "Agent ID to assign the action to (optional)" }
          },
          required: ["title"]
        }
      },
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
