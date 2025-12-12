const path = require('path');
const { getActiveNorthStar, insertNorthStar, insertActionCard } = require('../db/helpers');
require('dotenv').config();

console.log('[Test] Creating test scheduled task...');

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

// For manual testing, set schedule_time to now (task will be due immediately)
// For scheduler testing, set it to a few minutes in the future
const now = new Date();
const scheduleTime = now.toISOString(); // Immediate execution for manual test

const task = insertActionCard({
  north_star_id: northStar.id,
  title: 'Test Card Generation',
  description: 'Generate 3 test cards for Alice and Bob to verify the scheduled task system works',
  priority: 'high',
  task_type: 'scheduled',
  schedule_time: scheduleTime,
  task_config: taskConfig
});

console.log('\n[Test] ✓ Task created successfully!');
console.log(`Task ID: ${task.id}`);
console.log(`Schedule: ${scheduleTime}`);
console.log(`Inputs: ${taskConfig.inputs_path}`);
console.log(`Outputs: ${taskConfig.outputs_path}`);
console.log('\nTo test manually, run:');
console.log(`  node -e "require('./scheduler/task-executor')('${task.id}')"`);
console.log('\nTo test with scheduler, run:');
console.log(`  npm run scheduler`);
console.log('  (scheduler will pick up the task on next minute check)');
