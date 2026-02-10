#!/usr/bin/env node
/**
 * scripts/seed-survey-responses.js
 *
 * Uploads backdated full-survey responses for Erik and Marta,
 * then computes and stores the initial focus dimensions.
 *
 * Usage: node scripts/seed-survey-responses.js
 *
 * NOTE: Replace USER_IDS and scores with real data before running.
 * Scores are placeholder averages per dimension (1-10 scale).
 */

require('dotenv').config();
const { createSurveyResponse, recalculateFocus } = require('../packages/survey-engine');
const { uniqueId } = require('../packages/db-core');

const SURVEY_ID = 'survey-rel-v1';

// TODO: Replace with actual user IDs from Firestore
const ERIK_USER_ID = 'u-erik-placeholder';
const MARTA_USER_ID = 'u-marta-placeholder';

// Backdated to ~1 week ago
const backdatedTimestamp = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

// Placeholder scores — replace with real survey responses
// Each dimension has 3 question scores and a computed average
const erikScores = [
  { dimension: 'Communication', questionScores: [7, 6, 5], average: 6.0 },
  { dimension: 'Trust', questionScores: [8, 8, 7], average: 7.67 },
  { dimension: 'Intimacy', questionScores: [5, 4, 4], average: 4.33 },
  { dimension: 'Conflict Resolution', questionScores: [4, 3, 4], average: 3.67 },
  { dimension: 'Appreciation', questionScores: [6, 5, 5], average: 5.33 },
  { dimension: 'Shared Goals', questionScores: [7, 7, 8], average: 7.33 },
  { dimension: 'Fun & Play', questionScores: [3, 4, 3], average: 3.33 },
  { dimension: 'Emotional Support', questionScores: [6, 5, 6], average: 5.67 },
  { dimension: 'Independence', questionScores: [8, 9, 8], average: 8.33 },
  { dimension: 'Growth', questionScores: [7, 7, 6], average: 6.67 }
];

const martaScores = [
  { dimension: 'Communication', questionScores: [6, 5, 5], average: 5.33 },
  { dimension: 'Trust', questionScores: [7, 7, 8], average: 7.33 },
  { dimension: 'Intimacy', questionScores: [4, 5, 4], average: 4.33 },
  { dimension: 'Conflict Resolution', questionScores: [3, 4, 3], average: 3.33 },
  { dimension: 'Appreciation', questionScores: [5, 6, 5], average: 5.33 },
  { dimension: 'Shared Goals', questionScores: [8, 7, 7], average: 7.33 },
  { dimension: 'Fun & Play', questionScores: [4, 3, 3], average: 3.33 },
  { dimension: 'Emotional Support', questionScores: [5, 6, 5], average: 5.33 },
  { dimension: 'Independence', questionScores: [9, 8, 9], average: 8.67 },
  { dimension: 'Growth', questionScores: [7, 8, 7], average: 7.33 }
];

async function main() {
  console.log('Seeding survey responses...\n');

  // Create Erik's response
  const erikId = `sr-${Date.now()}-${uniqueId(6)}`;
  await createSurveyResponse(erikId, {
    _userId: ERIK_USER_ID,
    surveyDefinitionId: SURVEY_ID,
    type: 'full',
    timestamp: backdatedTimestamp,
    scores: erikScores,
    surveyActionId: null
  });
  console.log(`  Erik's response: ${erikId}`);

  // Create Marta's response (slightly offset timestamp)
  const martaId = `sr-${Date.now() + 1}-${uniqueId(6)}`;
  await createSurveyResponse(martaId, {
    _userId: MARTA_USER_ID,
    surveyDefinitionId: SURVEY_ID,
    type: 'full',
    timestamp: backdatedTimestamp,
    scores: martaScores,
    surveyActionId: null
  });
  console.log(`  Marta's response: ${martaId}`);

  // Compute and store focus dimensions
  console.log('\nComputing focus dimensions...');
  const { focusDimensions, combinedScores } = await recalculateFocus(SURVEY_ID);

  console.log('\nFocus dimensions (3 lowest + 2 highest combined):');
  for (const dim of focusDimensions) {
    const score = combinedScores[dim];
    console.log(`  ${dim}: ${score.combined.toFixed(2)}`);
  }

  console.log('\nAll combined scores:');
  const sorted = Object.entries(combinedScores)
    .sort((a, b) => a[1].combined - b[1].combined);
  for (const [dim, scores] of sorted) {
    const marker = focusDimensions.includes(dim) ? ' <-- FOCUS' : '';
    console.log(`  ${dim}: ${scores.combined.toFixed(2)}${marker}`);
  }

  console.log('\nDone.');
  process.exit(0);
}

main().catch(err => {
  console.error('Error seeding survey responses:', err);
  process.exit(1);
});
