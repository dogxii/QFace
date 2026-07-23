import { canModerate, requireAuth } from '../../../_lib/auth'
import { type CommentRow, commentSelectSql, getComment, toComment } from '../../../_lib/comments'
import { assertSameOrigin, json, readJson } from '../../../_lib/http'
import type { Env } from '../../../_lib/types'

interface AcceptBody {
  accepted?: boolean
}

function getId(params: EventContext<Env, 'id', unknown>['params']) {
  return Array.isArray(params.id) ? params.id[0] : params.id
}

export const onRequestPost: PagesFunction<Env, 'id'> = async ({ request, env, params }) => {
  assertSameOrigin(request)
  const auth = await requireAuth(request, env)
  if (!canModerate(auth.user)) {
    return json({ error: 'Moderator permission required' }, { status: 403 })
  }

  const id = getId(params)
  const comment = await getComment(env, id)
  if (comment?.status !== 'visible') {
    return json({ error: 'Comment not found' }, { status: 404 })
  }

  const body = await readJson<AcceptBody>(request)
  const accepted = body.accepted !== false

  if (accepted) {
    await env.DB.batch([
      env.DB.prepare('UPDATE comments SET accepted_at = NULL WHERE source_id = ?').bind(
        comment.source_id,
      ),
      env.DB.prepare(
        `UPDATE comments
         SET accepted_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
             updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
         WHERE id = ?`,
      ).bind(id),
    ])
  } else {
    await env.DB.prepare(
      `UPDATE comments
       SET accepted_at = NULL,
           updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
       WHERE id = ?`,
    )
      .bind(id)
      .run()
  }

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
