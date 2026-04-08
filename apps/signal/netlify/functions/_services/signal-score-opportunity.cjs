'use strict';
/**
 * signal-score-opportunity.cjs
 * Shared scoring pipeline: distill JD → search evidence → evaluate fit.
 * Used by signal-evaluate.js (dashboard) and signal-job-alert-ingest.js (email automation).
 */

const { buildContextText, buildProfileSection, buildCoverageSection } = require('./signal-init-shared.cjs');
const { searchChunks } = require('./db-signal-context.cjs');

const STOPWORDS = new Set([
  'the','a','an','and','or','for','to','in','of','on','is','are','was','were',
  'with','that','this','we','our','you','their','have','be','will','as','at',
  'by','from','it','its','not','but','they','has','had','can','all','your',
  'who','what','how','when','where','which','been','also','more','very'
]);

function extractTerms(text, limit = 25) {
  return [...new Set(
    text.toLowerCase()
      .split(/[\s,;:.()\[\]"'!?\\/\-]+/)
      .filter(t => t.length > 2 && !STOPWORDS.has(t))
  )].slice(0, limit);
}

function buildEvidenceText(chunks) {
  if (!chunks.length) return 'No matching work history evidence found.';
  return chunks.map(c =>
    `[${String(c.date || '').slice(0, 10)}] "${c.title}"\n${c.summary || ''}${c.keyInsight ? `\nKey signal: ${c.keyInsight}` : ''}`
  ).join('\n\n');
}

const JD_DISTILL_PROMPT = (rawJd) => `Extract the signal from this job description. Strip all boilerplate (company history, benefits, EEO, legal text). Return ONLY valid JSON with these fields:

{
  "roleTitle": "exact title from JD",
  "level": "IC level or seniority signal (e.g. Principal, Staff, VP)",
  "responsibilities": ["3-5 core responsibilities, specific and concrete"],
  "mustHave": ["actual hard requirements — years exp, specific skills, domains"],
  "niceToHave": ["preferred but not required"],
  "cultureSignals": ["2-3 inferences about working style, org type, pace"],
  "compensation": "range if listed, else null",
  "workModel": "remote/hybrid/onsite details if listed, else null"
}

Job description:
${rawJd}`;

const EVAL_PROMPT = ({ profileText, evidenceText, opportunity }) => `You are evaluating a professional's fit for an opportunity. Score honestly — a 4 is a 4.

== CANDIDATE PROFILE ==
${profileText}

== RELEVANT WORK EVIDENCE ==
${evidenceText}

== OPPORTUNITY ==
Type: ${opportunity.type}
Title: ${opportunity.title}
${opportunity.content}

Evaluate fit across two dimensions (Personality requires behavioral observation and cannot be scored here):
- Skills (0-10): How well does the candidate's demonstrated experience match what this opportunity requires?
- Alignment (0-10): How well does this opportunity match what the candidate has expressed they want?

Return ONLY valid JSON with exactly these fields:
{
  "score": { "skills": 0, "alignment": 0, "overall": 0 },
  "confidence": 0.0,
  "recommendation": "strong-candidate",
  "strengths": [],
  "gaps": [],
  "summary": "",
  "evidenceUsed": []
}

Field guidance:
- overall: weighted average (skills × 0.55 + alignment × 0.45), rounded to nearest integer
- confidence: 0.0-1.0, based on how much evidence you had on both sides
- recommendation: "strong-candidate" (overall ≥ 8), "worth-applying" (6-7), "stretch" (4-5), "poor-fit" (≤ 3)
- strengths: 2-4 specific statements about genuine overlap (cite evidence by title where possible)
- gaps: array of objects — only real gaps, be direct
  Each: { "dimension": "skills|alignment", "gap": "...", "severity": "low|moderate|high", "closeable": true, "framing": "honest reframe if closeable" }
  Omit "framing" if closeable is false
- summary: 2-3 direct sentences for the candidate — what they should know before applying
- evidenceUsed: array of "[YYYY-MM-DD] title" strings for chunks that informed scoring`;

/**
 * Score one opportunity against an owner's profile.
 *
 * @param {object} params
 * @param {object} params.owner - Owner record from db-signal-owners
 * @param {object} params.opportunity - { title, type, content, url }
 * @param {object} params.anthropicClient - Initialized Anthropic client
 * @param {object} [params.jdSummary] - Pre-distilled JD summary (skip distill step if provided)
 * @param {string} [params.distilledContent] - Pre-distilled content string (skip distill step if provided)
 *
 * @returns {{ jdSummary, distilledContent, opportunityForPrompt, chunks, parsed }}
 */
async function scoreOpportunity({ owner, opportunity, anthropicClient, jdSummary: preJdSummary, distilledContent: preDistilled }) {
  const { skillsProfile, wantsProfile, personalityProfile } = owner;
  const signalId = owner.id;
  const rawContent = String(opportunity.content || '').slice(0, 8000);

  let jdSummary = preJdSummary || null;
  let distilledContent = preDistilled || rawContent;

  if (!preDistilled) {
    try {
      const distillMsg = await anthropicClient.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 512,
        messages: [{ role: 'user', content: JD_DISTILL_PROMPT(rawContent) }]
      });
      const distillRaw = distillMsg.content[0]?.text || '{}';
      const distillMatch = distillRaw.match(/\{[\s\S]*\}/);
      jdSummary = JSON.parse(distillMatch ? distillMatch[0] : distillRaw);
      distilledContent = [
        `Role: ${jdSummary.roleTitle} (${jdSummary.level || 'unspecified level'})`,
        jdSummary.responsibilities?.length ? `Responsibilities:\n${jdSummary.responsibilities.map(r => `- ${r}`).join('\n')}` : '',
        jdSummary.mustHave?.length ? `Must have:\n${jdSummary.mustHave.map(r => `- ${r}`).join('\n')}` : '',
        jdSummary.niceToHave?.length ? `Nice to have:\n${jdSummary.niceToHave.map(r => `- ${r}`).join('\n')}` : '',
        jdSummary.cultureSignals?.length ? `Culture signals:\n${jdSummary.cultureSignals.map(r => `- ${r}`).join('\n')}` : '',
        jdSummary.compensation ? `Compensation: ${jdSummary.compensation}` : '',
        jdSummary.workModel ? `Work model: ${jdSummary.workModel}` : '',
      ].filter(Boolean).join('\n\n');
    } catch (err) {
      console.warn('[signal-score-opportunity] JD distillation failed, using raw:', err.message);
    }
  }

  // Search for relevant evidence chunks
  const opportunityText = `${opportunity.title || ''} ${distilledContent}`;
  const terms = extractTerms(opportunityText);
  const chunks = terms.length ? await searchChunks(signalId, terms, 8).catch(() => []) : [];

  // Build profile text
  const profileSection = buildProfileSection(owner.displayName, skillsProfile, wantsProfile, personalityProfile);
  const coverageSection = buildCoverageSection(skillsProfile, wantsProfile, personalityProfile);
  const profileText = [buildContextText(owner), profileSection, coverageSection].filter(Boolean).join('\n\n');
  const evidenceText = buildEvidenceText(chunks);

  const opportunityForPrompt = {
    type: opportunity.type || 'free-text',
    title: (() => {
      if (opportunity.title?.trim()) return opportunity.title.trim();
      const firstLine = rawContent.split('\n').map(l => l.trim()).find(l => l.length > 0) || '';
      if (firstLine.length > 0 && firstLine.length < 100 && !/[.!?]$/.test(firstLine)) return firstLine;
      return jdSummary?.roleTitle || 'Untitled';
    })(),
    content: distilledContent
  };

  const msg = await anthropicClient.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    messages: [{ role: 'user', content: EVAL_PROMPT({ profileText, evidenceText, opportunity: opportunityForPrompt }) }]
  });

  const raw = msg.content[0]?.text || '{}';
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw);

  // Normalise score
  if (parsed.score) {
    parsed.score.personality = null;
    parsed.score.confidence = parsed.confidence || 0;
    parsed.score.overall = Math.round((parsed.score.skills * 0.55) + (parsed.score.alignment * 0.45));
  }

  return { jdSummary, distilledContent, opportunityForPrompt, chunks, parsed };
}

module.exports = { scoreOpportunity };
