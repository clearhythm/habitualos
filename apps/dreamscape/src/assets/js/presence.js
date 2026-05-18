import { rtdb, db, ref, set, onValue, onDisconnect, rtdbTimestamp, doc, setDoc, updateDoc, collection, serverTimestamp, onSnapshot } from './firebase.js';
import { makeId } from './utils.js';

const PRESENCE_PATH = 'presence';
const SESSIONS_COL = 'sessions';

let _userId = null;
let _name = null;
let _state = 'witnessing';
let _activeSessionId = null;
let _practiceType = null;
let _startedAt = null;

function _getUserId() {
  let id = localStorage.getItem('dp-userId');
  if (!id) {
    id = 'dp-' + Math.random().toString(36).slice(2, 10);
    localStorage.setItem('dp-userId', id);
  }
  return id;
}

function _getName() {
  return localStorage.getItem('dp-name') || 'Someone';
}

function _presenceRecord(state) {
  return { _userId, _name, state, updatedAt: rtdbTimestamp() };
}

export function initPresence() {
  _userId = _getUserId();
  _name = _getName();

  const userRef = ref(rtdb, `${PRESENCE_PATH}/${_userId}`);
  const connectedRef = ref(rtdb, '.info/connected');

  onValue(connectedRef, (snap) => {
    if (!snap.val()) return;
    onDisconnect(userRef).set(_presenceRecord('idle'));
    set(userRef, _presenceRecord(_state));
  });
}

export function setPresenceState(state) {
  _state = state;
  if (!_userId) return;
  set(ref(rtdb, `${PRESENCE_PATH}/${_userId}`), _presenceRecord(state));
}

export function subscribeToCircle(callback) {
  const circleRef = ref(rtdb, PRESENCE_PATH);
  return onValue(circleRef, (snap) => {
    const members = [];
    snap.forEach((child) => {
      members.push({ _userId: child.key, ...child.val() });
    });
    callback(members);
  });
}

export function startSession(practiceType) {
  setPresenceState('practicing');
  _activeSessionId = makeId('sess');
  _practiceType = practiceType || null;
  _startedAt = new Date();
}

export async function endSession(note, durationSeconds) {
  if (!_activeSessionId) return;
  const sessionId = _activeSessionId;
  setDoc(doc(db, SESSIONS_COL, sessionId), {
    _sessionId: sessionId,
    _userId,
    _name,
    practiceType: _practiceType,
    note: note || null,
    duration: durationSeconds,
    startedAt: _startedAt,
    stoppedAt: serverTimestamp(),
  });
  setPresenceState('witnessing');
  // fire-and-forget: unlock any notes waiting for this user's practice
  fetch('/api/notes-unlock', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: _userId }),
  }).catch(() => {});
}

export function cancelSession() {
  _activeSessionId = null;
  _practiceType = null;
  _startedAt = null;
  setPresenceState('witnessing');
}

export function subscribeToSessions(callback) {
  return onSnapshot(collection(db, SESSIONS_COL), (snap) => {
    const sessions = snap.docs.map(d => d.data());
    callback(sessions);
  });
}

export async function saveReflection(note) {
  if (!_activeSessionId || !note) return;
  await updateDoc(doc(db, SESSIONS_COL, _activeSessionId), { note });
}

export function getCurrentUserId() { return _userId; }
export function getCurrentName() { return _name; }
