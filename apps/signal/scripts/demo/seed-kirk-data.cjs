/**
 * Seed demo data: Kirk (kirk).
 *
 * Data already exists from seed-spock-data.cjs — this script only creates Kirk.
 *
 * Usage:
 *   node scripts/demo/seed-kirk-data.cjs [--dry-run] [base_url]
 *
 * Writes Kirk owner doc + episode chunks to Firestore,
 * then calls /api/signal-context-synthesize to generate his profile.
 *
 * Default base: http://localhost:8888
 * Override: node scripts/demo/seed-kirk-data.cjs https://signal.habitualos.com
 */

require('dotenv').config();
const { db, admin } = require('@habitualos/db-core');
const { createOwner } = require('../../netlify/functions/_services/db-signal-owners.cjs');
const { createProcessedChunk } = require('../../netlify/functions/_services/db-signal-context.cjs');

const DRY_RUN = process.argv.includes('--dry-run');
const BASE = process.argv.find(a => a.startsWith('http')) || 'http://localhost:8888';

// ─── Owner definition ──────────────────────────────────────────────────────────

const OWNERS = [
  {
    signalId: 'kirk',
    data: {
      _userId: 'u-1000000000-kirk',
      displayName: 'James T. Kirk',
      nickname: 'Kirk',
      avatarUrl: '/assets/images/kirk.jpg',
      tagline: 'Captain, USS Enterprise. Human. Unrepentantly so.',
      contextText: "James T. Kirk is a Starfleet officer and commanding officer of the USS Enterprise. Youngest captain in Starfleet history at the time of his appointment. Known for rule-bending when he believes he is right, psychological manipulation of adversaries, and extreme loyalty to individual crew members. Operates on intuition shaped by experience rather than logical deduction. Has a documented pattern of finding third options where none are supposed to exist.",
      status: 'active'
    }
  }
];

// ─── Episode chunks ────────────────────────────────────────────────────────────

const KIRK_CHUNKS = [
  {
    conversationId: 'corbomite-maneuver',
    title: 'The Corbomite Maneuver (TOS S1E10)',
    date: '1966-11-10',
    source: 'star-trek',
    summary: "Facing an alien vessel of overwhelming power, Kirk invents a fictional weapon — the 'corbomite' — claiming any attack will trigger mutual destruction. He bluffs a vastly superior adversary into a standstill using nothing but projected confidence and fabricated information, buying time until the threat resolves on his terms.",
    keyInsight: 'Won a no-win scenario by changing the psychological frame rather than the tactical reality. The bluff only works because Kirk commits to it completely — doubt would have killed them.',
    topics: ['psychological operations', 'crisis leadership', 'adversarial negotiation', 'risk calculation'],
    skills: ['psychological manipulation under pressure', 'adversarial negotiation', 'decisive leadership', 'strategic deception'],
    technologies: ['Enterprise tactical systems', 'communication arrays'],
    projects: ['USS Enterprise NCC-1701'],
    wants: ['lead through impossible situations by force of will', 'protect crew through unconventional means'],
    personalitySignals: [
      { signal: 'creates psychological leverage where material leverage does not exist', polarity: 'strength' },
      { signal: 'projects absolute confidence to externalize doubt and gain negotiating position', polarity: 'strength' },
      { signal: 'commits fully to high-risk gambits rather than hedging', polarity: 'strength' }
    ],
    concepts: ['bluff', 'psychological', 'deception', 'leadership', 'crisis', 'adversarial', 'negotiation', 'risk'],
    dimensionCoverage: { skills: true, alignment: true, personality: true },
    evidenceStrength: 5
  },
  {
    conversationId: 'court-martial',
    title: 'Court Martial (TOS S1E20)',
    date: '1967-02-02',
    source: 'star-trek',
    summary: "Kirk is court-martialed for allegedly causing a crew member's death through negligence. Rather than deferring to institutional process, he aggressively fights the charges, refuses to accept the official record as truth, and ultimately exposes a falsified log. His integrity is validated — and so is his willingness to challenge the institution that credentialed him.",
    keyInsight: "Fought the record rather than accepting it. The institution was wrong; he was right; he made sure everyone knew. Shows that his rule-bending is not without principle — he has his own code, and it is not lesser than Starfleet's.",
    topics: ['institutional conflict', 'personal integrity', 'legal defense', 'record-keeping ethics'],
    skills: ['institutional conflict navigation', 'self-advocacy under pressure', 'evidence-based argumentation', 'decisive leadership'],
    technologies: ['ship computer systems', 'log records', 'sensor data'],
    projects: ['USS Enterprise NCC-1701'],
    wants: ['maintain personal integrity against institutional pressure', 'be judged by outcomes not procedure'],
    personalitySignals: [
      { signal: 'challenges institutional authority when personal integrity is at stake', polarity: 'strength' },
      { signal: 'refuses to accept unfavorable framing even from credible sources', polarity: 'strength' }
    ],
    concepts: ['integrity', 'institutional', 'legal', 'accountability', 'record', 'challenge', 'authority'],
    dimensionCoverage: { skills: true, alignment: true, personality: true },
    evidenceStrength: 4
  },
  {
    conversationId: 'city-on-edge-of-forever',
    title: 'The City on the Edge of Forever (TOS S1E28)',
    date: '1967-04-06',
    source: 'star-trek',
    summary: "Kirk falls in love with Edith Keeler while trapped in 1930s New York. Spock's analysis reveals she must die or the Nazis win WWII. Kirk personally prevents McCoy from saving her life — letting the woman he loves die because the logic is correct and he cannot argue against it.",
    keyInsight: 'Sacrificed personal desire for the greater good — not through detachment but through overwhelming force of will against his own impulse. The most costly decision in the record, made by the most emotional character.',
    topics: ['sacrifice', 'personal cost', 'ethical constraint', 'mission priority'],
    skills: ['ethical decision-making under personal cost', 'mission prioritization', 'decisive leadership'],
    technologies: ['Guardian of Forever', 'historical context analysis'],
    projects: ['USS Enterprise NCC-1701'],
    wants: ['protect humanity even at personal cost'],
    personalitySignals: [
      { signal: 'capable of overriding personal emotional investment when the stakes are existential', polarity: 'strength' },
      { signal: 'carries personal costs of command without deflecting them', polarity: 'strength' }
    ],
    concepts: ['sacrifice', 'love', 'ethics', 'mission', 'cost', 'grief', 'decision', 'will'],
    dimensionCoverage: { skills: true, alignment: true, personality: true },
    evidenceStrength: 5
  },
  {
    conversationId: 'space-seed',
    title: 'Space Seed (TOS S1E22)',
    date: '1967-02-16',
    source: 'star-trek',
    summary: "Kirk encounters Khan Noonien Singh, a genetically engineered 20th-century warlord, and is seduced by his evident capability. Rather than imprisoning him, Kirk exiles Khan to an uninhabited planet — a decision that directly enables the events of Wrath of Khan decades later. Kirk recognized the danger but overestimated his ability to contain it.",
    keyInsight: 'His instinct to recognize and admire strong adversaries led him to a catastrophically lenient call. He saw a peer where he should have seen a threat. Charisma read as compatibility.',
    topics: ['adversary assessment', 'judgment under charisma', 'risk miscalculation', 'leadership blind spots'],
    skills: ['adversarial negotiation', 'decisive leadership', 'psychological manipulation under pressure'],
    technologies: ['Botany Bay systems', 'cryogenic technology'],
    projects: ['USS Enterprise NCC-1701'],
    wants: ['find and engage with peers worthy of respect'],
    personalitySignals: [
      { signal: 'drawn to strong adversaries; may underestimate the threat they represent', polarity: 'edge' },
      { signal: 'extends professional respect to capable opponents even when it risks mission security', polarity: 'edge' }
    ],
    concepts: ['adversary', 'charisma', 'judgment', 'overconfidence', 'respect', 'risk', 'peer'],
    dimensionCoverage: { skills: false, alignment: true, personality: true },
    evidenceStrength: 4
  },
  {
    conversationId: 'private-little-war',
    title: 'A Private Little War (TOS S2E19)',
    date: '1968-02-02',
    source: 'star-trek',
    summary: "A planet Kirk once knew as peaceful is destabilized by Klingon-supplied weapons. To restore balance, Kirk decides to arm the opposing faction — deliberately escalating a proxy war to create stalemate. The logic is cold geopolitical calculus; the emotional weight of the decision visibly costs him.",
    keyInsight: "Made a decision with no good options and lived with it. The proxy war logic is not comfortable — he knows it isn't — but he makes the call, owns it, and doesn't pretend otherwise.",
    topics: ['geopolitics', 'proxy conflict', 'ethical ambiguity', 'cold calculus leadership'],
    skills: ['ethical decision-making under personal cost', 'adversarial negotiation', 'decisive leadership'],
    technologies: ['flintlock weapons', 'Klingon arms analysis'],
    projects: ['USS Enterprise NCC-1701'],
    wants: ['make defensible calls in situations with no clean answers'],
    personalitySignals: [
      { signal: 'willing to make cold-calculus calls in murky ethical territory', polarity: 'strength' },
      { signal: 'carries moral weight of ambiguous decisions rather than rationalizing them away', polarity: 'strength' }
    ],
    concepts: ['geopolitics', 'proxy', 'ethics', 'ambiguity', 'calculus', 'balance', 'conflict', 'decision'],
    dimensionCoverage: { skills: true, alignment: true, personality: true },
    evidenceStrength: 4
  },
  {
    conversationId: 'amok-time',
    title: 'Amok Time (TOS S2E1)',
    date: '1967-09-15',
    source: 'star-trek',
    summary: "Spock is dying due to the Vulcan pon farr mating drive. Kirk defies direct Starfleet orders to divert the ship to Vulcan, risking his command and career to save his first officer. When Spock appears to have killed Kirk in ritual combat and then discovers him alive, the joy on Spock's face is the most revealing moment in either man's record.",
    keyInsight: "Violated direct orders from Starfleet Command to prioritize a single crew member. Individual loyalty over institutional compliance — this is the pattern that defines Kirk's leadership edge as well as his deepest strength.",
    topics: ['crew loyalty', 'institutional defiance', 'personal risk for individual', 'command character'],
    skills: ['decisive leadership', 'institutional conflict navigation', 'adversarial negotiation'],
    technologies: ['Enterprise navigation', 'Vulcan ritual weapons'],
    projects: ['USS Enterprise NCC-1701'],
    wants: ['protect individuals he is responsible for, regardless of cost'],
    personalitySignals: [
      { signal: 'will sacrifice career and institutional standing for individual crew loyalty', polarity: 'strength' },
      { signal: 'operates from relational loyalty as a primary value, not hierarchy', polarity: 'strength' },
      { signal: 'prioritizes the individual over the system when forced to choose', polarity: 'edge' }
    ],
    concepts: ['loyalty', 'defiance', 'orders', 'individual', 'relationship', 'risk', 'career', 'crew'],
    dimensionCoverage: { skills: false, alignment: true, personality: true },
    evidenceStrength: 5
  },
  {
    conversationId: 'enterprise-incident',
    title: 'The Enterprise Incident (TOS S3E2)',
    date: '1968-09-27',
    source: 'star-trek',
    summary: "Kirk deliberately enters Romulan territory, feigns mental illness, then 'dies' and is resurrected as part of an elaborate intelligence operation to steal a Romulan cloaking device. He deceives the Romulan commander — including performing romantic interest — as part of the mission. The operation is entirely his design.",
    keyInsight: 'Ran a multi-layered deception operation that required him to perform instability, death, and romantic interest on command. The most technically sophisticated thing Kirk has ever done — and none of it involved a weapon.',
    topics: ['intelligence operations', 'multi-layer deception', 'mission planning', 'performance under cover'],
    skills: ['strategic deception', 'psychological manipulation under pressure', 'decisive leadership', 'adversarial negotiation'],
    technologies: ['Romulan cloaking device', 'transporter', 'disguise systems'],
    projects: ['USS Enterprise NCC-1701', 'Starfleet Intelligence'],
    wants: ['achieve mission success through unconventional methods'],
    personalitySignals: [
      { signal: 'designs and executes multi-step deceptions without visible stress', polarity: 'strength' },
      { signal: 'comfortable operating through ambiguity and misdirection as primary tools', polarity: 'strength' }
    ],
    concepts: ['deception', 'intelligence', 'mission', 'performance', 'cover', 'strategy', 'planning', 'unconventional'],
    dimensionCoverage: { skills: true, alignment: true, personality: true },
    evidenceStrength: 4
  },
  {
    conversationId: 'wrath-of-khan',
    title: 'Star Trek II: The Wrath of Khan',
    date: '1982-06-04',
    source: 'star-trek',
    summary: "Khan traps Kirk in a nebula, exploiting Kirk's inability to think in three dimensions. Kirk turns the constraint into an asset — navigating where superior sensors are useless, reading Khan's two-dimensional military thinking, and executing a precise strike under conditions where technical advantage is equalized. He also watches Spock die.",
    keyInsight: '"I don\'t believe in the no-win scenario." Under extreme pressure, with crew dying, he finds the angle Khan didn\'t anticipate. Tactical genius expressed through psychological read, not processing power.',
    topics: ['adaptive tactics', 'adversary psychology', 'team inspiration under grief', 'constraint-as-asset thinking'],
    skills: ['psychological manipulation under pressure', 'decisive leadership', 'adversarial negotiation', 'strategic deception'],
    technologies: ['Enterprise tactical systems', 'nebula navigation', 'photon torpedoes'],
    projects: ['USS Enterprise NCC-1701', 'Genesis Project'],
    wants: ['find the third option when only two bad ones are visible'],
    personalitySignals: [
      { signal: 'converts constraints into tactical advantages rather than working around them', polarity: 'strength' },
      { signal: 'reads adversary psychology as primary tactical input', polarity: 'strength' },
      { signal: 'leads through personal inspiration and presence, not position', polarity: 'strength' }
    ],
    concepts: ['tactics', 'psychology', 'adversary', 'constraint', 'inspiration', 'grief', 'adaptive', 'crisis'],
    dimensionCoverage: { skills: true, alignment: true, personality: true },
    evidenceStrength: 5
  },
  {
    conversationId: 'voyage-home',
    title: 'Star Trek IV: The Voyage Home',
    date: '1986-11-26',
    source: 'star-trek',
    summary: "Kirk leads his crew — stripped of their ship, operating covertly in 20th-century San Francisco — to acquire humpback whales to save Earth. He navigates bureaucracy, culture shock, and improvised logistics entirely without institutional support, rank, or resources. He makes a deal with a marine biologist and lands a stolen Bird of Prey in a public park.",
    keyInsight: 'Operated effectively completely outside his institutional context. No Enterprise, no Starfleet, no rank. Improvised, charmed, and executed a mission that required him to be a different kind of leader than he normally is.',
    topics: ['improvised leadership', 'operating outside institutional context', 'cross-cultural navigation', 'resource scarcity'],
    skills: ['decisive leadership', 'adversarial negotiation', 'institutional conflict navigation', 'psychological manipulation under pressure'],
    technologies: ['Klingon Bird of Prey', '20th century technology navigation'],
    projects: ['Earth rescue mission'],
    wants: ['succeed through ingenuity when no official path exists'],
    personalitySignals: [
      { signal: 'adapts leadership style to context — equally effective outside institutional structure', polarity: 'strength' },
      { signal: 'charisma functions as a resource-substitute when authority and tools are unavailable', polarity: 'strength' }
    ],
    concepts: ['improvisation', 'leadership', 'institutional', 'charisma', 'resource', 'adaptation', 'cross-cultural'],
    dimensionCoverage: { skills: true, alignment: true, personality: true },
    evidenceStrength: 4
  },
  {
    conversationId: 'generations',
    title: 'Star Trek: Generations',
    date: '1994-11-18',
    source: 'star-trek',
    summary: "Kirk is offered existence inside the Nexus — a temporal anomaly that simulates his heart's desires — and chooses to leave it to stop Soran. He is killed doing so. His final words: 'It was fun.' Before leaving, he acknowledges to Picard that he spent his career running from the personal life he never fully inhabited.",
    keyInsight: '"Don\'t let them promote you. Don\'t let them transfer you. Don\'t let them do anything that takes you off the bridge of a starship." He knows exactly who he is. He chose it. He doesn\'t regret it.',
    topics: ['leadership legacy', 'identity and purpose', 'mortality acceptance', 'self-knowledge'],
    skills: ['decisive leadership', 'ethical decision-making under personal cost', 'mission prioritization'],
    technologies: ['Nexus temporal mechanics', 'Enterprise-B systems'],
    projects: ['Enterprise-B launch', 'Veridian III mission'],
    wants: ['die doing something that matters', 'be remembered for the right reasons'],
    personalitySignals: [
      { signal: 'chooses meaningful action over comfortable stasis even when stasis is available', polarity: 'strength' },
      { signal: 'self-aware about the personal costs of his chosen identity', polarity: 'strength' },
      { signal: 'defines himself entirely through mission and crew — not role or title', polarity: 'strength' }
    ],
    concepts: ['legacy', 'identity', 'purpose', 'death', 'choice', 'self-knowledge', 'mission', 'sacrifice'],
    dimensionCoverage: { skills: false, alignment: true, personality: true },
    evidenceStrength: 4
  }
];

// ─── HTTP helper ────────────────────────────────────────────────────────────────

async function post(path, body) {
  const res = await fetch(`${BASE}/api/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  return res.json();
}

// ─── Main ────────────────────────────────────────────────────────────────────────

async function run() {
  console.log(`\nSeed: Kirk demo data → ${BASE}\n`);
  if (DRY_RUN) console.log('DRY RUN — Firestore writes skipped, HTTP calls skipped\n');

  // 1. Create owner doc
  for (const { signalId, data } of OWNERS) {
    try {
      if (!DRY_RUN) {
        await createOwner(signalId, data);
        console.log(`  ✓ Created owner: ${signalId}`);
      } else {
        console.log(`  [dry] Would create owner: ${signalId}`);
      }
    } catch (err) {
      if (err.message.includes('already taken')) {
        console.log(`  ~ Owner exists: ${signalId} (skipping)`);
      } else {
        throw err;
      }
    }
  }

  // 2. Write episode chunks
  for (const { conversationId, ...fields } of KIRK_CHUNKS) {
    if (!DRY_RUN) {
      const { created, docId } = await createProcessedChunk('kirk', conversationId, fields);
      console.log(`  ${created ? '✓' : '~'} Chunk: ${docId}`);
    } else {
      console.log(`  [dry] Would write chunk: kirk-${conversationId}`);
    }
  }

  if (DRY_RUN) {
    console.log('\nDRY RUN complete. Re-run without --dry-run to write.\n');
    process.exit(0);
  }

  // 3. Call synthesize for Kirk
  console.log('\nRunning synthesis for Kirk...');
  try {
    const result = await post('signal-context-synthesize', { userId: 'u-1000000000-kirk' });
    if (result.success) {
      console.log(`  ✓ Synthesized: kirk (${result.chunksProcessed} chunks)`);
    } else {
      console.error('  ✗ Synthesize failed:', result.error);
    }
  } catch (err) {
    console.error('  ✗ Synthesize error:', err.message);
  }

  console.log('\nSeed complete.\n');
  process.exit(0);
}

run().catch(err => { console.error(err); process.exit(1); });
