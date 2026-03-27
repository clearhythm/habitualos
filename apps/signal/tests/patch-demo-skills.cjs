/**
 * Patch Spock and Data chunks to surface technical skills that
 * filterByConfidence dropped, then re-synthesize both profiles.
 *
 * Usage:
 *   node tests/patch-demo-skills.cjs [--dry-run]
 *
 * After this runs, re-precompute SWE and CTO:
 *   node tests/precompute-spock-data.cjs --role "senior software"
 *   node tests/precompute-spock-data.cjs --role "chief technology"
 */

require('dotenv').config();
const { db, admin } = require('@habitualos/db-core');

const DRY_RUN = process.argv.includes('--dry-run');
const arrayUnion = admin.firestore.FieldValue.arrayUnion;

// ─── Patches ────────────────────────────────────────────────────────────────
// Each entry: docId → fields to arrayUnion into the existing arrays.
// Skills need to appear in ≥2 chunks to pass filterByConfidence.

const PATCHES = [
  // ── Spock: add CS/engineering skills to 3 chunks ──────────────────────────
  // VSA already has CS but it's 1 chunk — add to Wrath of Khan and Galileo Seven too
  {
    docId: 'spock-wrath-of-khan',
    skills: ['warp systems engineering', 'computer architecture', 'technical problem-solving under constraint'],
    wants: ['apply systematic methodology to complex technical problems'],
    concepts: ['engineering', 'computer', 'systems', 'architecture', 'technical']
  },
  {
    docId: 'spock-galileo-seven',
    skills: ['computer architecture', 'systems engineering', 'technical problem-solving under constraint'],
    wants: ['apply systematic methodology to complex technical problems'],
    concepts: ['engineering', 'systems', 'technical', 'architecture']
  },
  {
    docId: 'spock-vulcan-science-academy',
    skills: ['computer architecture', 'systems engineering', 'software systems'],
    wants: ['apply systematic methodology to complex technical problems'],
    concepts: ['computer', 'software', 'engineering', 'systems', 'architecture']
  },
  // Spock CTO: add technical leadership signal to 2 chunks
  {
    docId: 'spock-journey-to-babel',
    skills: ['technical leadership', 'cross-functional coordination'],
    concepts: ['leadership', 'technical', 'coordination', 'strategy']
  },
  {
    docId: 'spock-undiscovered-country',
    skills: ['technical leadership', 'strategic planning'],
    concepts: ['leadership', 'technical', 'strategy', 'planning']
  },

  // ── Data: add software engineering signal to 3+ chunks ────────────────────
  // Brothers, Starship Mine, First Contact are the best technical episodes
  {
    docId: 'data-tng-brothers',
    skills: ['distributed systems design', 'software architecture', 'autonomous systems engineering'],
    wants: ['solve complex computational systems problems', 'apply technical systems mastery to novel challenges'],
    concepts: ['distributed', 'software', 'architecture', 'autonomous', 'engineering', 'systems design']
  },
  {
    docId: 'data-tng-starship-mine',
    skills: ['distributed systems design', 'software architecture', 'real-time systems optimization'],
    wants: ['solve complex computational systems problems', 'apply technical systems mastery to novel challenges'],
    concepts: ['distributed', 'software', 'architecture', 'real-time', 'optimization', 'systems design']
  },
  {
    docId: 'data-tng-first-contact-film',
    skills: ['distributed systems design', 'real-time systems optimization', 'engineering leadership'],
    wants: ['apply technical systems mastery to novel challenges'],
    concepts: ['distributed', 'real-time', 'optimization', 'engineering', 'leadership', 'systems']
  },
  {
    docId: 'data-tng-the-naked-now',
    skills: ['real-time systems optimization', 'engineering leadership'],
    concepts: ['real-time', 'optimization', 'engineering', 'systems']
  },
  // Data CTO: add engineering leadership to 2 chunks (already added above in First Contact + Naked Now)
  {
    docId: 'data-tng-datas-day',
    skills: ['engineering leadership'],
    wants: ['solve complex computational systems problems'],
    concepts: ['engineering', 'leadership', 'systems']
  }
];

// ─── Main ────────────────────────────────────────────────────────────────────

async function run() {
  console.log('\nPatch: demo character skills\n');

  for (const patch of PATCHES) {
    const ref = db.collection('signal-context-chunks').doc(patch.docId);
    const update = {};

    if (patch.skills?.length)   update.skills    = arrayUnion(...patch.skills);
    if (patch.wants?.length)    update.wants     = arrayUnion(...patch.wants);
    if (patch.concepts?.length) update.concepts  = arrayUnion(...patch.concepts);

    if (DRY_RUN) {
      console.log(`  [dry] ${patch.docId}:`, JSON.stringify(update, null, 2));
    } else {
      await ref.update(update);
      console.log(`  ✓ ${patch.docId}`);
    }
  }

  if (DRY_RUN) {
    console.log('\nDRY RUN complete.\n');
  } else {
    console.log('\nPatches applied. Now re-synthesize:\n');
    console.log('  curl -s -X POST http://localhost:8888/api/signal-context-synthesize \\');
    console.log('    -H "Content-Type: application/json" \\');
    console.log('    -d \'{"userId":"u-1000000000-spock"}\' | jq .');
    console.log('');
    console.log('  curl -s -X POST http://localhost:8888/api/signal-context-synthesize \\');
    console.log('    -H "Content-Type: application/json" \\');
    console.log('    -d \'{"userId":"u-1000000000-data"}\' | jq .');
    console.log('');
    console.log('Then re-precompute:');
    console.log('  node tests/precompute-spock-data.cjs --role "senior software"');
    console.log('  node tests/precompute-spock-data.cjs --role "chief technology"');
  }

  process.exit(0);
}

run().catch(err => { console.error(err); process.exit(1); });
