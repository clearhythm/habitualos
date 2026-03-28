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
    synthesizedContext: `I work at the intersection of scientific methodology and command judgment. My expertise spans xenobiology, computer architecture, and systems-level problem-solving — I approach each as a question requiring evidence, not assumption. I've operated effectively under extreme operational pressure, integrating multiple technical domains simultaneously rather than specializing in one. My dual heritage creates a useful tension: Vulcan logic as the default, human intuition as the override when the data runs out.`
  },
  'data-tng': {
    tagline: "Lt. Commander, USS Enterprise-D. Android. Aspiring to understand.",
    synthesizedContext: `I process information across systems architecture, tactical analysis, and crew operations with a consistency that human officers find either reassuring or unsettling, depending on the situation. I am not impaired by uncertainty — I quantify it and proceed. My limitation is not processing capacity; it is the incomplete nature of human variables, which I am continuously modeling. Understanding how humans make decisions remains my most complex ongoing project, and the one I find most instructive.`
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
