import { rtdb, db, ref, set, onValue, onDisconnect, rtdbTimestamp, collection, addDoc, doc, updateDoc, serverTimestamp, onSnapshot } from './firebase.js';

const PRESENCE_PATH = 'presence';
const SESSIONS_COL = 'sessions';

let _userId = null;
let _name = null;
let _state = 'witnessing';
let _activeSessionId = null;

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

export function initPresence() {
  _userId = _getUserId();
  _name = _getName();

  const userRef = ref(rtdb, `${PRESENCE_PATH}/${_userId}`);
  const connectedRef = ref(rtdb, '.info/connected');

  onValue(connectedRef, (snap) => {
    if (!snap.val()) return;

    onDisconnect(userRef).set({
      name: _name,
      state: 'idle',
      updatedAt: rtdbTimestamp(),
    });

    set(userRef, {
      name: _name,
      state: _state,
      updatedAt: rtdbTimestamp(),
    });
  });
}

export function setPresenceState(state) {
  _state = state;
  if (!_userId) return;
  set(ref(rtdb, `${PRESENCE_PATH}/${_userId}`), {
    name: _name,
    state,
    updatedAt: rtdbTimestamp(),
  });
}

export function subscribeToCircle(callback) {
  const circleRef = ref(rtdb, PRESENCE_PATH);
  return onValue(circleRef, (snap) => {
    const members = [];
    snap.forEach((child) => {
      members.push({ userId: child.key, ...child.val() });
    });
    callback(members);
  });
}

export async function startSession(practiceType) {
  setPresenceState('practicing');
  const sessionRef = await addDoc(collection(db, SESSIONS_COL), {
    userId: _userId,
    name: _name,
    state: 'active',
    practiceType: practiceType || null,
    startedAt: serverTimestamp(),
  });
  _activeSessionId = sessionRef.id;
  return sessionRef.id;
}

export async function endSession(note, durationSeconds) {
  if (!_activeSessionId) return;
  await updateDoc(doc(db, SESSIONS_COL, _activeSessionId), {
    state: 'completed',
    note: note || null,
    duration: durationSeconds,
    stoppedAt: serverTimestamp(),
  });
  _activeSessionId = null;
  setPresenceState('witnessing');
}

export function subscribeToSessions(callback) {
  return onSnapshot(collection(db, SESSIONS_COL), (snap) => {
    const sessions = snap.docs.map(d => ({ sessionId: d.id, ...d.data() }));
    callback(sessions);
  });
}

export function getCurrentUserId() { return _userId; }
export function getCurrentName() { return _name; }
