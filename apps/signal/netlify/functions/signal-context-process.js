require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');
const { getOwnerByUserId, getOwnerBySignalId } = require('./_services/db-signal-owners.cjs');
const { resolveApiKey } = require('./_services/crypto.cjs');
const {
  getPendingChunks,
  countPendingChunks,
  updateChunk
} = require('./_services/db-signal-context.cjs');

/**
 * POST /api/signal-context-process
 *
 * Processes a batch of pending chunks: sends each to Claude for structured
 * extraction (topics, skills, technologies, projects, wants, personality signals,
 * summary, keyInsight, evidenceStrength).
 *
 * Called repeatedly by the client until remaining === 0.
 *
 * Body: { userId, limit? }  (limit defaults to 4, max 5)
 * Returns: { success, processed: N, remaining: M }
 */

const EXTRACTION_PROMPT = (title, date, excerpt, coachMode = false) => `Extract structured metadata from this AI conversation excerpt.

Title: "${title}"
Date: ${date}
Human messages excerpt: ${excerpt}

Return ONLY valid JSON with these exact fields:
{
  "topics": [],
  "skills": [],
  "technologies": [],
  "projects": [],
  "wants": [],
  "personalitySignals": [],
  "concepts": [],
  "summary": "",
  "keyInsight": "",
  "dimensionCoverage": { "skills": true, "alignment": false, "personality": true },
  "evidenceStrength": 3
}

Field guidance:
- topics: 2-5 broad domains (e.g. "streaming", "product strategy", "behavioral health")
- skills: demonstrated capabilities (e.g. "Firestore data modeling", "system prompt design")
- technologies: specific tools/frameworks (e.g. "Claude API", "Netlify edge functions", "TypeScript")
- projects: named projects or companies referenced (e.g. "HabitualOS", "Healify", "Intuit")
- wants: any goals or desires expressed (e.g. "wants to work on AI-native products", "interested in senior roles")
- personalitySignals: behavioral markers visible in HOW the person engaged (e.g. "asked clarifying questions before building", "challenged assumptions", "first-principles reasoning")
- concepts: union of all above plus any other searchable terms
- summary: 2-4 sentences — what was worked on and what it demonstrates about this person
- keyInsight: single most notable signal about this person's capabilities or character
- dimensionCoverage: true if this conversation clearly informs that dimension
- evidenceStrength: 1=shallow exchange, 2=some depth, 3=substantive work, 4=complex problem solved, 5=deep expertise demonstrated${coachMode ? `

Coach mode — balanced signal extraction:
Extract personalitySignals as objects with polarity tags instead of plain strings:
  { "signal": "...", "polarity": "strength" | "edge" }
- strength: what this person brings — capabilities, judgment, working style strengths
- edge: patterns worth examining — friction responses, avoidance, scope issues, blind spots
Be specific and observational, not evaluative. Both polarities build an honest record.` : ''}`;

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ success: false, error: 'Method not allowed' }) };
  }

  try {
    const { userId, limit: rawLimit = 4 } = JSON.parse(event.body);
    const limit = Math.min(Number(rawLimit) || 4, 5);

    if (!userId || !userId.startsWith('u-')) {
      return { statusCode: 400, body: JSON.stringify({ success: false, error: 'Valid userId required' }) };
    }

    const owner = await getOwnerByUserId(userId);
    if (!owner || owner.status !== 'active') {
      return { statusCode: 403, body: JSON.stringify({ success: false, error: 'Owner not found or not active' }) };
    }

    const signalId = owner.id;
    const coachMode = owner.reflectionMode === 'coach';

    // Resolve API key: owner's key if set, else Signal's key
    const apiKey = resolveApiKey(owner);
    if (!apiKey) {
      return { statusCode: 500, body: JSON.stringify({ success: false, error: 'No Anthropic API key configured' }) };
    }

    const client = new Anthropic({ apiKey });
    const pending = await getPendingChunks(signalId, limit);

    if (pending.length === 0) {
      const remaining = await countPendingChunks(signalId);
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: true, processed: 0, remaining })
      };
    }

    let processed = 0;
    for (const chunk of pending) {
      try {
        const response = await client.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 1024,
          messages: [{
            role: 'user',
            content: EXTRACTION_PROMPT(chunk.title, chunk.date, chunk.excerpt || '', coachMode)
          }]
        });

        const text = response.content?.[0]?.text || '';
        // Extract JSON from response (handle markdown code blocks)
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('No JSON in response');

        const extracted = JSON.parse(jsonMatch[0]);

        // Validate and sanitize
        const toArray = (v) => Array.isArray(v) ? v.map(String).slice(0, 30) : [];
        const normalizeSignals = (arr) => (Array.isArray(arr) ? arr : []).slice(0, 30).map(s => {
          if (typeof s === 'string') return { signal: s, polarity: 'strength' };
          if (s && typeof s.signal === 'string') return { signal: String(s.signal).slice(0, 200), polarity: s.polarity === 'edge' ? 'edge' : 'strength' };
          return null;
        }).filter(Boolean);
        const fields = {
          topics: toArray(extracted.topics),
          skills: toArray(extracted.skills),
          technologies: toArray(extracted.technologies),
          projects: toArray(extracted.projects),
          wants: toArray(extracted.wants),
          personalitySignals: normalizeSignals(extracted.personalitySignals),
          concepts: toArray(extracted.concepts),
          summary: String(extracted.summary || '').slice(0, 600),
          keyInsight: String(extracted.keyInsight || '').slice(0, 300),
          dimensionCoverage: {
            skills: !!extracted.dimensionCoverage?.skills,
            alignment: !!extracted.dimensionCoverage?.alignment,
            personality: !!extracted.dimensionCoverage?.personality
          },
          evidenceStrength: Math.min(5, Math.max(1, Number(extracted.evidenceStrength) || 1)),
          status: 'processed'
        };

        await updateChunk(chunk.id, fields);
        processed++;
      } catch (err) {
        console.error(`[signal-context-process] Chunk ${chunk.id} failed:`, err.message);
        await updateChunk(chunk.id, { status: 'error' });
      }
    }

    const remaining = await countPendingChunks(signalId);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, processed, remaining })
    };

  } catch (error) {
    console.error('[signal-context-process] ERROR:', error);
    return { statusCode: 500, body: JSON.stringify({ success: false, error: 'Internal server error' }) };
  }
};
