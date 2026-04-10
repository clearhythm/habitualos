/**
 * AES-256-GCM encryption/decryption for sensitive values (API keys).
 * Key is read from ENCRYPTION_KEY env var (must be 64 hex chars = 32 bytes).
 */

const crypto = require('crypto');

const ALG = 'aes-256-gcm';
const IV_LEN = 12;
const TAG_LEN = 16;

function getKey() {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) throw new Error('ENCRYPTION_KEY must be 64 hex chars (32 bytes)');
  return Buffer.from(hex, 'hex');
}

/**
 * Encrypt a plaintext string.
 * Returns a base64 string: iv(12) + tag(16) + ciphertext
 */
function encrypt(plaintext) {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALG, key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

/**
 * Decrypt a base64 string produced by encrypt().
 * Returns the original plaintext.
 */
function decrypt(encoded) {
  const key = getKey();
  const buf = Buffer.from(encoded, 'base64');
  const iv = buf.slice(0, IV_LEN);
  const tag = buf.slice(IV_LEN, IV_LEN + TAG_LEN);
  const ciphertext = buf.slice(IV_LEN + TAG_LEN);
  const decipher = crypto.createDecipheriv(ALG, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

/**
 * Resolve the Anthropic API key for an owner.
 * Uses the owner's personal encrypted key if present, falls back to
 * the ANTHROPIC_API_KEY env var. Returns null if neither is available.
 *
 * @param {object} owner - Owner record from db-signal-owners
 * @returns {string|null}
 */
function resolveApiKey(owner) {
  if (owner.anthropicApiKey) {
    try { return decrypt(owner.anthropicApiKey); } catch (_) {}
  }
  return process.env.ANTHROPIC_API_KEY || null;
}

module.exports = { encrypt, decrypt, resolveApiKey };
