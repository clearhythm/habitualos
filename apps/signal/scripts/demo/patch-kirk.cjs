/**
 * Patch Kirk's episode chunks to add repeating personality signals and ensure
 * key skills appear in ≥2 chunks (confidence filter threshold).
 *
 * Without this, all personality signals are unique per episode → all filtered
 * out → synthesizedContext never generated (blocked by strengthSignals.length > 0 check).
 *
 * Run BEFORE re-running synthesis:
 *   node scripts/demo/patch-kirk.cjs [--dry-run]
 *   Then: POST /api/signal-context-synthesize { userId: 'u-1000000000-kirk' }
 */

require('dotenv').config();
const { db } = require('@habitualos/db-core');

const DRY_RUN = process.argv.includes('--dry-run');

// Repeating personality signals to inject across multiple chunks.
// Each must be genuinely evidenced by the episodes it's added to.
const RECURRING_STRENGTH = [
  'leads through personal inspiration and presence, not position',
  'commits fully to high-risk gambits rather than hedging',
  'carries personal costs of command without deflecting them',
  'challenges institutional authority when personal integrity is at stake',
  'reads adversary psychology as primary tactical input'
];

const RECURRING_EDGE = [
  'prioritizes the individual over the system when forced to choose'
];

// Which signals to add to which chunks (by conversationId).
// Only adding signals that are genuinely supported by the episode.
const PATCHES = {
  'corbomite-maneuver': {
    addStrength: [
      'leads through personal inspiration and presence, not position',
      'commits fully to high-risk gambits rather than hedging',
      'reads adversary psychology as primary tactical input'
    ]
  },
  'court-martial': {
    addStrength: [
      'challenges institutional authority when personal integrity is at stake',
      'carries personal costs of command without deflecting them'
    ]
  },
  'city-on-edge-of-forever': {
    addStrength: [
      'carries personal costs of command without deflecting them',
      'leads through personal inspiration and presence, not position'
    ],
    addEdge: ['prioritizes the individual over the system when forced to choose']
  },
  'space-seed': {
    addStrength: ['reads adversary psychology as primary tactical input'],
    addEdge: ['prioritizes the individual over the system when forced to choose']
  },
  'private-little-war': {
    addStrength: [
      'carries personal costs of command without deflecting them',
      'commits fully to high-risk gambits rather than hedging'
    ]
  },
  'amok-time': {
    addStrength: [
      'challenges institutional authority when personal integrity is at stake',
      'leads through personal inspiration and presence, not position'
    ],
    addEdge: ['prioritizes the individual over the system when forced to choose']
  },
  'enterprise-incident': {
    addStrength: [
      'commits fully to high-risk gambits rather than hedging',
      'reads adversary psychology as primary tactical input'
    ]
  },
  'wrath-of-khan': {
    addStrength: [
      'leads through personal inspiration and presence, not position',
      'reads adversary psychology as primary tactical input',
      'commits fully to high-risk gambits rather than hedging'
    ]
  },
  'voyage-home': {
    addStrength: [
      'challenges institutional authority when personal integrity is at stake',
      'leads through personal inspiration and presence, not position'
    ]
  },
  'generations': {
    addStrength: [
      'carries personal costs of command without deflecting them',
      'challenges institutional authority when personal integrity is at stake'
    ]
  }
};

async function run() {
  console.log('\nPatch: Kirk personality signals\n');
  if (DRY_RUN) console.log('DRY RUN — no writes\n');

  const snap = await db.collection('signal-session-chunks')
    .where('_signalId', '==', 'kirk')
    .get();

  if (snap.empty) {
    console.error('No Kirk chunks found — run seed-kirk-data.cjs first');
    process.exit(1);
  }

  console.log(`Found ${snap.docs.length} Kirk chunks\n`);

  for (const doc of snap.docs) {
    const data = doc.data();
    const conversationId = data._conversationId;
    const patch = PATCHES[conversationId];
    if (!patch) continue;

    const existing = (data.personalitySignals || []).map(s =>
      typeof s === 'string' ? s : s.signal
    );

    const toAdd = [
      ...(patch.addStrength || []).map(signal => ({ signal, polarity: 'strength' })),
      ...(patch.addEdge || []).map(signal => ({ signal, polarity: 'edge' }))
    ].filter(({ signal }) => !existing.includes(signal));

    if (!toAdd.length) {
      console.log(`  ~ ${conversationId}: already patched`);
      continue;
    }

    const updated = [
      ...(data.personalitySignals || []),
      ...toAdd
    ];

    if (!DRY_RUN) {
      await doc.ref.update({ personalitySignals: updated });
      console.log(`  ✓ ${conversationId}: added ${toAdd.length} signal(s)`);
      toAdd.forEach(s => console.log(`      + [${s.polarity}] ${s.signal}`));
    } else {
      console.log(`  [dry] ${conversationId}: would add ${toAdd.length} signal(s)`);
      toAdd.forEach(s => console.log(`      + [${s.polarity}] ${s.signal}`));
    }
  }

  console.log('\nPatch complete. Now re-run synthesis:\n');
  console.log('  curl -X POST http://localhost:8888/api/signal-context-synthesize \\');
  console.log("    -H 'Content-Type: application/json' \\");
  console.log("    -d '{\"userId\":\"u-1000000000-kirk\"}'\n");
  process.exit(0);
}

run().catch(err => { console.error(err); process.exit(1); });
