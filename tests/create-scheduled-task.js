const path = require('path');
const { getActiveNorthStar, insertNorthStar, insertActionCard } = require('../db/helpers');
require('dotenv').config();

console.log('[Test] Creating scheduled task for future execution...');

// Ensure we have a NorthStar
let northStar = getActiveNorthStar();
if (!northStar) {
  console.log('[Test] No active NorthStar found, creating one...');
  northStar = insertNorthStar({
    title: 'Test NorthStar',
    goal: 'Test the scheduled task execution system',
    success_criteria: ['System executes tasks on schedule', 'Cards are generated correctly'],
    timeline: '2025-12'
  });
  console.log(`[Test] Created NorthStar: ${northStar.id}`);
}

// Create scheduled task
const taskConfig = {
  inputs_path: path.join(__dirname, '../data/tasks/test/inputs'),
  outputs_path: path.join(__dirname, '../data/tasks/test/outputs'),
  cards_per_subject: 3
};

// Schedule for 2 minutes from now
const now = new Date();
const scheduleTime = new Date(now.getTime() + 2 * 60 * 1000); // 2 minutes from now

const task = insertActionCard({
  north_star_id: northStar.id,
  title: 'Scheduled Test Card Generation',
  description: 'Automated test: Generate 3 test cards for Alice and Bob at scheduled time',
  priority: 'high',
  task_type: 'scheduled',
  schedule_time: scheduleTime.toISOString(),
  task_config: taskConfig
});

console.log('\n[Test] ✓ Scheduled task created successfully!');
console.log(`Task ID: ${task.id}`);
console.log(`Current time: ${now.toISOString()}`);
console.log(`Scheduled for: ${scheduleTime.toISOString()}`);
console.log(`Time until execution: 2 minutes`);
console.log(`\nInputs: ${taskConfig.inputs_path}`);
console.log(`Outputs: ${taskConfig.outputs_path}`);
console.log('\nTo test scheduler, run:');
console.log('  npm run scheduler');
console.log('  (watch for task execution in ~2 minutes)');
