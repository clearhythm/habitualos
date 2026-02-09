/**
 * chat-crypto.cjs - Encrypt/decrypt chat message content
 *
 * Privacy-grade encryption using AES-256-CBC with userId-derived key.
 * Not security-grade — anyone with the userId can decrypt.
 * Purpose: prevent casual reading of chat content in Firestore console.
 *
 * Encrypted content is prefixed with "enc:" so we can detect and
 * gracefully handle pre-encryption (plaintext) messages.
 */

const crypto = require('crypto');

const ALGORITHM = 'aes-256-cbc';
const PREFIX = 'enc:';

function deriveKey(userId) {
  return crypto.createHash('sha256').update(userId).digest();
}

function deriveIV(userId) {
  return crypto.createHash('sha256').update(userId + ':iv').digest().subarray(0, 16);
}

function encryptContent(text, userId) {
  if (!text || typeof text !== 'string') return text;
  const key = deriveKey(userId);
  const iv = deriveIV(userId);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  return PREFIX + encrypted.toString('base64');
}

function decryptContent(text, userId) {
  if (!text || typeof text !== 'string') return text;
  if (!text.startsWith(PREFIX)) return text; // plaintext (pre-encryption data)
  const key = deriveKey(userId);
  const iv = deriveIV(userId);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.from(text.slice(PREFIX.length), 'base64');
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
}

function encryptMessages(messages, userId) {
  if (!Array.isArray(messages)) return messages;
  return messages.map(msg => ({
    ...msg,
    content: encryptContent(msg.content, userId)
  }));
}

function decryptMessages(messages, userId) {
  if (!Array.isArray(messages)) return messages;
  return messages.map(msg => ({
    ...msg,
    content: decryptContent(msg.content, userId)
  }));
}

module.exports = { encryptContent, decryptContent, encryptMessages, decryptMessages };
