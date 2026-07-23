import { getQuestion } from '@/lib/questions'
import type { PublicCommentKind } from '@/types/community'

export interface LocalNote {
  sourceId: string
  content: string
  answerContent: string
  explainContent: string
  createdAt: string
  updatedAt: string
  answerUpdatedAt: string | null
  explainUpdatedAt: string | null
}

export interface NotesExportFile {
  app: 'QFace'
  version: 1 | 2
  exportedAt: string
  notes: LocalNote[]
}

export const notesStorageKey = 'qface:notes:v1'
export const notesChangedEvent = 'qface:notes-changed'

type LocalNoteMap = Record<string, LocalNote>

function now() {
  return new Date().toISOString()
}

function isBrowser() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

function readString(value: unknown) {
  return typeof value === 'string' ? value : ''
}

function readNestedContent(value: unknown) {
  if (!value || typeof value !== 'object') return ''
  return readString((value as { content?: unknown }).content)
}

function normalizeNote(sourceId: string, value: unknown): LocalNote | undefined {
  if (!value || typeof value !== 'object') return undefined

  const note = value as Partial<
    LocalNote & {
      answer?: { content?: string; updatedAt?: string }
      explain?: { content?: string; updatedAt?: string }
    }
  >
  const answerContent =
    readString(note.answerContent) || readNestedContent(note.answer) || readString(note.content)
  const explainContent = readString(note.explainContent) || readNestedContent(note.explain)

  if (!answerContent.trim() && !explainContent.trim()) return undefined

  const timestamp = now()
  const createdAt = typeof note.createdAt === 'string' ? note.createdAt : timestamp
  const answerUpdatedAt =
    typeof note.answerUpdatedAt === 'string'
      ? note.answerUpdatedAt
      : typeof note.answer?.updatedAt === 'string'
        ? note.answer.updatedAt
        : answerContent.trim()
          ? typeof note.updatedAt === 'string'
            ? note.updatedAt
            : timestamp
          : null
  const explainUpdatedAt =
    typeof note.explainUpdatedAt === 'string'
      ? note.explainUpdatedAt
      : typeof note.explain?.updatedAt === 'string'
        ? note.explain.updatedAt
        : explainContent.trim()
          ? typeof note.updatedAt === 'string'
            ? note.updatedAt
            : timestamp
          : null

  return {
    sourceId,
    content: answerContent || explainContent,
    answerContent,
    explainContent,
    createdAt,
    updatedAt: typeof note.updatedAt === 'string' ? note.updatedAt : timestamp,
    answerUpdatedAt,
    explainUpdatedAt,
  }
}

function emitNotesChanged() {
  if (!isBrowser()) return
  window.dispatchEvent(new Event(notesChangedEvent))
}

export function readLocalNotes(): LocalNoteMap {
  if (!isBrowser()) return {}

  try {
    const raw = window.localStorage.getItem(notesStorageKey)
    if (!raw) return {}

    const parsed = JSON.parse(raw) as Record<string, unknown>
    const notes: LocalNoteMap = {}

    for (const [sourceId, value] of Object.entries(parsed)) {
      const note = normalizeNote(sourceId, value)
      if (note) notes[sourceId] = note
    }

    return notes
  } catch {
    return {}
  }
}

export function writeLocalNotes(notes: LocalNoteMap) {
  if (!isBrowser()) return

  const cleaned = Object.fromEntries(
    Object.entries(notes).filter(
      ([, note]) => note.answerContent.trim() || note.explainContent.trim(),
    ),
  ) as LocalNoteMap

  window.localStorage.setItem(notesStorageKey, JSON.stringify(cleaned))
  emitNotesChanged()
}

export function getLocalNote(sourceId: string) {
  return readLocalNotes()[sourceId]
}

export function saveLocalNote(
  sourceId: string,
  content: string,
  kind: PublicCommentKind = 'answer',
) {
  const notes = readLocalNotes()
  const previous = notes[sourceId]
  const timestamp = now()
  const answerContent = kind === 'answer' ? content : (previous?.answerContent ?? '')
  const explainContent = kind === 'explain' ? content : (previous?.explainContent ?? '')

  if (!answerContent.trim() && !explainContent.trim()) {
    delete notes[sourceId]
    writeLocalNotes(notes)
    return undefined
  }

  const note: LocalNote = {
    sourceId,
    content: answerContent || explainContent,
    answerContent,
    explainContent,
    createdAt: previous?.createdAt ?? timestamp,
    updatedAt: timestamp,
    answerUpdatedAt:
      kind === 'answer'
        ? timestamp
        : (previous?.answerUpdatedAt ?? (answerContent ? timestamp : null)),
    explainUpdatedAt:
      kind === 'explain'
        ? timestamp
        : (previous?.explainUpdatedAt ?? (explainContent ? timestamp : null)),
  }

  notes[sourceId] = note
  writeLocalNotes(notes)

  return note
}

export function deleteLocalNote(sourceId: string, kind?: PublicCommentKind) {
  if (!kind) {
    const notes = readLocalNotes()
    delete notes[sourceId]
    writeLocalNotes(notes)
    return
  }

  const previous = getLocalNote(sourceId)
  if (!previous) return

  saveLocalNote(sourceId, '', kind)
}

export function getLocalNoteCount() {
  return Object.keys(readLocalNotes()).length
}

export function getLocalNoteList() {
  return Object.values(readLocalNotes())
    .map((note) => ({
      note,
      question: getQuestion(note.sourceId),
    }))
    .sort((left, right) => right.note.updatedAt.localeCompare(left.note.updatedAt))
}

export function buildNotesExport(): NotesExportFile {
  return {
    app: 'QFace',
    version: 2,
    exportedAt: now(),
    notes: getLocalNoteList().map(({ note }) => note),
  }
}

export function exportNotesAsJson() {
  return `${JSON.stringify(buildNotesExport(), null, 2)}\n`
}

export function exportNotesAsMarkdown() {
  const exportedAt = new Date().toLocaleString('zh-CN', { hour12: false })
  const sections = getLocalNoteList().map(({ note, question }) => {
    const title = question?.title ?? note.sourceId
    const meta = question
      ? [`岗位：${question.category}`, `模块：${question.module}`, `难度：${question.difficulty}`]
      : [`题目 ID：${note.sourceId}`]
    const answer = note.answerContent.trim()
    const explain = note.explainContent.trim()

    return [
      `## ${title}`,
      '',
      ...meta.map((item) => `- ${item}`),
      `- 更新：${note.updatedAt}`,
      '',
      answer ? ['### 回答', '', answer, ''].join('\n') : '',
      explain ? ['### 详解', '', explain, ''].join('\n') : '',
    ]
      .filter(Boolean)
      .join('\n')
  })

  return [`# QFace 笔记`, '', `导出时间：${exportedAt}`, '', ...sections].join('\n')
}

export function importNotesPayload(payload: string) {
  const parsed = JSON.parse(payload) as Partial<NotesExportFile> | LocalNote[] | LocalNoteMap
  const incoming = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed.notes)
      ? parsed.notes
      : Object.values(parsed)

  const notes = readLocalNotes()
  let imported = 0

  for (const item of incoming) {
    if (!item || typeof item !== 'object') continue

    const sourceId = typeof item.sourceId === 'string' ? item.sourceId : ''
    const note = normalizeNote(sourceId, item)
    if (!sourceId || !note) continue

    notes[sourceId] = note
    imported += 1
  }

  if (imported) writeLocalNotes(notes)

  return imported
}
