'use strict';
const { db, admin } = require('@habitualos/db-core');

const COLLECTION = 'signal-contacts';

/**
 * Contact document schema:
 * {
 *   _contactId, _ownerId, name, title, company,
 *   linkedinUrl, personalSiteUrl, email, emailSource,
 *   source ('discovery'|'csv'|'scraper'), sourceQuery,
 *   rawText (capped 8000 chars),
 *   profile: { skills[], domains[], trajectory, summary },
 *   score: { domain, trajectory, style, overall, confidence, summary, sharedGrounds[] },
 *   outreachStatus ('pending'|'sent'|'skipped'|'failed'|'unsubscribed'),
 *   outreachSentAt, outreachEmailId,
 *   _createdAt, _updatedAt
 * }
 */

async function createContact(ownerId, data) {
  const contactId = `contact-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const now = admin.firestore.FieldValue.serverTimestamp();
  await db.collection(COLLECTION).doc(contactId).set({
    _contactId: contactId,
    _ownerId: ownerId,
    outreachStatus: 'pending',
    outreachSentAt: null,
    outreachEmailId: null,
    ...data,
    rawText: data.rawText ? String(data.rawText).slice(0, 8000) : '',
    _createdAt: now,
    _updatedAt: now,
  });
  return contactId;
}

async function getContactById(contactId) {
  const doc = await db.collection(COLLECTION).doc(contactId).get();
  return doc.exists ? doc.data() : null;
}

async function getContactsByOwnerId(ownerId, { limit = 100, status } = {}) {
  const snap = await db.collection(COLLECTION).where('_ownerId', '==', ownerId).get();
  let docs = snap.docs.map(d => d.data());
  if (status) docs = docs.filter(d => d.outreachStatus === status);
  return docs
    .sort((a, b) => (b.score?.overall ?? 0) - (a.score?.overall ?? 0))
    .slice(0, limit);
}

async function updateContact(contactId, data) {
  await db.collection(COLLECTION).doc(contactId).set(
    { ...data, _updatedAt: admin.firestore.FieldValue.serverTimestamp() },
    { merge: true }
  );
}

/**
 * Upsert by linkedinUrl — idempotent for re-scraping same person.
 * If no linkedinUrl, always creates a new doc.
 */
async function upsertContactByLinkedIn(ownerId, linkedinUrl, data) {
  if (!linkedinUrl) return createContact(ownerId, data);

  const snap = await db.collection(COLLECTION)
    .where('_ownerId', '==', ownerId)
    .where('linkedinUrl', '==', linkedinUrl)
    .get();

  if (!snap.empty) {
    const doc = snap.docs[0];
    await updateContact(doc.id, data);
    return doc.id;
  }
  return createContact(ownerId, { linkedinUrl, ...data });
}

module.exports = { createContact, getContactById, getContactsByOwnerId, updateContact, upsertContactByLinkedIn };
