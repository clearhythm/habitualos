require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');
const { generateWorkLogId } = require('./_utils/data-utils.cjs');
const { createWorkLog, getWorkLogCount, getWorkLogsByUserId } = require('./_services/db-work-logs.cjs');
const { getProjectsByUserId } = require('./_services/db-projects.cjs');

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

/**
 * Generate personalized EA insight using Claude AI
 * @param {string} pattern - The detected pattern type
 * @param {number} workLogCount - Total work log count before this log
 * @param {Object} currentLog - Current work log data
 * @param {Array} recentLogs - Recent work log history
 * @param {Object} project - Project details if linked
 * @returns {Promise<{short: string, long: string}>} Generated insight
 */
async function generateEAInsight(pattern, workLogCount, currentLog, recentLogs, project) {
  const now = new Date();
  const timeOfDay = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

  // Build context about the work log
  let contextDetails = [];

  contextDetails.push(`Work title: "${currentLog.title}"`);

  if (project) {
    contextDetails.push(`Project: ${project.name}`);
  }

  if (currentLog.duration) {
    contextDetails.push(`Duration: ${currentLog.duration} minutes`);
  }

  if (currentLog.reflection) {
    contextDetails.push(`User's reflection: "${currentLog.reflection}"`);
  }

  contextDetails.push(`Total work sessions so far: ${workLogCount}`);
  contextDetails.push(`Time: ${timeOfDay}`);

  // Add pattern-specific context
  let patternContext = '';
  switch (pattern) {
    case 'first_log':
      patternContext = 'This is their very first work log. They started tracking their work.';
      break;
    case 'return_after_gap':
      const lastLog = new Date(recentLogs[0].timestamp || recentLogs[0]._createdAt);
      const daysSince = Math.floor((now - lastLog) / (1000 * 60 * 60 * 24));
      patternContext = `They returned after a ${daysSince}-day gap. They came back despite the break.`;
      break;
    case 'milestone_5':
      patternContext = 'This is their 5th work session. A pattern is forming.';
      break;
    case 'milestone_10':
      patternContext = '10 work sessions completed. Consistent effort showing.';
      break;
    case 'wrote_reflection':
      patternContext = 'They wrote a substantial reflection, paying attention to their experience.';
      break;
    case 'long_session':
      patternContext = `${currentLog.duration}+ minutes. They stayed focused for a significant block.`;
      break;
    case 'consistent_streak':
      patternContext = 'They\'ve logged 4+ sessions in the last week. Consistency is appearing.';
      break;
  }

  const prompt = `You are an Executive Assistant (EA) who notices patterns in someone's work. You appear occasionally when you see something meaningful in their work log. Your voice is:
- Calm, observational, present-tense
- Focused on what you see in the data/behavior, not assumptions
- Specific to their actual work, not generic
- Brief, understated wisdom - you notice patterns others miss
- No exclamation marks, no cheerleading, no "great job!"
- You speak like someone who's been watching quietly and sees something worth noting

Context about this work session:
${contextDetails.join('\n')}

Pattern detected: ${patternContext}

Generate two pieces of insight:

1. SHORT (1-2 sentences): A brief, direct observation. This will be shown immediately.

2. LONG (one paragraph, 3-5 sentences): A deeper reflection on what you're noticing. This expands on the short message.

Examples of the style (for reference only, don't copy):

SHORT: "I see you starting to track."
LONG: "Most people think about being more organized but never actually write it down. You crossed that gap. Tracking what you do changes how you see your time. I'll be watching what patterns emerge."

SHORT: "You came back after a break. That's the practice."
LONG: "I see the gap in your timeline. A few days, maybe more. And here you are anyway. Most people let a break become permanent. You let it be just a break. That distinction matters."

Now generate insight for THIS specific work session. Make it personal to what they actually did, their reflection, the time of day, the project - reference the specifics, not generic patterns.

Return as JSON: {"short": "...", "long": "..."}`;

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: prompt
      }]
    });

    const responseText = message.content[0].text;

    // Strip markdown code fences if present
    let jsonText = responseText.trim();
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```(?:json)?\n?/, '');
      jsonText = jsonText.replace(/\n?```$/, '');
    }

    return JSON.parse(jsonText.trim());
  } catch (error) {
    console.error('Error generating EA insight:', error);
    // Fallback response
    return {
      short: "I see you tracking your work.",
      long: "Recording what you do is the first step to understanding how you spend your time. Keep going."
    };
  }
}

/**
 * Detect meaningful patterns and decide if EA should speak
 */
function analyzeAndRespond(workLogCount, recentLogs, currentLog) {
  // Testing bypass
  const alwaysAppear = process.env.EA_ALWAYS_APPEAR === 'true';

  // First work log - always meaningful
  if (workLogCount === 0) {
    return {
      shouldAppear: true,
      pattern: 'first_log'
    };
  }

  const now = new Date();

  // Check for gap (last log was 3+ days ago)
  if (recentLogs.length >= 1) {
    const lastLog = new Date(recentLogs[0].timestamp || recentLogs[0]._createdAt);
    const daysSinceLastLog = (now - lastLog) / (1000 * 60 * 60 * 24);

    if (daysSinceLastLog >= 3) {
      return {
        shouldAppear: true,
        pattern: 'return_after_gap'
      };
    }
  }

  // Milestone: 5th log
  if (workLogCount === 4) {
    return {
      shouldAppear: true,
      pattern: 'milestone_5'
    };
  }

  // Milestone: 10th log
  if (workLogCount === 9) {
    return {
      shouldAppear: true,
      pattern: 'milestone_10'
    };
  }

  // User wrote a reflection (meaningful engagement)
  if (currentLog.reflection && currentLog.reflection.length > 20) {
    return {
      shouldAppear: true,
      pattern: 'wrote_reflection'
    };
  }

  // Longer session (45+ minutes)
  if (currentLog.duration && currentLog.duration >= 45) {
    return {
      shouldAppear: true,
      pattern: 'long_session'
    };
  }

  // Check for consistency (logged 4+ times in last 7 days)
  if (recentLogs.length >= 4) {
    const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
    const logsLastWeek = recentLogs.filter(l => {
      const logDate = new Date(l.timestamp || l._createdAt);
      return logDate >= sevenDaysAgo;
    }).length;

    if (logsLastWeek >= 4 && workLogCount >= 10) {
      return {
        shouldAppear: true,
        pattern: 'consistent_streak'
      };
    }
  }

  // No meaningful pattern detected
  if (alwaysAppear) {
    return {
      shouldAppear: true,
      pattern: 'wrote_reflection'
    };
  }

  return {
    shouldAppear: false,
    pattern: null
  };
}

/**
 * POST /api/work-log-submit
 * Submit a new work log entry
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
    const { userId, title, projectId, duration, reflection } = JSON.parse(event.body);

    // Validate userId
    if (!userId || typeof userId !== 'string' || !userId.startsWith('u-')) {
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, error: 'Valid userId is required' })
      };
    }

    // Validate required fields
    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          error: 'Missing required field: title is required'
        })
      };
    }

    // Get current work log count and recent logs
    let recentLogs = [];
    let workLogCount = 0;

    try {
      recentLogs = await getWorkLogsByUserId(userId);
      workLogCount = recentLogs.length;
    } catch (error) {
      console.log('No existing work logs found:', error.message);
      recentLogs = [];
      workLogCount = 0;
    }

    // Get project details if provided
    let project = null;
    if (projectId) {
      try {
        const projects = await getProjectsByUserId(userId);
        project = projects.find(p => p.id === projectId);
      } catch (error) {
        console.log('Error fetching project:', error.message);
      }
    }

    // Analyze patterns and decide if EA should speak
    const analysis = analyzeAndRespond(workLogCount, recentLogs, {
      title,
      duration,
      reflection
    });

    // Generate EA insight if a pattern was detected
    let insight = null;
    if (analysis.shouldAppear) {
      insight = await generateEAInsight(
        analysis.pattern,
        workLogCount,
        { title, duration, reflection },
        recentLogs,
        project
      );
    }

    // Build work log data
    const workLogData = {
      _userId: userId,
      title: title.trim(),
      _createdAt: new Date().toISOString()
    };

    // Add optional fields if provided
    if (projectId && typeof projectId === 'string' && projectId.startsWith('project-')) {
      workLogData.projectId = projectId;
    }

    if (duration && typeof duration === 'number' && duration > 0) {
      workLogData.duration = duration;
    }

    if (reflection && typeof reflection === 'string' && reflection.trim().length > 0) {
      workLogData.reflection = reflection.trim();
    }

    // Store EA insight if generated
    if (insight) {
      workLogData.ea_message = insight.short;
      workLogData.ea_expanded = insight.long;
    }

    // Create work log in Firestore
    const workLogId = generateWorkLogId();
    const result = await createWorkLog(workLogId, workLogData);

    // Get updated count for response
    const totalCount = workLogCount + 1;

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        workLog: {
          id: result.id,
          ...workLogData
        },
        totalCount,
        ea_appeared: analysis.shouldAppear,
        ea_message: insight ? insight.short : null,
        ea_expanded: insight ? insight.long : null,
        pattern_detected: analysis.pattern
      })
    };

  } catch (error) {
    console.error('Error in work-log-submit:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message || 'Internal server error'
      })
    };
  }
};
