import { db, doc, setDoc, updateDoc, serverTimestamp } from './firebase.js';
import { setPresenceState } from './presence.js';
import { post } from './api.js';
import { getUserId, getName } from './auth/auth.js';
import { makeId } from './utils.js';
import { invalidateCircleCache } from './collections/circle.js';

let sessionId = null;
let practiceType = null;
let startedAt = null;

export function startSession(type) {
  sessionId = makeId('sess');
  practiceType = type || null;
  startedAt = new Date();
  setPresenceState('practicing');
}

export async function endSession(note, durationSeconds) {
  if (!sessionId) return;
  const userId = getUserId();
  const name = getName();
  await setDoc(doc(db, 'practice-logs', sessionId), {
    _practiceId: sessionId,
    _userId: userId,
    _startedAt: startedAt,
    _stoppedAt: serverTimestamp(),
    name,
    practiceType,
    note: note || null,
    duration: durationSeconds,
  });
  setPresenceState('witnessing');
  post('/api/session-complete', { userId }).catch(() => {});
  invalidateCircleCache();
  sessionId = null;
  practiceType = null;
  startedAt = null;
}

export function cancelSession() {
  sessionId = null;
  practiceType = null;
  startedAt = null;
  setPresenceState('witnessing');
}

export async function saveReflection(note) {
  if (!sessionId || !note) return;
  await updateDoc(doc(db, 'practice-logs', sessionId), { note });
}
