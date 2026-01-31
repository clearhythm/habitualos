require('dotenv').config();
const { db } = require('./_utils/firestore.cjs');

/**
 * POST /api/migrate-collections
 *
 * One-time migration script to copy documents from old collection names to new ones:
 * - projects -> work-projects
 * - actions -> work-actions
 *
 * Run this once after deploying the collection rename changes.
 * Safe to run multiple times (uses set with merge).
 */
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ success: false, error: 'Method not allowed' })
    };
  }

  try {
    const results = {
      projects: { migrated: 0, errors: [] },
      actions: { migrated: 0, errors: [] }
    };

    // Migrate projects -> work-projects
    console.log('Migrating projects collection...');
    const projectsSnap = await db.collection('projects').get();

    for (const doc of projectsSnap.docs) {
      try {
        const data = doc.data();
        await db.collection('work-projects').doc(doc.id).set(data, { merge: true });
        results.projects.migrated++;
        console.log(`  Migrated project: ${doc.id}`);
      } catch (err) {
        results.projects.errors.push({ id: doc.id, error: err.message });
        console.error(`  Error migrating project ${doc.id}:`, err.message);
      }
    }

    // Migrate actions -> work-actions
    console.log('Migrating actions collection...');
    const actionsSnap = await db.collection('actions').get();

    for (const doc of actionsSnap.docs) {
      try {
        const data = doc.data();
        await db.collection('work-actions').doc(doc.id).set(data, { merge: true });
        results.actions.migrated++;
        console.log(`  Migrated action: ${doc.id}`);
      } catch (err) {
        results.actions.errors.push({ id: doc.id, error: err.message });
        console.error(`  Error migrating action ${doc.id}:`, err.message);
      }
    }

    console.log('Migration complete:', results);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        message: 'Migration complete',
        results
      })
    };

  } catch (error) {
    console.error('Migration error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message
      })
    };
  }
};
