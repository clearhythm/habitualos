require('dotenv').config();
const { query } = require('@habitualos/db-core');
const { getDraftById, updateDraft } = require('./_services/db-agent-drafts.cjs');

/**
 * POST /api/data-fix-migrate-feedback-to-drafts
 *
 * One-time migration: copies feedback from user-feedback collection
 * onto the corresponding agent-draft documents (review field).
 *
 * Safe to run multiple times (skips drafts that already have review data).
 */
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    // Fetch all user-feedback records
    const allFeedback = await query({ collection: 'user-feedback' });
    console.log(`[migrate-feedback] Found ${allFeedback.length} feedback records`);

    const results = { migrated: 0, skipped: 0, errors: [] };

    for (const fb of allFeedback) {
      const draftId = fb.draftId;
      if (!draftId) {
        results.skipped++;
        continue;
      }

      // Check if draft already has review data
      const draft = await getDraftById(draftId);
      if (!draft) {
        results.errors.push({ draftId, reason: 'Draft not found' });
        continue;
      }

      if (draft.review) {
        console.log(`[migrate-feedback] Skipping ${draftId} — already has review`);
        results.skipped++;
        continue;
      }

      // Copy feedback onto the draft as review data
      const derivedStatus = (fb.score >= 5) ? 'accepted' : 'rejected';
      await updateDraft(draftId, {
        status: draft.status === 'pending' ? 'reviewed' : draft.status,
        review: {
          score: fb.score,
          feedback: fb.feedback || '',
          status: fb.status || derivedStatus,
          user_tags: fb.user_tags || [],
          reviewedAt: fb._createdAt?._seconds
            ? new Date(fb._createdAt._seconds * 1000).toISOString()
            : new Date().toISOString()
        }
      });

      console.log(`[migrate-feedback] Migrated feedback to ${draftId} (score: ${fb.score})`);
      results.migrated++;
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, total: allFeedback.length, ...results })
    };

  } catch (error) {
    console.error('[migrate-feedback] ERROR:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: error.message })
    };
  }
};
