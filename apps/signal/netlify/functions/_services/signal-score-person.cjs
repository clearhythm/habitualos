'use strict';

/**
 * signal-score-person.cjs
 *
 * Scores the fit between a Signal owner and a prospect contact.
 * Person-to-person scoring — bidirectional, trajectory-aware.
 *
 * Dimensions:
 *   domain overlap       — shared expertise, industries, technologies, topics
 *   trajectory alignment — are they moving toward goals where knowing each other matters?
 *   working style        — personality/style compatibility from available behavioral signals
 *
 * Weights when style is assessable:     domain × 0.40 + trajectory × 0.40 + style × 0.20
 * Weights when style is NOT assessable: domain × 0.50 + trajectory × 0.50
 *   (sparse profiles shouldn't be penalized — style is dropped, not defaulted to neutral)
 *
 * Uses Sonnet 4.6 directly. No distillation step — prospect profiles are
 * already short; Haiku extraction happens upstream in the scraper.
 */

const { buildContextText, buildProfileSection, buildCoverageSection } = require('./signal-init-shared.cjs');

const SCORE_PERSON_PROMPT = ({ ownerContext, contactProfile }) => `You are scoring the professional fit between two people for a potential connection. Score honestly — a 4 is a 4.

== PERSON A (Signal owner) ==
${ownerContext}

== PERSON B (prospect) ==
Name: ${contactProfile.name || 'Unknown'}
Title: ${contactProfile.title || 'not specified'}
Company: ${contactProfile.company || 'not specified'}
Summary: ${contactProfile.summary || 'not available'}
Skills/domains: ${(contactProfile.skills || []).concat(contactProfile.domains || []).join(', ') || 'not specified'}
Trajectory: ${contactProfile.trajectory || 'not specified'}

Score three dimensions (0-10):

- domain: Shared expertise areas, industries, technologies, topics. High score = significant overlap in what they know and work on.

- trajectory: Are they moving in directions that would make a connection mutually generative? About where each person is GOING, not just where they've been. High score = both moving toward goals where knowing each other would matter.

- style: Working style and personality compatibility based on behavioral signals — how they communicate, what they value, their orientation toward work.
  IMPORTANT: Only score this if Person B has enough data to actually assess it (summary text, writing samples, behavioral patterns visible in their profile). If Person B's data is limited to a job title and company name, set styleAssessable to false and style to 0.

Return ONLY valid JSON — no explanation, no markdown:
{
  "domain": 0,
  "trajectory": 0,
  "style": 0,
  "styleAssessable": true,
  "overall": 0,
  "confidence": 0.0,
  "summary": "2-3 sentences on why this match is or isn't interesting — be specific about what overlaps or doesn't",
  "sharedGrounds": ["specific overlapping area 1", "area 2"]
}

overall: set to 0 — computed server-side from dimension scores
styleAssessable: true if style can be meaningfully scored from available data, false if data is too sparse
confidence: 0.0–1.0. Rich profiles on both sides → 0.7+. Sparse prospect (title + company only) → 0.2–0.4. One strong dimension well-evidenced → 0.5–0.6.
sharedGrounds: 2–4 specific things they share — name the actual skill, domain, interest, or trajectory signal, not generic categories.`;

/**
 * Score a prospect contact against a Signal owner.
 *
 * @param {object} params
 * @param {object} params.owner           - Owner record from db-signal-owners
 * @param {object} params.contactProfile  - Extracted prospect profile:
 *   { name, title, company, summary, skills[], domains[], trajectory }
 * @param {object} params.anthropicClient - Initialized Anthropic client
 *
 * @returns {{ domain, trajectory, style, styleAssessable, overall, confidence, summary, sharedGrounds }}
 */
async function scorePersonAgainstOwner({ owner, contactProfile, anthropicClient }) {
  const { skillsProfile, wantsProfile, personalityProfile } = owner;

  const contextText = buildContextText(owner);
  const profileSection = buildProfileSection(owner.displayName, skillsProfile, wantsProfile, personalityProfile, true);
  const coverageSection = buildCoverageSection(skillsProfile, wantsProfile, personalityProfile);
  const ownerContext = [contextText, profileSection, coverageSection].filter(Boolean).join('\n\n');

  const msg = await anthropicClient.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 512,
    messages: [{ role: 'user', content: SCORE_PERSON_PROMPT({ ownerContext, contactProfile }) }],
  });

  const raw = msg.content[0]?.text || '{}';
  const match = raw.match(/\{[\s\S]*\}/);
  const parsed = JSON.parse(match ? match[0] : raw);

  // Compute overall server-side.
  // When style can't be assessed from sparse data, drop it entirely and
  // reweight domain + trajectory proportionally rather than padding with a neutral 5.
  if (parsed.styleAssessable === false) {
    parsed.overall = Math.round((parsed.domain * 0.50) + (parsed.trajectory * 0.50));
  } else {
    parsed.overall = Math.round((parsed.domain * 0.40) + (parsed.trajectory * 0.40) + (parsed.style * 0.20));
  }

  return parsed;
}

module.exports = { scorePersonAgainstOwner };
