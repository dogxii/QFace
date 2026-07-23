import { canModerate } from './auth'
import type { AuthContext, Env } from './types'
import { cleanSourceId } from './validators'

export interface ExperienceQuestionLinkRow {
  id: string
  source_id: string
  label: string
  position: number
}

export interface ExperienceRow {
  id: string
  title: string
  interview_date: string
  content: string
  status: 'visible' | 'deleted' | 'hidden'
  created_at: string
  updated_at: string
  deleted_at: string | null
  user_id: string
  user_login: string
  user_name: string | null
  user_avatar_url: string | null
  user_html_url: string | null
  link_count: number
  reply_count: number
  upvotes: number
  downvotes: number
  viewer_vote: number | null
}

export interface ExperienceLinkInput {
  sourceId: string
  label?: string
  position?: number
}

export function experienceCommentSourceId(id: string) {
  return `exp-${id}`
}

export function experienceSelectSql(viewerUserId: string | null = null) {
  return `
    SELECT
      experiences.id,
      experiences.title,
      experiences.interview_date,
      experiences.content,
      experiences.status,
      experiences.created_at,
      experiences.updated_at,
      experiences.deleted_at,
      users.id AS user_id,
      users.login AS user_login,
      users.name AS user_name,
      users.avatar_url AS user_avatar_url,
      users.html_url AS user_html_url,
      (
        SELECT COUNT(*)
        FROM experience_question_links
        WHERE experience_question_links.experience_id = experiences.id
      ) AS link_count,
      (
        SELECT COUNT(*)
        FROM comments
        WHERE comments.source_id = 'exp-' || experiences.id
          AND comments.status = 'visible'
      ) AS reply_count,
      (
        SELECT COALESCE(SUM(CASE WHEN experience_votes.value = 1 THEN 1 ELSE 0 END), 0)
        FROM experience_votes
        WHERE experience_votes.experience_id = experiences.id
      ) AS upvotes,
      (
        SELECT COALESCE(SUM(CASE WHEN experience_votes.value = -1 THEN 1 ELSE 0 END), 0)
        FROM experience_votes
        WHERE experience_votes.experience_id = experiences.id
      ) AS downvotes,
      ${
        viewerUserId
          ? `(
              SELECT COALESCE(value, 0)
              FROM experience_votes
              WHERE experience_votes.experience_id = experiences.id
                AND experience_votes.user_id = ?
              LIMIT 1
            )`
          : '0'
      } AS viewer_vote
    FROM experiences
    JOIN users ON users.id = experiences.user_id
  `
}

export function toExperience(
  row: ExperienceRow,
  auth?: AuthContext,
  links: ExperienceQuestionLinkRow[] = [],
) {
  const visible = row.status === 'visible'

  return {
    id: row.id,
    title: row.title,
    interviewDate: row.interview_date,
    content: visible ? row.content : '',
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    linkCount: row.link_count ?? links.length,
    replyCount: row.reply_count ?? 0,
    upvotes: row.upvotes ?? 0,
    downvotes: row.downvotes ?? 0,
    viewerVote: row.viewer_vote ?? 0,
    links: links.map((link) => ({
      id: link.id,
      sourceId: link.source_id,
      label: link.label,
      position: link.position,
    })),
    canEdit: Boolean(auth && visible && (auth.user.id === row.user_id || canModerate(auth.user))),
    canDelete: Boolean(auth && visible && (auth.user.id === row.user_id || canModerate(auth.user))),
    user: {
      id: row.user_id,
      login: row.user_login,
      name: row.user_name,
      avatarUrl: row.user_avatar_url,
      htmlUrl: row.user_html_url,
    },
  }
}

export function cleanExperienceLinks(value: unknown): ExperienceLinkInput[] {
  if (!Array.isArray(value)) return []

  const seen = new Set<string>()
  const links: ExperienceLinkInput[] = []

  for (const item of value.slice(0, 80)) {
    if (!item || typeof item !== 'object') continue

    const raw = item as { sourceId?: unknown; label?: unknown; position?: unknown }
    const sourceId = cleanSourceId(raw.sourceId)
    if (seen.has(sourceId)) continue
    seen.add(sourceId)

    const label = typeof raw.label === 'string' ? raw.label.trim().slice(0, 80) : ''
    const position = Number(raw.position ?? links.length)

    links.push({
      sourceId,
      label,
      position: Number.isFinite(position) ? Math.max(0, Math.floor(position)) : links.length,
    })
  }

  return links
}

export async function getExperienceLinks(env: Env, experienceId: string) {
  const rows = await env.DB.prepare(
    `SELECT id, source_id, label, position
     FROM experience_question_links
     WHERE experience_id = ?
     ORDER BY position ASC, created_at ASC`,
  )
    .bind(experienceId)
    .all<ExperienceQuestionLinkRow>()

  return rows.results
}

export async function replaceExperienceLinks(
  env: Env,
  experienceId: string,
  links: ExperienceLinkInput[],
) {
  const statements = [
    env.DB.prepare('DELETE FROM experience_question_links WHERE experience_id = ?').bind(
      experienceId,
    ),
    ...links.map((link, index) =>
      env.DB.prepare(
        `INSERT INTO experience_question_links (id, experience_id, source_id, label, position)
         VALUES (?, ?, ?, ?, ?)`,
      ).bind(
        crypto.randomUUID(),
        experienceId,
        link.sourceId,
        link.label ?? '',
        link.position ?? index,
      ),
    ),
  ]

  await env.DB.batch(statements)
}

export async function getExperience(env: Env, id: string, viewerUserId: string | null = null) {
  const rows = await env.DB.prepare(
    `${experienceSelectSql(viewerUserId)}
     WHERE experiences.id = ?
     LIMIT 1`,
  )
    .bind(...(viewerUserId ? [viewerUserId, id] : [id]))
    .all<ExperienceRow>()

  return rows.results[0]
}
