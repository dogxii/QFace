import { getAuth } from '../_lib/auth'
import { json, noStore } from '../_lib/http'
import type { Env } from '../_lib/types'

async function getStats(env: Env, userId: string) {
  const row = await env.DB.prepare(
    `SELECT
       (SELECT COUNT(*)
        FROM notes
        WHERE user_id = ?
          AND (
            length(trim(answer_content)) > 0
            OR length(trim(explain_content)) > 0
            OR mastery > 0
          )) AS note_count,
       (SELECT COUNT(*) FROM comments WHERE user_id = ? AND status = 'visible') AS comment_count
     `,
  )
    .bind(userId, userId)
    .first<{ note_count: number; comment_count: number }>()

  return {
    noteCount: row?.note_count ?? 0,
    commentCount: row?.comment_count ?? 0,
  }
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const auth = await getAuth(request, env)

  if (!auth) {
    return noStore(json({ user: null, stats: { noteCount: 0, commentCount: 0 } }))
  }

  return noStore(json({ user: auth.user, stats: await getStats(env, auth.user.id) }))
}
