import { json } from '../../_lib/http'
import type { Env } from '../../_lib/types'
import { cleanSourceId } from '../../_lib/validators'

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const url = new URL(request.url)
  const sourceIds = (url.searchParams.get('sourceIds') ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 100)
    .map(cleanSourceId)

  if (!sourceIds.length) return json({ counts: {} })

  const placeholders = sourceIds.map(() => '?').join(', ')
  const rows = await env.DB.prepare(
    `SELECT source_id, COUNT(*) AS count
     FROM comments
     WHERE status = 'visible'
       AND source_id IN (${placeholders})
     GROUP BY source_id`,
  )
    .bind(...sourceIds)
    .all<{ source_id: string; count: number }>()

  const counts: Record<string, number> = Object.fromEntries(
    sourceIds.map((sourceId) => [sourceId, 0]),
  )

  for (const row of rows.results) {
    counts[row.source_id] = row.count
  }

  return json({ counts })
}
