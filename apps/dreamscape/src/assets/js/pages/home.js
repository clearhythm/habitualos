import { initPresence, subscribeToCircle } from '../presence.js';

initPresence();

subscribeToCircle((members) => {
  console.log('Circle update:', members);
});
