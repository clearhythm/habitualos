/**
 * Precompute Kirk vs Data evaluations for 7 roles.
 *
 * Calls Anthropic and Firestore directly — no HTTP endpoint, no lambda timeout.
 *
 * Usage:
 *   node scripts/demo/precompute-kirk-data.cjs [--dry-run] [--role "Role Name"]
 *
 * Requires seed-kirk-data.cjs to have run first (Kirk owner + chunks).
 * Data owner already exists from seed-spock-data.cjs.
 * Results stored in Firestore with demo: true, demoId: 'kirk-vs-data'.
 * Eval IDs logged to scripts/demo/precomputed-eval-ids-kirk-data.json.
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');
const { db, admin } = require('@habitualos/db-core');
const { getOwnerBySignalId } = require('../../netlify/functions/_services/db-signal-owners.cjs');
const { searchChunks } = require('../../netlify/functions/_services/db-signal-context.cjs');
const { buildContextText, buildProfileSection, buildCoverageSection } = require('../../netlify/functions/_services/signal-init-shared.cjs');

const DRY_RUN = process.argv.includes('--dry-run');
const ROLE_FILTER = (() => {
  const i = process.argv.indexOf('--role');
  return i !== -1 ? process.argv[i + 1]?.toLowerCase() : null;
})();

// ─── Shared eval logic (mirrors precompute-spock-data.cjs) ────────────────────

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

const EVAL_PROMPT = ({ profileText, evidenceText, opportunity }) =>
`You are evaluating a professional's fit for an opportunity. Use the full scale aggressively. If the candidate's demonstrated skills clearly match what the role requires, that is an 8 or 9, not a 7. A 7 means "decent but with real gaps." Reserve 5-6 for genuinely mixed cases. Do not penalize for limited evidence volume: score based on the quality of the match, not the quantity of proof. A 10 requires overwhelming evidence with no meaningful concerns or gaps. If any real risk, failure mode, or friction exists in the record, score 9.

Write all prose without em dashes. Use commas, colons, semicolons, or new sentences instead.

== CANDIDATE PROFILE ==
${profileText}

== RELEVANT WORK EVIDENCE ==
${evidenceText}

== OPPORTUNITY ==
Type: ${opportunity.type}
Title: ${opportunity.title}
${opportunity.content}

Evaluate fit across three dimensions:
- Skills (0-10): How well does the candidate's demonstrated experience match what this opportunity requires?
- Alignment (0-10): How well does this opportunity match what the candidate has expressed they want?
- Personality (0-10): Based on the behavioral signals in the profile (communication style, how they handle pressure, decision-making patterns), how well does this person's *way of working* fit what this role demands?

Return ONLY valid JSON with exactly these fields:
{
  "score": { "skills": 0, "alignment": 0, "personality": 0, "overall": 0 },
  "confidence": 0.0,
  "recommendation": "strong-candidate",
  "summary": "",
  "evidenceFor": [],
  "evidenceAgainst": [],
  "evidenceUsed": []
}

Field guidance:
- overall: weighted average (skills × 0.4 + alignment × 0.35 + personality × 0.25), rounded to nearest integer
- confidence: 0.0-1.0, based on how much evidence you had on both sides
- recommendation: "strong-candidate" (overall 9-10), "worth-applying" (overall 7-8), "stretch" (overall 5-6), "questionable-fit" (overall 3-4), "poor-fit" (overall ≤ 2)
- summary: 2-3 sentences about this candidate in third person — refer to them by name (Kirk, Data), not "you." A hiring manager's honest take on fit
- evidenceFor: 2-3 items — specific work sessions that support this candidate for this role
  Each: { "title": "exact session title from evidence", "signal": "one sharp sentence: what this session shows that's relevant here" }
- evidenceAgainst: 1-2 items — specific work sessions that reveal gaps or risks for this role
  Each: { "title": "exact session title from evidence", "signal": "one sharp sentence: what this session reveals as a concern" }
- evidenceUsed: array of "[YYYY-MM-DD] title" strings for chunks that informed scoring`;

// ─── Role definitions ────────────────────────────────────────────────────────

const ROLES = [
  {
    title: 'Starship Captain',
    content: `Role: Commanding Officer, deep space exploration vessel. Crew of 430.

Responsibilities:
- Final authority on all tactical, diplomatic, and scientific decisions
- First contact with unknown civilizations; no playbook, no support
- Crew welfare, morale, and trust under sustained high-stakes conditions
- Mission execution in environments with zero institutional backup

Must have:
- Command experience under life-or-death conditions with incomplete information
- Ability to inspire trust and compliance without coercion
- Ethical judgment that doesn't break under pressure or temptation
- Demonstrated record of bringing crew home

Culture signals:
- You will be wrong in front of your crew; that's part of the job
- The ship is not a democracy, but the crew knows when they're respected
- Leadership here is personal, not procedural`
  },
  {
    title: 'Science Officer',
    content: `Role: Chief Science Officer, deep space exploration vessel.

Responsibilities:
- Lead all scientific research and sensor analysis operations
- Interpret novel phenomena — biological, physical, temporal, xenological — often without prior reference
- Advise command on scientific implications of mission-critical decisions
- Maintain scientific rigor under operational pressure; document findings for Starfleet records

Must have:
- Deep cross-disciplinary knowledge: physics, biology, chemistry, xenobiology, astrophysics
- Ability to process and synthesize large volumes of complex data into actionable conclusions
- Methodical research discipline — hypothesize, test, revise, document
- Comfort with sustained uncertainty; many phenomena encountered will have no known explanation

Nice to have:
- Experience with alien or non-standard data structures and communication systems
- Capacity to operate independently for extended periods without external validation

Culture signals:
- The answer is almost never obvious; the method is what separates signal from noise
- Speculation without evidence is noise; the science officer's job is to narrow the space of possibilities
- You will be asked for answers before the data is complete — your job is to say what you know and what you don't`
  },
  {
    title: "Ship's Counselor",
    content: `Role: Licensed Clinical Therapist, individual and group practice.

Responsibilities:
- Provide weekly individual and group therapy sessions
- Specialize in trauma, grief, and emotional dysregulation
- Hold space for clients experiencing acute suffering without projecting or deflecting
- Maintain appropriate boundaries while building therapeutic alliance

Must have:
- Licensed clinical training (LCSW, MFT, or equivalent)
- Deep empathy and reflective listening — the work is relational, not procedural
- Ability to sit with uncertainty and distress without rushing to resolution
- Experience with clients who cannot or will not express emotion directly

Culture signals:
- The work happens in the relationship, not the technique
- You will carry this work home sometimes — self-care is a job requirement
- Clients will resist; that is not failure, that is the work`
  },
  {
    title: 'Startup Founder',
    content: `Role: Co-Founder, early-stage technology startup (pre-seed to Series A).

Responsibilities:
- Define product vision and iterate based on customer signal, not internal conviction
- Recruit first 10 hires; you are the culture whether you mean to be or not
- Raise from angels and early institutional investors — pitch, close, repeat
- Make product, hiring, and go-to-market decisions with inadequate information

Must have:
- High risk tolerance and genuine comfort with ambiguity
- Ability to inspire early believers — engineers, customers, investors — without proof
- Speed of decision-making; indecision is a decision at this stage
- Track record of moving fast and adjusting, not waiting for the right moment

Nice to have:
- Experience operating outside established structures
- History of finding creative solutions when conventional options are unavailable
- Network of potential customers, engineers, or investors

Culture signals:
- The plan will be wrong; the ability to adapt is what matters
- You will be selling constantly — the idea, the vision, the company, yourself
- Founders who wait for certainty do not survive the early stages`
  },
  {
    title: 'Chief Technology Officer',
    content: `Role: CTO, Series B startup (~80 people, $12M ARR).

Responsibilities:
- Own technical vision, architecture decisions, and engineering org
- Hire and develop senior engineering leadership
- Communicate complex technical tradeoffs to non-technical founders, board, investors
- Manage technical debt against product velocity; make the call

Must have:
- Prior experience building and leading engineering teams (15+ people)
- Ability to translate technical decisions into business language
- Track record shipping production systems that scale
- Comfort operating in ambiguity without a complete picture

Nice to have:
- Prior startup founding experience
- Experience with compliance-sensitive domains (HIPAA, SOC2, etc.)

Culture signals:
- You will be pulled in ten directions; prioritization is the job
- Strong opinions, loosely held — be willing to be wrong in front of people
- The founders built this with no engineers; they will challenge every assumption`
  },
  {
    title: 'Venture Capitalist',
    content: `Role: Principal, early-stage venture fund ($200M AUM, Seed to Series A).

Responsibilities:
- Source and evaluate investment opportunities; 2-4 new investments per year
- Build founder relationships before a raise — the best deals aren't pitched, they're earned
- Read founders accurately under pressure: distinguish conviction from delusion, authenticity from performance
- Support portfolio companies post-investment — recruiting, strategy, follow-on fundraising

Must have:
- Deep people pattern recognition — at this stage you are betting on the founder more than the idea
- Instinct for authentic conviction: who will hold through the hard period, who won't
- Comfort with being wrong often; the model requires many failures to find the outliers
- Ability to read adversarial dynamics — founders pitching you have prepared; your job is to see past the pitch

Nice to have:
- Operating experience as a founder or early employee
- Strong network in one or more technical verticals
- Analytical rigor on market sizing and unit economics (important but secondary to people judgment)

Culture signals:
- The job is mostly saying no — how you say no matters enormously
- You are selling yourself to founders as much as they are selling to you
- The spreadsheet won't tell you who will survive the first real crisis; your read of the person will`
  },
  {
    title: 'Baby Nanny',
    content: `Role: Full-time Nanny, private household. Two children, ages 3 and 6.

Responsibilities:
- Primary daytime caregiver; school pickup, meals, activities, bedtime routine
- Age-appropriate education and play — patience and consistency required
- Manage minor conflicts, tantrums, and emotional regulation moments
- Communicate clearly and proactively with parents about the children's day

Must have:
- Genuine warmth and patience with young children over extended periods
- Ability to maintain routine and structure without rigidity
- Emotional availability — children need to feel seen, not managed
- Low ego; the job is invisible when it's done well

Nice to have:
- First aid and CPR certification
- Experience with children at multiple developmental stages

Culture signals:
- Children do not respond to authority — they respond to relationship
- The 3-year-old will ask "why" forty times today; your answer to the fortieth time matters as much as the first
- This job is not glamorous; the reward is the relationship`
  }
];

const CHARACTERS = ['kirk', 'data'];

// ─── Evaluate one character against one role ──────────────────────────────────

async function evaluate(client, owner, role) {
  const signalId = owner._signalId || owner.id;
  const { skillsProfile, wantsProfile, personalityProfile } = owner;

  const terms = extractTerms(`${role.title} ${role.content}`);
  const chunks = terms.length ? await searchChunks(signalId, terms, 8).catch(() => []) : [];

  const profileSection = buildProfileSection(owner.displayName, skillsProfile, wantsProfile, personalityProfile);
  const coverageSection = buildCoverageSection(skillsProfile, wantsProfile, personalityProfile);
  const profileText = [buildContextText(owner), profileSection, coverageSection].filter(Boolean).join('\n\n');
  const evidenceText = buildEvidenceText(chunks);

  const msg = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    messages: [{ role: 'user', content: EVAL_PROMPT({
      profileText,
      evidenceText,
      opportunity: { type: 'free-text', title: role.title, content: role.content }
    })}]
  });

  const raw = msg.content[0]?.text || '{}';
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw);

  // Strip em dashes from all text fields before storing
  const stripEmDash = str => typeof str === 'string' ? str.replace(/ \u2014 /g, ', ').replace(/\u2014/g, ', ') : str;
  if (parsed.summary) parsed.summary = stripEmDash(parsed.summary);
  if (parsed.evidenceFor) parsed.evidenceFor = parsed.evidenceFor.map(e => ({ ...e, signal: stripEmDash(e.signal) }));
  if (parsed.evidenceAgainst) parsed.evidenceAgainst = parsed.evidenceAgainst.map(e => ({ ...e, signal: stripEmDash(e.signal) }));

  if (parsed.score) {
    const s = parsed.score;
    s.overall = Math.round((s.skills * 0.4) + (s.alignment * 0.35) + ((s.personality || 0) * 0.25));
  }

  const evalId = `eval-demo-${signalId}-${role.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '')}-${Date.now()}`;

  await db.collection('signal-evaluations').doc(evalId).set({
    _evalId: evalId,
    _signalId: signalId,
    _userId: owner._userId,
    demo: true,
    demoId: 'kirk-vs-data',
    mode: 'demo',
    opportunity: { type: 'free-text', title: role.title, content: role.content },
    jdSummary: null,
    score: parsed.score || {},
    confidence: parsed.confidence || 0,
    recommendation: parsed.recommendation || '',
    summary: parsed.summary || '',
    evidenceFor: parsed.evidenceFor || [],
    evidenceAgainst: parsed.evidenceAgainst || [],
    evidenceUsed: parsed.evidenceUsed || [],
    evidenceChunks: chunks.map(c => ({
      title: c.title || '',
      date: c.date || '',
      summary: c.summary || '',
      keyInsight: c.keyInsight || '',
      topics: c.topics || [],
      skills: c.skills || []
    })),
    resumeGenerated: false,
    coverLetterGenerated: false,
    _createdAt: admin.firestore.FieldValue.serverTimestamp()
  });

  return { evalId, score: parsed.score, recommendation: parsed.recommendation };
}

// ─── Main ────────────────────────────────────────────────────────────────────────

async function run() {
  console.log('\nPrecompute: Kirk vs Data (direct — no lambda timeout)\n');
  if (DRY_RUN) console.log('DRY RUN — no writes\n');

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) { console.error('ANTHROPIC_API_KEY not set'); process.exit(1); }

  const client = new Anthropic({ apiKey });

  // Load owners
  const owners = {};
  for (const id of CHARACTERS) {
    owners[id] = await getOwnerBySignalId(id);
    if (!owners[id]) {
      const seedScript = id === 'kirk' ? 'seed-kirk-data.cjs' : 'seed-spock-data.cjs';
      console.error(`Owner not found: ${id} — run ${seedScript} first`);
      process.exit(1);
    }
    console.log(`  Loaded: ${id} (${owners[id].displayName})`);
  }
  console.log('');

  const results = {};

  for (const role of ROLES.filter(r => !ROLE_FILTER || r.title.toLowerCase().includes(ROLE_FILTER))) {
    results[role.title] = {};
    for (const id of CHARACTERS) {
      const label = `${id} / ${role.title}`;
      if (DRY_RUN) { console.log(`  [dry] ${label}`); continue; }
      try {
        const { evalId, score, recommendation } = await evaluate(client, owners[id], role);
        results[role.title][id] = evalId;
        console.log(`  ✓ ${label} → overall ${score?.overall ?? '?'} (${recommendation}) [${evalId}]`);
      } catch (err) {
        console.error(`  ✗ ${label} → ${err.message}`);
      }
    }
  }

  if (!DRY_RUN) {
    const outPath = path.join(__dirname, 'precomputed-eval-ids-kirk-data.json');
    fs.writeFileSync(outPath, JSON.stringify(results, null, 2));
    console.log(`\nEval IDs → ${outPath}\n`);
  }

  process.exit(0);
}

run().catch(err => { console.error(err); process.exit(1); });
