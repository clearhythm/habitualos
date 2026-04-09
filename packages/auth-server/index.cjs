/**
 * @habitualos/auth-server
 *
 * Shared server-side authentication for all HabitualOS apps.
 * Provides middleware, security wrappers, user data access,
 * and magic link token-based authentication.
 */

const { authenticate } = require('./middleware/api-auth.cjs');
const { requireAuth } = require('./middleware/api-security.cjs');
const { getUserById, getUserByEmail, updateUser, ensureUserEmail } = require('./services/db-users.cjs');
const { createToken, validateToken, recordConsumption, createMagicLinkToken } = require('./tokens.cjs');
const { createMagicLinkSendHandler } = require('./handlers/magic-link-send.cjs');
const { createMagicLinkConsumeHandler } = require('./handlers/magic-link-consume.cjs');
const { createMigrationsHandler } = require('./handlers/migrations.cjs');

module.exports = {
  // Middleware
  authenticate,
  requireAuth,

  // User management
  getUserById,
  getUserByEmail,
  updateUser,
  ensureUserEmail,

  // Token management
  createToken,
  validateToken,
  recordConsumption,
  createMagicLinkToken,

  // Magic link handler factories
  createMagicLinkSendHandler,
  createMagicLinkConsumeHandler,
  createMigrationsHandler
};
