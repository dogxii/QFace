import { canModerate, getAuth, requireAuth } from '../../_lib/auth'
import {
  cleanExperienceLinks,
  type ExperienceRow,
  experienceSelectSql,
  getExperience,
  getExperienceLinks,
  replaceExperienceLinks,
  toExperience,
} from '../../_lib/experiences'
import { assertSameOrigin, json, readJson } from '../../_lib/http'
import type { Env } from '../../_lib/types'
import { cleanContent, cleanOptionalDate, cleanTitle } from '../../_lib/validators'

interface ExperienceBody {
  title?: string
  interviewDate?: string
  content?: string
  links?: unknown
}

function getId(params: EventContext<Env, 'id', unknown>['params']) {
  return Array.isArray(params.id) ? params.id[0] : params.id
}

export const onRequestGet: PagesFunction<Env, 'id'> = async ({ request, env, params }) => {
  const auth = await getAuth(request, env)
  const id = getId(params)
  const row = await getExperience(env, id, auth?.user.id ?? null)

  if (row?.status !== 'visible') {
    return json({ error: 'Experience not found' }, { status: 404 })
  }

  return json({
    experience: toExperience(row, auth, await getExperienceLinks(env, id)),
  })
}

export const onRequestPatch: PagesFunction<Env, 'id'> = async ({ request, env, params }) => {
  assertSameOrigin(request)
  const auth = await requireAuth(request, env)
  const id = getId(params)
  const previous = await getExperience(env, id, auth.user.id)

  if (previous?.status !== 'visible') {
    return json({ error: 'Experience not found' }, { status: 404 })
  }
  if (previous.user_id !== auth.user.id && !canModerate(auth.user)) {
    return json({ error: 'Only the author or moderator can edit this experience' }, { status: 403 })
  }

  const body = await readJson<ExperienceBody>(request)
  const title = cleanTitle(body.title)
  const interviewDate = cleanOptionalDate(body.interviewDate)
  const content = cleanContent(body.content, 30000)
  const links = cleanExperienceLinks(body.links)

  await env.DB.prepare(
    `UPDATE experiences
     SET title = ?,
         interview_date = ?,
         content = ?,
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
     WHERE id = ?`,
  )
    .bind(title, interviewDate, content, id)
    .run()

  await replaceExperienceLinks(env, id, links)

  const row = await env.DB.prepare(
    `${experienceSelectSql(auth.user.id)}
     WHERE experiences.id = ?
     LIMIT 1`,
  )
    .bind(auth.user.id, id)
    .first<ExperienceRow>()

  return json({
    experience: row ? toExperience(row, auth, await getExperienceLinks(env, id)) : null,
  })
}

export const onRequestDelete: PagesFunction<Env, 'id'> = async ({ request, env, params }) => {
  assertSameOrigin(request)
  const auth = await requireAuth(request, env)
  const id = getId(params)
  const previous = await getExperience(env, id, auth.user.id)

  if (previous?.status !== 'visible') {
    return json({ error: 'Experience not found' }, { status: 404 })
  }
  if (previous.user_id !== auth.user.id && !canModerate(auth.user)) {
    return json(
      { error: 'Only the author or moderator can delete this experience' },
      { status: 403 },
    )
  }

  await env.DB.prepare(
    `UPDATE experiences
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
