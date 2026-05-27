require('dotenv').config();
const { db } = require('@habitualos/db-core');
const { getOwnerBySignalId } = require('./_services/db-signal-owners.cjs');

/**
 * GET /api/signal-demo-evals-get?demo=<demoId>
 *
 * Public endpoint — no auth required.
 * Returns demo evaluations grouped by role, plus public profile data
 * for the two characters in the requested demo.
 *
 * demoId defaults to 'spock-vs-data'.
 */

const DEMO_CONFIG = {
  'spock-vs-data': {
    signalIds: ['spock', 'data'],
    roleOrder: [
      'Starship Captain',
      'Senior Software Engineer',
      'Crisis Negotiator',
      'Counselor',
      'Chief Technology Officer',
      'Stand-up Comedian'
    ]
  },
  'kirk-vs-data': {
    signalIds: ['kirk', 'data'],
    roleOrder: [
      'Starship Captain',
      'Science Officer',
      'Startup Founder',
      'Chief Technology Officer',
      'Venture Capitalist',
      'Baby Nanny'
    ]
  }
};

function buildProfile(owner) {
  if (!owner) return null;
  return {
    displayName: owner.displayName,
    nickname: owner.nickname || null,
    avatarUrl: owner.avatarUrl || null,
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

  const demoId = event.queryStringParameters?.demo || 'spock-vs-data';
  const config = DEMO_CONFIG[demoId] || DEMO_CONFIG['spock-vs-data'];
  const { signalIds, roleOrder } = config;

  try {
    const [evalsSnap, ...ownerDocs] = await Promise.all([
      db.collection('signal-evaluations')
        .where('demo', '==', true)
        .where('demoId', '==', demoId)
        .get(),
      ...signalIds.map(id => getOwnerBySignalId(id))
    ]);

    const profiles = {};
    signalIds.forEach((id, i) => {
      profiles[id] = buildProfile(ownerDocs[i]);
    });

    const evalsByRole = {};
    for (const doc of evalsSnap.docs) {
      const data = doc.data();
      if (!signalIds.includes(data._signalId)) continue;

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

    const roles = roleOrder.filter(r => evalsByRole[r]);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=3600'
      },
      body: JSON.stringify({ success: true, profiles, evalsByRole, roles })
    };

  } catch (error) {
    console.error('[signal-demo-evals-get] ERROR:', error);
    return { statusCode: 500, body: JSON.stringify({ success: false, error: 'Internal server error' }) };
  }
};
