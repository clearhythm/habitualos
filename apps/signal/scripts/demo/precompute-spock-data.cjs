/**
 * Precompute Spock vs Data evaluations for 6 roles.
 *
 * Calls Anthropic and Firestore directly — no HTTP endpoint, no lambda timeout.
 *
 * Usage:
 *   node tests/precompute-spock-data.cjs [--dry-run]
 *
 * Requires seed-spock-data.cjs to have run first.
 * Results stored in Firestore with demo: true.
 * Eval IDs logged to tests/precomputed-eval-ids.json.
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');
const { db, admin } = require('@habitualos/db-core');
const { getOwnerBySignalId } = require('../netlify/functions/_services/db-signal-owners.cjs');
const { searchChunks } = require('../netlify/functions/_services/db-signal-context.cjs');
const { buildContextText, buildProfileSection, buildCoverageSection } = require('../netlify/functions/_services/signal-init-shared.cjs');

const DRY_RUN = process.argv.includes('--dry-run');
const ROLE_FILTER = (() => {
  const i = process.argv.indexOf('--role');
  return i !== -1 ? process.argv[i + 1]?.toLowerCase() : null;
})();

// ─── Shared eval logic (mirrors signal-evaluate.js) ───────────────────────────

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
`You are evaluating a professional's fit for an opportunity. Use the full scale aggressively. If the candidate's demonstrated skills clearly match what the role requires, that is an 8 or 9 — not a 7. A 7 means "decent but with real gaps." Reserve 5-6 for genuinely mixed cases. Do not penalize for limited evidence volume — score based on the quality of the match, not the quantity of proof.

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
- recommendation: "strong-candidate" (overall ≥ 8), "worth-applying" (overall = 7), "stretch" (overall 5-6), "questionable-fit" (overall 3-4), "poor-fit" (overall ≤ 2)
- summary: 2-3 direct sentences for the candidate — what they should know before applying
- evidenceFor: 2-3 items — specific work sessions that support this candidate for this role
  Each: { "title": "exact session title from evidence", "signal": "one sharp sentence: what this session shows that's relevant here" }
- evidenceAgainst: 1-2 items — specific work sessions that reveal gaps or risks for this role
  Each: { "title": "exact session title from evidence", "signal": "one sharp sentence: what this session reveals as a concern" }
- evidenceUsed: array of "[YYYY-MM-DD] title" strings for chunks that informed scoring`;

// ─── Role definitions ────────────────────────────────────────────────────────

const ROLES = [
  {
    title: 'Starship Captain',
    content: `Role: Commanding Officer, deep space exploration vessel. Crew of 400.

Responsibilities:
- Final authority on all tactical, diplomatic, and ethical decisions
- Direct contact with hostile alien civilizations; first contact protocols
- Crew welfare, morale, and conflict resolution under extreme pressure
- Mission execution in environments with zero external support

Must have:
- Proven command experience under life-or-death conditions
- Ability to make consequential decisions with incomplete information
- Track record managing multi-species, high-stakes interpersonal dynamics
- Ethical judgment that holds under pressure

Culture signals:
- Command is lonely; you will be wrong sometimes and must live with it
- Crew trust is built through presence, not authority
- The mission and the people are both non-negotiable`
  },
  {
    title: 'Senior Software Engineer',
    content: `Role: Senior Engineer, Distributed Systems Team. 5+ years required.

Responsibilities:
- Design and build fault-tolerant services at scale (Python/Go/Kubernetes)
- Lead code reviews; mentor junior engineers
- Debug production incidents across large distributed systems
- Collaborate closely with product and infrastructure teams

Must have:
- Deep CS fundamentals: algorithms, data structures, system design
- Experience with distributed consensus, eventual consistency, failure modes
- Strong written communication — you will document decisions and tradeoffs
- Ship fast, fail fast culture — you are expected to own outcomes

Nice to have:
- Prior work on real-time data pipelines or ML infra
- Experience with formal verification or proof systems

Culture signals:
- High intellectual rigor; PRs are thorough
- Ship fast, iterate — not polished but fast
- Remote-first; async communication is a core skill`
  },
  {
    title: 'Crisis Negotiator',
    content: `Role: Crisis Negotiator, Law Enforcement.

Responsibilities:
- Respond to hostage situations, barricaded persons, and active threat scenarios
- Build rapid rapport with individuals in extreme psychological distress
- Navigate emotional dynamics while executing tactical strategy
- Coordinate with armed response teams without triggering escalation

Must have:
- High emotional regulation under acute stress
- Demonstrated ability to build trust with hostile or distressed individuals quickly
- Experience adapting communication style in real time
- Physical presence and composure in field environments

Culture signals:
- Every call is different; scripts fail
- You are not there to win — you are there to reduce harm
- Your own emotional state will affect outcomes`
  },
  {
    title: 'Counselor',
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
    title: 'Stand-up Comedian',
    content: `Role: Headliner, corporate event comedy night. 45-minute set.

Responsibilities:
- Perform to a mixed audience (ages 25-55, diverse backgrounds, mixed alcohol consumption)
- Make people laugh without alienating or offending
- Read the room in real time and adapt
- Survive the silence when a bit doesn't land

Must have:
- Willingness to be vulnerable on stage
- Timing, rhythm, and the ability to turn awkward human truth into comedy
- Experience recovering from a dead audience without panic
- Material that is funny, not just clever

Nice to have:
- Self-deprecating material — audiences trust people who can laugh at themselves
- Experience improvising when planned material isn't working

Culture signals:
- This is a room full of accountants who have had two drinks
- Your job is to make them forget they are at a work event
- Earnestness is a trap; so is trying too hard`
  }
];

const CHARACTERS = ['spock', 'data'];

// ─── Evaluate one character against one role ──────────────────────────────────

async function evaluate(client, owner, role) {
  const signalId = owner.id;
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
  console.log(`\nPrecompute: Spock vs Data (direct — no lambda timeout)\n`);
  if (DRY_RUN) { console.log('DRY RUN — no writes\n'); }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) { console.error('ANTHROPIC_API_KEY not set'); process.exit(1); }

  const client = new Anthropic({ apiKey });

  // Load owners
  const owners = {};
  for (const id of CHARACTERS) {
    owners[id] = await getOwnerBySignalId(id);
    if (!owners[id]) { console.error(`Owner not found: ${id} — run seed-spock-data.cjs first`); process.exit(1); }
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
    const outPath = path.join(__dirname, 'precomputed-eval-ids.json');
    fs.writeFileSync(outPath, JSON.stringify(results, null, 2));
    console.log(`\nEval IDs → ${outPath}\n`);
  }

  process.exit(0);
}

run().catch(err => { console.error(err); process.exit(1); });
