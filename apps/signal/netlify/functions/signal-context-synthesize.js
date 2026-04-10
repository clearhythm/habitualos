require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');
const { getOwnerByUserId, updateOwner } = require('./_services/db-signal-owners.cjs');
const { getAllProcessedChunks, getContextStats } = require('./_services/db-signal-context.cjs');
const { resolveApiKey } = require('./_services/crypto.cjs');

/**
 * POST /api/signal-context-synthesize
 *
 * Aggregates all processed chunks into three structured profiles on the owner doc:
 *   - skillsProfile: core skills, domains, technologies, project types
 *   - wantsProfile: what the owner is looking for (extracted from "wants" signals in chunks)
 *   - personalityProfile: weighted strength/edge signals from behavioral observations
 *
 * Also computes a concept co-occurrence graph, dimension completeness scores,
 * and a Claude-generated 3-paragraph narrative (synthesizedContext) stored on the owner doc.
 *
 * Called after signal-context-process finishes all chunks.
 *
 * Body: { userId }
 * Returns: { success, skillsProfile, wantsProfile, personalityProfile, conceptGraph }
 */

function recencyWeight(dateStr) {
  const ageInDays = (Date.now() - new Date(dateStr).getTime()) / 86400000;
  return Math.exp(-ageInDays / 180); // half-life ~180 days
}

function filterByConfidence(scoreMap, sessionCount) {
  // Only keep signals seen in ≥2 sessions
  return Object.fromEntries(
    Object.entries(scoreMap).filter(([signal]) => sessionCount[signal] >= 2)
  );
}

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

    const totalChunks = chunks.length;

    const topN = (scoreMap, n) => Object.entries(scoreMap)
      .sort(([, a], [, b]) => b - a)
      .slice(0, n)
      .map(([k]) => k);

    // ─── Aggregate skills ────────────────────────────────────────────────────────

    const skillScore = {};
    const techScore = {};
    const domainScore = {};
    const projectScore = {};
    const skillSessionCount = {};
    const techSessionCount = {};
    const domainSessionCount = {};
    const projectSessionCount = {};
    let skillsCoverage = 0;

    for (const chunk of chunks) {
      if (chunk.dimensionCoverage?.skills) skillsCoverage++;
      const w = (chunk.evidenceStrength || 3) * recencyWeight(chunk.date || chunk._createdAt);
      for (const s of (chunk.skills || [])) {
        skillScore[s] = (skillScore[s] || 0) + w;
        skillSessionCount[s] = (skillSessionCount[s] || 0) + 1;
      }
      for (const t of (chunk.technologies || [])) {
        techScore[t] = (techScore[t] || 0) + w;
        techSessionCount[t] = (techSessionCount[t] || 0) + 1;
      }
      for (const d of (chunk.topics || [])) {
        domainScore[d] = (domainScore[d] || 0) + w;
        domainSessionCount[d] = (domainSessionCount[d] || 0) + 1;
      }
      for (const p of (chunk.projects || [])) {
        projectScore[p] = (projectScore[p] || 0) + w;
        projectSessionCount[p] = (projectSessionCount[p] || 0) + 1;
      }
    }

    const coreSkills = topN(filterByConfidence(skillScore, skillSessionCount), 15);
    const technologies = topN(filterByConfidence(techScore, techSessionCount), 20);
    const domains = topN(filterByConfidence(domainScore, domainSessionCount), 10);
    const projectTypes = topN(filterByConfidence(projectScore, projectSessionCount), 10);

    const skillSignalMeta = {};
    for (const skill of [...coreSkills, ...technologies]) {
      skillSignalMeta[skill] = {
        sessions: skillSessionCount[skill] || 0,
        confidence: (skillSessionCount[skill] || 0) / totalChunks
      };
    }

    const skillsProfile = {
      coreSkills,
      technologies,
      domains,
      projectTypes,
      signalMeta: skillSignalMeta,
      completeness: Math.min(1, skillsCoverage / totalChunks)
    };

    // ─── Aggregate wants (alignment) ────────────────────────────────────────────

    const wantScore = {};
    const wantSessionCount = {};
    let alignmentCoverage = 0;

    for (const chunk of chunks) {
      if (chunk.dimensionCoverage?.alignment) alignmentCoverage++;
      const w = (chunk.evidenceStrength || 3) * recencyWeight(chunk.date || chunk._createdAt);
      for (const want of (chunk.wants || [])) {
        wantScore[want] = (wantScore[want] || 0) + w;
        wantSessionCount[want] = (wantSessionCount[want] || 0) + 1;
      }
    }

    const topWants = topN(filterByConfidence(wantScore, wantSessionCount), 20);

    const wantSignalMeta = {};
    for (const want of topWants) {
      wantSignalMeta[want] = {
        sessions: wantSessionCount[want] || 0,
        confidence: (wantSessionCount[want] || 0) / totalChunks
      };
    }

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
      signalMeta: wantSignalMeta,
      completeness: Math.min(1, alignmentCoverage / totalChunks)
    };

    // ─── Aggregate personality signals ──────────────────────────────────────────

    const strengthScore = {};
    const edgeScore = {};
    const signalSessionCount = {};
    let personalityCoverage = 0;

    for (const chunk of chunks) {
      if (chunk.dimensionCoverage?.personality) personalityCoverage++;
      const w = (chunk.evidenceStrength || 3) * recencyWeight(chunk.date || chunk._createdAt);
      for (const raw of (chunk.personalitySignals || [])) {
        const signal = typeof raw === 'string' ? raw : raw.signal;
        const polarity = typeof raw === 'string' ? 'strength' : (raw.polarity || 'strength');
        const map = polarity === 'edge' ? edgeScore : strengthScore;
        map[signal] = (map[signal] || 0) + w;
        signalSessionCount[signal] = (signalSessionCount[signal] || 0) + 1;
      }
    }

    const filteredStrength = filterByConfidence(strengthScore, signalSessionCount);
    const filteredEdge = filterByConfidence(edgeScore, signalSessionCount);

    const strengthSignals = topN(filteredStrength, 10);
    const edgeSignals = topN(filteredEdge, 6); // empty array until reflection mode ships

    const signalMeta = {};
    for (const sig of [...strengthSignals, ...edgeSignals]) {
      signalMeta[sig] = {
        sessions: signalSessionCount[sig] || 0,
        confidence: (signalSessionCount[sig] || 0) / totalChunks
      };
    }

    const personalityProfile = {
      strengthSignals,
      edgeSignals,
      signalMeta,
      completeness: Math.min(1, personalityCoverage / totalChunks)
    };

    // ─── Concept co-occurrence graph ─────────────────────────────────────────────

    const coOccurrence = {};
    for (const chunk of chunks) {
      const concepts = (chunk.concepts || []).slice(0, 20);
      concepts.forEach(a => {
        if (!coOccurrence[a]) coOccurrence[a] = {};
        concepts.forEach(b => {
          if (b !== a) coOccurrence[a][b] = (coOccurrence[a][b] || 0) + 1;
        });
      });
    }

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

    // ─── Update owner doc ─────────────────────────────────────────────────────────

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

    // ─── Narrative generation (Part B) ──────────────────────────────────────────

    const signalFingerprint = [
      ...strengthSignals.slice(0, 10),
      ...(coreSkills).slice(0, 10),
      ...(topWants).slice(0, 10)
    ].join('|');
    const newHash = require('crypto').createHash('md5').update(signalFingerprint).digest('hex');
    const needsNarrative = !owner.synthesizedContextHash || owner.synthesizedContextHash !== newHash;

    if (needsNarrative && strengthSignals.length > 0) {
      const apiKey = resolveApiKey(owner);

      if (apiKey) {
        const anthropic = new Anthropic({ apiKey });
        const narrativePrompt = `You are building a behavioral profile for ${owner.displayName} from ${totalChunks} work sessions.

SKILLS (top weighted):
${coreSkills.slice(0, 10).join(', ')}

TECHNOLOGIES:
${technologies.slice(0, 10).join(', ')}

PERSONALITY signals (top weighted, by observed frequency):
${strengthSignals.slice(0, 8).map(s => `• ${s}`).join('\n')}

ALIGNMENT (what they're moving toward):
${topWants.slice(0, 8).join(', ')}

Write exactly three paragraphs:
1. Skills & technical depth — what they've demonstrably built and where they're strongest
2. How they work — behavioral patterns, working style, how they handle friction and decisions
3. Direction — what they're moving toward professionally

Ground every claim in the signal data above. Do not invent anything not supported by the signals. Write in third person. Approximately 100 words per paragraph.`;

        try {
          const narrativeResponse = await anthropic.messages.create({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 600,
            messages: [{ role: 'user', content: narrativePrompt }]
          });

          const synthesizedContext = narrativeResponse.content[0]?.text?.trim().substring(0, 1400) || null;

          if (synthesizedContext) {
            await updateOwner(signalId, {
              synthesizedContext,
              synthesizedContextGeneratedAt: new Date().toISOString(),
              synthesizedContextHash: newHash
            });
          }
        } catch (err) {
          // Narrative generation failure is non-fatal — log and continue
          console.error('[signal-context-synthesize] Narrative generation failed:', err.message);
        }
      }
    }

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
