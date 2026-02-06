//
// netlify/functions/_utils/agent-filesystem.cjs
// ------------------------------------------------------
// Filesystem utilities for agent local data.
// Provides sandboxed file access within agent data directories.
//
// Security:
//   - All paths resolved relative to /data/{agentPath}/
//   - Path traversal protection
//   - Only available when APP_ENV=local
// ------------------------------------------------------

const path = require('path');
const fs = require('fs').promises;

// Root directory for all agent data
const DATA_ROOT = path.join(process.cwd(), 'data');

/**
 * Get the full path to an agent's data directory
 * @param {string} localDataPath - Agent's localDataPath (e.g., "career-agent-abc123")
 * @returns {string|null} Full path or null if invalid
 */
function getAgentDataPath(localDataPath) {
  if (!localDataPath || typeof localDataPath !== 'string') {
    return null;
  }

  // Sanitize: only allow alphanumeric, dash, underscore
  const sanitized = localDataPath.replace(/[^a-zA-Z0-9-_]/g, '');
  if (sanitized !== localDataPath) {
    console.warn(`[agent-filesystem] Sanitized localDataPath: "${localDataPath}" -> "${sanitized}"`);
  }

  return path.join(DATA_ROOT, sanitized);
}

/**
 * Resolve a relative path within an agent's data directory safely
 * @param {string} agentDataPath - Full path to agent's data directory
 * @param {string} relativePath - Relative path within the directory
 * @returns {string} Resolved full path
 * @throws {Error} If path traversal detected
 */
function resolveSafePath(agentDataPath, relativePath) {
  if (!relativePath || typeof relativePath !== 'string') {
    relativePath = '';
  }

  // Normalize and resolve the path
  const normalized = path.normalize(relativePath);

  // Remove leading slashes and dots
  const cleaned = normalized.replace(/^[\/\\]+/, '').replace(/^\.+[\/\\]+/, '');

  const fullPath = path.join(agentDataPath, cleaned);

  // Verify the resolved path is within the agent's directory
  if (!fullPath.startsWith(agentDataPath + path.sep) && fullPath !== agentDataPath) {
    throw new Error('Path traversal detected');
  }

  return fullPath;
}

/**
 * Ensure a directory exists, creating it if necessary
 * @param {string} dirPath - Directory path to ensure
 */
async function ensureDir(dirPath) {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (err) {
    if (err.code !== 'EEXIST') {
      throw err;
    }
  }
}

/**
 * Read a file from an agent's data directory
 * @param {string} agentDataPath - Full path to agent's data directory
 * @param {string} relativePath - Relative path to the file
 * @returns {Promise<{success: boolean, content?: string, error?: string}>}
 */
async function readFile(agentDataPath, relativePath) {
  try {
    const fullPath = resolveSafePath(agentDataPath, relativePath);
    const content = await fs.readFile(fullPath, 'utf8');
    return { success: true, content };
  } catch (err) {
    if (err.message === 'Path traversal detected') {
      return { success: false, error: 'Invalid path: access denied' };
    }
    if (err.code === 'ENOENT') {
      return { success: false, error: `File not found: ${relativePath}` };
    }
    return { success: false, error: err.message };
  }
}

/**
 * Write content to a file in an agent's data directory
 * @param {string} agentDataPath - Full path to agent's data directory
 * @param {string} relativePath - Relative path to the file
 * @param {string} content - Content to write
 * @param {string} mode - Write mode: "overwrite" or "append"
 * @returns {Promise<{success: boolean, path?: string, error?: string}>}
 */
async function writeFile(agentDataPath, relativePath, content, mode = 'overwrite') {
  try {
    const fullPath = resolveSafePath(agentDataPath, relativePath);

    // Ensure parent directory exists
    await ensureDir(path.dirname(fullPath));

    if (mode === 'append') {
      await fs.appendFile(fullPath, content, 'utf8');
    } else {
      await fs.writeFile(fullPath, content, 'utf8');
    }

    return { success: true, path: relativePath };
  } catch (err) {
    if (err.message === 'Path traversal detected') {
      return { success: false, error: 'Invalid path: access denied' };
    }
    return { success: false, error: err.message };
  }
}

/**
 * List files in an agent's data directory
 * @param {string} agentDataPath - Full path to agent's data directory
 * @param {string} relativePath - Relative subdirectory path (optional)
 * @returns {Promise<{success: boolean, files?: Array, error?: string}>}
 */
async function listFiles(agentDataPath, relativePath = '') {
  try {
    const fullPath = resolveSafePath(agentDataPath, relativePath);

    // Ensure directory exists
    try {
      await fs.access(fullPath);
    } catch {
      // Directory doesn't exist yet - return empty list
      return { success: true, files: [] };
    }

    const entries = await fs.readdir(fullPath, { withFileTypes: true });

    const files = entries.map(entry => ({
      name: entry.name,
      type: entry.isDirectory() ? 'directory' : 'file',
      path: relativePath ? path.join(relativePath, entry.name) : entry.name
    }));

    return { success: true, files };
  } catch (err) {
    if (err.message === 'Path traversal detected') {
      return { success: false, error: 'Invalid path: access denied' };
    }
    return { success: false, error: err.message };
  }
}

/**
 * Check if filesystem tools should be available
 * @returns {boolean}
 */
function isFilesystemAvailable() {
  return process.env.APP_ENV === 'local';
}

module.exports = {
  DATA_ROOT,
  getAgentDataPath,
  resolveSafePath,
  ensureDir,
  readFile,
  writeFile,
  listFiles,
  isFilesystemAvailable
};
