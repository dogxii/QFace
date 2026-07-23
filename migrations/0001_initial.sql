PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  github_id INTEGER UNIQUE NOT NULL,
  login TEXT NOT NULL,
  name TEXT,
  avatar_url TEXT,
  html_url TEXT,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'moderator', 'admin')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  banned_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_users_login ON users (login);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  last_seen_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  expires_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions (expires_at);

CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL,
  parent_id TEXT,
  user_id TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'answer' CHECK (kind IN ('answer', 'explain', 'question', 'discussion')),
  content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'visible' CHECK (status IN ('visible', 'deleted', 'hidden')),
  accepted_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  deleted_at TEXT,
  FOREIGN KEY (parent_id) REFERENCES comments (id) ON DELETE SET NULL,
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_comments_source_created ON comments (source_id, created_at);
CREATE INDEX IF NOT EXISTS idx_comments_parent_id ON comments (parent_id);
CREATE INDEX IF NOT EXISTS idx_comments_user_id ON comments (user_id);
CREATE INDEX IF NOT EXISTS idx_comments_status ON comments (status);

CREATE TABLE IF NOT EXISTS comment_votes (
  comment_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  value INTEGER NOT NULL CHECK (value IN (-1, 1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (comment_id, user_id),
  FOREIGN KEY (comment_id) REFERENCES comments (id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_comment_votes_user_id ON comment_votes (user_id);

CREATE TABLE IF NOT EXISTS notes (
  user_id TEXT NOT NULL,
  source_id TEXT NOT NULL,
  answer_content TEXT NOT NULL DEFAULT '',
  explain_content TEXT NOT NULL DEFAULT '',
  mastery INTEGER NOT NULL DEFAULT 0 CHECK (mastery BETWEEN 0 AND 3),
  answer_comment_id TEXT,
  explain_comment_id TEXT,
  answer_published_at TEXT,
  explain_published_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (user_id, source_id),
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  FOREIGN KEY (answer_comment_id) REFERENCES comments (id) ON DELETE SET NULL,
  FOREIGN KEY (explain_comment_id) REFERENCES comments (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_notes_user_updated ON notes (user_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_notes_answer_comment_id ON notes (answer_comment_id);
CREATE INDEX IF NOT EXISTS idx_notes_explain_comment_id ON notes (explain_comment_id);

CREATE TABLE IF NOT EXISTS moderation_logs (
  id TEXT PRIMARY KEY,
  actor_user_id TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  action TEXT NOT NULL,
  reason TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (actor_user_id) REFERENCES users (id) ON DELETE CASCADE
);
