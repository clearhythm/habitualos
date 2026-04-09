require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');
const { getGuestEvalById, updateGuestEval } = require('./_services/db-signal-guest-evals.cjs');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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

const REWRITE_PROMPT = (resumeText, distilledJd, improvements, harder = false) => `You are improving a candidate's resume for a specific job based on what they told you.${harder ? '\nIMPORTANT: The first rewrite did not improve the score. Be more aggressive — directly incorporate the specific details, numbers, and outcomes the candidate provided. Rewrite the relevant sections more substantially.' : ''}

== ORIGINAL RESUME ==
${resumeText}

== JOB REQUIREMENTS ==
${distilledJd}

== WHAT YOU LEARNED ==
${improvements.map((imp, i) => `[Gap ${imp.gapIndex}]: ${imp.learnedInfo}`).join('\n\n')}

Rewrite the relevant resume sections. Keep their voice. Only use what they told you.
Be specific — numbers, outcomes, scope.

Return ONLY valid JSON:
{
  "rewrittenSections": [{ "gapIndex": 0, "original": "...", "rewritten": "...", "note": "..." }],
  "improvedResumeText": "full resume with sections replaced"
}`;

const RESCORE_PROMPT = (resumeText, distilledJd) => `You are evaluating a candidate's fit for a job based on their resume. Score honestly — a 4 is a 4.

== RESUME ==
${resumeText}

== JOB REQUIREMENTS (distilled) ==
${distilledJd}

Score two dimensions:

Skills (0-10): How well does the resume demonstrate the hard skills, domains, and experience the JD requires?
Alignment (0-10): Based on career trajectory, how well does this role match where they seem to be heading?

Return ONLY valid JSON:
{
  "score": { "skills": 0, "alignment": 0, "overall": 0 },
  "confidence": 0.0
}

overall: round(skills × 0.55 + alignment × 0.45)`;

async function runRewrite(client, resumeText, distilledJd, improvements, harder = false) {
  const msg = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    messages: [{ role: 'user', content: REWRITE_PROMPT(resumeText, distilledJd, improvements, harder) }],
  });
  const raw = msg.content[0]?.text || '{}';
  const match = raw.match(/\{[\s\S]*\}/);
  return JSON.parse(match ? match[0] : raw);
}

async function runRescore(client, resumeText, distilledJd) {
  const msg = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 512,
    messages: [{ role: 'user', content: RESCORE_PROMPT(resumeText, distilledJd) }],
  });
  const raw = msg.content[0]?.text || '{}';
  const match = raw.match(/\{[\s\S]*\}/);
  const parsed = JSON.parse(match ? match[0] : raw);
  if (parsed.score) {
    parsed.score.overall = Math.round((parsed.score.skills * 0.55) + (parsed.score.alignment * 0.45));
  }
  return parsed;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ success: false, error: 'Method not allowed' }) };
  }

  try {
    const { guestId, gevalId } = JSON.parse(event.body || '{}');

    if (!guestId || !gevalId) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ success: false, error: 'guestId and gevalId required' }) };
    }

    const geval = await getGuestEvalById(gevalId);
    if (!geval) {
      return { statusCode: 404, headers: CORS, body: JSON.stringify({ success: false, error: 'Eval not found' }) };
    }
    if (geval._guestId !== guestId) {
      return { statusCode: 403, headers: CORS, body: JSON.stringify({ success: false, error: 'Forbidden' }) };
    }

    const { resumeText, jdSummary, coachingImprovements, score: originalScore } = geval;

    if (!resumeText || !jdSummary) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ success: false, error: 'Eval missing required data' }) };
    }
    if (!coachingImprovements || coachingImprovements.length === 0) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ success: false, error: 'No coaching improvements found — complete the interview first' }) };
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return { statusCode: 500, headers: CORS, body: JSON.stringify({ success: false, error: 'Service unavailable' }) };
    }

    const client = new Anthropic({ apiKey });
    const distilledJd = buildDistilledJd(jdSummary);
    const originalOverall = originalScore?.overall ?? 0;

    // Attempt 1: rewrite + rescore
    let rewriteResult = await runRewrite(client, resumeText, distilledJd, coachingImprovements, false);
    let rescoreResult = await runRescore(client, rewriteResult.improvedResumeText || resumeText, distilledJd);
    let attempt = 1;

    // If score didn't improve, retry with harder prompt
    if ((rescoreResult.score?.overall ?? 0) <= originalOverall) {
      rewriteResult = await runRewrite(client, resumeText, distilledJd, coachingImprovements, true);
      rescoreResult = await runRescore(client, rewriteResult.improvedResumeText || resumeText, distilledJd);
      attempt = 2;
    }

    const improvedOverall = rescoreResult.score?.overall ?? 0;
    const improved = improvedOverall > originalOverall;

    const resultData = {
      improvedResumeText: rewriteResult.improvedResumeText || null,
      rewrittenSections: rewriteResult.rewrittenSections || [],
      improvedScore: rescoreResult.score || {},
      improvementAttempts: attempt,
    };

    await updateGuestEval(gevalId, resultData);

    if (!improved) {
      return {
        statusCode: 200,
        headers: { ...CORS, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: true,
          improved: false,
          reason: `The rewrite didn't move the score (${originalOverall} → ${improvedOverall}). The gaps may require experience you haven't yet demonstrated — more specific outcomes or direct role overlap would help.`,
          originalScore,
          improvedScore: rescoreResult.score,
          rewrittenSections: rewriteResult.rewrittenSections || [],
        }),
      };
    }

    return {
      statusCode: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        improved: true,
        originalScore,
        improvedScore: rescoreResult.score,
        rewrittenSections: rewriteResult.rewrittenSections || [],
        improvedResumeText: rewriteResult.improvedResumeText || null,
      }),
    };

  } catch (error) {
    console.error('[signal-guest-improve] ERROR:', error);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ success: false, error: 'Internal server error' }) };
  }
};
