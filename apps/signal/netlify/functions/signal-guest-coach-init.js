require('dotenv').config();
const { getGuestEvalById } = require('./_services/db-signal-guest-evals.cjs');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const FINISH_INTERVIEW_TOOL = {
  name: 'finish_interview',
  description: 'Call this when you have gathered enough concrete, specific information to meaningfully improve the candidate\'s resume for each closeable gap. Do not call prematurely — you need specific outcomes, numbers, or scope for each gap addressed.',
  input_schema: {
    type: 'object',
    properties: {
      improvements: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            gapIndex: { type: 'number', description: 'Index of the gap from the closeable gaps list' },
            learnedInfo: { type: 'string', description: 'Concrete information learned from conversation for this gap' },
          },
          required: ['gapIndex', 'learnedInfo'],
        },
      },
    },
    required: ['improvements'],
  },
};

function buildDistilledJd(jdSummary) {
  return [
    `Role: ${jdSummary.roleTitle} (${jdSummary.level || 'unspecified level'})`,
    jdSummary.responsibilities?.length ? `Responsibilities:\n${jdSummary.responsibilities.map(r => `- ${r}`).join('\n')}` : '',
    jdSummary.mustHave?.length ? `Must have:\n${jdSummary.mustHave.map(r => `- ${r}`).join('\n')}` : '',
    jdSummary.niceToHave?.length ? `Nice to have:\n${jdSummary.niceToHave.map(r => `- ${r}`).join('\n')}` : '',
    jdSummary.cultureSignals?.length ? `Culture signals:\n${jdSummary.cultureSignals.map(r => `- ${r}`).join('\n')}` : '',
    jdSummary.compensation ? `Compensation: ${jdSummary.compensation}` : '',
    jdSummary.workModel ? `Work model: ${jdSummary.workModel}` : '',
  ].filter(Boolean).join('\n\n');
}

function buildCoachPrompt(resumeText, distilledJd, closeableGaps) {
  const gapsText = closeableGaps.map((g, i) =>
    `[${i}] ${g.dimension} | severity: ${g.severity}\n${g.gap}${g.framing ? `\nFraming: ${g.framing}` : ''}`
  ).join('\n\n');

  return `You are a resume coach. You've already scored this person's resume against a job.
Your job: through conversation, unearth the real experience they have that their resume doesn't show.

Rules:
- Ask ONE question at a time. No lists, no preambles.
- Start with the highest-severity closeable gap.
- When someone gives a vague answer, push for specifics: scope, numbers, outcomes, timeline.
- Be direct. Human. Not corporate.
- When you have enough concrete material to meaningfully improve the resume (2-4 solid points per closeable gap), call finish_interview().
- If after 3 exchanges a gap is going nowhere, move on.
- Don't explain what you're doing. Just ask.

== THEIR RESUME ==
${resumeText}

== JOB REQUIREMENTS ==
${distilledJd}

== CLOSEABLE GAPS (address these, highest severity first) ==
${gapsText}`;
}

const OPENER = "I've looked at your resume against the role. I'm going to ask you a few targeted questions — answer as specifically as you can. Let's start.";

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ success: false, error: 'Method not allowed' }) };
  }

  try {
    const { userId, gevalId, guestId } = JSON.parse(event.body || '{}');
    const resolvedGuestId = guestId || userId;

    if (!resolvedGuestId || !gevalId) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ success: false, error: 'guestId and gevalId required' }) };
    }

    const geval = await getGuestEvalById(gevalId);
    if (!geval) {
      return { statusCode: 404, headers: CORS, body: JSON.stringify({ success: false, error: 'Eval not found' }) };
    }
    if (geval._guestId !== resolvedGuestId) {
      return { statusCode: 403, headers: CORS, body: JSON.stringify({ success: false, error: 'Forbidden' }) };
    }

    const { resumeText, jdSummary, gaps } = geval;
    if (!resumeText || !jdSummary) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ success: false, error: 'Eval missing required data' }) };
    }

    const distilledJd = buildDistilledJd(jdSummary);
    const closeableGaps = (gaps || [])
      .filter(g => g.closeable === true)
      .sort((a, b) => {
        const order = { high: 0, moderate: 1, low: 2 };
        return (order[a.severity] ?? 99) - (order[b.severity] ?? 99);
      });

    const coachPrompt = buildCoachPrompt(resumeText, distilledJd, closeableGaps);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        opener: OPENER,
        systemMessages: [
          { role: 'user', content: coachPrompt },
          { role: 'assistant', content: OPENER },
        ],
        tools: [FINISH_INTERVIEW_TOOL],
      }),
    };

  } catch (error) {
    console.error('[signal-guest-coach-init] ERROR:', error);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ success: false, error: 'Internal server error' }) };
  }
};
