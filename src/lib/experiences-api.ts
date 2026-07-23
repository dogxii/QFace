import { apiGet, apiSend } from '@/lib/community-api'
import type { Experience, ExperienceInput, ExperienceSort } from '@/types/experience'

const devExperiencesKey = 'qface:dev-experiences:v1'

export interface ExperienceListOptions {
  query?: string
  mine?: boolean
  sort?: ExperienceSort
}

const devUser = {
  id: 'dev-user-dogxi',
  login: 'dogxii',
  name: 'Dogxi',
  avatarUrl: 'https://avatars.githubusercontent.com/u/106546046?v=4',
  htmlUrl: 'https://github.com/dogxii',
}

function now() {
  return new Date().toISOString()
}

function createDevExperience(input?: Partial<Experience>): Experience {
  const timestamp = '2026-07-23T07:30:00.000Z'
  const content = [
    'wxg 企业微信日常一面：',
    '',
    '自我介绍',
    '',
    'XSS 是什么？什么情况会发生？怎么防御？React 里用什么会发生？ [↗](/q/net-044)',
    '',
    'CSRF 是什么？怎么发生？防御办法？ [↗](/q/net-045)',
    '',
    '浏览器输入 URL -> 页面出现流程 [↗](/q/net-025)',
    '',
    '说一下事件循环 [↗](/q/js-006)',
    '',
    '如果一个长列表遍历会阻塞主线程，如何解决？',
    '',
    'Vite 为什么启动快？如何实现按需编译？ [↗](/q/perf-025)',
    '',
    '了解 Node.js 吗？讲下 V8 的 GC 回收',
    '',
    '新生代和老生代了解吗？',
    '',
    'React setState -> 虚拟 DOM -> 真实 DOM 的过程 [↗](/q/react-010)',
    '',
    '项目相关（仅提问，无技术问题）',
    '',
    '实习相关（压根没问…）',
    '',
    '算法：20 有效的有序括号 {[()]}（额外增加有序括号要求）',
  ].join('\n')

  return {
    id: 'dev-wxg-frontend-1',
    title: 'wxg 企业微信日常一面',
    interviewDate: '2026-07-16',
    content,
    status: 'visible',
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
    linkCount: 6,
    replyCount: 3,
    upvotes: 12,
    downvotes: 1,
    viewerVote: 0,
    links: [
      { id: 'dev-link-xss', sourceId: 'net-044', label: 'XSS', position: 0 },
      { id: 'dev-link-csrf', sourceId: 'net-045', label: 'CSRF', position: 1 },
      { id: 'dev-link-url', sourceId: 'net-025', label: 'URL 流程', position: 2 },
      { id: 'dev-link-event-loop', sourceId: 'js-006', label: '事件循环', position: 3 },
      { id: 'dev-link-vite', sourceId: 'perf-025', label: 'Vite', position: 4 },
      { id: 'dev-link-react-vdom', sourceId: 'react-010', label: '虚拟 DOM', position: 5 },
    ],
    canEdit: true,
    canDelete: true,
    user: devUser,
    ...input,
  }
}

function isExperiencesPayload(payload: unknown): payload is { experiences: Experience[] } {
  return Boolean(
    payload &&
      typeof payload === 'object' &&
      'experiences' in payload &&
      Array.isArray(payload.experiences),
  )
}

function isExperiencePayload(payload: unknown): payload is { experience: Experience | null } {
  return Boolean(payload && typeof payload === 'object' && 'experience' in payload)
}

function readDevExperiences() {
  if (!import.meta.env.DEV) return []

  try {
    const parsed = JSON.parse(window.localStorage.getItem(devExperiencesKey) ?? '[]')
    if (!Array.isArray(parsed)) return []
    return parsed as Experience[]
  } catch {
    return []
  }
}

function writeDevExperiences(experiences: Experience[]) {
  if (!import.meta.env.DEV) return
  window.localStorage.setItem(devExperiencesKey, JSON.stringify(experiences))
}

function devExperienceList() {
  const local = readDevExperiences()
  if (local.length) return local

  return [
    createDevExperience(),
    createDevExperience({
      id: 'dev-byte-frontend-1',
      title: '字节前端实习二面',
      interviewDate: '2026-07-03',
      content: [
        '字节前端实习二面：',
        '',
        'Promise.all 和 Promise.allSettled 的区别 [↗](/q/js-026)',
        '',
        '说一下闭包，项目里哪里用过 [↗](/q/js-004)',
        '',
        'React.memo 有什么作用，什么时候会失效 [↗](/q/react-021)',
        '',
        '虚拟列表怎么做，动态高度怎么处理',
        '',
        '整体感觉更偏项目追问，八股题问得不算深。',
      ].join('\n'),
      linkCount: 3,
      replyCount: 1,
      upvotes: 4,
      downvotes: 0,
      canEdit: false,
      canDelete: false,
      user: {
        id: 'dev-user-lin',
        login: 'lin-dev',
        name: '林一',
        avatarUrl: null,
        htmlUrl: 'https://github.com/lin-dev',
      },
      links: [
        { id: 'dev-link-promise', sourceId: 'js-026', label: 'Promise', position: 0 },
        { id: 'dev-link-closure', sourceId: 'js-004', label: '闭包', position: 1 },
        { id: 'dev-link-memo', sourceId: 'react-021', label: 'React.memo', position: 2 },
      ],
    }),
  ]
}

function filterDevExperiences({ query = '', mine, sort = 'latest' }: ExperienceListOptions) {
  const keyword = query.trim().toLocaleLowerCase('zh-CN')
  let experiences = devExperienceList()

  if (mine) {
    experiences = experiences.filter((experience) => experience.canEdit)
  }

  if (keyword) {
    experiences = experiences.filter((experience) =>
      [
        experience.title,
        experience.interviewDate,
        experience.user.name,
        experience.user.login,
        experience.content,
      ]
        .join('\n')
        .toLocaleLowerCase('zh-CN')
        .includes(keyword),
    )
  }

  return [...experiences].sort((left, right) => {
    if (sort === 'hot') {
      const leftScore = left.upvotes - left.downvotes
      const rightScore = right.upvotes - right.downvotes
      if (leftScore !== rightScore) return rightScore - leftScore
      if (left.replyCount !== right.replyCount) return right.replyCount - left.replyCount
    }

    return Date.parse(right.createdAt) - Date.parse(left.createdAt)
  })
}

function createLocalExperience(input: ExperienceInput) {
  const timestamp = now()
  const links = input.links ?? []

  return createDevExperience({
    id: crypto.randomUUID(),
    title: input.title,
    interviewDate: input.interviewDate ?? '',
    content: input.content,
    createdAt: timestamp,
    updatedAt: timestamp,
    linkCount: links.length,
    replyCount: 0,
    upvotes: 0,
    downvotes: 0,
    viewerVote: 0,
    links: links.map((link, index) => ({
      id: crypto.randomUUID(),
      sourceId: link.sourceId,
      label: link.label ?? '',
      position: link.position ?? index,
    })),
  })
}

export async function getExperiences(options: ExperienceListOptions = {}) {
  const params = new URLSearchParams()
  const query = options.query?.trim() ?? ''
  if (query.trim()) params.set('q', query.trim())
  if (options.mine) params.set('mine', '1')
  if (options.sort === 'hot') params.set('sort', 'hot')

  try {
    const payload = await apiGet<{ experiences: Experience[] }>(
      `/api/experiences${params.size ? `?${params.toString()}` : ''}`,
    )
    if (isExperiencesPayload(payload)) return payload
    if (import.meta.env.DEV) return { experiences: filterDevExperiences(options) }
    return { experiences: [] }
  } catch (error) {
    if (import.meta.env.DEV) return { experiences: filterDevExperiences(options) }
    throw error
  }
}

export async function getExperience(id: string) {
  try {
    const payload = await apiGet<{ experience: Experience | null }>(`/api/experiences/${id}`)
    if (isExperiencePayload(payload)) return payload
    if (import.meta.env.DEV) {
      return { experience: devExperienceList().find((item) => item.id === id) ?? null }
    }
    return { experience: null }
  } catch (error) {
    if (import.meta.env.DEV) {
      return { experience: devExperienceList().find((item) => item.id === id) ?? null }
    }
    throw error
  }
}

export async function createExperience(input: ExperienceInput) {
  try {
    return await apiSend<{ experience: Experience | null }>('/api/experiences', 'POST', input)
  } catch (error) {
    if (!import.meta.env.DEV) throw error

    const experience = createLocalExperience(input)
    writeDevExperiences([experience, ...readDevExperiences()])
    return { experience }
  }
}

export async function updateExperience(id: string, input: ExperienceInput) {
  try {
    return await apiSend<{ experience: Experience | null }>(
      `/api/experiences/${id}`,
      'PATCH',
      input,
    )
  } catch (error) {
    if (!import.meta.env.DEV) throw error

    const next = devExperienceList().map((item) =>
      item.id === id
        ? {
            ...item,
            ...input,
            linkCount: input.links?.length ?? item.linkCount,
            links:
              input.links?.map((link, index) => ({
                id: crypto.randomUUID(),
                sourceId: link.sourceId,
                label: link.label ?? '',
                position: link.position ?? index,
              })) ?? item.links,
            updatedAt: now(),
          }
        : item,
    )
    writeDevExperiences(next)

    return { experience: next.find((item) => item.id === id) ?? null }
  }
}

export function deleteExperience(id: string) {
  return apiSend<{ ok: true }>(`/api/experiences/${id}`, 'DELETE')
}

export async function voteExperience(id: string, value: -1 | 0 | 1) {
  try {
    return await apiSend<{ experience: Experience | null }>(`/api/experiences/${id}/vote`, 'POST', {
      value,
    })
  } catch (error) {
    if (!import.meta.env.DEV) throw error

    const next = devExperienceList().map((item) => {
      if (item.id !== id) return item

      const upvotes = item.upvotes - (item.viewerVote === 1 ? 1 : 0) + (value === 1 ? 1 : 0)
      const downvotes = item.downvotes - (item.viewerVote === -1 ? 1 : 0) + (value === -1 ? 1 : 0)

      return {
        ...item,
        upvotes: Math.max(0, upvotes),
        downvotes: Math.max(0, downvotes),
        viewerVote: value,
      }
    })
    writeDevExperiences(next)

    return { experience: next.find((item) => item.id === id) ?? null }
  }
}
