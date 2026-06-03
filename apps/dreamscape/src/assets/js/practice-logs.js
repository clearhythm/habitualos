import { db, doc, setDoc, updateDoc, serverTimestamp } from './firebase.js';
import { setPresenceState } from './presence.js';
import { post } from './api.js';
import { getUserId } from './auth/auth.js';
import { generatePracticeLogId } from './utils.js';

let practiceLogId = null;
let _lastPracticeLogId = null;
let practiceName = null;
let startedAt = null;

export function startPractice(name) {
  practiceLogId = generatePracticeLogId();
  practiceName = name || null;
  startedAt = new Date();
  setPresenceState('practicing');
}

export async function endPractice(durationSeconds) {
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
  _lastPracticeLogId = practiceLogId;
  practiceLogId = null;
  practiceName = null;
  startedAt = null;
}

export function cancelPractice() {
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
