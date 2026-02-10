#!/usr/bin/env node
/**
 * scripts/seed-survey-definition.js
 *
 * Seeds the master relationship health survey definition to Firestore.
 * Uses placeholder dimensions/questions — replace with real content later.
 *
 * Usage: node scripts/seed-survey-definition.js
 */

require('dotenv').config();
const { createSurveyDefinition } = require('../packages/survey-engine');

const SURVEY_ID = 'survey-rel-v1';

const surveyDefinition = {
  title: 'Relationship Health Survey',
  version: 1,
  dimensions: [
    {
      name: 'Communication',
      questions: [
        'How well are you expressing your needs to your partner?',
        'How well is your partner hearing and understanding you?',
        'How comfortable are you bringing up difficult topics?'
      ]
    },
    {
      name: 'Trust',
      questions: [
        'How much do you trust your partner with your vulnerabilities?',
        'How reliable does your partner feel to you right now?',
        'How safe do you feel being fully honest?'
      ]
    },
    {
      name: 'Intimacy',
      questions: [
        'How connected do you feel to your partner emotionally?',
        'How satisfied are you with physical closeness and affection?',
        'How comfortable are you initiating intimacy?'
      ]
    },
    {
      name: 'Conflict Resolution',
      questions: [
        'How well are you and your partner resolving disagreements?',
        'How quickly do you recover from arguments?',
        'How fair do your conflicts feel?'
      ]
    },
    {
      name: 'Appreciation',
      questions: [
        'How appreciated do you feel by your partner?',
        'How often do you express gratitude toward your partner?',
        'How noticed do your efforts feel?'
      ]
    },
    {
      name: 'Shared Goals',
      questions: [
        'How aligned do you feel on your future together?',
        'How well are you working together toward shared goals?',
        'How supported do you feel in your individual goals?'
      ]
    },
    {
      name: 'Fun & Play',
      questions: [
        'How much fun are you having together?',
        'How often do you laugh together?',
        'How adventurous does your relationship feel?'
      ]
    },
    {
      name: 'Emotional Support',
      questions: [
        'How supported do you feel during hard times?',
        'How comfortable are you leaning on your partner?',
        'How well does your partner respond when you are struggling?'
      ]
    },
    {
      name: 'Independence',
      questions: [
        'How well does your relationship support your individual identity?',
        'How comfortable are you spending time apart?',
        'How balanced is togetherness vs. personal space?'
      ]
    },
    {
      name: 'Growth',
      questions: [
        'How much is your relationship helping you grow as a person?',
        'How open are you both to feedback and change?',
        'How much are you evolving together?'
      ]
    }
  ]
};

async function main() {
  console.log(`Seeding survey definition: ${SURVEY_ID}`);
  console.log(`  ${surveyDefinition.dimensions.length} dimensions, ${surveyDefinition.dimensions.length * 3} questions\n`);

  await createSurveyDefinition(SURVEY_ID, surveyDefinition);

  console.log('Survey definition seeded successfully.');
  process.exit(0);
}

main().catch(err => {
  console.error('Error seeding survey definition:', err);
  process.exit(1);
});
