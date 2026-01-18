/**
 * One-time script to:
 * 1. Update action-mkj1birb43i0 to have measurement taskType and taskConfig
 * 2. Create the first measurement record from today's check-in
 *
 * Run with: node scripts/setup-measurement-action.js
 */

require('dotenv').config();
const { db, admin } = require('../netlify/functions/_utils/firestore.cjs');

async function main() {
  const actionId = 'action-mkj1birb43i0';

  // Get the action to find userId and agentId
  const actionRef = db.collection('actions').doc(actionId);
  const actionSnap = await actionRef.get();

  if (!actionSnap.exists) {
    console.error('Action not found:', actionId);
    process.exit(1);
  }

  const action = actionSnap.data();
  console.log('Found action:', action.title);
  console.log('User:', action._userId);
  console.log('Agent:', action.agentId);

  // Update action with measurement config
  const taskConfig = {
    dimensions: ['focus', 'body', 'connection', 'hope', 'embodiment'],
    recurrence: { type: 'daily', time: '09:00' }
  };

  await actionRef.update({
    taskType: 'measurement',
    taskConfig: taskConfig
  });

  console.log('\nUpdated action with taskType: measurement and taskConfig:', taskConfig);

  // Create the first measurement
  const measurementId = `m-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

  const measurementData = {
    _userId: action._userId,
    agentId: action.agentId,
    actionId: actionId,
    timestamp: new Date().toISOString(),
    _createdAt: admin.firestore.FieldValue.serverTimestamp(),
    _updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    dimensions: [
      { name: 'focus', score: 3, notes: "Doesn't know how to use this tool optimally or evolve it" },
      { name: 'body', score: 4, notes: null },
      { name: 'connection', score: 2, notes: "Woke up tired, feeling not enough time for work, doesn't feel safe around wife" },
      { name: 'hope', score: 4, notes: "Doesn't know what article to start with, fear of putting self out there" },
      { name: 'embodiment', score: 0, notes: "Did not do practice today" }
    ],
    notes: null
  };

  await db.collection('measurements').doc(measurementId).set(measurementData);

  console.log('\nCreated measurement:', measurementId);
  console.log('Dimensions:', measurementData.dimensions.map(d => `${d.name}: ${d.score}`).join(', '));

  console.log('\nDone! The action is now configured for measurement check-ins.');
  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
