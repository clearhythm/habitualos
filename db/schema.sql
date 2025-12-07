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
  created_at TEXT DEFAULT (datetime('now')),
  completed_at TEXT,
  dismissed_reason TEXT
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

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_action_cards_north_star ON action_cards(north_star_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_action ON chat_messages(action_id);
CREATE INDEX IF NOT EXISTS idx_artifacts_action ON artifacts(action_id);
