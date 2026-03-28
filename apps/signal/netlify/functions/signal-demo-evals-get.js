require('dotenv').config();
const { db } = require('@habitualos/db-core');
const { getOwnerBySignalId } = require('./_services/db-signal-owners.cjs');

/**
 * GET /api/signal-demo-evals-get
 *
 * Public endpoint — no auth required.
 * Returns all demo evaluations (demo: true) grouped by role title,
 * plus public profile data for both demo characters (spock, data-tng).
 */

const DEMO_SIGNAL_IDS = ['spock', 'data-tng'];

function buildProfile(owner) {
  if (!owner) return null;
  return {
    displayName: owner.displayName,
    tagline: owner.tagline || '',
    synthesizedContext: owner.synthesizedContext || '',
    skillsProfile: {
      coreSkills: owner.skillsProfile?.coreSkills || [],
      technologies: owner.skillsProfile?.technologies || [],
      domains: owner.skillsProfile?.domains || []
    },
    personalityProfile: {
      strengthSignals: owner.personalityProfile?.strengthSignals || []
    }
  };
}

exports.handler = async (event) => {
  const method = event.httpMethod;
  if (method === 'OPTIONS') {
    return { statusCode: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type' }, body: '' };
  }
  if (method !== 'GET' && method !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ success: false, error: 'Method not allowed' }) };
  }

  try {
    const [evalsSnap, spockOwner, dataOwner] = await Promise.all([
      db.collection('signal-evaluations').where('demo', '==', true).get(),
      getOwnerBySignalId('spock'),
      getOwnerBySignalId('data-tng')
    ]);

    const evalsByRole = {};
    for (const doc of evalsSnap.docs) {
      const data = doc.data();
      if (!DEMO_SIGNAL_IDS.includes(data._signalId)) continue;

      const role = data.opportunity?.title || 'Unknown';
      if (!evalsByRole[role]) evalsByRole[role] = {};

      evalsByRole[role][data._signalId] = {
        evalId: data._evalId,
        score: data.score || {},
        recommendation: data.recommendation || '',
        summary: data.summary || '',
        evidenceFor: data.evidenceFor || [],
        evidenceAgainst: data.evidenceAgainst || [],
        evidenceChunks: (data.evidenceChunks || []).slice(0, 4),
        evidenceUsed: data.evidenceUsed || []
      };
    }

    const ROLE_ORDER = [
      'Starship Captain',
      'Senior Software Engineer',
      'Crisis Negotiator',
      'Counselor',
      'Chief Technology Officer',
      'Stand-up Comedian'
    ];
    const roles = ROLE_ORDER.filter(r => evalsByRole[r]);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=300'
      },
      body: JSON.stringify({
        success: true,
        profiles: {
          spock: buildProfile(spockOwner),
          'data-tng': buildProfile(dataOwner)
        },
        evalsByRole,
        roles
      })
    };

  } catch (error) {
    console.error('[signal-demo-evals-get] ERROR:', error);
    return { statusCode: 500, body: JSON.stringify({ success: false, error: 'Internal server error' }) };
  }
};
