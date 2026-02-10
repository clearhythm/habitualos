#!/usr/bin/env node
/**
 * scripts/seed-survey-definition.js
 *
 * Seeds the master relationship health survey definition to Firestore.
 * Questions match the Google Forms "Comprehensive Relationship Health Assessment".
 *
 * Usage: node scripts/seed-survey-definition.js
 */

require('dotenv').config();
const { createSurveyDefinition } = require('../packages/survey-engine');

const SURVEY_ID = 'survey-rel-v1';

const surveyDefinition = {
  title: 'Relationship Health Survey',
  version: 1,
  scale: { min: 1, max: 5, labels: ['Never / Strongly Disagree', 'Rarely / Disagree', 'Sometimes / Not Sure', 'Most of the time / Agree', 'Always / Strongly Agree'] },
  dimensions: [
    {
      name: 'Communication Patterns',
      questions: [
        'I feel heard and understood when I express myself.',
        'We can talk about difficult topics without shutdown or escalation.',
        'We share openly about thoughts, plans, and feelings.'
      ]
    },
    {
      name: 'Emotional Intimacy and Connection',
      questions: [
        'I feel emotionally close and safe with my partner.',
        'I can share vulnerably and get comforted in distress.',
        'I feel seen, valued, and accepted for who I really am.'
      ]
    },
    {
      name: 'Physical & Sexual Intimacy',
      questions: [
        'I am satisfied with our physical/sexual connection.',
        'I feel safe expressing desires, boundaries, and preferences.',
        'Our physical intimacy feels emotionally connected.'
      ]
    },
    {
      name: 'Conflict Resolution & Problem Solving',
      questions: [
        'We handle disagreements in a healthy and constructive way.',
        'Our issues get addressed and resolved, not recycled.',
        'We are able to repair and reconnect after conflict.'
      ]
    },
    {
      name: 'Shared Values & Life Vision',
      questions: [
        'We are aligned on major life areas (children, goals, lifestyle, etc.).',
        'We share a common vision for the future of our family.'
      ]
    },
    {
      name: 'Division of Labor & Responsibilities',
      questions: [
        'The division of chores, parenting, and emotional labor feels fair to me.',
        'We communicate clearly about responsibilities.'
      ]
    },
    {
      name: 'Financial Management',
      questions: [
        'We are transparent and collaborative in financial decisions.',
        'We agree on financial priorities and habits.'
      ]
    },
    {
      name: 'Individual Autonomy & Identity',
      questions: [
        'I have sufficient space for personal interests and friendships.',
        'I feel supported in my individuality and independence.'
      ]
    },
    {
      name: 'Trust & Commitment',
      questions: [
        'I feel emotionally safe in our relationship.',
        'I feel physically safe in our relationship.',
        'I trust my partner\'s honesty and intentions.',
        'I feel secure in my partner\'s commitment to our union.',
        'I feel like I can rely on my partner.'
      ]
    },
    {
      name: 'Friendship, Play & Appreciation',
      questions: [
        'We enjoy spending time together beyond responsibilities.',
        'We laugh, play, or share lightness.',
        'We express appreciation and gratitude for each other.'
      ]
    }
  ]
};

async function main() {
  console.log(`Seeding survey definition: ${SURVEY_ID}`);
  const totalQuestions = surveyDefinition.dimensions.reduce((sum, d) => sum + d.questions.length, 0);
  console.log(`  ${surveyDefinition.dimensions.length} dimensions, ${totalQuestions} questions\n`);

  await createSurveyDefinition(SURVEY_ID, surveyDefinition);

  console.log('Survey definition seeded successfully.');
  process.exit(0);
}

main().catch(err => {
  console.error('Error seeding survey definition:', err);
  process.exit(1);
});
