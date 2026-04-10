require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');
const { db, admin } = require('@habitualos/db-core');
const { getOwnerByUserId } = require('./_services/db-signal-owners.cjs');
const { resolveApiKey } = require('./_services/crypto.cjs');
const { searchChunks } = require('./_services/db-signal-context.cjs');

const STOPWORDS = new Set([
  'the','a','an','and','or','for','to','in','of','on','is','are','was','were',
  'with','that','this','we','our','you','their','have','be','will','as','at',
  'by','from','it','its','not','but','they','has','had','can','all','your',
  'who','what','how','when','where','which','been','also','more','very'
]);

function extractTerms(text, limit = 25) {
  return [...new Set(
    text.toLowerCase()
      .split(/[\s,;:.()\[\]"'!?\\/\-]+/)
      .filter(t => t.length > 2 && !STOPWORDS.has(t))
  )].slice(0, limit);
}

function buildProfileText(skillsProfile, wantsProfile) {
  const parts = [];
  if (skillsProfile) {
    if (skillsProfile.coreSkills?.length) parts.push(`Core skills: ${skillsProfile.coreSkills.join(', ')}`);
    if (skillsProfile.domains?.length) parts.push(`Domains: ${skillsProfile.domains.join(', ')}`);
    if (skillsProfile.technologies?.length) parts.push(`Stack: ${skillsProfile.technologies.join(', ')}`);
    if (skillsProfile.projectTypes?.length) parts.push(`Project types: ${skillsProfile.projectTypes.join(', ')}`);
  }
  if (wantsProfile?.workStyle) parts.push(`Work style: ${wantsProfile.workStyle}`);
  return parts.join('\n');
}

function buildEvidenceText(chunks) {
  if (!chunks.length) return 'No matching work history evidence found.';
  return chunks.map(c =>
    `[${String(c.date || '').slice(0, 10)}] "${c.title}"\n${c.summary || ''}${c.keyInsight ? `\nKey signal: ${c.keyInsight}` : ''}\nSkills: ${(c.skills || []).slice(0, 6).join(', ')}`
  ).join('\n\n');
}

const RESUME_PROMPT = ({ displayName, profileText, evidenceText, opportunity, gaps }) => `You are generating a targeted resume for ${displayName} for a specific opportunity.

== CANDIDATE PROFILE ==
${profileText}

== OPPORTUNITY ==
Title: ${opportunity.title}
${opportunity.content}

== RELEVANT WORK EVIDENCE ==
${evidenceText}

== GAP ANALYSIS ==
${gaps.length
  ? gaps.map(g => `- ${g.gap} (${g.severity}${g.closeable && g.framing ? ` — reframe as: ${g.framing}` : ', omit from resume'})`).join('\n')
  : 'No significant gaps identified.'}

Generate a targeted resume. Rules:
1. Use language from the opportunity where the candidate genuinely has matching experience
2. Bullets derive from work history evidence — cite real projects and outcomes, not generics
3. Do NOT fabricate — only claims grounded in the evidence provided
4. Reframe closeable gaps honestly; omit uncloseable gaps entirely
5. Keep bullets action-oriented: "Built X that did Y, resulting in Z"

Return ONLY valid JSON:
{
  "summary": "2-3 sentence professional summary tailored to this opportunity",
  "experience": [
    { "title": "Job title", "org": "Organization", "dates": "YYYY – YYYY", "bullets": ["...", "..."] }
  ],
  "skills": ["skill1", "skill2"],
  "education": [
    { "degree": "Degree", "institution": "Institution", "dates": "YYYY" }
  ]
}`;

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ success: false, error: 'Method not allowed' }) };
  }

  try {
    const { userId, evaluationId } = JSON.parse(event.body);

    if (!userId || !userId.startsWith('u-')) {
      return { statusCode: 400, body: JSON.stringify({ success: false, error: 'Valid userId required' }) };
    }
    if (!evaluationId) {
      return { statusCode: 400, body: JSON.stringify({ success: false, error: 'evaluationId required' }) };
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

    const signalId = owner.id;
    const { skillsProfile, wantsProfile } = owner;
    const displayName = owner.displayName || 'Candidate';

    const apiKey = resolveApiKey(owner);
    if (!apiKey) {
      return { statusCode: 500, body: JSON.stringify({ success: false, error: 'No Anthropic API key configured' }) };
    }

    // Get relevant evidence
    const opportunityText = `${evaluation.opportunity.title} ${evaluation.opportunity.content}`;
    const terms = extractTerms(opportunityText);
    const chunks = terms.length ? await searchChunks(signalId, terms, 10).catch(() => []) : [];

    const profileText = buildProfileText(skillsProfile, wantsProfile);
    const evidenceText = buildEvidenceText(chunks);
    const opportunity = {
      title: evaluation.opportunity.title,
      content: String(evaluation.opportunity.content).slice(0, 3000)
    };
    const gaps = evaluation.gaps || [];

    const client = new Anthropic({ apiKey });
    const msg = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      messages: [{ role: 'user', content: RESUME_PROMPT({ displayName, profileText, evidenceText, opportunity, gaps }) }]
    });

    const raw = msg.content[0]?.text || '{}';
    let parsed;
    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
    } catch {
      console.error('[signal-resume-generate] JSON parse failed:', raw);
      return { statusCode: 500, body: JSON.stringify({ success: false, error: 'Failed to parse resume response' }) };
    }

    // Store resume
    const resumeId = `resume-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    await db.collection('signal-resumes').doc(resumeId).set({
      _resumeId: resumeId,
      _evaluationId: evaluationId,
      _signalId: signalId,
      _userId: userId,
      content: parsed,
      _createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Mark evaluation as having a resume
    await db.collection('signal-evaluations').doc(evaluationId).set(
      { resumeGenerated: true, resumeId },
      { merge: true }
    );

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, resumeId, content: parsed })
    };

  } catch (error) {
    console.error('[signal-resume-generate] ERROR:', error);
    return { statusCode: 500, body: JSON.stringify({ success: false, error: 'Internal server error' }) };
  }
};
