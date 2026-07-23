import type {
  CommentKind,
  CommunityComment,
  NoteSaveAction,
  PublicCommentKind,
} from '@/types/community'

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

export function githubLoginUrl(redirect?: string) {
  const nextRedirect =
    redirect ?? `${window.location.pathname}${window.location.search}${window.location.hash}`
  return `/api/auth/github/start?redirect=${encodeURIComponent(nextRedirect)}`
}

function isCommentsPayload(payload: unknown): payload is { comments: CommunityComment[] } {
  return Boolean(
    payload &&
      typeof payload === 'object' &&
      'comments' in payload &&
      Array.isArray(payload.comments),
  )
}

function createDevMockComments(sourceId: string): { comments: CommunityComment[] } {
  const user = {
    id: 'dev-user-dogxi',
    login: 'dogxii',
    name: 'Dogxi',
    avatarUrl: 'https://avatars.githubusercontent.com/u/106546046?v=4',
    htmlUrl: 'https://github.com/dogxii',
  }
  const student = {
    id: 'dev-user-lin',
    login: 'lin-dev',
    name: '林一',
    avatarUrl: null,
    htmlUrl: 'https://github.com/lin-dev',
  }
  const interviewer = {
    id: 'dev-user-interviewer',
    login: 'frontend-interviewer',
    name: '面试官',
    avatarUrl: null,
    htmlUrl: 'https://github.com/frontend-interviewer',
  }

  if (sourceId.startsWith('exp-')) {
    return {
      comments: [
        {
          id: 'dev-experience-reply-1',
          sourceId,
          parentId: null,
          kind: 'discussion',
          content: '这种面经和题库打通会很有用，尤其是每个问题后面能直接跳到对应八股题。',
          status: 'visible',
          acceptedAt: null,
          createdAt: '2026-07-23T07:42:00.000Z',
          updatedAt: '2026-07-23T07:42:00.000Z',
          deletedAt: null,
          upvotes: 5,
          downvotes: 0,
          viewerVote: 0,
          canEdit: false,
          canDelete: false,
          canAccept: false,
          user: student,
        },
        {
          id: 'dev-experience-reply-2',
          sourceId,
          parentId: null,
          kind: 'discussion',
          content:
            '补一个观察：如果面经里问题比较散，自动匹配不一定百分百准，但作为第一步草稿已经很省时间，发布前自己检查一下链接就行。',
          status: 'visible',
          acceptedAt: null,
          createdAt: '2026-07-23T07:48:00.000Z',
          updatedAt: '2026-07-23T07:48:00.000Z',
          deletedAt: null,
          upvotes: 3,
          downvotes: 0,
          viewerVote: 1,
          canEdit: false,
          canDelete: false,
          canAccept: false,
          user,
        },
        {
          id: 'dev-experience-reply-3',
          sourceId,
          parentId: 'dev-experience-reply-2',
          kind: 'discussion',
          content: '是的，尤其是 XSS/CSRF 这类关键词很准，项目相关的问题可以不强行关联。',
          status: 'visible',
          acceptedAt: null,
          createdAt: '2026-07-23T07:51:00.000Z',
          updatedAt: '2026-07-23T07:51:00.000Z',
          deletedAt: null,
          upvotes: 1,
          downvotes: 0,
          viewerVote: 0,
          canEdit: false,
          canDelete: false,
          canAccept: false,
          user: interviewer,
        },
      ],
    }
  }

  return {
    comments: [
      {
        id: 'dev-answer-1',
        sourceId,
        parentId: null,
        kind: 'answer',
        content:
          '这是一条本地开发测试回答。var 是函数作用域，let 和 const 是块级作用域。const 不能重新赋值，但对象内部属性仍然可以修改。',
        status: 'visible',
        acceptedAt: null,
        createdAt: '2026-07-23T06:31:00.000Z',
        updatedAt: '2026-07-23T06:31:00.000Z',
        deletedAt: null,
        upvotes: 8,
        downvotes: 2,
        viewerVote: 1,
        canEdit: false,
        canDelete: false,
        canAccept: false,
        user,
      },
      {
        id: 'dev-reply-1',
        sourceId,
        parentId: 'dev-answer-1',
        kind: 'discussion',
        content: '这是一条本地开发测试回复，用来检查回复区的间距和操作按钮。',
        status: 'visible',
        acceptedAt: null,
        createdAt: '2026-07-23T06:34:00.000Z',
        updatedAt: '2026-07-23T06:34:00.000Z',
        deletedAt: null,
        upvotes: 1,
        downvotes: 0,
        viewerVote: 0,
        canEdit: false,
        canDelete: true,
        canAccept: false,
        user,
      },
      {
        id: 'dev-reply-2',
        sourceId,
        parentId: 'dev-answer-1',
        kind: 'discussion',
        content:
          '这是一条比较长的本地开发测试回复，用来检查长回复折叠和展开。实际社区里经常会有人把一段理解、反例、代码边界、面试表达方式都写在同一条回复里，如果没有折叠，列表会被单条内容拉得很长，影响继续浏览其他人的回答。这里特意写长一点：`var` 的问题不只是“可以重复声明”，更关键是它没有块级作用域，容易在循环、条件分支和闭包里制造不直观的结果；`let` 更适合需要重新赋值的变量；`const` 更适合表达引用不变的意图。面试时可以先给结论，再补作用域、声明提升、重复声明、暂时性死区和 const 对引用类型的限制。',
        status: 'visible',
        acceptedAt: null,
        createdAt: '2026-07-23T06:36:00.000Z',
        updatedAt: '2026-07-23T06:52:00.000Z',
        deletedAt: null,
        upvotes: 4,
        downvotes: 1,
        viewerVote: -1,
        canEdit: false,
        canDelete: false,
        canAccept: false,
        user: student,
      },
      {
        id: 'dev-reply-3',
        sourceId,
        parentId: 'dev-answer-1',
        kind: 'discussion',
        content: '我一般会加一句：`const` 保证的是绑定关系不变，不是深层不可变。',
        status: 'visible',
        acceptedAt: null,
        createdAt: '2026-07-15T02:38:00.000Z',
        updatedAt: '2026-07-15T02:38:00.000Z',
        deletedAt: null,
        upvotes: 2,
        downvotes: 0,
        viewerVote: 0,
        canEdit: false,
        canDelete: false,
        canAccept: false,
        user: interviewer,
      },
      {
        id: 'dev-reply-4',
        sourceId,
        parentId: 'dev-answer-1',
        kind: 'discussion',
        content: '如果题目追问声明提升，可以顺着解释 TDZ，别只背结论。',
        status: 'visible',
        acceptedAt: null,
        createdAt: '2026-07-23T06:41:00.000Z',
        updatedAt: '2026-07-23T06:41:00.000Z',
        deletedAt: null,
        upvotes: 0,
        downvotes: 0,
        viewerVote: 0,
        canEdit: false,
        canDelete: false,
        canAccept: false,
        user: student,
      },
      {
        id: 'dev-explain-1',
        sourceId,
        parentId: null,
        kind: 'explain',
        content: '这是一条本地开发测试详解，用来检查 `#详解` 标签和热度 / 最新排序。',
        status: 'visible',
        acceptedAt: null,
        createdAt: '2025-07-01T06:20:00.000Z',
        updatedAt: '2025-07-01T06:20:00.000Z',
        deletedAt: null,
        upvotes: 3,
        downvotes: 0,
        viewerVote: 0,
        canEdit: false,
        canDelete: false,
        canAccept: false,
        user,
      },
    ],
  }
}

export async function getComments(sourceId: string, kind = 'all') {
  const params = new URLSearchParams({ sourceId })
  if (kind !== 'all') params.set('kind', kind)

  try {
    const payload = await apiGet<{ comments: CommunityComment[] }>(
      `/api/comments?${params.toString()}`,
    )
    if (isCommentsPayload(payload)) return payload
    if (import.meta.env.DEV) return createDevMockComments(sourceId)
    throw new ApiError('评论数据格式错误', 502)
  } catch (error) {
    if (import.meta.env.DEV) return createDevMockComments(sourceId)
    throw error
  }
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
