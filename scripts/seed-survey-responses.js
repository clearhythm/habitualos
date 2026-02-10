#!/usr/bin/env node
/**
 * scripts/seed-survey-responses.js
 *
 * Uploads backdated full-survey responses for Erik and Marta,
 * then computes and stores the initial focus dimensions.
 *
 * Usage: node scripts/seed-survey-responses.js
 *
 * Real scores extracted from Google Forms CSV export.
 * Scale: 1-5 (1=Never/Strongly Disagree, 5=Always/Strongly Agree).
 */

require('dotenv').config();
const { createSurveyResponse, recalculateFocus } = require('../packages/survey-engine');
const { uniqueId } = require('../packages/db-core');

const SURVEY_ID = 'survey-rel-v1';

// TODO: Replace with actual user IDs from Firestore
const ERIK_USER_ID = 'u-mgpqwa49';
const MARTA_USER_ID = 'u-mgprma90';

// Backdated to ~1 week ago
const backdatedTimestamp = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

// Real scores from Google Forms CSV (scale: 1-5)
// Erik: 2/4/2026, Marta: 2/3/2026
const erikScores = [
  { dimension: 'Communication Patterns', questionScores: [3, 2, 2], average: 2.33 },
  { dimension: 'Emotional Intimacy and Connection', questionScores: [2, 2, 2], average: 2.0 },
  { dimension: 'Physical & Sexual Intimacy', questionScores: [1, 2, 1], average: 1.33 },
  { dimension: 'Conflict Resolution & Problem Solving', questionScores: [2, 2, 2], average: 2.0 },
  { dimension: 'Shared Values & Life Vision', questionScores: [2, 2], average: 2.0 },
  { dimension: 'Division of Labor & Responsibilities', questionScores: [4, 4], average: 4.0 },
  { dimension: 'Financial Management', questionScores: [1, 2], average: 1.5 },
  { dimension: 'Individual Autonomy & Identity', questionScores: [3, 3], average: 3.0 },
  { dimension: 'Trust & Commitment', questionScores: [2, 4, 3, 4, 2], average: 3.0 },
  { dimension: 'Friendship, Play & Appreciation', questionScores: [3, 3, 3], average: 3.0 }
];

const martaScores = [
  { dimension: 'Communication Patterns', questionScores: [4, 2, 3], average: 3.0 },
  { dimension: 'Emotional Intimacy and Connection', questionScores: [3, 4, 3], average: 3.33 },
  { dimension: 'Physical & Sexual Intimacy', questionScores: [2, 3, 4], average: 3.0 },
  { dimension: 'Conflict Resolution & Problem Solving', questionScores: [2, 1, 4], average: 2.33 },
  { dimension: 'Shared Values & Life Vision', questionScores: [3, 3], average: 3.0 },
  { dimension: 'Division of Labor & Responsibilities', questionScores: [3, 3], average: 3.0 },
  { dimension: 'Financial Management', questionScores: [3, 2], average: 2.5 },
  { dimension: 'Individual Autonomy & Identity', questionScores: [3, 5], average: 4.0 },
  { dimension: 'Trust & Commitment', questionScores: [3, 4, 2, 3, 2], average: 2.8 },
  { dimension: 'Friendship, Play & Appreciation', questionScores: [4, 4, 3], average: 3.67 }
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
