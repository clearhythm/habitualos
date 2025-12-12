const cron = require('node-cron');
const executeTask = require('./task-executor');
const { getScheduledTasksDue } = require('../db/helpers');
require('dotenv').config();

console.log('[Scheduler] Starting HabitualOS Task Scheduler...');

// Track currently executing tasks to prevent duplicates
const executingTasks = new Set();

/**
 * Check for and execute due tasks
 */
async function checkAndExecuteTasks() {
  try {
    const dueTasks = getScheduledTasksDue();

    if (dueTasks.length === 0) {
      return; // No tasks due, nothing to log
    }

    console.log(`[Scheduler] Found ${dueTasks.length} task(s) due for execution`);

    for (const task of dueTasks) {
      // Skip if already executing
      if (executingTasks.has(task.id)) {
        console.log(`[Scheduler] Task ${task.id} already executing, skipping`);
        continue;
      }

      console.log(`[Scheduler] Starting task: ${task.title} (ID: ${task.id})`);

      // Mark as executing
      executingTasks.add(task.id);

      // Execute task (non-blocking)
      executeTask(task.id)
        .then(() => {
          console.log(`[Scheduler] ✓ Task ${task.id} completed successfully`);
          executingTasks.delete(task.id);
        })
        .catch((error) => {
          console.error(`[Scheduler] ✗ Task ${task.id} failed:`, error.message);
          executingTasks.delete(task.id);
        });
    }
  } catch (error) {
    console.error('[Scheduler] Error checking for due tasks:', error);
  }
}

// Schedule to run every minute
cron.schedule('* * * * *', () => {
  checkAndExecuteTasks();
});

console.log('[Scheduler] Cron job scheduled (runs every minute)');
console.log('[Scheduler] Waiting for scheduled tasks...');

// Initial check on startup
checkAndExecuteTasks();

// Keep the process alive
process.on('SIGINT', () => {
  console.log('\n[Scheduler] Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n[Scheduler] Shutting down gracefully...');
  process.exit(0);
});
