export interface ExperienceDraftValue {
  title: string
  interviewDate: string
  content: string
}

export interface ExperienceDraft {
  value: ExperienceDraftValue
  savedAt: string
  baseUpdatedAt?: string
}

export const newExperienceDraftKey = 'qface:experience-draft:new:v1'

export function editExperienceDraftKey(experienceId: string) {
  return `qface:experience-draft:edit:${experienceId}:v1`
}

function normalizeDraftValue(value: unknown): ExperienceDraftValue | undefined {
  if (!value || typeof value !== 'object') return undefined

  const raw = value as Partial<Record<keyof ExperienceDraftValue, unknown>>

  return {
    title: typeof raw.title === 'string' ? raw.title : '',
    interviewDate: typeof raw.interviewDate === 'string' ? raw.interviewDate : '',
    content: typeof raw.content === 'string' ? raw.content : '',
  }
}

function timeValue(value?: string) {
  const time = Date.parse(value ?? '')
  return Number.isFinite(time) ? time : 0
}

export function hasExperienceDraftContent(value: ExperienceDraftValue) {
  return Boolean(value.title.trim() || value.interviewDate.trim() || value.content.trim())
}

export function sameExperienceDraftValue(left: ExperienceDraftValue, right: ExperienceDraftValue) {
  return (
    left.title === right.title &&
    left.interviewDate === right.interviewDate &&
    left.content === right.content
  )
}

export function readExperienceDraft(key: string): ExperienceDraft | undefined {
  if (typeof window === 'undefined') return undefined

  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(key) ?? 'null',
    ) as Partial<ExperienceDraft>
    const value = normalizeDraftValue(parsed?.value)
    if (!value || !hasExperienceDraftContent(value)) return undefined

    return {
      value,
      savedAt: typeof parsed.savedAt === 'string' ? parsed.savedAt : '',
      baseUpdatedAt: typeof parsed.baseUpdatedAt === 'string' ? parsed.baseUpdatedAt : undefined,
    }
  } catch {
    return undefined
  }
}

export function writeExperienceDraft(
  key: string,
  value: ExperienceDraftValue,
  options: { baseUpdatedAt?: string } = {},
) {
  if (typeof window === 'undefined') return

  try {
    if (!hasExperienceDraftContent(value)) {
      window.localStorage.removeItem(key)
      return
    }

    window.localStorage.setItem(
      key,
      JSON.stringify({
        value,
        savedAt: new Date().toISOString(),
        ...(options.baseUpdatedAt ? { baseUpdatedAt: options.baseUpdatedAt } : {}),
      }),
    )
  } catch {
    return
  }
}

export function clearExperienceDraft(key: string) {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.removeItem(key)
  } catch {
    return
  }
}

export function selectExperienceDraftValue(
  serverValue: ExperienceDraftValue,
  serverUpdatedAt: string,
  draft?: ExperienceDraft,
) {
  if (!draft || sameExperienceDraftValue(serverValue, draft.value)) return serverValue
  if (draft.baseUpdatedAt === serverUpdatedAt) return draft.value
  if (timeValue(draft.savedAt) > timeValue(serverUpdatedAt)) return draft.value

  return serverValue
}
