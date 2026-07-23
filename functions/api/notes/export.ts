import { requireAuth } from '../../_lib/auth'
import type { Env } from '../../_lib/types'

interface NoteRow {
  source_id: string
  answer_content: string
  explain_content: string
  mastery: number
  answer_comment_id: string | null
  explain_comment_id: string | null
  answer_published_at: string | null
  explain_published_at: string | null
  created_at: string
  updated_at: string
}

function markdownExport(notes: NoteRow[]) {
  const exportedAt = new Date().toLocaleString('zh-CN', { hour12: false })
  const sections = notes.map((note) => {
    const answer = note.answer_content.trim()
    const explain = note.explain_content.trim()

    return [
      `## ${note.source_id}`,
      '',
      `- 掌握：${note.mastery}/3`,
      `- 回答：${note.answer_comment_id ? '已公开' : '私密草稿'}`,
      `- 详解：${note.explain_comment_id ? '已公开' : '私密草稿'}`,
      `- 更新：${note.updated_at}`,
      '',
      answer ? ['### 回答', '', answer, ''].join('\n') : '',
      explain ? ['### 详解', '', explain, ''].join('\n') : '',
    ]
      .filter(Boolean)
      .join('\n')
  })

  return [`# QFace 笔记`, '', `导出时间：${exportedAt}`, '', ...sections].join('\n')
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const auth = await requireAuth(request, env)
  const url = new URL(request.url)
  const format = url.searchParams.get('format') === 'markdown' ? 'markdown' : 'json'
  const rows = await env.DB.prepare(
    `SELECT source_id,
            answer_content,
            explain_content,
            mastery,
            answer_comment_id,
            explain_comment_id,
            answer_published_at,
            explain_published_at,
            created_at,
            updated_at
     FROM notes
     WHERE user_id = ?
       AND (
         length(trim(answer_content)) > 0
         OR length(trim(explain_content)) > 0
         OR answer_comment_id IS NOT NULL
         OR explain_comment_id IS NOT NULL
         OR mastery > 0
       )
     ORDER BY updated_at DESC`,
  )
    .bind(auth.user.id)
    .all<NoteRow>()

  if (format === 'markdown') {
    return new Response(markdownExport(rows.results), {
      headers: {
        'content-type': 'text/markdown; charset=utf-8',
        'content-disposition': 'attachment; filename="qface-notes.md"',
      },
    })
  }

  return new Response(
    JSON.stringify(
      {
        app: 'QFace',
        version: 2,
        exportedAt: new Date().toISOString(),
        notes: rows.results.map((note) => ({
          sourceId: note.source_id,
          content: note.answer_content || note.explain_content,
          answerContent: note.answer_content,
          explainContent: note.explain_content,
          mastery: note.mastery,
          answer: {
            content: note.answer_content,
            publicCommentId: note.answer_comment_id,
            publishedAt: note.answer_published_at,
          },
          explain: {
            content: note.explain_content,
            publicCommentId: note.explain_comment_id,
            publishedAt: note.explain_published_at,
          },
          createdAt: note.created_at,
          updatedAt: note.updated_at,
        })),
      },
      null,
      2,
    ),
    {
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'content-disposition': 'attachment; filename="qface-notes.json"',
      },
    },
  )
}
