/**
 * packages/db-core/data-utils.cjs
 *
 * Generic ID generation utility shared across apps.
 * Domain-specific ID generators (generateAgentId, etc.) stay in each app.
 */

function uniqueId(prefix = "") {
  const t = Date.now().toString(36);
  const r = Math.random().toString(36).slice(2, 6);
  return prefix ? `${prefix}-${t}${r}` : `${t}${r}`;
}

module.exports = { uniqueId };
