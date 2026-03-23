// Secure default: if APP_ENV not set, assume production
const APP_ENV = process.env.APP_ENV || 'prod';

const API_BASE_URL =
  APP_ENV === 'local'
    ? 'http://localhost:8888'
    : 'https://signal.habitualos.com';

// User-facing site base for links in emails and absolute URLs
const SITE_BASE_URL =
  APP_ENV === 'local'
    ? 'http://localhost:8888'
    : 'https://signal.habitualos.com';

module.exports = { APP_ENV, API_BASE_URL, SITE_BASE_URL };
