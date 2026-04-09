require('dotenv').config();
const crypto = require('crypto');
const Anthropic = require('@anthropic-ai/sdk');
const { db, admin } = require('@habitualos/db-core');
const { createGuestEval, getGuestEvalsByGuestId } = require('./_services/db-signal-guest-evals.cjs');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const GUEST_EVAL_LIMIT = 3;
const IP_DAILY_LIMIT = 10;

const JD_DISTILL_PROMPT = (rawJd) => `Extract the signal from this job description. Strip all boilerplate (company history, benefits, EEO, legal text). Return ONLY valid JSON with these fields:

{
  "roleTitle": "exact title from JD",
  "level": "IC level or seniority signal (e.g. Principal, Staff, VP)",
  "responsibilities": ["3-5 core responsibilities, specific and concrete"],
  "mustHave": ["actual hard requirements — years exp, specific skills, domains"],
  "niceToHave": ["preferred but not required"],
  "cultureSignals": ["2-3 inferences about working style, org type, pace"],
  "compensation": "range if listed, else null",
  "workModel": "remote/hybrid/onsite details if listed, else null"
}

Job description:
${rawJd}`;

const GUEST_EVAL_PROMPT = ({ resumeText, distilledJd }) => `You are evaluating a candidate's fit for a job based on their resume. Score honestly — a 4 is a 4.

== RESUME ==
${resumeText}

== JOB REQUIREMENTS (distilled) ==
${distilledJd}

Score two dimensions and provide one qualitative observation:

Skills (0-10): How well does the resume demonstrate the hard skills, domains, and experience the JD requires? Look at years, depth, recency, and direct overlap with mustHave and responsibilities.

Alignment (0-10): Based on the candidate's career trajectory, seniority moves, role types, and apparent interests visible in this resume, how well does this role match where they seem to be heading? A person who has moved from IC → management should score low for a pure IC role even if their skills qualify.

Personality (qualitative only, NOT scored): 2-3 sentence paragraph on working style inferences visible in how the resume is written and structured. Return a short paragraph, not bullet points. Do NOT assign a number.

Return ONLY valid JSON:
{
  "score": { "skills": 0, "alignment": 0, "overall": 0 },
  "confidence": 0.0,
  "recommendation": "strong-candidate",
  "strengths": [],
  "gaps": [],
  "summary": "",
  "personalityNote": ""
}

overall: round(skills × 0.55 + alignment × 0.45)
confidence: 0.0-1.0. Full resume + detailed JD = 0.7-0.8. Sparse resume or vague JD = 0.4-0.5.
recommendation: "strong-candidate" (≥8), "worth-applying" (6-7), "stretch" (4-5), "poor-fit" (≤3)
strengths: 2-4 specific statements drawn directly from resume content vs JD requirements
gaps: array of objects — only real gaps, be direct. Each: { "dimension": "skills|alignment", "gap": "...", "severity": "low|moderate|high", "closeable": true|false, "framing": "honest reframe if closeable" }. Omit "framing" if closeable is false.
summary: 2-3 direct sentences — what the candidate should know before applying
personalityNote: 2-3 sentence paragraph on working style inferences from the resume`;

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ success: false, error: 'Method not allowed' }) };
  }

  try {
    const { guestId, resumeText, jdText, jdTitle } = JSON.parse(event.body || '{}');

    if (!guestId || !guestId.startsWith('g-')) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ success: false, error: 'Valid guestId required' }) };
    }
    if (!resumeText?.trim()) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ success: false, error: 'resumeText required' }) };
    }
    if (!jdText?.trim()) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ success: false, error: 'jdText required' }) };
    }

    // Check guest eval limit
    const existingEvals = await getGuestEvalsByGuestId(guestId);
    if (existingEvals.length >= GUEST_EVAL_LIMIT) {
      return {
        statusCode: 429,
        headers: { ...CORS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: 'limit_reached', limit: GUEST_EVAL_LIMIT }),
      };
    }

    // IP-based secondary gate
    const ip = event.headers['x-nf-client-connection-ip'] || event.headers['x-forwarded-for'] || 'unknown';
    const ipHash = crypto.createHash('sha256').update(ip).digest('hex');
    const oneDayAgo = new Date(Date.now() - 86400000).toISOString();
    const ipSnap = await db.collection('signal-guest-evals')
      .where('_ipHash', '==', ipHash)
      .get();
    const recentIpCount = ipSnap.docs.filter(d => {
      const data = d.data();
      return (data._createdAt?.toDate?.()?.toISOString() || '') > oneDayAgo;
    }).length;
    if (recentIpCount >= IP_DAILY_LIMIT) {
      return {
        statusCode: 429,
        headers: { ...CORS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: 'rate_limited' }),
      };
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return { statusCode: 500, headers: CORS, body: JSON.stringify({ success: false, error: 'Service unavailable' }) };
    }

    const client = new Anthropic({ apiKey });
    const rawResume = String(resumeText).slice(0, 12000);
    const rawJd = String(jdText).slice(0, 8000);

    // Step 1: Distill JD with Haiku
    let jdSummary = null;
    let distilledJd = rawJd;
    try {
      const distillMsg = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 512,
        messages: [{ role: 'user', content: JD_DISTILL_PROMPT(rawJd) }],
      });
      const distillRaw = distillMsg.content[0]?.text || '{}';
      const distillMatch = distillRaw.match(/\{[\s\S]*\}/);
      jdSummary = JSON.parse(distillMatch ? distillMatch[0] : distillRaw);
      distilledJd = [
        `Role: ${jdSummary.roleTitle} (${jdSummary.level || 'unspecified level'})`,
        jdSummary.responsibilities?.length ? `Responsibilities:\n${jdSummary.responsibilities.map(r => `- ${r}`).join('\n')}` : '',
        jdSummary.mustHave?.length ? `Must have:\n${jdSummary.mustHave.map(r => `- ${r}`).join('\n')}` : '',
        jdSummary.niceToHave?.length ? `Nice to have:\n${jdSummary.niceToHave.map(r => `- ${r}`).join('\n')}` : '',
        jdSummary.cultureSignals?.length ? `Culture signals:\n${jdSummary.cultureSignals.map(r => `- ${r}`).join('\n')}` : '',
        jdSummary.compensation ? `Compensation: ${jdSummary.compensation}` : '',
        jdSummary.workModel ? `Work model: ${jdSummary.workModel}` : '',
      ].filter(Boolean).join('\n\n');
    } catch (err) {
      console.warn('[signal-guest-score] JD distillation failed, using raw:', err.message);
    }

    // Step 2: Score with Sonnet
    const msg = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      messages: [{ role: 'user', content: GUEST_EVAL_PROMPT({ resumeText: rawResume, distilledJd }) }],
    });

    const raw = msg.content[0]?.text || '{}';
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw);

    // Normalize
    if (parsed.score) {
      parsed.score.overall = Math.round((parsed.score.skills * 0.55) + (parsed.score.alignment * 0.45));
      parsed.score.confidence = parsed.confidence || 0;
    }

    const resolvedTitle = jdTitle?.trim() || jdSummary?.roleTitle || 'Untitled';

    const gevalId = await createGuestEval(guestId, {
      resumeText: rawResume,
      jdText: rawJd,
      jdTitle: resolvedTitle,
      jdSummary: jdSummary || null,
      score: parsed.score || {},
      confidence: parsed.confidence || 0,
      recommendation: parsed.recommendation || '',
      strengths: parsed.strengths || [],
      gaps: parsed.gaps || [],
      summary: parsed.summary || '',
      personalityNote: parsed.personalityNote || '',
      _ipHash: ipHash,
    });

    return {
      statusCode: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        gevalId,
        jdTitle: resolvedTitle,
        jdSummary,
        ...parsed,
      }),
    };

  } catch (error) {
    console.error('[signal-guest-score] ERROR:', error);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ success: false, error: 'Internal server error' }) };
  }
};
