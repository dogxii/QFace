PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS experiences (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  interview_date TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'visible' CHECK (status IN ('visible', 'deleted', 'hidden')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  deleted_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_experiences_status_created ON experiences (status, created_at);
CREATE INDEX IF NOT EXISTS idx_experiences_user_updated ON experiences (user_id, updated_at);

CREATE TABLE IF NOT EXISTS experience_question_links (
  id TEXT PRIMARY KEY,
  experience_id TEXT NOT NULL,
  source_id TEXT NOT NULL,
  label TEXT NOT NULL DEFAULT '',
  position INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (experience_id) REFERENCES experiences (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_experience_links_experience ON experience_question_links (
  experience_id,
  position
);
CREATE INDEX IF NOT EXISTS idx_experience_links_source ON experience_question_links (source_id);

CREATE TABLE IF NOT EXISTS experience_votes (
  experience_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  value INTEGER NOT NULL CHECK (value IN (-1, 1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (experience_id, user_id),
  FOREIGN KEY (experience_id) REFERENCES experiences (id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_experience_votes_experience ON experience_votes (experience_id);
