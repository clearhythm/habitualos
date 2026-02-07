/**
 * @habitualos/auth-server
 *
 * Shared server-side authentication for all HabitualOS apps.
 * Provides middleware, security wrappers, and user data access.
 */

const { authenticate } = require('./middleware/api-auth.cjs');
const { requireAuth } = require('./middleware/api-security.cjs');
const { getUserById, getUserByEmail, updateUser, ensureUserEmail } = require('./services/db-users.cjs');

module.exports = {
  // Middleware
  authenticate,
  requireAuth,

  // User management
  getUserById,
  getUserByEmail,
  updateUser,
  ensureUserEmail
};
