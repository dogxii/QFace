import { getAuth, requireAuth } from '../../_lib/auth'
import {
  cleanExperienceLinks,
  type ExperienceRow,
  experienceSelectSql,
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

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const url = new URL(request.url)
  const keyword = url.searchParams.get('q')?.trim()
  const mine = url.searchParams.get('mine') === '1'
  const sort = url.searchParams.get('sort') === 'hot' ? 'hot' : 'latest'
  let auth = await getAuth(request, env)
  let mineUserId: string | undefined
  if (mine) {
    auth = auth ?? (await requireAuth(request, env))
    mineUserId = auth.user.id
  }

  const viewerUserId = auth?.user.id ?? null
  const filters = [`experiences.status = 'visible'`]
  const bindings: unknown[] = viewerUserId ? [viewerUserId] : []

  if (mineUserId) {
    filters.push('experiences.user_id = ?')
    bindings.push(mineUserId)
  }

  if (keyword) {
    const like = `%${keyword}%`
    filters.push(
      `(experiences.title LIKE ? OR experiences.content LIKE ? OR experiences.interview_date LIKE ? OR users.login LIKE ? OR users.name LIKE ?)`,
    )
    bindings.push(like, like, like, like, like)
  }

  const orderSql =
    sort === 'hot'
      ? 'ORDER BY upvotes DESC, downvotes ASC, reply_count DESC, experiences.created_at DESC'
      : 'ORDER BY experiences.created_at DESC'

  const rows = await env.DB.prepare(
    `${experienceSelectSql(viewerUserId)}
     WHERE ${filters.join(' AND ')}
     ${orderSql}
     LIMIT 60`,
  )
    .bind(...bindings)
    .all<ExperienceRow>()

  return json({
    experiences: rows.results.map((row) => toExperience(row, auth)),
  })
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  assertSameOrigin(request)
  const auth = await requireAuth(request, env)
  const body = await readJson<ExperienceBody>(request)
  const id = crypto.randomUUID()
  const title = cleanTitle(body.title)
  const interviewDate = cleanOptionalDate(body.interviewDate)
  const content = cleanContent(body.content, 30000)
  const links = cleanExperienceLinks(body.links)

  await env.DB.prepare(
    `INSERT INTO experiences (id, user_id, title, interview_date, content)
     VALUES (?, ?, ?, ?, ?)`,
  )
    .bind(id, auth.user.id, title, interviewDate, content)
    .run()

  await replaceExperienceLinks(env, id, links)

  const row = await env.DB.prepare(
    `${experienceSelectSql(auth.user.id)}
     WHERE experiences.id = ?
     LIMIT 1`,
  )
    .bind(auth.user.id, id)
    .first<ExperienceRow>()

  return json(
    {
      experience: row ? toExperience(row, auth, await getExperienceLinks(env, id)) : null,
    },
    { status: 201 },
  )
}
