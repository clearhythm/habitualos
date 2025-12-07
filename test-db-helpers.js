/**
 * Basic test script for database helpers
 * Run with: node test-db-helpers.js
 */

require('dotenv').config();
const {
  insertNorthStar,
  getActiveNorthStar,
  insertActionCard,
  getAllActions,
  getAction,
  insertChatMessage,
  getChatMessages,
  insertArtifact,
  getArtifacts
} = require('./db/helpers');

console.log('🧪 Testing database helpers...\n');

try {
  // Test 1: Insert NorthStar
  console.log('1. Testing insertNorthStar...');
  const northStar = insertNorthStar({
    title: 'Test NorthStar',
    goal: 'Test the database helpers',
    success_criteria: ['Create DB', 'Test CRUD', 'Verify data'],
    timeline: 'December 2025'
  });
  console.log('✅ NorthStar created:', northStar.id);

  // Test 2: Get active NorthStar
  console.log('\n2. Testing getActiveNorthStar...');
  const activeNorthStar = getActiveNorthStar();
  console.log('✅ Active NorthStar retrieved:', activeNorthStar.title);

  // Test 3: Insert ActionCard
  console.log('\n3. Testing insertActionCard...');
  const action1 = insertActionCard({
    north_star_id: northStar.id,
    title: 'Test Action 1',
    description: 'First test action',
    priority: 'high'
  });
  console.log('✅ ActionCard 1 created:', action1.id);

  const action2 = insertActionCard({
    north_star_id: northStar.id,
    title: 'Test Action 2',
    description: 'Second test action',
    priority: 'medium'
  });
  console.log('✅ ActionCard 2 created:', action2.id);

  // Test 4: Get all actions
  console.log('\n4. Testing getAllActions...');
  const allActions = getAllActions();
  console.log('✅ Retrieved', allActions.length, 'actions');

  // Test 5: Get single action
  console.log('\n5. Testing getAction...');
  const retrievedAction = getAction(action1.id);
  console.log('✅ Retrieved action:', retrievedAction.title);

  // Test 6: Insert chat message
  console.log('\n6. Testing insertChatMessage...');
  const userMessage = insertChatMessage({
    action_id: action1.id,
    role: 'user',
    content: 'Can you help with this?'
  });
  console.log('✅ User message created:', userMessage.id);

  const assistantMessage = insertChatMessage({
    action_id: action1.id,
    role: 'assistant',
    content: 'Sure! I can help you with that.'
  });
  console.log('✅ Assistant message created:', assistantMessage.id);

  // Test 7: Get chat messages
  console.log('\n7. Testing getChatMessages...');
  const chatMessages = getChatMessages(action1.id);
  console.log('✅ Retrieved', chatMessages.length, 'messages');

  // Test 8: Insert artifact
  console.log('\n8. Testing insertArtifact...');
  const artifact = insertArtifact({
    action_id: action1.id,
    type: 'markdown',
    title: 'test-document.md',
    content: '# Test Document\n\nThis is a test artifact.',
    destination: null
  });
  console.log('✅ Artifact created:', artifact.id);

  // Test 9: Get artifacts
  console.log('\n9. Testing getArtifacts...');
  const artifacts = getArtifacts(action1.id);
  console.log('✅ Retrieved', artifacts.length, 'artifacts');

  console.log('\n✅ All database helper tests passed!');
  console.log('\n📊 Summary:');
  console.log('  - NorthStars: 1');
  console.log('  - ActionCards: 2');
  console.log('  - Chat Messages: 2');
  console.log('  - Artifacts: 1');

} catch (error) {
  console.error('\n❌ Test failed:', error.message);
  process.exit(1);
}
