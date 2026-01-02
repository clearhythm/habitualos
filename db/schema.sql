-- NorthStars: User's overarching goals
CREATE TABLE IF NOT EXISTS north_stars (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  goal TEXT NOT NULL,
  success_criteria TEXT,           -- JSON array as string
  timeline TEXT,
  status TEXT DEFAULT 'active',    -- active | completed | archived
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- ActionCards: Discrete, executable steps
CREATE TABLE IF NOT EXISTS action_cards (
  id TEXT PRIMARY KEY,
  north_star_id TEXT NOT NULL REFERENCES north_stars(id),
  title TEXT NOT NULL,
  description TEXT,
  state TEXT DEFAULT 'open',       -- open | in_progress | completed | dismissed
  priority TEXT DEFAULT 'medium',  -- high | medium | low
  task_type TEXT DEFAULT 'interactive',  -- interactive | scheduled
  schedule_time TEXT,              -- ISO timestamp for scheduled tasks
  task_config TEXT,                -- JSON config for scheduled tasks
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  started_at TEXT,
  completed_at TEXT,
  dismissed_reason TEXT,
  error_message TEXT
);

-- Chat Messages: Persistent conversation history
CREATE TABLE IF NOT EXISTS chat_messages (
  id TEXT PRIMARY KEY,
  action_id TEXT NOT NULL REFERENCES action_cards(id),
  role TEXT NOT NULL,              -- user | assistant
  content TEXT NOT NULL,
  timestamp TEXT DEFAULT (datetime('now'))
);

-- Artifacts: Generated work products
CREATE TABLE IF NOT EXISTS artifacts (
  id TEXT PRIMARY KEY,
  action_id TEXT NOT NULL REFERENCES action_cards(id),
  type TEXT NOT NULL,              -- markdown | code | image | data
  title TEXT NOT NULL,
  content TEXT NOT NULL,           -- Full content stored locally
  destination TEXT,                -- github | substack | filesystem | null (future)
  destination_url TEXT,            -- External URL if delivered (future)
  created_at TEXT DEFAULT (datetime('now'))
);

-- Practice Library: Canonical practice definitions
CREATE TABLE IF NOT EXISTS practices (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,              -- Practice name (original casing preserved)
  instructions TEXT,               -- Latest/best version of practice instructions
  checkins INTEGER DEFAULT 0,      -- Counter of how many times this practice was done
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT                  -- Updated when instructions change
);

-- Practice Logs: Individual practice log entries
CREATE TABLE IF NOT EXISTS practice_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  practice_name TEXT,
  duration INTEGER,                -- Duration in minutes (optional)
  reflection TEXT,                 -- User's reflection after practice
  obi_wan_message TEXT,            -- Encouragement message shown
  obi_wan_feedback TEXT,           -- thumbs_up | thumbs_down | null
  timestamp TEXT DEFAULT (datetime('now'))
);

-- Practice Conversations: Save Obi-Wai conversations
CREATE TABLE IF NOT EXISTS practice_conversations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  messages TEXT NOT NULL,          -- JSON array of {role, content, timestamp}
  suggested_practice TEXT,         -- Practice name if conversation completed
  full_suggestion TEXT,            -- Full practice instructions from conversation
  completed BOOLEAN DEFAULT 0,     -- 1 if resulted in practice, 0 otherwise
  saved_at TEXT DEFAULT (datetime('now'))
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_action_cards_north_star ON action_cards(north_star_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_action ON chat_messages(action_id);
CREATE INDEX IF NOT EXISTS idx_artifacts_action ON artifacts(action_id);
CREATE INDEX IF NOT EXISTS idx_practices_user ON practices(user_id);
CREATE INDEX IF NOT EXISTS idx_practice_logs_timestamp ON practice_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_practice_logs_user ON practice_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_practice_conversations_user ON practice_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_practice_conversations_saved_at ON practice_conversations(saved_at);
