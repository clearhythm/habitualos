require('dotenv').config();
const { getOwnerByUserId, updateOwner } = require('./_services/db-signal-owners.cjs');
const { getAllProcessedChunks, getContextStats } = require('./_services/db-signal-context.cjs');

/**
 * POST /api/signal-context-synthesize
 *
 * Aggregates all processed chunks into three structured profiles on the owner doc:
 *   - skillsProfile: core skills, domains, technologies, project types
 *   - wantsProfile: what the owner is looking for (extracted from "wants" signals in chunks)
 *   - personalityProfile: communication/intellectual style from behavioural signals
 *
 * Also computes a concept co-occurrence graph and dimension completeness scores.
 *
 * Called after signal-context-process finishes all chunks.
 *
 * Body: { userId }
 * Returns: { success, skillsProfile, wantsProfile, personalityProfile, conceptGraph }
 */
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ success: false, error: 'Method not allowed' }) };
  }

  try {
    const { userId } = JSON.parse(event.body);

    if (!userId || !userId.startsWith('u-')) {
      return { statusCode: 400, body: JSON.stringify({ success: false, error: 'Valid userId required' }) };
    }

    const owner = await getOwnerByUserId(userId);
    if (!owner || owner.status !== 'active') {
      return { statusCode: 403, body: JSON.stringify({ success: false, error: 'Owner not found or not active' }) };
    }

    const signalId = owner.id;
    const chunks = await getAllProcessedChunks(signalId);

    if (chunks.length === 0) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: true, message: 'No processed chunks to synthesize' })
      };
    }

    // ─── Aggregate skills ────────────────────────────────────────────────────────

    const skillFreq = {};
    const techFreq = {};
    const domainFreq = {};
    const projectFreq = {};
    let skillsCoverage = 0;

    chunks.forEach(c => {
      if (c.dimensionCoverage?.skills) skillsCoverage++;
      (c.skills || []).forEach(s => { skillFreq[s] = (skillFreq[s] || 0) + 1; });
      (c.technologies || []).forEach(t => { techFreq[t] = (techFreq[t] || 0) + 1; });
      (c.topics || []).forEach(d => { domainFreq[d] = (domainFreq[d] || 0) + 1; });
      (c.projects || []).forEach(p => { projectFreq[p] = (projectFreq[p] || 0) + 1; });
    });

    const topN = (freq, n) => Object.entries(freq)
      .sort(([, a], [, b]) => b - a)
      .slice(0, n)
      .map(([k]) => k);

    const skillsProfile = {
      coreSkills: topN(skillFreq, 15),
      technologies: topN(techFreq, 20),
      domains: topN(domainFreq, 10),
      projectTypes: topN(projectFreq, 10),
      completeness: Math.min(1, skillsCoverage / chunks.length)
    };

    // ─── Aggregate wants (alignment) ────────────────────────────────────────────

    const allWants = [];
    let alignmentCoverage = 0;

    chunks.forEach(c => {
      if (c.dimensionCoverage?.alignment) alignmentCoverage++;
      (c.wants || []).forEach(w => allWants.push(w));
    });

    // Deduplicate and group wants into categories
    const wantsFreq = {};
    allWants.forEach(w => { wantsFreq[w] = (wantsFreq[w] || 0) + 1; });
    const topWants = topN(wantsFreq, 20);

    const wantsProfile = {
      workTypes: (owner.wantsProfile?.workTypes || []).length
        ? owner.wantsProfile.workTypes
        : topWants.filter(w => /product|engineer|design|lead|build|create|develop/i.test(w)).slice(0, 8),
      opportunities: owner.wantsProfile?.opportunities || [],
      excitedBy: topWants.filter(w => /excit|love|passion|interest|curious/i.test(w)).slice(0, 8),
      workStyle: owner.wantsProfile?.workStyle || '',
      openTo: owner.wantsProfile?.openTo || [],
      notLookingFor: owner.wantsProfile?.notLookingFor || [],
      rawWants: topWants,
      completeness: Math.min(1, alignmentCoverage / chunks.length)
    };

    // ─── Aggregate personality signals ──────────────────────────────────────────

    const sigFreq = {};
    let personalityCoverage = 0;

    chunks.forEach(c => {
      if (c.dimensionCoverage?.personality) personalityCoverage++;
      (c.personalitySignals || []).forEach(s => { sigFreq[s] = (sigFreq[s] || 0) + 1; });
    });

    const topSignals = topN(sigFreq, 15);

    // Derive summary descriptors from signals
    const is = (patterns) => topSignals.some(s => patterns.some(p => s.toLowerCase().includes(p)));
    const communicationStyle = [
      is(['direct', 'concise', 'terse', 'precise']) ? 'direct' : null,
      is(['warm', 'collaborative', 'supportive']) ? 'warm' : null,
      is(['detailed', 'thorough', 'comprehensive']) ? 'thorough' : null,
      is(['exploratory', 'open-ended', 'curious']) ? 'exploratory' : null
    ].filter(Boolean).join(', ') || 'varies by context';

    const intellectualStyle = [
      is(['first-principles', 'fundamental', 'from scratch']) ? 'first-principles thinker' : null,
      is(['systems', 'architecture', 'structural']) ? 'systems thinker' : null,
      is(['empirical', 'data', 'evidence']) ? 'empirical' : null,
      is(['creative', 'novel', 'innovative']) ? 'creative problem-solver' : null
    ].filter(Boolean).join(', ') || 'pragmatic';

    const personalityProfile = {
      communicationStyle,
      intellectualStyle,
      problemApproach: topSignals.slice(0, 5).join('; '),
      rawSignals: topSignals,
      completeness: Math.min(1, personalityCoverage / chunks.length)
    };

    // ─── Concept co-occurrence graph ────────────────────────────────────────────

    const coOccurrence = {};
    chunks.forEach(c => {
      const concepts = (c.concepts || []).slice(0, 20);
      concepts.forEach(a => {
        if (!coOccurrence[a]) coOccurrence[a] = {};
        concepts.forEach(b => {
          if (b !== a) coOccurrence[a][b] = (coOccurrence[a][b] || 0) + 1;
        });
      });
    });

    // Keep top 50 concepts × top 5 neighbors
    const conceptGraph = {};
    Object.entries(coOccurrence)
      .map(([c, neighbors]) => ({ c, total: Object.values(neighbors).reduce((s, v) => s + v, 0), neighbors }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 50)
      .forEach(({ c, neighbors }) => {
        conceptGraph[c] = Object.entries(neighbors)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 5)
          .map(([k]) => k);
      });

    // ─── Update owner doc ────────────────────────────────────────────────────────

    const stats = await getContextStats(signalId);

    await updateOwner(signalId, {
      skillsProfile,
      wantsProfile,
      personalityProfile,
      'contextStats.totalChunks': stats.total,
      'contextStats.processedChunks': stats.processed,
      'contextStats.bySource': stats.bySource,
      'contextStats.conceptGraph': conceptGraph
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        chunksProcessed: chunks.length,
        skillsProfile,
        wantsProfile,
        personalityProfile,
        conceptGraph
      })
    };

  } catch (error) {
    console.error('[signal-context-synthesize] ERROR:', error);
    return { statusCode: 500, body: JSON.stringify({ success: false, error: 'Internal server error' }) };
  }
};
