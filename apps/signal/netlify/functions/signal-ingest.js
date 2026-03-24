require('dotenv').config();
const { getOwnerBySignalId } = require('./_services/db-signal-owners.cjs');
const { createProcessedChunk, getContextStats } = require('./_services/db-signal-context.cjs');
const { updateOwner } = require('./_services/db-signal-owners.cjs');

/**
 * POST /api/signal-ingest
 *
 * Receives a pre-extracted session summary from Claude Code and writes it
 * directly as a processed context chunk. No pending → process pipeline needed
 * because Claude already synthesized the session context.
 *
 * Body: {
 *   userId: string,
 *   signalId: string,
 *   source: "claude-code" | "git-hook",
 *   repo: string,               // e.g. "habitualos"
 *   summary: string,            // rich session summary (2-6 sentences)
 *   topics: string[],
 *   skills: string[],
 *   technologies: string[],
 *   projects?: string[],
 *   wants?: string[],
 *   personalitySignals?: string[],
 *   keyInsight?: string,
 *   date?: string               // ISO — defaults to now
 * }
 *
 * Returns: { success, created, docId }
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ success: false, error: 'Method not allowed' }) };
  }

  try {
    const {
      userId,
      signalId,
      source = 'claude-code',
      repo = '',
      summary,
      topics = [],
      skills = [],
      technologies = [],
      projects = [],
      wants = [],
      personalitySignals = [],
      keyInsight = '',
      date,
      conversationId: providedConversationId
    } = JSON.parse(event.body || '{}');

    if (!userId || !signalId || !summary) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ success: false, error: 'userId, signalId, and summary required' }) };
    }

    const owner = await getOwnerBySignalId(signalId);
    if (!owner || owner.status !== 'active') {
      return { statusCode: 403, headers: CORS, body: JSON.stringify({ success: false, error: 'Signal not found or not active' }) };
    }

    if (owner._userId !== userId) {
      return { statusCode: 403, headers: CORS, body: JSON.stringify({ success: false, error: 'Unauthorized' }) };
    }

    const sessionDate = date || new Date().toISOString();
    // Dedup key: use provided id (e.g. commit hash) or generate from source+repo+date
    const safeRepo = repo.replace(/[^a-zA-Z0-9_-]/g, '-');
    const conversationId = providedConversationId ||
      `${source}-${safeRepo}-${sessionDate.slice(0, 16).replace(/[^0-9]/g, '')}`;

    // Concepts = union of all searchable terms
    const concepts = [...new Set([...topics, ...skills, ...technologies, ...projects])];

    // Infer dimension coverage from what was provided
    const dimensionCoverage = {
      skills: skills.length > 0,
      alignment: wants.length > 0,
      personality: personalitySignals.length > 0
    };

    // Evidence strength: based on richness of the summary
    const evidenceStrength = Math.min(5, Math.max(1,
      (summary.length > 400 ? 2 : 1) +
      (skills.length > 3 ? 1 : 0) +
      (technologies.length > 2 ? 1 : 0) +
      (keyInsight ? 1 : 0)
    ));

    const { created, docId } = await createProcessedChunk(signalId, conversationId, {
      source,
      title: `${repo ? repo + ': ' : ''}${sessionDate.slice(0, 10)} session`,
      date: sessionDate,
      repo,
      summary,
      topics,
      skills,
      technologies,
      projects,
      wants,
      personalitySignals,
      concepts,
      keyInsight,
      dimensionCoverage,
      evidenceStrength,
      messageCount: 0
    });

    // Update owner contextStats
    const stats = await getContextStats(signalId);
    await updateOwner(signalId, {
      'contextStats.totalChunks': stats.total,
      'contextStats.processedChunks': stats.processed,
      'contextStats.lastIngestAt': sessionDate
    });

    return {
      statusCode: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, created, docId })
    };

  } catch (error) {
    console.error('[signal-ingest] ERROR:', error);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ success: false, error: 'Internal server error' }) };
  }
};
