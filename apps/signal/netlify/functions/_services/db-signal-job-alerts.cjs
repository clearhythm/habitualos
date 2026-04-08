'use strict';
const { db, admin } = require('@habitualos/db-core');

async function saveJobAlert({ signalId, emailSubject, emailDate, source, jobs, highScoreCount }) {
  const alertId = `alert-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  await db.collection('signal-job-alerts').doc(alertId).set({
    _alertId: alertId,
    _signalId: signalId,
    source: source || 'linkedin-job-alert',
    emailSubject: emailSubject || null,
    emailDate: emailDate || null,
    jobs: jobs || [],
    highScoreCount: highScoreCount || 0,
    scoredAt: new Date().toISOString(),
    _createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  return alertId;
}

async function getJobAlerts({ signalId, limit = 50 }) {
  const snap = await db.collection('signal-job-alerts')
    .where('_signalId', '==', signalId)
    .get();
  return snap.docs
    .map((d) => d.data())
    .sort((a, b) => (b.scoredAt || '').localeCompare(a.scoredAt || ''))
    .slice(0, limit);
}

async function getJobAlertById(alertId) {
  const doc = await db.collection('signal-job-alerts').doc(alertId).get();
  return doc.exists ? doc.data() : null;
}

module.exports = { saveJobAlert, getJobAlerts, getJobAlertById };
