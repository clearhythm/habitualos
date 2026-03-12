require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');
const { db, admin } = require('@habitualos/db-core');
const { getOwnerByUserId } = require('./_services/db-signal-owners.cjs');
const { decrypt } = require('./_services/crypto.cjs');
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

function buildProfileText(skillsProfile, wantsProfile, personalityProfile) {
  const parts = [];
  if (skillsProfile) {
    if (skillsProfile.coreSkills?.length) parts.push(`Skills: ${skillsProfile.coreSkills.join(', ')}`);
    if (skillsProfile.domains?.length) parts.push(`Domains: ${skillsProfile.domains.join(', ')}`);
    if (skillsProfile.technologies?.length) parts.push(`Stack: ${skillsProfile.technologies.join(', ')}`);
    if (skillsProfile.projectTypes?.length) parts.push(`Project types: ${skillsProfile.projectTypes.join(', ')}`);
  }
  if (wantsProfile) {
    if (wantsProfile.opportunities?.length) parts.push(`Open to: ${wantsProfile.opportunities.join(', ')}`);
    if (wantsProfile.excitedBy?.length) parts.push(`Excited by: ${wantsProfile.excitedBy.join(', ')}`);
    if (wantsProfile.workStyle) parts.push(`Work style: ${wantsProfile.workStyle}`);
    if (wantsProfile.notLookingFor?.length) parts.push(`Not looking for: ${wantsProfile.notLookingFor.join(', ')}`);
  }
  if (personalityProfile) {
    if (personalityProfile.communicationStyle) parts.push(`Communication: ${personalityProfile.communicationStyle}`);
    if (personalityProfile.intellectualStyle) parts.push(`Intellectual style: ${personalityProfile.intellectualStyle}`);
  }
  return parts.length ? parts.join('\n') : 'Profile not yet synthesized — limited evidence available.';
}

function buildEvidenceText(chunks) {
  if (!chunks.length) return 'No matching work history evidence found.';
  return chunks.map(c =>
    `[${String(c.date || '').slice(0, 10)}] "${c.title}"\n${c.summary || ''}${c.keyInsight ? `\nKey signal: ${c.keyInsight}` : ''}`
  ).join('\n\n');
}

const EVAL_PROMPT = ({ profileText, evidenceText, opportunity }) => `You are evaluating a professional's fit for an opportunity. Score honestly — a 4 is a 4.

== CANDIDATE PROFILE ==
${profileText}

== RELEVANT WORK EVIDENCE ==
${evidenceText}

== OPPORTUNITY ==
Type: ${opportunity.type}
Title: ${opportunity.title}
${opportunity.content}

Evaluate fit across two dimensions (Personality requires behavioral observation and cannot be scored here):
- Skills (0-10): How well does the candidate's demonstrated experience match what this opportunity requires?
- Alignment (0-10): How well does this opportunity match what the candidate has expressed they want?

Return ONLY valid JSON with exactly these fields:
{
  "score": { "skills": 0, "alignment": 0, "overall": 0 },
  "confidence": 0.0,
  "recommendation": "strong-candidate",
  "strengths": [],
  "gaps": [],
  "summary": "",
  "evidenceUsed": []
}

Field guidance:
- overall: weighted average (skills × 0.55 + alignment × 0.45), rounded to nearest integer
- confidence: 0.0-1.0, based on how much evidence you had on both sides
- recommendation: "strong-candidate" (overall ≥ 8), "worth-applying" (6-7), "stretch" (4-5), "poor-fit" (≤ 3)
- strengths: 2-4 specific statements about genuine overlap (cite evidence by title where possible)
- gaps: array of objects — only real gaps, be direct
  Each: { "dimension": "skills|alignment", "gap": "...", "severity": "low|moderate|high", "closeable": true, "framing": "honest reframe if closeable" }
  Omit "framing" if closeable is false
- summary: 2-3 direct sentences for the candidate — what they should know before applying
- evidenceUsed: array of "[YYYY-MM-DD] title" strings for chunks that informed scoring`;

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ success: false, error: 'Method not allowed' }) };
  }

  try {
    const { userId, opportunity } = JSON.parse(event.body);

    if (!userId || !userId.startsWith('u-')) {
      return { statusCode: 400, body: JSON.stringify({ success: false, error: 'Valid userId required' }) };
    }
    if (!opportunity?.content?.trim()) {
      return { statusCode: 400, body: JSON.stringify({ success: false, error: 'opportunity.content required' }) };
    }

    const owner = await getOwnerByUserId(userId);
    if (!owner || owner.status !== 'active') {
      return { statusCode: 403, body: JSON.stringify({ success: false, error: 'Owner not found or inactive' }) };
    }

    const signalId = owner.id;
    const { skillsProfile, wantsProfile, personalityProfile } = owner;

    let apiKey = process.env.ANTHROPIC_API_KEY;
    if (owner.anthropicApiKey) {
      try { apiKey = decrypt(owner.anthropicApiKey); } catch (_) {}
    }
    if (!apiKey) {
      return { statusCode: 500, body: JSON.stringify({ success: false, error: 'No Anthropic API key configured' }) };
    }

    // Search for relevant evidence chunks
    const opportunityText = `${opportunity.title || ''} ${opportunity.content}`;
    const terms = extractTerms(opportunityText);
    const chunks = terms.length ? await searchChunks(signalId, terms, 8).catch(() => []) : [];

    // Build and call Claude
    const profileText = buildProfileText(skillsProfile, wantsProfile, personalityProfile);
    const evidenceText = buildEvidenceText(chunks);
    const opportunityForPrompt = {
      type: opportunity.type || 'free-text',
      title: String(opportunity.title || 'Untitled').slice(0, 200),
      content: String(opportunity.content).slice(0, 4000)
    };

    const client = new Anthropic({ apiKey });
    const msg = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{ role: 'user', content: EVAL_PROMPT({ profileText, evidenceText, opportunity: opportunityForPrompt }) }]
    });

    const raw = msg.content[0]?.text || '{}';
    let parsed;
    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
    } catch {
      console.error('[signal-evaluate] JSON parse failed:', raw);
      return { statusCode: 500, body: JSON.stringify({ success: false, error: 'Failed to parse evaluation response' }) };
    }

    // Ensure overall is an integer
    if (parsed.score) {
      parsed.score.overall = Math.round((parsed.score.skills * 0.55) + (parsed.score.alignment * 0.45));
    }

    // Store evaluation
    const evalId = `eval-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    await db.collection('signal-evaluations').doc(evalId).set({
      evalId,
      signalId,
      userId,
      opportunity: {
        type: opportunityForPrompt.type,
        title: opportunityForPrompt.title,
        content: opportunityForPrompt.content,
        url: String(opportunity.url || '').slice(0, 500)
      },
      score: parsed.score || {},
      confidence: parsed.confidence || 0,
      recommendation: parsed.recommendation || '',
      strengths: parsed.strengths || [],
      gaps: parsed.gaps || [],
      summary: parsed.summary || '',
      evidenceUsed: parsed.evidenceUsed || [],
      resumeGenerated: false,
      coverLetterGenerated: false,
      _createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, evaluationId: evalId, ...parsed })
    };

  } catch (error) {
    console.error('[signal-evaluate] ERROR:', error);
    return { statusCode: 500, body: JSON.stringify({ success: false, error: 'Internal server error' }) };
  }
};
