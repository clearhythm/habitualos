/**
 * Shared Firestore Utility: firestore.cjs
 *
 * This module provides reusable Firestore admin access for HabitualOS.
 * It initializes Firebase Admin SDK using credentials from environment variables.
 *
 * Used by all Netlify serverless functions that need Firestore access.
 *
 * NOTE: Requires FIREBASE_ADMIN_CREDENTIALS env var to be set (as JSON string).
 */
require('dotenv').config();
const admin = require('firebase-admin');

function initAdmin() {
  if (admin.apps.length) return;

  // Get credentials from environment variable
  const json = process.env.FIREBASE_ADMIN_CREDENTIALS;

  if (json) {
    let creds;
    try {
      creds = JSON.parse(json);
    } catch (e) {
      throw new Error('FIREBASE_ADMIN_CREDENTIALS env is not valid JSON.');
    }
    // Fix escaped newlines in private_key
    if (creds.private_key && typeof creds.private_key === 'string') {
      creds.private_key = creds.private_key.replace(/\\n/g, '\n');
    }
    admin.initializeApp({ credential: admin.credential.cert(creds) });
    return;
  }

  // Fallback to Application Default Credentials (file path or runtime env)
  try {
    admin.initializeApp(); // uses GOOGLE_APPLICATION_CREDENTIALS or ambient creds
  } catch (e) {
    throw new Error(
      'Firebase Admin not initialized. Set FIREBASE_ADMIN_CREDENTIALS (JSON) or GOOGLE_APPLICATION_CREDENTIALS.'
    );
  }
}

initAdmin();

const db = admin.firestore();
const { FieldValue, Timestamp } = admin.firestore;

module.exports = { db, admin, FieldValue, Timestamp };
