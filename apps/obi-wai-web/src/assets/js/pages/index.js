import { isSignedIn } from '../auth/auth.js';

if (isSignedIn()) {
  window.location.replace('/practice/');
}
