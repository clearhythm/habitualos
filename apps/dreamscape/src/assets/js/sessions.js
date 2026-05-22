import { db, doc, setDoc, updateDoc, serverTimestamp } from './firebase.js';
import { setPresenceState } from './presence.js';
import { post } from './api.js';
import { getUserId } from './auth/auth.js';
import { generatePracticeLogId } from './utils.js';
import { invalidateCircleCache } from './collections/circle.js';

let practiceLogId = null;
let _lastPracticeLogId = null;
let practiceName = null;
let startedAt = null;

export function startSession(name) {
  practiceLogId = generatePracticeLogId();
  practiceName = name || null;
  startedAt = new Date();
  setPresenceState('practicing');
}

export async function endSession(durationSeconds) {
  if (!practiceLogId) return;
  const userId = getUserId();
  await setDoc(doc(db, 'practice-logs', practiceLogId), {
    _practiceId: practiceLogId,
    _userId: userId,
    _startedAt: startedAt,
    _stoppedAt: serverTimestamp(),
    practiceName,
    note: null,
    durationSeconds,
  });
  setPresenceState('witnessing');
  post('/api/session-complete', { userId }).catch(() => {});
  invalidateCircleCache();
  _lastPracticeLogId = practiceLogId;
  practiceLogId = null;
  practiceName = null;
  startedAt = null;
}

export function cancelSession() {
  practiceLogId = null;
  _lastPracticeLogId = null;
  practiceName = null;
  startedAt = null;
  setPresenceState('witnessing');
}

export async function saveReflection(note) {
  if (!_lastPracticeLogId || !note) return;
  await updateDoc(doc(db, 'practice-logs', _lastPracticeLogId), { note });
  _lastPracticeLogId = null;
}
