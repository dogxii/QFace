import { getAuth, requireAuth } from '../../_lib/auth'
import { type CommentRow, commentSelectSql, toComment } from '../../_lib/comments'
import { assertSameOrigin, json, readJson } from '../../_lib/http'
import type { Env } from '../../_lib/types'
import { cleanCommentKind, cleanContent, cleanParentId, cleanSourceId } from '../../_lib/validators'

interface CreateCommentBody {
  sourceId?: string
  parentId?: string | null
  kind?: string
  content?: string
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const url = new URL(request.url)
  const sourceId = cleanSourceId(url.searchParams.get('sourceId'))
  const kind = url.searchParams.get('kind')
  const auth = await getAuth(request, env)
  const viewerUserId = auth?.user.id ?? null
  const filters = [`comments.source_id = ?`]
  const bindings: unknown[] = viewerUserId ? [viewerUserId, sourceId] : [sourceId]

  filters.push(`comments.status = 'visible'`)

  if (kind && kind !== 'all') {
    filters.push('comments.kind = ?')
    bindings.push(cleanCommentKind(kind))
  }

  const rows = await env.DB.prepare(
    `${commentSelectSql(viewerUserId)}
     WHERE ${filters.join(' AND ')}
     GROUP BY comments.id
     ORDER BY
       CASE WHEN comments.accepted_at IS NOT NULL THEN 0 ELSE 1 END,
       (upvotes - downvotes) DESC,
       comments.created_at DESC`,
  )
    .bind(...bindings)
    .all<CommentRow>()

  return json({
    comments: rows.results.map((row) => toComment(row, auth)),
  })
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  assertSameOrigin(request)
  const auth = await requireAuth(request, env)
  const body = await readJson<CreateCommentBody>(request)
  const sourceId = cleanSourceId(body.sourceId)
  const parentId = cleanParentId(body.parentId)
  const kind = parentId ? 'discussion' : cleanCommentKind(body.kind)
  const content = cleanContent(body.content)

  if (parentId) {
    const parent = await env.DB.prepare(
      `SELECT id, source_id, status
       FROM comments
       WHERE id = ?
       LIMIT 1`,
    )
      .bind(parentId)
      .first<{ id: string; source_id: string; status: string }>()

    if (!parent || parent.source_id !== sourceId || parent.status !== 'visible') {
      return json({ error: 'Parent comment not found' }, { status: 404 })
    }
  }

  const id = crypto.randomUUID()

  await env.DB.prepare(
    `INSERT INTO comments (id, source_id, parent_id, user_id, kind, content)
     VALUES (?, ?, ?, ?, ?, ?)`,
  )
    .bind(id, sourceId, parentId, auth.user.id, kind, content)
    .run()

  const rows = await env.DB.prepare(
    `${commentSelectSql(auth.user.id)}
     WHERE comments.id = ?
     GROUP BY comments.id
     LIMIT 1`,
  )
    .bind(auth.user.id, id)
    .all<CommentRow>()

  return json(
    { comment: rows.results[0] ? toComment(rows.results[0], auth) : null },
    { status: 201 },
  )
}
