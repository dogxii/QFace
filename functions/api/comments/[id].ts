import { canModerate, requireAuth } from '../../_lib/auth'
import { type CommentRow, commentSelectSql, getComment, toComment } from '../../_lib/comments'
import { assertSameOrigin, json, readJson } from '../../_lib/http'
import type { Env } from '../../_lib/types'
import { cleanContent } from '../../_lib/validators'

interface UpdateCommentBody {
  content?: string
}

function getId(params: EventContext<Env, 'id', unknown>['params']) {
  return Array.isArray(params.id) ? params.id[0] : params.id
}

export const onRequestPatch: PagesFunction<Env, 'id'> = async ({ request, env, params }) => {
  assertSameOrigin(request)
  const auth = await requireAuth(request, env)
  const id = getId(params)
  const comment = await getComment(env, id)

  if (comment?.status !== 'visible') {
    return json({ error: 'Comment not found' }, { status: 404 })
  }
  if (comment.user_id !== auth.user.id) {
    return json({ error: 'Only the author can edit this comment' }, { status: 403 })
  }

  const body = await readJson<UpdateCommentBody>(request)
  const content = cleanContent(body.content)

  await env.DB.prepare(
    `UPDATE comments
     SET content = ?,
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
     WHERE id = ?`,
  )
    .bind(content, id)
    .run()

  const rows = await env.DB.prepare(
    `${commentSelectSql(auth.user.id)}
     WHERE comments.id = ?
     GROUP BY comments.id
     LIMIT 1`,
  )
    .bind(auth.user.id, id)
    .all<CommentRow>()

  return json({ comment: rows.results[0] ? toComment(rows.results[0], auth) : null })
}

export const onRequestDelete: PagesFunction<Env, 'id'> = async ({ request, env, params }) => {
  assertSameOrigin(request)
  const auth = await requireAuth(request, env)
  const id = getId(params)
  const comment = await getComment(env, id)

  if (comment?.status !== 'visible') {
    return json({ error: 'Comment not found' }, { status: 404 })
  }
  if (comment.user_id !== auth.user.id && !canModerate(auth.user)) {
    return json({ error: 'Only the author or moderator can delete this comment' }, { status: 403 })
  }

  await env.DB.prepare(
    `UPDATE comments
     SET status = 'deleted',
         content = '',
         deleted_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
     WHERE id = ?`,
  )
    .bind(id)
    .run()

  return json({ ok: true })
}
