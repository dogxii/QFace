export type CommentKind = 'answer' | 'explain' | 'question' | 'discussion'
export type PublicCommentKind = 'answer' | 'explain'
export type NoteSaveAction = 'draft' | 'publish' | 'unpublish'

const commentKinds = new Set<CommentKind>(['answer', 'explain', 'question', 'discussion'])
const publicCommentKinds = new Set<PublicCommentKind>(['answer', 'explain'])
const noteSaveActions = new Set<NoteSaveAction>(['draft', 'publish', 'unpublish'])

export function cleanSourceId(value: unknown) {
  const sourceId = typeof value === 'string' ? value.trim() : ''
  if (!/^[a-z0-9][a-z0-9-]{1,63}$/i.test(sourceId)) {
    throw new Response(JSON.stringify({ error: 'Invalid source id' }), {
      status: 400,
      headers: { 'content-type': 'application/json; charset=utf-8' },
    })
  }

  return sourceId
}

export function cleanContent(value: unknown, maxLength = 12000) {
  const content = typeof value === 'string' ? value.trim() : ''
  if (content.length < 2) {
    throw new Response(JSON.stringify({ error: 'Content is too short' }), {
      status: 400,
      headers: { 'content-type': 'application/json; charset=utf-8' },
    })
  }
  if (content.length > maxLength) {
    throw new Response(JSON.stringify({ error: 'Content is too long' }), {
      status: 400,
      headers: { 'content-type': 'application/json; charset=utf-8' },
    })
  }

  return content
}

export function cleanTitle(value: unknown, maxLength = 80) {
  const title = typeof value === 'string' ? value.trim() : ''
  if (title.length < 2) {
    throw new Response(JSON.stringify({ error: 'Title is too short' }), {
      status: 400,
      headers: { 'content-type': 'application/json; charset=utf-8' },
    })
  }
  if (title.length > maxLength) {
    throw new Response(JSON.stringify({ error: 'Title is too long' }), {
      status: 400,
      headers: { 'content-type': 'application/json; charset=utf-8' },
    })
  }

  return title
}

export function cleanOptionalContent(value: unknown, maxLength = 12000) {
  const content = typeof value === 'string' ? value.trim() : ''
  if (content.length > maxLength) {
    throw new Response(JSON.stringify({ error: 'Content is too long' }), {
      status: 400,
      headers: { 'content-type': 'application/json; charset=utf-8' },
    })
  }

  return content
}

export function cleanOptionalDate(value: unknown) {
  const text = typeof value === 'string' ? value.trim() : ''
  if (!text) return ''

  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    throw new Response(JSON.stringify({ error: 'Invalid date' }), {
      status: 400,
      headers: { 'content-type': 'application/json; charset=utf-8' },
    })
  }

  const date = new Date(`${text}T00:00:00.000Z`)
  if (Number.isNaN(date.getTime())) {
    throw new Response(JSON.stringify({ error: 'Invalid date' }), {
      status: 400,
      headers: { 'content-type': 'application/json; charset=utf-8' },
    })
  }

  const normalized = date.toISOString().slice(0, 10)
  if (normalized !== text) {
    throw new Response(JSON.stringify({ error: 'Invalid date' }), {
      status: 400,
      headers: { 'content-type': 'application/json; charset=utf-8' },
    })
  }

  return text
}

export function cleanCommentKind(value: unknown): CommentKind {
  return commentKinds.has(value as CommentKind) ? (value as CommentKind) : 'answer'
}

export function cleanPublicCommentKind(value: unknown): PublicCommentKind | undefined {
  if (value === undefined || value === null || value === '') return undefined
  if (publicCommentKinds.has(value as PublicCommentKind)) return value as PublicCommentKind

  throw new Response(JSON.stringify({ error: 'Invalid public comment kind' }), {
    status: 400,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}

export function cleanParentId(value: unknown) {
  if (value === undefined || value === null || value === '') return null
  const id = typeof value === 'string' ? value.trim() : ''
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    throw new Response(JSON.stringify({ error: 'Invalid parent id' }), {
      status: 400,
      headers: { 'content-type': 'application/json; charset=utf-8' },
    })
  }

  return id
}

export function cleanVote(value: unknown) {
  if (value === 1 || value === '1') return 1
  if (value === -1 || value === '-1') return -1
  if (value === 0 || value === '0' || value === null) return 0

  throw new Response(JSON.stringify({ error: 'Invalid vote value' }), {
    status: 400,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}

export function cleanMastery(value: unknown) {
  const mastery = Number(value ?? 0)
  if (!Number.isInteger(mastery) || mastery < 0 || mastery > 3) {
    throw new Response(JSON.stringify({ error: 'Invalid mastery value' }), {
      status: 400,
      headers: { 'content-type': 'application/json; charset=utf-8' },
    })
  }

  return mastery
}

export function cleanNoteSaveAction(value: unknown): NoteSaveAction {
  if (value === undefined || value === null || value === '') return 'draft'
  if (noteSaveActions.has(value as NoteSaveAction)) return value as NoteSaveAction

  throw new Response(JSON.stringify({ error: 'Invalid note action' }), {
    status: 400,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}
