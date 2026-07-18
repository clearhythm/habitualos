const host = window.location.hostname;
export const APP_ENV = (host === 'localhost' || host === '127.0.0.1') ? 'local' : 'production';
