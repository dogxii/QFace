import type { Env } from './types'

export interface QuestionStatsRow {
  source_id: string
  comment_count: number
  answer_count: number
  explain_count: number
  discussion_count: number
  last_comment_at: string | null
}

function isMissingStatsTable(error: unknown) {
  return String(error).includes('question_stats')
}

function aggregateStatsSql(whereSql = '') {
  return `
    SELECT
      source_id,
      COUNT(*) AS comment_count,
      SUM(CASE WHEN kind = 'answer' THEN 1 ELSE 0 END) AS answer_count,
      SUM(CASE WHEN kind = 'explain' THEN 1 ELSE 0 END) AS explain_count,
      SUM(CASE WHEN kind = 'discussion' THEN 1 ELSE 0 END) AS discussion_count,
      MAX(created_at) AS last_comment_at
    FROM comments
    WHERE status = 'visible'
      ${whereSql}
    GROUP BY source_id
  `
}

export function toQuestionStats(row: QuestionStatsRow) {
  return {
    sourceId: row.source_id,
    commentCount: row.comment_count ?? 0,
    answerCount: row.answer_count ?? 0,
    explainCount: row.explain_count ?? 0,
    discussionCount: row.discussion_count ?? 0,
    lastCommentAt: row.last_comment_at,
  }
}

export async function getQuestionStatsRows(env: Env) {
  try {
    return (
      await env.DB.prepare(
        `SELECT source_id,
                comment_count,
                answer_count,
                explain_count,
                discussion_count,
                last_comment_at
         FROM question_stats
         WHERE comment_count > 0`,
      ).all<QuestionStatsRow>()
    ).results
  } catch (error) {
    if (!isMissingStatsTable(error)) throw error

    return (await env.DB.prepare(aggregateStatsSql()).all<QuestionStatsRow>()).results
  }
}

export async function getQuestionStatsRowsForSourceIds(env: Env, sourceIds: string[]) {
  if (!sourceIds.length) return []

  const placeholders = sourceIds.map(() => '?').join(', ')

  try {
    return (
      await env.DB.prepare(
        `SELECT source_id,
                comment_count,
                answer_count,
                explain_count,
                discussion_count,
                last_comment_at
         FROM question_stats
         WHERE source_id IN (${placeholders})`,
      )
        .bind(...sourceIds)
        .all<QuestionStatsRow>()
    ).results
  } catch (error) {
    if (!isMissingStatsTable(error)) throw error

    return (
      await env.DB.prepare(aggregateStatsSql(`AND source_id IN (${placeholders})`))
        .bind(...sourceIds)
        .all<QuestionStatsRow>()
    ).results
  }
}
