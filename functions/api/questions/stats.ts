import { json } from '../../_lib/http'
import { getQuestionStatsRows, toQuestionStats } from '../../_lib/question-stats'
import type { Env } from '../../_lib/types'

const cacheControl = 'public, max-age=60, s-maxage=300, stale-while-revalidate=3600'

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const rows = await getQuestionStatsRows(env)

  return json(
    {
      stats: Object.fromEntries(rows.map((row) => [row.source_id, toQuestionStats(row)])),
    },
    {
      headers: {
        'cache-control': cacheControl,
      },
    },
  )
}
