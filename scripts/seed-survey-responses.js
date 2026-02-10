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
 * Scale: 0-4 (0=Never/Strongly Disagree, 4=Always/Strongly Agree).
 * Original Google Forms used 1-5; we subtract 1 so "Never" = 0.
 */

require('dotenv').config();
const { createSurveyResponse, recalculateFocus } = require('../packages/survey-engine');
const { uniqueId, query, remove } = require('../packages/db-core');

const SURVEY_ID = 'survey-rel-v1';

// TODO: Replace with actual user IDs from Firestore
const ERIK_USER_ID = 'u-mgpqwa49';
const MARTA_USER_ID = 'u-mgprma90';

// Backdated to ~1 week ago (passed as _createdAt to override server timestamp)
const backdatedCreatedAt = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString();

// Real scores from Google Forms CSV (converted to 0-4 scale)
// Original 1-5 values minus 1. Erik: 2/4/2026, Marta: 2/3/2026
// `score` is the normalized percentage (average / 4 * 100)
const erikScores = [
  { dimension: 'Communication Patterns', questionScores: [2, 1, 1], average: 1.33, score: 33.25 },
  { dimension: 'Emotional Intimacy and Connection', questionScores: [1, 1, 1], average: 1.0, score: 25.0 },
  { dimension: 'Physical & Sexual Intimacy', questionScores: [0, 1, 0], average: 0.33, score: 8.25 },
  { dimension: 'Conflict Resolution & Problem Solving', questionScores: [1, 1, 1], average: 1.0, score: 25.0 },
  { dimension: 'Shared Values & Life Vision', questionScores: [1, 1], average: 1.0, score: 25.0 },
  { dimension: 'Division of Labor & Responsibilities', questionScores: [3, 3], average: 3.0, score: 75.0 },
  { dimension: 'Financial Management', questionScores: [0, 1], average: 0.5, score: 12.5 },
  { dimension: 'Individual Autonomy & Identity', questionScores: [2, 2], average: 2.0, score: 50.0 },
  { dimension: 'Trust & Commitment', questionScores: [1, 3, 2, 3, 1], average: 2.0, score: 50.0 },
  { dimension: 'Friendship, Play & Appreciation', questionScores: [2, 2, 2], average: 2.0, score: 50.0 }
];

const martaScores = [
  { dimension: 'Communication Patterns', questionScores: [3, 1, 2], average: 2.0, score: 50.0 },
  { dimension: 'Emotional Intimacy and Connection', questionScores: [2, 3, 2], average: 2.33, score: 58.25 },
  { dimension: 'Physical & Sexual Intimacy', questionScores: [1, 2, 3], average: 2.0, score: 50.0 },
  { dimension: 'Conflict Resolution & Problem Solving', questionScores: [1, 0, 3], average: 1.33, score: 33.25 },
  { dimension: 'Shared Values & Life Vision', questionScores: [2, 2], average: 2.0, score: 50.0 },
  { dimension: 'Division of Labor & Responsibilities', questionScores: [2, 2], average: 2.0, score: 50.0 },
  { dimension: 'Financial Management', questionScores: [2, 1], average: 1.5, score: 37.5 },
  { dimension: 'Individual Autonomy & Identity', questionScores: [2, 4], average: 3.0, score: 75.0 },
  { dimension: 'Trust & Commitment', questionScores: [2, 3, 1, 2, 1], average: 1.8, score: 45.0 },
  { dimension: 'Friendship, Play & Appreciation', questionScores: [3, 3, 2], average: 2.67, score: 66.75 }
];

async function main() {
  // Clean up old survey-responses for this survey definition
  console.log('Cleaning up old survey responses...');
  const existing = await query({ collection: 'survey-responses', where: `surveyDefinitionId::eq::${SURVEY_ID}` });
  for (const doc of existing) {
    await remove({ collection: 'survey-responses', id: doc.id });
    console.log(`  Deleted: ${doc.id}`);
  }

  console.log('Seeding survey responses...\n');

  // Create Erik's response
  const erikId = `sr-${Date.now()}-${uniqueId(6)}`;
  await createSurveyResponse(erikId, {
    _userId: ERIK_USER_ID,
    surveyDefinitionId: SURVEY_ID,
    type: 'full',
    _createdAt: backdatedCreatedAt,
    scores: erikScores,
    surveyActionId: null
  });
  console.log(`  Erik's response: ${erikId}`);

  // Create Marta's response
  const martaId = `sr-${Date.now() + 1}-${uniqueId(6)}`;
  await createSurveyResponse(martaId, {
    _userId: MARTA_USER_ID,
    surveyDefinitionId: SURVEY_ID,
    type: 'full',
    _createdAt: backdatedCreatedAt,
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
