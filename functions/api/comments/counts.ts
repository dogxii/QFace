import { getAuth } from '../../_lib/auth'
import { canViewExperience, getExperienceAccessByCommentSource } from '../../_lib/experiences'
import { json } from '../../_lib/http'
import { getQuestionStatsRowsForSourceIds } from '../../_lib/question-stats'
import type { Env } from '../../_lib/types'
import { cleanSourceId } from '../../_lib/validators'

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const url = new URL(request.url)
  const auth = await getAuth(request, env)
  const sourceIds = (url.searchParams.get('sourceIds') ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 100)
    .map(cleanSourceId)

  if (!sourceIds.length) return json({ counts: {} })

  const counts: Record<string, number> = Object.fromEntries(
    sourceIds.map((sourceId) => [sourceId, 0]),
  )
  const visibleSourceIds: string[] = []

  for (const sourceId of sourceIds) {
    if (!sourceId.startsWith('exp-')) {
      visibleSourceIds.push(sourceId)
      continue
    }

    const experience = await getExperienceAccessByCommentSource(env, sourceId)
    if (experience && canViewExperience(experience, auth)) visibleSourceIds.push(sourceId)
  }

  const rows = await getQuestionStatsRowsForSourceIds(env, visibleSourceIds)

  for (const row of rows) {
    counts[row.source_id] = row.comment_count
  }

  return json({ counts })
}
