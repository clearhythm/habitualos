/**
 * POST /api/reconciler-run
 *
 * Triggers draft reconciliation - converts reviewed drafts into markdown files.
 * Only works in local mode (APP_ENV=local) since Netlify has read-only filesystem.
 *
 * Request body (optional):
 *   { userId: "u-..." }  // Filter to specific user
 *
 * Response:
 *   {
 *     success: true,
 *     committed: 3,
 *     skipped: 1,
 *     errors: 0,
 *     details: [...]
 *   }
 */

const { reconcile } = require('./_utils/draft-reconciler.cjs');

exports.handler = async (event) => {
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ success: false, error: 'Method not allowed' })
    };
  }

  try {
    // Parse optional body
    let userId = null;
    if (event.body) {
      try {
        const body = JSON.parse(event.body);
        userId = body.userId || null;
      } catch {
        // Ignore parse errors, proceed without userId filter
      }
    }

    console.log(`[reconciler-run] Starting reconciliation${userId ? ` for user ${userId}` : ''}`);

    // Run reconciliation
    const results = await reconcile({ userId });

    console.log(`[reconciler-run] Complete:`, results);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        ...results
      })
    };

  } catch (err) {
    console.error('[reconciler-run] Error:', err);

    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        error: err.message
      })
    };
  }
};
