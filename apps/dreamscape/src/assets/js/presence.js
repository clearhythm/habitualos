import { rtdb, ref, set, onValue, onDisconnect, rtdbTimestamp } from './firebase.js';
import { getUserId, getName } from './auth/auth.js';

const PRESENCE_PATH = 'presence';

let userId = null;
let name = null;
let state = 'witnessing';

function presenceRecord(s) {
  return { userId, name, state: s, updatedAt: rtdbTimestamp() };
}

export function initPresence() {
  userId = getUserId();
  name = getName();

  const userRef    = ref(rtdb, `${PRESENCE_PATH}/${userId}`);
  const connectedRef = ref(rtdb, '.info/connected');

  onValue(connectedRef, (snap) => {
    if (!snap.val()) return;
    onDisconnect(userRef).set(presenceRecord('idle'));
    set(userRef, presenceRecord(state));
  });
}

export function setPresenceState(newState) {
  state = newState;
  if (!userId) return;
  set(ref(rtdb, `${PRESENCE_PATH}/${userId}`), presenceRecord(newState));
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
