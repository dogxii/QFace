import type { AuthContext, Env } from './types'

export interface CommentRow {
  id: string
  source_id: string
  parent_id: string | null
  kind: 'answer' | 'explain' | 'question' | 'discussion'
  content: string
  status: 'visible' | 'deleted' | 'hidden'
  accepted_at: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
  user_id: string
  user_login: string
  user_name: string | null
  user_avatar_url: string | null
  user_html_url: string | null
  upvotes: number
  downvotes: number
  viewer_vote: number | null
}

export function toComment(row: CommentRow, auth?: AuthContext) {
  const deleted = row.status !== 'visible'

  return {
    id: row.id,
    sourceId: row.source_id,
    parentId: row.parent_id,
    kind: row.kind,
    content: deleted ? '' : row.content,
    status: row.status,
    acceptedAt: row.accepted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    upvotes: row.upvotes ?? 0,
    downvotes: row.downvotes ?? 0,
    viewerVote: row.viewer_vote ?? 0,
    canEdit: Boolean(auth && auth.user.id === row.user_id && row.status === 'visible'),
    canDelete: Boolean(
      auth &&
        row.status === 'visible' &&
        (auth.user.id === row.user_id ||
          auth.user.role === 'admin' ||
          auth.user.role === 'moderator'),
    ),
    canAccept: Boolean(
      auth &&
        row.status === 'visible' &&
        !row.parent_id &&
        (row.kind === 'answer' || row.kind === 'explain') &&
        (auth.user.role === 'admin' || auth.user.role === 'moderator'),
    ),
    user: {
      id: row.user_id,
      login: row.user_login,
      name: row.user_name,
      avatarUrl: row.user_avatar_url,
      htmlUrl: row.user_html_url,
    },
  }
}

export function commentSelectSql(viewerUserId: string | null) {
  return `
    SELECT
      comments.id,
      comments.source_id,
      comments.parent_id,
      comments.kind,
      comments.content,
      comments.status,
      comments.accepted_at,
      comments.created_at,
      comments.updated_at,
      comments.deleted_at,
      users.id AS user_id,
      users.login AS user_login,
      users.name AS user_name,
      users.avatar_url AS user_avatar_url,
      users.html_url AS user_html_url,
      COALESCE(SUM(CASE WHEN votes.value = 1 THEN 1 ELSE 0 END), 0) AS upvotes,
      COALESCE(SUM(CASE WHEN votes.value = -1 THEN 1 ELSE 0 END), 0) AS downvotes,
      ${
        viewerUserId ? `COALESCE(MAX(CASE WHEN votes.user_id = ? THEN votes.value END), 0)` : '0'
      } AS viewer_vote
    FROM comments
    JOIN users ON users.id = comments.user_id
    LEFT JOIN comment_votes AS votes ON votes.comment_id = comments.id
  `
}

export async function getComment(env: Env, id: string) {
  return env.DB.prepare(
    `SELECT id, user_id, source_id, status
     FROM comments
     WHERE id = ?
     LIMIT 1`,
  )
    .bind(id)
    .first<{ id: string; user_id: string; source_id: string; status: string }>()
}
