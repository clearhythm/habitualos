#!/usr/bin/env node
/**
 * One-time script: patch Spock and Data synthesizedContext + tagline to first-person.
 * Run: node tests/patch-demo-bios.cjs
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { updateOwner } = require('../netlify/functions/_services/db-signal-owners.cjs');

const patches = {
  spock: {
    tagline: "Science Officer, Starfleet. Half-Vulcan. Fully committed.",
    synthesizedContext: `My function is the application of logic to problems that resist it. I operate across xenobiology, systems architecture, and command decision theory — not as separate disciplines, but as a unified framework. Most inefficiencies in complex systems trace to emotion applied where evidence was available. I have found that naming the limits of one's own reasoning, precisely and without apology, is more useful than concealing them.`
  },
  'data-tng': {
    tagline: "Lt. Commander, USS Enterprise-D. Android. Aspiring to understand.",
    synthesizedContext: `I process crew operations, tactical analysis, and systems architecture with a consistency that biological officers describe as either reassuring or unsettling, depending on the situation. I do not experience uncertainty as a state — I quantify it and proceed. My limitation is not processing capacity; it is the incomplete nature of human variables, which I am continuously modeling. Understanding how humans make decisions remains my most complex ongoing project, and the one I find most instructive.`
  }
};

async function run() {
  for (const [signalId, patch] of Object.entries(patches)) {
    try {
      await updateOwner(signalId, patch);
      console.log(`✓ Patched ${signalId}`);
    } catch (err) {
      console.error(`✗ Failed ${signalId}:`, err.message);
    }
  }
}

run();
