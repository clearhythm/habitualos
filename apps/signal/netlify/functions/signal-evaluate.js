require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');
const { db, admin } = require('@habitualos/db-core');
const { getOwnerByUserId } = require('./_services/db-signal-owners.cjs');
const { decrypt } = require('./_services/crypto.cjs');
const { searchChunks } = require('./_services/db-signal-context.cjs');

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

function buildProfileText(owner) {
  const { skillsProfile, wantsProfile, personalityProfile } = owner;
  const sections = [];

  // Primary sources: LinkedIn and contextText (always present even before synthesis)
  const linkedin = owner.sources?.linkedin || '';
  const contextText = owner.contextText || '';
  if (linkedin) sections.push(`== LINKEDIN PROFILE ==\n${linkedin.slice(0, 6000)}`);
  if (contextText) sections.push(`== ADDITIONAL CONTEXT ==\n${contextText.slice(0, 3000)}`);

  // Synthesized profiles (populated after conversation upload)
  const synthesized = [];
  if (skillsProfile) {
    if (skillsProfile.coreSkills?.length) synthesized.push(`Skills: ${skillsProfile.coreSkills.join(', ')}`);
    if (skillsProfile.domains?.length) synthesized.push(`Domains: ${skillsProfile.domains.join(', ')}`);
    if (skillsProfile.technologies?.length) synthesized.push(`Stack: ${skillsProfile.technologies.join(', ')}`);
    if (skillsProfile.projectTypes?.length) synthesized.push(`Project types: ${skillsProfile.projectTypes.join(', ')}`);
  }
  if (wantsProfile) {
    if (wantsProfile.opportunities?.length) synthesized.push(`Open to: ${wantsProfile.opportunities.join(', ')}`);
    if (wantsProfile.excitedBy?.length) synthesized.push(`Excited by: ${wantsProfile.excitedBy.join(', ')}`);
    if (wantsProfile.workStyle) synthesized.push(`Work style: ${wantsProfile.workStyle}`);
    if (wantsProfile.notLookingFor?.length) synthesized.push(`Not looking for: ${wantsProfile.notLookingFor.join(', ')}`);
  }
  if (personalityProfile) {
    if (personalityProfile.communicationStyle) synthesized.push(`Communication: ${personalityProfile.communicationStyle}`);
    if (personalityProfile.intellectualStyle) synthesized.push(`Intellectual style: ${personalityProfile.intellectualStyle}`);
  }
  if (synthesized.length) sections.push(`== SYNTHESIZED PROFILE ==\n${synthesized.join('\n')}`);

  return sections.length ? sections.join('\n\n') : 'No profile data available.';
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

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ success: false, error: 'Method not allowed' }) };
  }

  try {
    const { userId, opportunity } = JSON.parse(event.body);

    if (!userId || !userId.startsWith('u-')) {
      return { statusCode: 400, body: JSON.stringify({ success: false, error: 'Valid userId required' }) };
    }
    if (!opportunity?.content?.trim()) {
      return { statusCode: 400, body: JSON.stringify({ success: false, error: 'opportunity.content required' }) };
    }

    const owner = await getOwnerByUserId(userId);
    if (!owner || owner.status !== 'active') {
      return { statusCode: 403, body: JSON.stringify({ success: false, error: 'Owner not found or inactive' }) };
    }

    const signalId = owner.id;
    const { skillsProfile, wantsProfile, personalityProfile } = owner;

    let apiKey = process.env.ANTHROPIC_API_KEY;
    if (owner.anthropicApiKey) {
      try { apiKey = decrypt(owner.anthropicApiKey); } catch (_) {}
    }
    if (!apiKey) {
      return { statusCode: 500, body: JSON.stringify({ success: false, error: 'No Anthropic API key configured' }) };
    }

    const client = new Anthropic({ apiKey });
    const rawContent = String(opportunity.content).slice(0, 8000);

    // Step 1: Distill the JD — strip boilerplate, extract signal
    let jdSummary = null;
    let distilledContent = rawContent;
    try {
      const distillMsg = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 512,
        messages: [{ role: 'user', content: JD_DISTILL_PROMPT(rawContent) }]
      });
      const distillRaw = distillMsg.content[0]?.text || '{}';
      const distillMatch = distillRaw.match(/\{[\s\S]*\}/);
      jdSummary = JSON.parse(distillMatch ? distillMatch[0] : distillRaw);
      // Flatten distilled JD for scoring prompt
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
      console.warn('[signal-evaluate] JD distillation failed, using raw:', err.message);
    }

    // Step 2: Search for relevant evidence chunks
    const opportunityText = `${opportunity.title || ''} ${distilledContent}`;
    const terms = extractTerms(opportunityText);
    const chunks = terms.length ? await searchChunks(signalId, terms, 8).catch(() => []) : [];

    // Step 3: Score
    const profileText = buildProfileText(owner);
    const evidenceText = buildEvidenceText(chunks);
    const opportunityForPrompt = {
      type: opportunity.type || 'free-text',
      title: jdSummary?.roleTitle || String(opportunity.title || 'Untitled').slice(0, 200),
      content: distilledContent
    };

    const msg = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{ role: 'user', content: EVAL_PROMPT({ profileText, evidenceText, opportunity: opportunityForPrompt }) }]
    });

    const raw = msg.content[0]?.text || '{}';
    let parsed;
    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
    } catch {
      console.error('[signal-evaluate] JSON parse failed:', raw);
      return { statusCode: 500, body: JSON.stringify({ success: false, error: 'Failed to parse evaluation response' }) };
    }

    // Ensure overall is an integer
    if (parsed.score) {
      parsed.score.overall = Math.round((parsed.score.skills * 0.55) + (parsed.score.alignment * 0.45));
    }

    // Store evaluation
    const evalId = `eval-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    await db.collection('signal-evaluations').doc(evalId).set({
      evalId,
      signalId,
      userId,
      opportunity: {
        type: opportunityForPrompt.type,
        title: opportunityForPrompt.title,
        content: opportunityForPrompt.content,
        url: String(opportunity.url || '').slice(0, 500)
      },
      jdSummary: jdSummary || null,
      score: parsed.score || {},
      confidence: parsed.confidence || 0,
      recommendation: parsed.recommendation || '',
      strengths: parsed.strengths || [],
      gaps: parsed.gaps || [],
      summary: parsed.summary || '',
      evidenceUsed: parsed.evidenceUsed || [],
      resumeGenerated: false,
      coverLetterGenerated: false,
      _createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, evaluationId: evalId, jdSummary, ...parsed })
    };

  } catch (error) {
    console.error('[signal-evaluate] ERROR:', error);
    return { statusCode: 500, body: JSON.stringify({ success: false, error: 'Internal server error' }) };
  }
};
