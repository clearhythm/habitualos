#!/usr/bin/env node
require('dotenv').config();
const { db } = require('../netlify/functions/_utils/firestore.cjs');

async function getLatestChat() {
  try {
    const snapshot = await db.collection('agent-chats').orderBy('_createdAt', 'desc').limit(1).get();

    if (snapshot.empty) {
      console.log('No chats found');
      return;
    }

    const doc = snapshot.docs[0];
    const data = doc.data();

    console.log('Chat ID:', doc.id);
    console.log('Agent ID:', data.agentId);
    console.log('Generated Assets:', JSON.stringify(data.generatedAssets, null, 2));
    console.log('Generated Actions:', JSON.stringify(data.generatedActions, null, 2));
    console.log('\n=== MESSAGES ===');
    data.messages.forEach((msg, i) => {
      console.log(`\n[${i}] ${msg.role}:`);
      console.log(msg.content.substring(0, 800));
      if (msg.content.length > 800) console.log('...(truncated)');
    });
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

getLatestChat().then(() => process.exit(0));
