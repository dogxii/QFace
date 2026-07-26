PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS question_stats (
  source_id TEXT PRIMARY KEY,
  comment_count INTEGER NOT NULL DEFAULT 0 CHECK (comment_count >= 0),
  answer_count INTEGER NOT NULL DEFAULT 0 CHECK (answer_count >= 0),
  explain_count INTEGER NOT NULL DEFAULT 0 CHECK (explain_count >= 0),
  discussion_count INTEGER NOT NULL DEFAULT 0 CHECK (discussion_count >= 0),
  last_comment_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_question_stats_comment_count ON question_stats (
  comment_count DESC,
  source_id
);

CREATE INDEX IF NOT EXISTS idx_question_stats_last_comment ON question_stats (
  last_comment_at DESC,
  source_id
);

INSERT INTO question_stats (
  source_id,
  comment_count,
  answer_count,
  explain_count,
  discussion_count,
  last_comment_at,
  updated_at
)
SELECT
  source_id,
  COUNT(*) AS comment_count,
  SUM(CASE WHEN kind = 'answer' THEN 1 ELSE 0 END) AS answer_count,
  SUM(CASE WHEN kind = 'explain' THEN 1 ELSE 0 END) AS explain_count,
  SUM(CASE WHEN kind = 'discussion' THEN 1 ELSE 0 END) AS discussion_count,
  MAX(created_at) AS last_comment_at,
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now') AS updated_at
FROM comments
WHERE status = 'visible'
GROUP BY source_id
ON CONFLICT(source_id) DO UPDATE SET
  comment_count = excluded.comment_count,
  answer_count = excluded.answer_count,
  explain_count = excluded.explain_count,
  discussion_count = excluded.discussion_count,
  last_comment_at = excluded.last_comment_at,
  updated_at = excluded.updated_at;

CREATE TRIGGER IF NOT EXISTS trg_question_stats_comments_insert
AFTER INSERT ON comments
WHEN NEW.status = 'visible'
BEGIN
  INSERT INTO question_stats (
    source_id,
    comment_count,
    answer_count,
    explain_count,
    discussion_count,
    last_comment_at,
    updated_at
  )
  VALUES (
    NEW.source_id,
    1,
    CASE WHEN NEW.kind = 'answer' THEN 1 ELSE 0 END,
    CASE WHEN NEW.kind = 'explain' THEN 1 ELSE 0 END,
    CASE WHEN NEW.kind = 'discussion' THEN 1 ELSE 0 END,
    NEW.created_at,
    strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  )
  ON CONFLICT(source_id) DO UPDATE SET
    comment_count = question_stats.comment_count + 1,
    answer_count = question_stats.answer_count + CASE WHEN NEW.kind = 'answer' THEN 1 ELSE 0 END,
    explain_count = question_stats.explain_count + CASE WHEN NEW.kind = 'explain' THEN 1 ELSE 0 END,
    discussion_count = question_stats.discussion_count + CASE WHEN NEW.kind = 'discussion' THEN 1 ELSE 0 END,
    last_comment_at = CASE
      WHEN question_stats.last_comment_at IS NULL OR NEW.created_at > question_stats.last_comment_at
      THEN NEW.created_at
      ELSE question_stats.last_comment_at
    END,
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now');
END;

CREATE TRIGGER IF NOT EXISTS trg_question_stats_comments_update_new_source
AFTER UPDATE OF source_id, kind, status, created_at ON comments
WHEN OLD.status = 'visible' OR NEW.status = 'visible'
BEGIN
  INSERT INTO question_stats (
    source_id,
    comment_count,
    answer_count,
    explain_count,
    discussion_count,
    last_comment_at,
    updated_at
  )
  VALUES (
    NEW.source_id,
    (SELECT COUNT(*) FROM comments WHERE source_id = NEW.source_id AND status = 'visible'),
    (
      SELECT COUNT(*)
      FROM comments
      WHERE source_id = NEW.source_id AND status = 'visible' AND kind = 'answer'
    ),
    (
      SELECT COUNT(*)
      FROM comments
      WHERE source_id = NEW.source_id AND status = 'visible' AND kind = 'explain'
    ),
    (
      SELECT COUNT(*)
      FROM comments
      WHERE source_id = NEW.source_id AND status = 'visible' AND kind = 'discussion'
    ),
    (SELECT MAX(created_at) FROM comments WHERE source_id = NEW.source_id AND status = 'visible'),
    strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  )
  ON CONFLICT(source_id) DO UPDATE SET
    comment_count = excluded.comment_count,
    answer_count = excluded.answer_count,
    explain_count = excluded.explain_count,
    discussion_count = excluded.discussion_count,
    last_comment_at = excluded.last_comment_at,
    updated_at = excluded.updated_at;
END;

CREATE TRIGGER IF NOT EXISTS trg_question_stats_comments_update_old_source
AFTER UPDATE OF source_id, kind, status, created_at ON comments
WHEN OLD.source_id <> NEW.source_id AND (OLD.status = 'visible' OR NEW.status = 'visible')
BEGIN
  INSERT INTO question_stats (
    source_id,
    comment_count,
    answer_count,
    explain_count,
    discussion_count,
    last_comment_at,
    updated_at
  )
  VALUES (
    OLD.source_id,
    (SELECT COUNT(*) FROM comments WHERE source_id = OLD.source_id AND status = 'visible'),
    (
      SELECT COUNT(*)
      FROM comments
      WHERE source_id = OLD.source_id AND status = 'visible' AND kind = 'answer'
    ),
    (
      SELECT COUNT(*)
      FROM comments
      WHERE source_id = OLD.source_id AND status = 'visible' AND kind = 'explain'
    ),
    (
      SELECT COUNT(*)
      FROM comments
      WHERE source_id = OLD.source_id AND status = 'visible' AND kind = 'discussion'
    ),
    (SELECT MAX(created_at) FROM comments WHERE source_id = OLD.source_id AND status = 'visible'),
    strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  )
  ON CONFLICT(source_id) DO UPDATE SET
    comment_count = excluded.comment_count,
    answer_count = excluded.answer_count,
    explain_count = excluded.explain_count,
    discussion_count = excluded.discussion_count,
    last_comment_at = excluded.last_comment_at,
    updated_at = excluded.updated_at;
END;

CREATE TRIGGER IF NOT EXISTS trg_question_stats_comments_delete
AFTER DELETE ON comments
WHEN OLD.status = 'visible'
BEGIN
  INSERT INTO question_stats (
    source_id,
    comment_count,
    answer_count,
    explain_count,
    discussion_count,
    last_comment_at,
    updated_at
  )
  VALUES (
    OLD.source_id,
    (SELECT COUNT(*) FROM comments WHERE source_id = OLD.source_id AND status = 'visible'),
    (
      SELECT COUNT(*)
      FROM comments
      WHERE source_id = OLD.source_id AND status = 'visible' AND kind = 'answer'
    ),
    (
      SELECT COUNT(*)
      FROM comments
      WHERE source_id = OLD.source_id AND status = 'visible' AND kind = 'explain'
    ),
    (
      SELECT COUNT(*)
      FROM comments
      WHERE source_id = OLD.source_id AND status = 'visible' AND kind = 'discussion'
    ),
    (SELECT MAX(created_at) FROM comments WHERE source_id = OLD.source_id AND status = 'visible'),
    strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  )
  ON CONFLICT(source_id) DO UPDATE SET
    comment_count = excluded.comment_count,
    answer_count = excluded.answer_count,
    explain_count = excluded.explain_count,
    discussion_count = excluded.discussion_count,
    last_comment_at = excluded.last_comment_at,
    updated_at = excluded.updated_at;
END;
