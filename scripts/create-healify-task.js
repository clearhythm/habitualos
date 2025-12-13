#!/usr/bin/env node
/**
 * Create Healify Shift Card Generation Task
 *
 * This script:
 * 1. Creates the folder structure for inputs/outputs
 * 2. Inserts the scheduled task into the database
 * 3. Schedules it for a specified time (default: 2 minutes from now)
 */

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const { v4: uuidv4 } = require('uuid');

// Configuration
const TASK_NAME = 'Generate Healify Shift Cards';
const TASK_DESCRIPTION = 'Generate personalized shift cards for Healify users based on their goals and progress';
const CARDS_PER_USER = 3;
const MINUTES_FROM_NOW = 2; // Schedule task for N minutes from now

// Paths
const PROJECT_ROOT = path.join(__dirname, '..');
const DB_PATH = path.join(PROJECT_ROOT, 'data', 'habitualos.db');
const TASK_ID = uuidv4();
const TASK_DIR = path.join(PROJECT_ROOT, 'data', 'tasks', 'healify-shift-cards');
const INPUTS_DIR = path.join(TASK_DIR, 'inputs');
const OUTPUTS_DIR = path.join(TASK_DIR, 'outputs');

// Calculate schedule time
const scheduleTime = new Date();
scheduleTime.setMinutes(scheduleTime.getMinutes() + MINUTES_FROM_NOW);
const scheduleTimeISO = scheduleTime.toISOString();

console.log('🚀 Creating Healify Shift Card Generation Task...\n');

// Step 1: Create folder structure
console.log('📁 Creating folder structure...');
fs.mkdirSync(INPUTS_DIR, { recursive: true });
fs.mkdirSync(OUTPUTS_DIR, { recursive: true });
console.log(`   ✓ Created ${INPUTS_DIR}`);
console.log(`   ✓ Created ${OUTPUTS_DIR}\n`);

// Step 2: Create placeholder context.md (user will edit this)
const contextTemplate = `# Healify Shift Card Generation

You are an AI assistant helping to generate personalized shift cards for Healify users. Shift cards are daily motivational and actionable messages designed to help users maintain their health habits.

## Card Style Guide

Each card should:
- Be encouraging and positive
- Focus on ONE specific action the user can take today
- Reference the user's specific goals when relevant
- Be concise (2-3 short paragraphs max)
- End with an empowering statement

## Example Card Format

### Card 1: Motivational Focus
Start with encouragement based on their recent progress or goals. Acknowledge where they are in their journey.

### Card 2: Actionable Tip
Provide ONE specific, small action they can take today that aligns with their goals.

### Card 3: Progress Reflection
Help them reflect on their journey and celebrate small wins.

## User Data Available

You will receive JSON data for each user containing:
- name: User's name
- goals: Array of their health goals
- progress: Recent progress data
- preferences: Any specific preferences or focus areas

## Output Format

For each user, generate exactly ${CARDS_PER_USER} cards in this format:

=== CARD 1 ===
[Card content here]

=== CARD 2 ===
[Card content here]

=== CARD 3 ===
[Card content here]

Keep each card focused, actionable, and personalized to the user's data.
`;

fs.writeFileSync(path.join(INPUTS_DIR, 'context.md'), contextTemplate);
console.log('📝 Created context.md template\n');

// Step 3: Create sample user data
const sampleUser = {
  name: 'Alice',
  goals: [
    'Improve coding skills',
    'Build a personal project',
    'Learn React'
  ],
  progress: {
    days_active: 7,
    completed_tasks: 3,
    current_streak: 5
  },
  preferences: {
    focus: 'web development',
    difficulty: 'beginner'
  }
};

fs.writeFileSync(
  path.join(INPUTS_DIR, 'alice.json'),
  JSON.stringify(sampleUser, null, 2)
);
console.log('👤 Created sample user: alice.json\n');

// Step 4: Get North Star ID (we'll use the first one)
const db = new Database(DB_PATH);
const northstar = db.prepare('SELECT id FROM north_stars LIMIT 1').get();

if (!northstar) {
  console.error('❌ Error: No North Star found. Please set up your North Star first.');
  process.exit(1);
}

// Step 5: Insert task into database
console.log('💾 Inserting task into database...');

const taskConfig = {
  inputs_path: INPUTS_DIR,
  outputs_path: OUTPUTS_DIR,
  cards_per_subject: CARDS_PER_USER
};

const insertStmt = db.prepare(`
  INSERT INTO action_cards (
    id,
    north_star_id,
    title,
    description,
    state,
    priority,
    task_type,
    schedule_time,
    task_config,
    created_at,
    updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
`);

insertStmt.run(
  TASK_ID,
  northstar.id,
  TASK_NAME,
  TASK_DESCRIPTION,
  'open',
  'high',
  'scheduled',
  scheduleTimeISO,
  JSON.stringify(taskConfig)
);

db.close();

console.log(`   ✓ Task created with ID: ${TASK_ID}\n`);

// Summary
console.log('✅ Task setup complete!\n');
console.log('📊 Summary:');
console.log(`   Task ID: ${TASK_ID}`);
console.log(`   Scheduled for: ${scheduleTime.toLocaleString()}`);
console.log(`   (${MINUTES_FROM_NOW} minutes from now)\n`);
console.log('📂 Next steps:');
console.log(`   1. Edit context.md: ${path.join(INPUTS_DIR, 'context.md')}`);
console.log(`   2. Add more user JSON files to: ${INPUTS_DIR}`);
console.log(`   3. Wait for scheduled time, or use "Run Now" button in UI\n`);
console.log(`🌐 View task: http://localhost:8888/action/${TASK_ID}\n`);
