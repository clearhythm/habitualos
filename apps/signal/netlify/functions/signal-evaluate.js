require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');
const { db, admin } = require('@habitualos/db-core');
const { getOwnerByUserId } = require('./_services/db-signal-owners.cjs');
const { decrypt } = require('./_services/crypto.cjs');
const { scoreOpportunity } = require('./_services/signal-score-opportunity.cjs');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ success: false, error: 'Method not allowed' }) };
  }

  try {
    const body = JSON.parse(event.body);
    const { userId, opportunity } = body;

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

    let apiKey = process.env.ANTHROPIC_API_KEY;
    if (owner.anthropicApiKey) {
      try { apiKey = decrypt(owner.anthropicApiKey); } catch (_) {}
    }
    if (!apiKey) {
      return { statusCode: 500, body: JSON.stringify({ success: false, error: 'No Anthropic API key configured' }) };
    }

    const client = new Anthropic({ apiKey });

    const { jdSummary, opportunityForPrompt, chunks, parsed } = await scoreOpportunity({
      owner,
      opportunity,
      anthropicClient: client,
      jdSummary: body.jdSummary || null,
      distilledContent: body.distilledContent || null,
    });

    // Store evaluation
    const evalId = `eval-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    await db.collection('signal-evaluations').doc(evalId).set({
      _evalId: evalId,
      _signalId: owner.id,
      _userId: userId,
      mode: 'dashboard',
      opportunity: {
        type: opportunityForPrompt.type,
        title: opportunityForPrompt.title,
        content: opportunityForPrompt.content,
        url: String(opportunity.url || '').slice(0, 500)
      },
      demo: body.demo === true,
      jdSummary: jdSummary || null,
      score: parsed.score || {},
      confidence: parsed.confidence || 0,
      recommendation: parsed.recommendation || '',
      strengths: parsed.strengths || [],
      gaps: parsed.gaps || [],
      summary: parsed.summary || '',
      evidenceUsed: parsed.evidenceUsed || [],
      evidenceChunks: chunks.map(c => ({
        title: c.title || '',
        date: c.date || '',
        summary: c.summary || '',
        keyInsight: c.keyInsight || '',
        topics: c.topics || [],
        skills: c.skills || []
      })),
      resumeGenerated: false,
      coverLetterGenerated: false,
      _createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, evaluationId: evalId, jdSummary, ...parsed })
    };

  } catch (error) {
    console.error('[signal-evaluate] ERROR:', error);
    return { statusCode: 500, body: JSON.stringify({ success: false, error: 'Internal server error' }) };
  }
};
