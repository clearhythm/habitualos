const Database = require('better-sqlite3');
const path = require('path');
const { randomUUID } = require('crypto');

// Initialize database connection
const dbPath = process.env.DATABASE_PATH || path.join(__dirname, 'habitualos.db');
const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

/**
 * NorthStar Operations
 */

// Insert a new NorthStar
function insertNorthStar({ title, goal, success_criteria, timeline }) {
  const id = randomUUID();
  const stmt = db.prepare(`
    INSERT INTO north_stars (id, title, goal, success_criteria, timeline)
    VALUES (?, ?, ?, ?, ?)
  `);

  try {
    stmt.run(
      id,
      title,
      goal,
      JSON.stringify(success_criteria), // Store array as JSON string
      timeline
    );
    return { id, title, goal, success_criteria, timeline, status: 'active' };
  } catch (error) {
    throw new Error(`Failed to insert NorthStar: ${error.message}`);
  }
}

// Get active NorthStar (PoC assumes single NorthStar)
function getActiveNorthStar() {
  const stmt = db.prepare(`
    SELECT * FROM north_stars
    WHERE status = 'active'
    ORDER BY created_at DESC
    LIMIT 1
  `);

  try {
    const row = stmt.get();
    if (!row) return null;

    // Parse JSON success_criteria back to array
    return {
      ...row,
      success_criteria: JSON.parse(row.success_criteria)
    };
  } catch (error) {
    throw new Error(`Failed to get NorthStar: ${error.message}`);
  }
}

/**
 * ActionCard Operations
 */

// Insert a new ActionCard
function insertActionCard({ north_star_id, title, description, priority, task_type, schedule_time, task_config }) {
  const id = randomUUID();
  const stmt = db.prepare(`
    INSERT INTO action_cards (
      id, north_star_id, title, description, priority,
      task_type, schedule_time, task_config, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `);

  try {
    stmt.run(
      id,
      north_star_id,
      title,
      description,
      priority || 'medium',
      task_type || 'interactive',
      schedule_time || null,
      task_config ? JSON.stringify(task_config) : null
    );
    return {
      id, north_star_id, title, description,
      priority: priority || 'medium',
      task_type: task_type || 'interactive',
      schedule_time, task_config,
      state: 'open'
    };
  } catch (error) {
    throw new Error(`Failed to insert ActionCard: ${error.message}`);
  }
}

// Get all ActionCards for a NorthStar
function getActions(north_star_id) {
  const stmt = db.prepare(`
    SELECT * FROM action_cards
    WHERE north_star_id = ?
    ORDER BY
      CASE priority
        WHEN 'high' THEN 1
        WHEN 'medium' THEN 2
        WHEN 'low' THEN 3
      END,
      created_at ASC
  `);

  try {
    return stmt.all(north_star_id);
  } catch (error) {
    throw new Error(`Failed to get ActionCards: ${error.message}`);
  }
}

// Get all ActionCards (for PoC with single NorthStar)
function getAllActions() {
  const stmt = db.prepare(`
    SELECT * FROM action_cards
    ORDER BY
      CASE priority
        WHEN 'high' THEN 1
        WHEN 'medium' THEN 2
        WHEN 'low' THEN 3
      END,
      created_at ASC
  `);

  try {
    return stmt.all();
  } catch (error) {
    throw new Error(`Failed to get all ActionCards: ${error.message}`);
  }
}

// Get a single ActionCard by ID
function getAction(id) {
  const stmt = db.prepare('SELECT * FROM action_cards WHERE id = ?');

  try {
    return stmt.get(id);
  } catch (error) {
    throw new Error(`Failed to get ActionCard: ${error.message}`);
  }
}

// Update ActionCard state
function updateActionState(id, state, additionalFields = {}) {
  let sql = 'UPDATE action_cards SET state = ?, updated_at = datetime("now")';
  const params = [state];

  if (additionalFields.completed_at) {
    sql += ', completed_at = ?';
    params.push(additionalFields.completed_at);
  }

  if (additionalFields.dismissed_reason) {
    sql += ', dismissed_reason = ?';
    params.push(additionalFields.dismissed_reason);
  }

  if (additionalFields.started_at) {
    sql += ', started_at = ?';
    params.push(additionalFields.started_at);
  }

  if (additionalFields.error_message) {
    sql += ', error_message = ?';
    params.push(additionalFields.error_message);
  }

  sql += ' WHERE id = ?';
  params.push(id);

  const stmt = db.prepare(sql);

  try {
    stmt.run(...params);
    return getAction(id);
  } catch (error) {
    throw new Error(`Failed to update ActionCard state: ${error.message}`);
  }
}

// Get scheduled tasks that are due to run
function getScheduledTasksDue() {
  const stmt = db.prepare(`
    SELECT * FROM action_cards
    WHERE task_type = 'scheduled'
      AND state = 'open'
      AND schedule_time IS NOT NULL
      AND schedule_time <= datetime('now')
    ORDER BY schedule_time ASC
  `);

  try {
    const rows = stmt.all();
    return rows.map(row => ({
      ...row,
      task_config: row.task_config ? JSON.parse(row.task_config) : null
    }));
  } catch (error) {
    throw new Error(`Failed to get scheduled tasks: ${error.message}`);
  }
}

/**
 * Chat Message Operations
 */

// Insert a chat message
function insertChatMessage({ action_id, role, content }) {
  const id = randomUUID();
  const stmt = db.prepare(`
    INSERT INTO chat_messages (id, action_id, role, content)
    VALUES (?, ?, ?, ?)
  `);

  try {
    stmt.run(id, action_id, role, content);
    return { id, action_id, role, content };
  } catch (error) {
    throw new Error(`Failed to insert chat message: ${error.message}`);
  }
}

// Get all chat messages for an action
function getChatMessages(action_id) {
  const stmt = db.prepare(`
    SELECT * FROM chat_messages
    WHERE action_id = ?
    ORDER BY timestamp ASC
  `);

  try {
    return stmt.all(action_id);
  } catch (error) {
    throw new Error(`Failed to get chat messages: ${error.message}`);
  }
}

/**
 * Artifact Operations
 */

// Insert an artifact
function insertArtifact({ action_id, type, title, content, destination }) {
  const id = randomUUID();
  const stmt = db.prepare(`
    INSERT INTO artifacts (id, action_id, type, title, content, destination)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  try {
    stmt.run(id, action_id, type, title, content, destination || null);
    return { id, action_id, type, title, content, destination };
  } catch (error) {
    throw new Error(`Failed to insert artifact: ${error.message}`);
  }
}

// Get all artifacts for an action
function getArtifacts(action_id) {
  const stmt = db.prepare(`
    SELECT * FROM artifacts
    WHERE action_id = ?
    ORDER BY created_at DESC
  `);

  try {
    return stmt.all(action_id);
  } catch (error) {
    throw new Error(`Failed to get artifacts: ${error.message}`);
  }
}

// Get a single artifact by ID
function getArtifact(id) {
  const stmt = db.prepare('SELECT * FROM artifacts WHERE id = ?');

  try {
    return stmt.get(id);
  } catch (error) {
    throw new Error(`Failed to get artifact: ${error.message}`);
  }
}

/**
 * Utility Functions
 */

// Close database connection (for cleanup)
function closeDatabase() {
  db.close();
}

// Export all functions
module.exports = {
  // NorthStar operations
  insertNorthStar,
  getActiveNorthStar,

  // ActionCard operations
  insertActionCard,
  getActions,
  getAllActions,
  getAction,
  updateActionState,
  getScheduledTasksDue,

  // Chat operations
  insertChatMessage,
  getChatMessages,

  // Artifact operations
  insertArtifact,
  getArtifacts,
  getArtifact,

  // Utilities
  closeDatabase
};
