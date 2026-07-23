import { requireAuth } from '../../_lib/auth'
import { assertSameOrigin, json, readJson } from '../../_lib/http'
import type { Env } from '../../_lib/types'
import {
  cleanMastery,
  cleanNoteSaveAction,
  cleanOptionalContent,
  cleanPublicCommentKind,
  cleanSourceId,
  type NoteSaveAction,
  type PublicCommentKind,
} from '../../_lib/validators'

interface NoteRow {
  source_id: string
  answer_content: string
  explain_content: string
  mastery: number
  answer_comment_id: string | null
  explain_comment_id: string | null
  answer_published_at: string | null
  explain_published_at: string | null
  answer_published_content: string | null
  explain_published_content: string | null
  created_at: string
  updated_at: string
}

interface StoredNoteRow {
  answer_content: string
  explain_content: string
  mastery: number
  answer_comment_id: string | null
  explain_comment_id: string | null
  answer_published_at: string | null
  explain_published_at: string | null
}

interface SaveNoteBody {
  sourceId?: string
  kind?: PublicCommentKind
  content?: string
  mastery?: number
  action?: NoteSaveAction
}

interface DraftState {
  content: string
  publicCommentId: string | null
  publishedAt: string | null
  publishedContent: string
}

function isoNow() {
  return new Date().toISOString()
}

function cleanKind(value: unknown) {
  return cleanPublicCommentKind(value) ?? 'answer'
}

function createDraft(input: {
  content: string
  publicCommentId: string | null
  publishedAt: string | null
  publishedContent: string | null
}): DraftState {
  const hasPublishedContent = input.publishedContent !== null

  return {
    content: input.content,
    publicCommentId: hasPublishedContent ? input.publicCommentId : null,
    publishedAt: hasPublishedContent ? input.publishedAt : null,
    publishedContent: input.publishedContent ?? '',
  }
}

function toNote(row: NoteRow) {
  const answer = createDraft({
    content: row.answer_content,
    publicCommentId: row.answer_comment_id,
    publishedAt: row.answer_published_at,
    publishedContent: row.answer_published_content,
  })
  const explain = createDraft({
    content: row.explain_content,
    publicCommentId: row.explain_comment_id,
    publishedAt: row.explain_published_at,
    publishedContent: row.explain_published_content,
  })
  return {
    sourceId: row.source_id,
    mastery: row.mastery,
    answer,
    explain,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    content: answer.content || explain.content,
  }
}

function noteSelectSql(whereSql: string) {
  return `
    SELECT
      notes.source_id,
      notes.answer_content,
      notes.explain_content,
      notes.mastery,
      notes.answer_comment_id,
      notes.explain_comment_id,
      notes.answer_published_at,
      notes.explain_published_at,
      answer_comments.content AS answer_published_content,
      explain_comments.content AS explain_published_content,
      notes.created_at,
      notes.updated_at
    FROM notes
    LEFT JOIN comments AS answer_comments
      ON answer_comments.id = notes.answer_comment_id
     AND answer_comments.status = 'visible'
    LEFT JOIN comments AS explain_comments
      ON explain_comments.id = notes.explain_comment_id
     AND explain_comments.status = 'visible'
    ${whereSql}
  `
}

async function softDeletePublicComment(env: Env, commentId: string | null, userId: string) {
  if (!commentId) return

  await env.DB.prepare(
    `UPDATE comments
     SET status = 'deleted',
         content = '',
         deleted_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
     WHERE id = ? AND user_id = ? AND status = 'visible'`,
  )
    .bind(commentId, userId)
    .run()
}

async function upsertPublicComment(
  env: Env,
  input: {
    sourceId: string
    userId: string
    content: string
    kind: PublicCommentKind
    publicCommentId: string | null
  },
) {
  if (input.publicCommentId) {
    const existing = await env.DB.prepare(
      `SELECT id
       FROM comments
       WHERE id = ? AND user_id = ? AND source_id = ?
       LIMIT 1`,
    )
      .bind(input.publicCommentId, input.userId, input.sourceId)
      .first<{ id: string }>()

    if (existing) {
      await env.DB.prepare(
        `UPDATE comments
         SET kind = ?,
             content = ?,
             status = 'visible',
             deleted_at = NULL,
             updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
         WHERE id = ? AND user_id = ?`,
      )
        .bind(input.kind, input.content, input.publicCommentId, input.userId)
        .run()

      return input.publicCommentId
    }
  }

  const commentId = crypto.randomUUID()

  await env.DB.prepare(
    `INSERT INTO comments (id, source_id, parent_id, user_id, kind, content)
     VALUES (?, ?, NULL, ?, ?, ?)`,
  )
    .bind(commentId, input.sourceId, input.userId, input.kind, input.content)
    .run()

  return commentId
}

async function getStoredNote(env: Env, userId: string, sourceId: string) {
  return env.DB.prepare(
    `SELECT answer_content,
            explain_content,
            mastery,
            answer_comment_id,
            explain_comment_id,
            answer_published_at,
            explain_published_at
     FROM notes
     WHERE user_id = ? AND source_id = ?
     LIMIT 1`,
  )
    .bind(userId, sourceId)
    .first<StoredNoteRow>()
}

async function getNoteForResponse(env: Env, userId: string, sourceId: string) {
  return env.DB.prepare(
    `${noteSelectSql('WHERE notes.user_id = ? AND notes.source_id = ?')} LIMIT 1`,
  )
    .bind(userId, sourceId)
    .first<NoteRow>()
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const auth = await requireAuth(request, env)
  const url = new URL(request.url)
  const sourceId = url.searchParams.get('sourceId')

  if (sourceId) {
    const note = await getNoteForResponse(env, auth.user.id, cleanSourceId(sourceId))

    return json({ note: note ? toNote(note) : null })
  }

  const rows = await env.DB.prepare(
    `${noteSelectSql(`
     WHERE notes.user_id = ?
       AND (
         length(trim(notes.answer_content)) > 0
         OR length(trim(notes.explain_content)) > 0
         OR notes.answer_comment_id IS NOT NULL
         OR notes.explain_comment_id IS NOT NULL
         OR notes.mastery > 0
       )
     ORDER BY notes.updated_at DESC
    `)}`,
  )
    .bind(auth.user.id)
    .all<NoteRow>()

  return json({ notes: rows.results.map(toNote) })
}

export const onRequestPut: PagesFunction<Env> = async ({ request, env }) => {
  assertSameOrigin(request)
  const auth = await requireAuth(request, env)
  const body = await readJson<SaveNoteBody>(request)
  const sourceId = cleanSourceId(body.sourceId)
  const kind = cleanKind(body.kind)
  const action = cleanNoteSaveAction(body.action)
  const existing = await getStoredNote(env, auth.user.id, sourceId)

  let answerContent = existing?.answer_content ?? ''
  let explainContent = existing?.explain_content ?? ''
  let answerCommentId = existing?.answer_comment_id ?? null
  let explainCommentId = existing?.explain_comment_id ?? null
  let answerPublishedAt = existing?.answer_published_at ?? null
  let explainPublishedAt = existing?.explain_published_at ?? null
  const mastery = body.mastery === undefined ? (existing?.mastery ?? 0) : cleanMastery(body.mastery)

  if (body.content !== undefined) {
    const content = cleanOptionalContent(body.content, 50000)
    if (kind === 'answer') {
      answerContent = content
    } else {
      explainContent = content
    }
  }

  if (action === 'publish') {
    const content = kind === 'answer' ? answerContent : explainContent
    if (content.trim().length < 2) {
      throw new Response(JSON.stringify({ error: 'Content is too short' }), {
        status: 400,
        headers: { 'content-type': 'application/json; charset=utf-8' },
      })
    }

    const commentId = await upsertPublicComment(env, {
      sourceId,
      userId: auth.user.id,
      content,
      kind,
      publicCommentId: kind === 'answer' ? answerCommentId : explainCommentId,
    })

    if (kind === 'answer') {
      answerCommentId = commentId
      answerPublishedAt = isoNow()
    } else {
      explainCommentId = commentId
      explainPublishedAt = isoNow()
    }
  } else if (action === 'unpublish') {
    if (kind === 'answer') {
      await softDeletePublicComment(env, answerCommentId, auth.user.id)
      answerCommentId = null
      answerPublishedAt = null
    } else {
      await softDeletePublicComment(env, explainCommentId, auth.user.id)
      explainCommentId = null
      explainPublishedAt = null
    }
  }

  if (
    mastery === 0 &&
    !answerContent.trim() &&
    !explainContent.trim() &&
    !answerCommentId &&
    !explainCommentId
  ) {
    await env.DB.prepare('DELETE FROM notes WHERE user_id = ? AND source_id = ?')
      .bind(auth.user.id, sourceId)
      .run()
    return json({ note: null })
  }

  await env.DB.prepare(
    `INSERT INTO notes (
       user_id,
       source_id,
       mastery,
       answer_content,
       explain_content,
       answer_comment_id,
       explain_comment_id,
       answer_published_at,
       explain_published_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id, source_id)
     DO UPDATE SET mastery = excluded.mastery,
                   answer_content = excluded.answer_content,
                   explain_content = excluded.explain_content,
                   answer_comment_id = excluded.answer_comment_id,
                   explain_comment_id = excluded.explain_comment_id,
                   answer_published_at = excluded.answer_published_at,
                   explain_published_at = excluded.explain_published_at,
                   updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`,
  )
    .bind(
      auth.user.id,
      sourceId,
      mastery,
      answerContent,
      explainContent,
      answerCommentId,
      explainCommentId,
      answerPublishedAt,
      explainPublishedAt,
    )
    .run()

  const note = await getNoteForResponse(env, auth.user.id, sourceId)

  return json({ note: note ? toNote(note) : null })
}
