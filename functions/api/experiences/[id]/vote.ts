import { requireAuth } from '../../../_lib/auth'
import { getExperience, getExperienceLinks, toExperience } from '../../../_lib/experiences'
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
  const experience = await getExperience(env, id, auth.user.id)

  if (experience?.status !== 'visible') {
    return json({ error: 'Experience not found' }, { status: 404 })
  }

  const body = await readJson<VoteBody>(request)
  const value = cleanVote(body.value)

  if (value === 0) {
    await env.DB.prepare('DELETE FROM experience_votes WHERE experience_id = ? AND user_id = ?')
      .bind(id, auth.user.id)
      .run()
  } else {
    await env.DB.prepare(
      `INSERT INTO experience_votes (experience_id, user_id, value)
       VALUES (?, ?, ?)
       ON CONFLICT(experience_id, user_id)
       DO UPDATE SET value = excluded.value,
                     updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`,
    )
      .bind(id, auth.user.id, value)
      .run()
  }

  const nextExperience = await getExperience(env, id, auth.user.id)

  return json({
    experience: nextExperience
      ? toExperience(nextExperience, auth, await getExperienceLinks(env, id))
      : null,
  })
}
