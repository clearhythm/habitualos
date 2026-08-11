//
// netlify/functions/_utils/data-utils.cjs
// ------------------------------------------------------
// Server-side id generation, named per entity — one place for tico-talk's
// own prefixed-id conventions, so every db-*.cjs service reuses the same
// pattern instead of calling uniqueId(prefix) inline, separately, in each
// one. Mirrors src/assets/js/utils/data-utils.js on the client side.
//
// Wraps @habitualos/db-core's generic uniqueId(prefix) (the shared,
// cross-app engine) — this file only ever fixes the prefix per entity, it
// doesn't reimplement id generation itself.
// ------------------------------------------------------

const { uniqueId } = require('@habitualos/db-core');

// Generates a unique learn-chat id with "lc-" prefix.
exports.generateChatId = () => uniqueId('lc');
