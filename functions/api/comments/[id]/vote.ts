import { requireAuth } from '../../../_lib/auth'
import { type CommentRow, commentSelectSql, getComment, toComment } from '../../../_lib/comments'
import { assertSameOrigin, json, readJson } from '../../../_lib/http'
import type { Env } from '../../../_lib/types'
import { cleanVote } from '../../../_lib/validators'

interface VoteBody {
  value?: number
}

function getId(params: EventContext<Env, 'id', unknown>['params']) {
  return Array.isArray(params.id) ? params.id[0] : params.id
}

export const onRequestPost: PagesFunction<Env, 'id'> = async ({ request, env, params }) => {
  assertSameOrigin(request)
  const auth = await requireAuth(request, env)
  const id = getId(params)
  const comment = await getComment(env, id)

  if (comment?.status !== 'visible') {
    return json({ error: 'Comment not found' }, { status: 404 })
  }

  const body = await readJson<VoteBody>(request)
  const value = cleanVote(body.value)

  if (value === 0) {
    await env.DB.prepare('DELETE FROM comment_votes WHERE comment_id = ? AND user_id = ?')
      .bind(id, auth.user.id)
      .run()
  } else {
    await env.DB.prepare(
      `INSERT INTO comment_votes (comment_id, user_id, value)
       VALUES (?, ?, ?)
       ON CONFLICT(comment_id, user_id)
       DO UPDATE SET value = excluded.value,
                     updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`,
    )
      .bind(id, auth.user.id, value)
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
