PRAGMA foreign_keys = ON;

ALTER TABLE experiences
ADD COLUMN visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'private'));

CREATE INDEX IF NOT EXISTS idx_experiences_visibility_status_created ON experiences (
  visibility,
  status,
  created_at
);

CREATE INDEX IF NOT EXISTS idx_experiences_user_visibility_updated ON experiences (
  user_id,
  visibility,
  updated_at
);
