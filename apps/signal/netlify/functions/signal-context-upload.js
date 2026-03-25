require('dotenv').config();
const { getOwnerByUserId, updateOwner } = require('./_services/db-signal-owners.cjs');
const {
  getExistingConversationIds,
  createPendingChunks,
  getContextStats
} = require('./_services/db-signal-context.cjs');

/**
 * POST /api/signal-context-upload
 *
 * Receives client-parsed conversations from a Claude or ChatGPT JSON export.
 * Deduplicates by conversationId — safe to re-upload full exports repeatedly.
 *
 * Body: {
 *   userId: string,
 *   source: "claude" | "chatgpt",
 *   conversations: Array<{
 *     conversationId: string,
 *     title: string,
 *     date: string,        // ISO
 *     messageCount: number,
 *     excerpt: string      // ≤800 chars of human message text
 *   }>
 * }
 *
 * Returns: { success, new: N, skipped: M, total: T, pending: P }
 */
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ success: false, error: 'Method not allowed' }) };
  }

  try {
    const { userId, source, conversations } = JSON.parse(event.body);

    if (!userId || !userId.startsWith('u-')) {
      return { statusCode: 400, body: JSON.stringify({ success: false, error: 'Valid userId required' }) };
    }
    if (!source || !['claude', 'chatgpt'].includes(source)) {
      return { statusCode: 400, body: JSON.stringify({ success: false, error: 'source must be "claude" or "chatgpt"' }) };
    }
    if (!Array.isArray(conversations) || conversations.length === 0) {
      return { statusCode: 400, body: JSON.stringify({ success: false, error: 'conversations array required' }) };
    }

    const owner = await getOwnerByUserId(userId);
    if (!owner || owner.status !== 'active') {
      return { statusCode: 403, body: JSON.stringify({ success: false, error: 'Owner not found or not active' }) };
    }

    const signalId = owner.id;

    // Cap at 500 conversations per upload
    const incoming = conversations.slice(0, 500).map(conv => ({
      conversationId: String(conv.conversationId || '').slice(0, 100),
      source,
      title: String(conv.title || 'Untitled').slice(0, 200),
      date: String(conv.date || new Date().toISOString()).slice(0, 30),
      messageCount: Number(conv.messageCount) || 0,
      excerpt: String(conv.excerpt || '').slice(0, 800)
    })).filter(c => c.conversationId);

    // Dedup: find which conversationIds already exist
    const incomingIds = incoming.map(c => c.conversationId);
    const existingIds = await getExistingConversationIds(signalId, incomingIds);

    const newConversations = incoming.filter(c => !existingIds.has(c.conversationId));
    const skipped = incoming.length - newConversations.length;

    // Create pending chunks for new conversations
    if (newConversations.length > 0) {
      await createPendingChunks(signalId, newConversations);
    }

    // Update owner stats
    const stats = await getContextStats(signalId);
    await updateOwner(signalId, {
      'contextStats.totalChunks': stats.total,
      'contextStats.processedChunks': stats.processed,
      'contextStats.bySource': stats.bySource,
      'contextStats.lastUploadAt': new Date().toISOString()
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        new: newConversations.length,
        skipped,
        total: stats.total,
        pending: stats.pending
      })
    };

  } catch (error) {
    console.error('[signal-context-upload] ERROR:', error);
    return { statusCode: 500, body: JSON.stringify({ success: false, error: 'Internal server error' }) };
  }
};
