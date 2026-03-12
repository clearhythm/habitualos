/**
 * Firestore service for signal-context-chunks collection.
 *
 * signal-context-chunks/{signalId}-{conversationId}:
 *   signalId          — owner's signal ID
 *   conversationId    — UUID from export (dedup key)
 *   source            — "claude" | "chatgpt"
 *   title             — conversation title
 *   date              — ISO string (conversation creation date)
 *   messageCount      — number of messages
 *   topics            — broad domains discussed
 *   skills            — capabilities demonstrated
 *   technologies      — stack mentioned
 *   projects          — projects/companies referenced
 *   wants             — goals/desires expressed
 *   personalitySignals — behavioral markers
 *   concepts          — union of all above (primary search index)
 *   summary           — 2-4 sentence extraction
 *   keyInsight        — most notable signal
 *   dimensionCoverage — { skills, alignment, personality }
 *   evidenceStrength  — 1-5
 *   status            — "pending" | "processed" | "error"
 *   _createdAt / _processedAt
 */

require('dotenv').config();
const { db, admin } = require('@habitualos/db-core');

const COLLECTION = 'signal-context-chunks';

/**
 * Check which conversationIds already exist for a signalId.
 * Returns a Set of existing IDs.
 */
async function getExistingConversationIds(signalId, conversationIds) {
  if (!conversationIds.length) return new Set();

  // Doc IDs are {signalId}-{conversationId}
  const docIds = conversationIds.map(id => `${signalId}-${id}`);

  // Firestore getAll supports up to 500 docs
  const refs = docIds.map(id => db.collection(COLLECTION).doc(id));
  const snaps = await db.getAll(...refs);
  const existing = new Set();
  snaps.forEach((snap, i) => {
    if (snap.exists) existing.add(conversationIds[i]);
  });
  return existing;
}

/**
 * Create pending chunks (batch write). Skips existing doc IDs.
 */
async function createPendingChunks(signalId, conversations) {
  if (!conversations.length) return 0;

  const colRef = db.collection(COLLECTION);
  const now = admin.firestore.FieldValue.serverTimestamp();

  // Write in batches of 500 (Firestore limit)
  let created = 0;
  for (let i = 0; i < conversations.length; i += 500) {
    const batch = db.batch();
    const slice = conversations.slice(i, i + 500);
    slice.forEach(conv => {
      const docId = `${signalId}-${conv.conversationId}`;
      const ref = colRef.doc(docId);
      batch.set(ref, {
        signalId,
        conversationId: conv.conversationId,
        source: conv.source,
        title: conv.title,
        date: conv.date,
        messageCount: conv.messageCount || 0,
        excerpt: conv.excerpt || '',
        // Extraction fields (filled by signal-context-process)
        topics: [],
        skills: [],
        technologies: [],
        projects: [],
        wants: [],
        personalitySignals: [],
        concepts: [],
        summary: '',
        keyInsight: '',
        dimensionCoverage: { skills: false, alignment: false, personality: false },
        evidenceStrength: 0,
        status: 'pending',
        _createdAt: now,
        _processedAt: null
      });
    });
    await batch.commit();
    created += slice.length;
  }
  return created;
}

/**
 * Fetch pending chunks for a signalId (for processing).
 */
async function getPendingChunks(signalId, limit = 5) {
  const snap = await db.collection(COLLECTION)
    .where('signalId', '==', signalId)
    .where('status', '==', 'pending')
    .limit(limit)
    .get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/**
 * Count pending chunks for a signalId.
 */
async function countPendingChunks(signalId) {
  const snap = await db.collection(COLLECTION)
    .where('signalId', '==', signalId)
    .where('status', '==', 'pending')
    .get();
  return snap.size;
}

/**
 * Update a chunk after extraction.
 */
async function updateChunk(docId, fields) {
  await db.collection(COLLECTION).doc(docId).set(
    { ...fields, _processedAt: admin.firestore.FieldValue.serverTimestamp() },
    { merge: true }
  );
}

/**
 * Fetch all processed chunks for a signalId (for synthesis).
 */
async function getAllProcessedChunks(signalId) {
  const snap = await db.collection(COLLECTION)
    .where('signalId', '==', signalId)
    .where('status', '==', 'processed')
    .get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/**
 * Fetch top chunks for a signalId, sorted by evidenceStrength desc.
 * Used at inference time to inject grounding evidence.
 */
async function getTopChunks(signalId, limit = 15) {
  const snap = await db.collection(COLLECTION)
    .where('signalId', '==', signalId)
    .where('status', '==', 'processed')
    .get();

  const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  // Sort by evidenceStrength desc, then date desc
  docs.sort((a, b) => {
    if (b.evidenceStrength !== a.evidenceStrength) return b.evidenceStrength - a.evidenceStrength;
    return new Date(b.date) - new Date(a.date);
  });
  return docs.slice(0, limit);
}

/**
 * Get stats for a signalId.
 */
async function getContextStats(signalId) {
  const snap = await db.collection(COLLECTION)
    .where('signalId', '==', signalId)
    .get();

  let total = 0, processed = 0, pending = 0;
  const bySource = { claude: 0, chatgpt: 0 };

  snap.docs.forEach(d => {
    const data = d.data();
    total++;
    if (data.status === 'processed') processed++;
    if (data.status === 'pending') pending++;
    if (data.source === 'claude') bySource.claude++;
    if (data.source === 'chatgpt') bySource.chatgpt++;
  });

  return { total, processed, pending, bySource };
}

/**
 * Delete all chunks for a signalId.
 */
async function deleteAllChunks(signalId) {
  const snap = await db.collection(COLLECTION)
    .where('signalId', '==', signalId)
    .get();

  if (snap.empty) return 0;

  let deleted = 0;
  for (let i = 0; i < snap.docs.length; i += 500) {
    const batch = db.batch();
    snap.docs.slice(i, i + 500).forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    deleted += Math.min(500, snap.docs.length - i);
  }
  return deleted;
}

module.exports = {
  getExistingConversationIds,
  createPendingChunks,
  getPendingChunks,
  countPendingChunks,
  updateChunk,
  getAllProcessedChunks,
  getTopChunks,
  getContextStats,
  deleteAllChunks
};
