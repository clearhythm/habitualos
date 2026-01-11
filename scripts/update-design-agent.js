#!/usr/bin/env node
//
// scripts/update-design-agent.js
// Script to update the HabitualOS Design Agent with new framing and timeline
//

require('dotenv').config();
const { db } = require('../netlify/functions/_utils/firestore.cjs');

async function updateDesignAgent() {
  try {
    console.log('🔍 Searching for HabitualOS Design Agent...\n');

    // Query all agents
    const agentsSnapshot = await db.collection('agents').get();

    if (agentsSnapshot.empty) {
      console.log('❌ No agents found in database');
      return;
    }

    console.log(`Found ${agentsSnapshot.size} agents total\n`);

    // Find the design agent
    let designAgent = null;
    agentsSnapshot.forEach(doc => {
      const agent = { id: doc.id, ...doc.data() };
      console.log(`- ${agent.name} (${agent.id})`);

      if (agent.name && agent.name.toLowerCase().includes('design')) {
        designAgent = agent;
      }
    });

    if (!designAgent) {
      console.log('\n❌ Could not find HabitualOS Design Agent');
      return;
    }

    console.log(`\n✅ Found design agent: ${designAgent.name}`);
    console.log(`   ID: ${designAgent.id}`);
    console.log(`   Current goal: ${designAgent.instructions?.goal || 'N/A'}`);
    console.log(`   Current timeline: ${designAgent.instructions?.timeline || 'N/A'}`);

    // Update the agent with new framing
    const updates = {
      name: 'HabitualOS Architecture Agent',
      'instructions.goal': 'A strategic architecture agent that generates actionable Claude Code prompts for implementing HabitualOS features and improvements.',
      'instructions.timeline': 'Ongoing',
      _updatedAt: new Date().toISOString()
    };

    console.log('\n📝 Updating agent with:');
    console.log(`   New name: ${updates.name}`);
    console.log(`   New goal: ${updates['instructions.goal']}`);
    console.log(`   New timeline: ${updates['instructions.timeline']}`);

    await db.collection('agents').doc(designAgent.id).update(updates);

    console.log('\n✅ Agent updated successfully!');

  } catch (error) {
    console.error('❌ Error updating agent:', error);
    process.exit(1);
  }
}

// Run the script
updateDesignAgent()
  .then(() => {
    console.log('\n✨ Done!');
    process.exit(0);
  })
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
