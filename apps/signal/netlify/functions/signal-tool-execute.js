require('dotenv').config();
const { searchChunks } = require('./_services/db-signal-context.cjs');
const { getOwnerBySignalId, updateOwner } = require('./_services/db-signal-owners.cjs');

const STOPWORDS = new Set(['the','a','an','and','or','for','to','in','of','on','is','are','was','were','with','that','this']);

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
    const { signalId, toolUse } = JSON.parse(event.body);
    const { name, input } = toolUse;

    // show_evaluation is rendered client-side; server just acknowledges
    if (name === 'show_evaluation') {
      return {
        statusCode: 200,
        headers: { ...CORS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ result: { ok: true } })
      };
    }

    if (name === 'update_fit_score') {
      const { skills, alignment, personality, overall, confidence, reason, nextStep } = input;
      return {
        statusCode: 200,
        headers: { ...CORS, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          result: {
            ok: true,
            scores: { skills, alignment, personality, overall, confidence },
            reason: reason || null,
            nextStep: nextStep || null
          }
        })
      };
    }

    if (name === 'search_work_history') {
      const rawQuery = String(input.query || '').slice(0, 200);
      const terms = rawQuery
        .toLowerCase()
        .split(/[\s,;:]+/)
        .filter(t => t.length > 2 && !STOPWORDS.has(t));

      if (!signalId || !terms.length) {
        return {
          statusCode: 200,
          headers: { ...CORS, 'Content-Type': 'application/json' },
          body: JSON.stringify({ result: { chunks: [], found: 0, message: 'No results' } })
        };
      }

      const chunks = await searchChunks(signalId, terms, 5);

      const result = {
        query: rawQuery,
        found: chunks.length,
        chunks: chunks.map(c => ({
          date: String(c.date || '').slice(0, 10),
          title: c.title,
          summary: c.summary,
          keyInsight: c.keyInsight,
          evidenceStrength: c.evidenceStrength,
          skills: (c.skills || []).slice(0, 8),
          topics: (c.topics || []).slice(0, 5)
        }))
      };

      return {
        statusCode: 200,
        headers: { ...CORS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ result })
      };
    }

    if (name === 'save_preference_update') {
      if (!signalId) {
        return {
          statusCode: 200,
          headers: { ...CORS, 'Content-Type': 'application/json' },
          body: JSON.stringify({ result: { error: 'signalId required to save preferences' } })
        };
      }

      const owner = await getOwnerBySignalId(signalId);
      if (!owner) {
        return {
          statusCode: 200,
          headers: { ...CORS, 'Content-Type': 'application/json' },
          body: JSON.stringify({ result: { error: 'Owner not found' } })
        };
      }

      const current = owner.wantsProfile || {};
      const patch = {};

      if (input.addOpportunities?.length) {
        patch['wantsProfile.opportunities'] = [...new Set([...(current.opportunities || []), ...input.addOpportunities])];
      }
      if (input.addExcitedBy?.length) {
        patch['wantsProfile.excitedBy'] = [...new Set([...(current.excitedBy || []), ...input.addExcitedBy])];
      }
      if (input.addNotLookingFor?.length) {
        patch['wantsProfile.notLookingFor'] = [...new Set([...(current.notLookingFor || []), ...input.addNotLookingFor])];
      }
      if (input.workStyle) {
        patch['wantsProfile.workStyle'] = input.workStyle;
      }
      if (input.feedbackNote) {
        const existing = owner.preferenceFeedback || [];
        patch['preferenceFeedback'] = [...existing, { note: input.feedbackNote, date: new Date().toISOString() }];
      }

      if (Object.keys(patch).length === 0) {
        return {
          statusCode: 200,
          headers: { ...CORS, 'Content-Type': 'application/json' },
          body: JSON.stringify({ result: { ok: true, updated: [], message: 'No changes to save' } })
        };
      }

      await updateOwner(signalId, patch);

      return {
        statusCode: 200,
        headers: { ...CORS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ result: { ok: true, updated: Object.keys(patch) } })
      };
    }

    return {
      statusCode: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ result: { error: `Unknown tool: ${name}` } })
    };

  } catch (error) {
    console.error('[signal-tool-execute] ERROR:', error);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ success: false, error: 'Internal server error' }) };
  }
};
