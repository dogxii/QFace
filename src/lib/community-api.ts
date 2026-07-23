import type { CommentKind, NoteSaveAction, PublicCommentKind } from '@/types/community'

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

async function parseResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get('content-type') ?? ''
  const data = contentType.includes('application/json') ? await response.json() : undefined

  if (!response.ok) {
    const errorMessage =
      data && typeof data === 'object' && 'error' in data && typeof data.error === 'string'
        ? data.error
        : '请求失败'

    throw new ApiError(errorMessage, response.status)
  }

  return data as T
}

export async function apiGet<T>(url: string) {
  return parseResponse<T>(await fetch(url, { credentials: 'include' }))
}

export async function apiSend<T>(
  url: string,
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  body?: unknown,
) {
  return parseResponse<T>(
    await fetch(url, {
      method,
      credentials: 'include',
      headers: body === undefined ? undefined : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  )
}

export function githubLoginUrl() {
  const redirect = `${window.location.pathname}${window.location.search}${window.location.hash}`
  return `/api/auth/github/start?redirect=${encodeURIComponent(redirect)}`
}

export function getComments(sourceId: string, kind = 'all') {
  const params = new URLSearchParams({ sourceId })
  if (kind !== 'all') params.set('kind', kind)

  return apiGet<{ comments: import('@/types/community').CommunityComment[] }>(
    `/api/comments?${params.toString()}`,
  )
}

export function createComment(input: {
  sourceId: string
  parentId?: string | null
  kind?: CommentKind
  content: string
}) {
  return apiSend<{ comment: import('@/types/community').CommunityComment }>(
    '/api/comments',
    'POST',
    input,
  )
}

export function updateComment(id: string, content: string) {
  return apiSend<{ comment: import('@/types/community').CommunityComment }>(
    `/api/comments/${id}`,
    'PATCH',
    { content },
  )
}

export function deleteComment(id: string) {
  return apiSend<{ ok: true }>(`/api/comments/${id}`, 'DELETE')
}

export function voteComment(id: string, value: -1 | 0 | 1) {
  return apiSend<{ comment: import('@/types/community').CommunityComment }>(
    `/api/comments/${id}/vote`,
    'POST',
    { value },
  )
}

export function acceptComment(id: string, accepted: boolean) {
  return apiSend<{ comment: import('@/types/community').CommunityComment }>(
    `/api/comments/${id}/accept`,
    'POST',
    { accepted },
  )
}

export function getCommentCounts(sourceIds: string[]) {
  if (!sourceIds.length) return Promise.resolve({ counts: {} as Record<string, number> })
  const params = new URLSearchParams({ sourceIds: sourceIds.join(',') })

  return apiGet<{ counts: Record<string, number> }>(`/api/comments/counts?${params.toString()}`)
}

export function getRemoteNote(sourceId: string) {
  const params = new URLSearchParams({ sourceId })
  return apiGet<{ note: import('@/types/community').RemoteNote | null }>(
    `/api/notes?${params.toString()}`,
  )
}

export function getRemoteNotes() {
  return apiGet<{ notes: import('@/types/community').RemoteNote[] }>('/api/notes')
}

export function saveRemoteNote(input: {
  sourceId: string
  kind?: PublicCommentKind
  content?: string
  mastery?: number
  action?: NoteSaveAction
}) {
  return apiSend<{ note: import('@/types/community').RemoteNote | null }>(
    '/api/notes',
    'PUT',
    input,
  )
}
