/**
 * Patch Kirk round 2:
 *   1. Strip markdown from synthesizedContext (Haiku used headers; Spock's is plain prose)
 *   2. Add recurring wants across chunks so rawWants passes the ≥2 confidence filter
 *
 * After this script, re-run synthesis to rebuild wantsProfile:
 *   curl -X POST http://localhost:8888/api/signal-context-synthesize \
 *     -H 'Content-Type: application/json' \
 *     -d '{"userId":"u-1000000000-kirk"}'
 *
 * Usage:
 *   node scripts/demo/patch-kirk-2.cjs [--dry-run]
 */

require('dotenv').config();
const { db } = require('@habitualos/db-core');

const DRY_RUN = process.argv.includes('--dry-run');

// ─── Wants to inject across multiple chunks ────────────────────────────────────
// Each must appear in ≥2 chunks to survive confidence filtering.

const WANTS_PATCHES = {
  'corbomite-maneuver': [
    'operate in conditions where conventional options do not apply',
    'protect crew through personal conviction and presence'
  ],
  'court-martial': [
    'be judged by outcomes and integrity, not procedure',
    'operate in conditions where conventional options do not apply'
  ],
  'city-on-edge-of-forever': [
    'protect crew through personal conviction and presence',
    'be judged by outcomes and integrity, not procedure'
  ],
  'space-seed': [
    'find and engage with peers worthy of respect',
    'operate in conditions where conventional options do not apply'
  ],
  'private-little-war': [
    'be judged by outcomes and integrity, not procedure',
    'operate in conditions where conventional options do not apply'
  ],
  'amok-time': [
    'protect crew through personal conviction and presence',
    'find and engage with peers worthy of respect'
  ],
  'enterprise-incident': [
    'operate in conditions where conventional options do not apply',
    'protect crew through personal conviction and presence'
  ],
  'wrath-of-khan': [
    'protect crew through personal conviction and presence',
    'operate in conditions where conventional options do not apply',
    'be judged by outcomes and integrity, not procedure'
  ],
  'voyage-home': [
    'operate in conditions where conventional options do not apply',
    'protect crew through personal conviction and presence'
  ],
  'generations': [
    'be judged by outcomes and integrity, not procedure',
    'find and engage with peers worthy of respect'
  ]
};

// ─── Strip markdown from a string ─────────────────────────────────────────────

function stripMarkdown(text) {
  return text
    .replace(/^#{1,6}\s+/gm, '')       // headings
    .replace(/\*{1,2}([^*]+)\*{1,2}/g, '$1') // bold/italic
    .replace(/^[-*_]{3,}\s*$/gm, '')   // horizontal rules
    .replace(/\n{3,}/g, '\n\n')         // collapse excess blank lines
    .trim();
}

async function run() {
  console.log('\nPatch Kirk round 2: wants + synthesizedContext cleanup\n');
  if (DRY_RUN) console.log('DRY RUN — no writes\n');

  // ── 1. Strip markdown from synthesizedContext ──────────────────────────────
  console.log('Patching synthesizedContext...');
  const ownerSnap = await db.collection('signal-owners')
    .where('_signalId', '==', 'kirk')
    .limit(1)
    .get();

  if (ownerSnap.empty) {
    console.error('Kirk owner not found');
    process.exit(1);
  }

  const ownerDoc = ownerSnap.docs[0];
  const owner = ownerDoc.data();
  const raw = owner.synthesizedContext || '';

  if (!raw) {
    console.log('  ~ No synthesizedContext found (skipping)');
  } else if (!raw.includes('#') && !raw.includes('**')) {
    console.log('  ~ synthesizedContext looks clean already (skipping)');
  } else {
    const cleaned = stripMarkdown(raw);
    if (!DRY_RUN) {
      await ownerDoc.ref.update({ synthesizedContext: cleaned });
      console.log('  ✓ Stripped markdown from synthesizedContext');
    } else {
      console.log('  [dry] Would strip markdown. Before:\n');
      console.log(raw.slice(0, 300) + '...\n');
      console.log('  After:\n');
      console.log(cleaned.slice(0, 300) + '...\n');
    }
  }

  // ── 2. Patch wants onto chunks ─────────────────────────────────────────────
  console.log('\nPatching wants on chunks...');
  const snap = await db.collection('signal-session-chunks')
    .where('_signalId', '==', 'kirk')
    .get();

  if (snap.empty) {
    console.error('No Kirk chunks found');
    process.exit(1);
  }

  for (const doc of snap.docs) {
    const data = doc.data();
    const conversationId = data._conversationId;
    const wantsPatch = WANTS_PATCHES[conversationId];
    if (!wantsPatch) continue;

    const existing = data.wants || [];
    const toAdd = wantsPatch.filter(w => !existing.includes(w));

    if (!toAdd.length) {
      console.log(`  ~ ${conversationId}: wants already patched`);
      continue;
    }

    const updated = [...existing, ...toAdd];
    if (!DRY_RUN) {
      await doc.ref.update({ wants: updated });
      console.log(`  ✓ ${conversationId}: added ${toAdd.length} want(s)`);
      toAdd.forEach(w => console.log(`      + ${w}`));
    } else {
      console.log(`  [dry] ${conversationId}: would add ${toAdd.length} want(s)`);
      toAdd.forEach(w => console.log(`      + ${w}`));
    }
  }

  console.log('\nDone. Now re-run synthesis to rebuild wantsProfile:\n');
  console.log('  curl -X POST http://localhost:8888/api/signal-context-synthesize \\');
  console.log("    -H 'Content-Type: application/json' \\");
  console.log("    -d '{\"userId\":\"u-1000000000-kirk\"}'\n");

  process.exit(0);
}

run().catch(err => { console.error(err); process.exit(1); });
