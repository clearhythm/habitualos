require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');
const { db, admin } = require('@habitualos/db-core');
const { getOwnerByUserId } = require('./_services/db-signal-owners.cjs');
const { decrypt } = require('./_services/crypto.cjs');

const COVER_PROMPT = ({ displayName, profileSummary, opportunity, strengths, gaps, communicationStyle }) => `You are writing a cover letter for ${displayName} applying to a specific opportunity.

== CANDIDATE SUMMARY ==
${profileSummary}

== OPPORTUNITY ==
Title: ${opportunity.title}
${opportunity.content}

== FIT STRENGTHS ==
${strengths.length ? strengths.join('\n') : 'Strong overall match.'}

== GAPS TO ACKNOWLEDGE (if relevant) ==
${gaps.filter(g => g.severity === 'high').map(g => g.gap).join('\n') || 'None significant enough to address.'}

== TONE ==
Communication style: ${communicationStyle || 'direct, warm, intellectually honest'}

Write a cover letter that:
1. Connects the candidate's specific story to the company's specific problem
2. References real work (from strengths above — be concrete, not generic)
3. Addresses why this role, why now — honestly
4. Acknowledges a significant gap only if it's high-severity (shows self-awareness)
5. Matches the tone above — a direct person writes a direct letter
6. Is 3-4 paragraphs. No filler. No "I am writing to express my interest in..."

Return ONLY valid JSON:
{
  "subject": "Cover letter subject line",
  "body": "Full cover letter text with paragraph breaks (use \\n\\n between paragraphs)"
}`;

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ success: false, error: 'Method not allowed' }) };
  }

  try {
    const { userId, evaluationId, resumeId } = JSON.parse(event.body);

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
    if (!evalSnap.exists || evalSnap.data().userId !== userId) {
      return { statusCode: 404, body: JSON.stringify({ success: false, error: 'Evaluation not found' }) };
    }
    const evaluation = evalSnap.data();

    const displayName = owner.displayName || 'Candidate';
    const communicationStyle = owner.personalityProfile?.communicationStyle || 'direct, warm';

    // Build profile summary from profiles + optional resume summary
    let profileSummary = '';
    if (resumeId) {
      const resumeSnap = await db.collection('signal-resumes').doc(resumeId).get();
      if (resumeSnap.exists) {
        profileSummary = resumeSnap.data().content?.summary || '';
      }
    }
    if (!profileSummary) {
      const sp = owner.skillsProfile;
      const wp = owner.wantsProfile;
      const parts = [];
      if (sp?.coreSkills?.length) parts.push(`Skills: ${sp.coreSkills.slice(0, 8).join(', ')}`);
      if (sp?.domains?.length) parts.push(`Domains: ${sp.domains.join(', ')}`);
      if (wp?.opportunities?.length) parts.push(`Open to: ${wp.opportunities.join(', ')}`);
      profileSummary = parts.join('\n');
    }

    let apiKey = process.env.ANTHROPIC_API_KEY;
    if (owner.anthropicApiKey) {
      try { apiKey = decrypt(owner.anthropicApiKey); } catch (_) {}
    }
    if (!apiKey) {
      return { statusCode: 500, body: JSON.stringify({ success: false, error: 'No Anthropic API key configured' }) };
    }

    const opportunity = {
      title: evaluation.opportunity.title,
      content: String(evaluation.opportunity.content).slice(0, 2000)
    };

    const client = new Anthropic({ apiKey });
    const msg = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: COVER_PROMPT({
          displayName,
          profileSummary,
          opportunity,
          strengths: evaluation.strengths || [],
          gaps: evaluation.gaps || [],
          communicationStyle
        })
      }]
    });

    const raw = msg.content[0]?.text || '{}';
    let parsed;
    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
    } catch {
      console.error('[signal-cover-generate] JSON parse failed:', raw);
      return { statusCode: 500, body: JSON.stringify({ success: false, error: 'Failed to parse cover letter response' }) };
    }

    // Store cover letter
    const coverId = `cover-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    await db.collection('signal-covers').doc(coverId).set({
      coverId,
      evaluationId,
      resumeId: resumeId || null,
      signalId: owner.id,
      userId,
      content: parsed,
      _createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Mark evaluation as having a cover letter
    await db.collection('signal-evaluations').doc(evaluationId).set(
      { coverLetterGenerated: true, coverId },
      { merge: true }
    );

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, coverId, content: parsed })
    };

  } catch (error) {
    console.error('[signal-cover-generate] ERROR:', error);
    return { statusCode: 500, body: JSON.stringify({ success: false, error: 'Internal server error' }) };
  }
};
