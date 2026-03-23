require('dotenv').config();
const { getOwnerByUserId, updateOwner } = require('./_services/db-signal-owners.cjs');
const { encrypt } = require('./_services/crypto.cjs');

const MAX_PERSONAS = 4;

/**
 * POST /api/signal-config-set
 *
 * Body: { userId, patch: { displayName?, personas?, contextText?, anthropicApiKey? } }
 *
 * Only the owner (matched by userId) can update their config.
 * API key is encrypted before storing.
 */
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ success: false, error: 'Method not allowed' }) };
  }

  try {
    const { userId, patch } = JSON.parse(event.body);

    if (!userId || !userId.startsWith('u-')) {
      return { statusCode: 400, body: JSON.stringify({ success: false, error: 'Valid userId required' }) };
    }
    if (!patch || typeof patch !== 'object') {
      return { statusCode: 400, body: JSON.stringify({ success: false, error: 'patch object required' }) };
    }

    // Verify ownership
    const owner = await getOwnerByUserId(userId);
    if (!owner) {
      return { statusCode: 403, body: JSON.stringify({ success: false, error: 'No Signal found for this user' }) };
    }

    const update = {};

    if (patch.displayName !== undefined) {
      if (!patch.displayName || patch.displayName.trim().length < 2) {
        return { statusCode: 400, body: JSON.stringify({ success: false, error: 'Display name must be at least 2 characters' }) };
      }
      update.displayName = patch.displayName.trim();
    }

    if (patch.contextText !== undefined) {
      update.contextText = String(patch.contextText).slice(0, 20000);
    }

    if (patch.sources !== undefined) {
      if (typeof patch.sources !== 'object') {
        return { statusCode: 400, body: JSON.stringify({ success: false, error: 'sources must be an object' }) };
      }
      if (patch.sources.linkedin !== undefined) {
        update['sources.linkedin'] = String(patch.sources.linkedin).slice(0, 30000);
        update['sources.linkedinUpdatedAt'] = new Date().toISOString();
      }
      if (patch.sources.resume !== undefined) {
        update['sources.resume'] = String(patch.sources.resume).slice(0, 30000);
        update['sources.resumeUpdatedAt'] = new Date().toISOString();
      }
    }

    if (patch.personas !== undefined) {
      if (!Array.isArray(patch.personas) || patch.personas.length === 0 || patch.personas.length > MAX_PERSONAS) {
        return { statusCode: 400, body: JSON.stringify({ success: false, error: `personas must be 1–${MAX_PERSONAS} items` }) };
      }
      // Validate each persona
      for (const p of patch.personas) {
        if (!p.key || !p.label || !p.opener) {
          return { statusCode: 400, body: JSON.stringify({ success: false, error: 'Each persona needs key, label, and opener' }) };
        }
      }
      update.personas = patch.personas.map(p => ({
        key: String(p.key).slice(0, 32),
        label: String(p.label).slice(0, 64),
        opener: String(p.opener).slice(0, 500)
      }));
    }

    if (patch.anthropicApiKey !== undefined) {
      const key = String(patch.anthropicApiKey).trim();
      if (key && !key.startsWith('sk-ant-')) {
        return { statusCode: 400, body: JSON.stringify({ success: false, error: 'Anthropic API key must start with sk-ant-' }) };
      }
      update.anthropicApiKey = key ? encrypt(key) : '';
    }

    await updateOwner(owner.signalId, update);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true })
    };

  } catch (error) {
    console.error('[signal-config-set] ERROR:', error);
    return { statusCode: 500, body: JSON.stringify({ success: false, error: 'Internal server error' }) };
  }
};
