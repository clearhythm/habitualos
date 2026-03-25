require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');
const { db, admin } = require('@habitualos/db-core');
const { getOwnerByUserId } = require('./_services/db-signal-owners.cjs');
const { decrypt } = require('./_services/crypto.cjs');

const RESCORE_PROMPT = ({ displayName, originalScore, opportunity, strengths, gaps, resumeText }) => `You are re-evaluating the full fit assessment for ${displayName} after they tailored their resume for a specific opportunity.

== OPPORTUNITY ==
Title: ${opportunity.title}
${opportunity.content}

== ORIGINAL FIT SCORES ==
Skills: ${originalScore.skills}/10
Alignment: ${originalScore.alignment}/10
Overall: ${originalScore.overall}/10

== ORIGINAL STRENGTHS ==
${strengths.length ? strengths.join('\n') : 'None recorded.'}

== ORIGINAL GAPS ==
${gaps.length ? gaps.map(g => `- ${g.gap} (${g.severity}${g.closeable ? ', closeable' : ', not closeable'})`).join('\n') : 'No significant gaps.'}

== TAILORED RESUME ==
${resumeText}

Re-evaluate fit based on the tailored resume. The alignment score does not change (that reflects what the candidate wants, not how they present themselves). Everything else — skills score, summary, strengths, and gaps — should reflect how the tailored resume now presents the candidate.

Return ONLY valid JSON:
{
  "skills": <integer 0-10, revised skills fit>,
  "alignment": ${originalScore.alignment},
  "overall": <integer 0-10, weighted: skills*0.55 + alignment*0.45>,
  "summary": "<updated bottom-line summary: why this score, core tension or fit. 2-4 sentences, second person>",
  "strengths": [
    "<updated fit signal — reflect what the tailored resume now demonstrates>",
    "<another strength>"
  ],
  "gaps": [
    {
      "dimension": "skills",
      "gap": "<remaining gap or concern>",
      "severity": "low|moderate|high",
      "closeable": true|false,
      "framing": "<how to address it, if closeable>"
    }
  ],
  "improvementSummary": "<1-2 sentences on what improved and why>",
  "changeDetails": [
    "<specific change made and why it helps>",
    "<another specific change>"
  ]
}

strengths: 2-4 items. gaps: only include gaps that remain meaningful after the resume changes — drop or downgrade ones that were addressed. changeDetails: 2-4 items, specific. If the score did not improve, explain honestly why.`;

function buildResumeText(content) {
  if (!content) return 'No resume content available.';
  const lines = [];
  if (content.summary) lines.push(`Summary: ${content.summary}`);
  (content.experience || []).forEach(e => {
    lines.push(`\n${e.title} — ${e.org} (${e.dates})`);
    (e.bullets || []).forEach(b => lines.push(`  • ${b}`));
  });
  if (content.skills?.length) lines.push(`\nSkills: ${content.skills.join(', ')}`);
  return lines.join('\n');
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ success: false, error: 'Method not allowed' }) };
  }

  try {
    const { userId, evaluationId, resumeId } = JSON.parse(event.body);

    if (!userId || !userId.startsWith('u-')) {
      return { statusCode: 400, body: JSON.stringify({ success: false, error: 'Valid userId required' }) };
    }
    if (!evaluationId || !resumeId) {
      return { statusCode: 400, body: JSON.stringify({ success: false, error: 'evaluationId and resumeId required' }) };
    }

    const owner = await getOwnerByUserId(userId);
    if (!owner || owner.status !== 'active') {
      return { statusCode: 403, body: JSON.stringify({ success: false, error: 'Owner not found or inactive' }) };
    }

    // Load evaluation
    const evalSnap = await db.collection('signal-evaluations').doc(evaluationId).get();
    if (!evalSnap.exists || evalSnap.data()._userId !== userId) {
      return { statusCode: 404, body: JSON.stringify({ success: false, error: 'Evaluation not found' }) };
    }
    const evaluation = evalSnap.data();

    // Load resume
    const resumeSnap = await db.collection('signal-resumes').doc(resumeId).get();
    if (!resumeSnap.exists || resumeSnap.data()._userId !== userId) {
      return { statusCode: 404, body: JSON.stringify({ success: false, error: 'Resume not found' }) };
    }
    const resume = resumeSnap.data();

    let apiKey = process.env.ANTHROPIC_API_KEY;
    if (owner.anthropicApiKey) {
      try { apiKey = decrypt(owner.anthropicApiKey); } catch (_) {}
    }
    if (!apiKey) {
      return { statusCode: 500, body: JSON.stringify({ success: false, error: 'No Anthropic API key configured' }) };
    }

    const originalScore = evaluation.score || { skills: 0, alignment: 0, overall: 0 };
    const opportunity = {
      title: evaluation.opportunity.title,
      content: String(evaluation.opportunity.content).slice(0, 2000)
    };
    const resumeText = buildResumeText(resume.content);
    const displayName = owner.displayName || 'Candidate';

    const client = new Anthropic({ apiKey });
    const msg = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      messages: [{
        role: 'user',
        content: RESCORE_PROMPT({
          displayName,
          originalScore,
          opportunity,
          strengths: evaluation.strengths || [],
          gaps: evaluation.gaps || [],
          resumeText
        })
      }]
    });

    const raw = msg.content[0]?.text || '{}';
    let parsed;
    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
    } catch {
      console.error('[signal-resume-rescore] JSON parse failed:', raw);
      return { statusCode: 500, body: JSON.stringify({ success: false, error: 'Failed to parse rescore response' }) };
    }

    const newScore = {
      skills: parsed.skills ?? originalScore.skills,
      alignment: parsed.alignment ?? originalScore.alignment,
      overall: parsed.overall ?? originalScore.overall
    };
    const delta = newScore.overall - (originalScore.overall ?? 0);

    // Upsert the full evaluation with updated score, summary, strengths, gaps
    await db.collection('signal-evaluations').doc(evaluationId).set({
      score: newScore,
      summary: parsed.summary || evaluation.summary || '',
      strengths: parsed.strengths || evaluation.strengths || [],
      gaps: parsed.gaps || evaluation.gaps || [],
      rescoreResult: {
        newScore,
        originalScore,
        delta,
        improvementSummary: parsed.improvementSummary || '',
        changeDetails: parsed.changeDetails || [],
        resumeId,
        _rescoredAt: admin.firestore.FieldValue.serverTimestamp()
      }
    }, { merge: true });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        newScore,
        originalScore,
        delta,
        summary: parsed.summary || '',
        strengths: parsed.strengths || [],
        gaps: parsed.gaps || [],
        improvementSummary: parsed.improvementSummary || '',
        changeDetails: parsed.changeDetails || []
      })
    };

  } catch (error) {
    console.error('[signal-resume-rescore] ERROR:', error);
    return { statusCode: 500, body: JSON.stringify({ success: false, error: 'Internal server error' }) };
  }
};
