// Detect environment from hostname
const hostname = typeof window !== 'undefined' ? window.location.hostname : '';

export const APP_ENV =
  hostname === 'localhost' || hostname === '127.0.0.1' ? 'local' : 'prod';

export const API_BASE_URL =
  APP_ENV === 'local'
    ? 'http://localhost:8888'
    : 'https://signal.habitualos.com';

// User-facing site base for absolute links
export const SITE_BASE_URL =
  APP_ENV === 'local'
    ? 'http://localhost:8888'
    : 'https://signal.habitualos.com';
