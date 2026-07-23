import { Link } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { DifficultyBadge } from '@/components/difficulty-badge'
import { getRemoteNotes } from '@/lib/community-api'
import { downloadTextFile, exportDate } from '@/lib/download'
import { exportNotesAsMarkdown, getLocalNoteList, notesChangedEvent } from '@/lib/local-notes'
import { getQuestion } from '@/lib/questions'
import { useSession } from '@/lib/session'
import type { Question } from '@/types/question'

interface DisplayNote {
  note: {
    sourceId: string
    content: string
    updatedAt: string
    answerContent?: string
    explainContent?: string
    answer?: { content: string }
    explain?: { content: string }
  }
  question: Question | undefined
}

function formatDate(value: string) {
  try {
    return new Date(value).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
  } catch {
    return value
  }
}

function createPreview(content: string) {
  return content.replace(/\s+/g, ' ').trim().slice(0, 120)
}

function getAnswerContent(note: DisplayNote['note']) {
  return note.answerContent ?? note.answer?.content ?? ''
}

function getExplainContent(note: DisplayNote['note']) {
  return note.explainContent ?? note.explain?.content ?? ''
}

function getPreviewContent(note: DisplayNote['note']) {
  const answer = getAnswerContent(note).trim()
  const explain = getExplainContent(note).trim()
  const typedContent = [answer ? `回答：${answer}` : '', explain ? `详解：${explain}` : ''].filter(
    Boolean,
  )

  return typedContent.length ? typedContent.join(' ') : note.content
}

export function NotesPage() {
  const { user } = useSession()
  const [notes, setNotes] = useState<DisplayNote[]>([])
  const [query, setQuery] = useState('')

  const exportMarkdown = async () => {
    if (user) {
      const response = await fetch('/api/notes/export?format=markdown', { credentials: 'include' })
      downloadTextFile(
        `qface-notes-${exportDate()}.md`,
        await response.text(),
        'text/markdown;charset=utf-8',
      )
      return
    }

    downloadTextFile(
      `qface-notes-${exportDate()}.md`,
      exportNotesAsMarkdown(),
      'text/markdown;charset=utf-8',
    )
  }

  useEffect(() => {
    const updateLocalNotes = () => setNotes(getLocalNoteList())

    document.title = '笔记 · QFace'
    if (user) {
      getRemoteNotes()
        .then((payload) =>
          setNotes(
            payload.notes.map((note) => ({
              note,
              question: getQuestion(note.sourceId),
            })),
          ),
        )
        .catch(updateLocalNotes)
      return
    }

    updateLocalNotes()
    window.addEventListener(notesChangedEvent, updateLocalNotes)
    window.addEventListener('storage', updateLocalNotes)

    return () => {
      window.removeEventListener(notesChangedEvent, updateLocalNotes)
      window.removeEventListener('storage', updateLocalNotes)
    }
  }, [user])

  const filteredNotes = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase('zh-CN')
    if (!keyword) return notes

    return notes.filter(({ note, question }) =>
      [
        question?.title,
        question?.category,
        question?.module,
        ...(question?.tags ?? []),
        note.content,
        getAnswerContent(note),
        getExplainContent(note),
        note.sourceId,
      ]
        .filter(Boolean)
        .join('\n')
        .toLocaleLowerCase('zh-CN')
        .includes(keyword),
    )
  }, [notes, query])

  return (
    <main className="page-shell notes-page">
      <section className="notes-head" aria-labelledby="notes-heading">
        <div>
          <h1 id="notes-heading">笔记</h1>
          <span>{filteredNotes.length} 条</span>
        </div>
        <div className="notes-head__actions">
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
            placeholder="搜索笔记"
            aria-label="搜索笔记"
          />
          <button type="button" onClick={exportMarkdown}>
            导出 Markdown
          </button>
        </div>
      </section>

      <section className="notes-list" aria-label="笔记列表">
        {filteredNotes.length ? (
          filteredNotes.map(({ note, question }) => (
            <article className="note-row" key={note.sourceId}>
              <div className="note-row__content">
                <Link
                  className="note-row__title"
                  to="/q/$sourceId"
                  params={{ sourceId: note.sourceId }}
                >
                  {question?.title ?? note.sourceId}
                </Link>
                <div className="note-row__meta">
                  {question ? (
                    <>
                      <span>{question.category}</span>
                      <span>{question.module}</span>
                      <DifficultyBadge difficulty={question.difficulty} />
                    </>
                  ) : (
                    <span>{note.sourceId}</span>
                  )}
                  {getAnswerContent(note).trim() ? <span>回答</span> : null}
                  {getExplainContent(note).trim() ? <span>详解</span> : null}
                  <span>{formatDate(note.updatedAt)}</span>
                </div>
                <p>{createPreview(getPreviewContent(note))}</p>
              </div>
              <Link className="answer-state" to="/q/$sourceId" params={{ sourceId: note.sourceId }}>
                打开
              </Link>
            </article>
          ))
        ) : (
          <div className="empty-list">
            <strong>还没有笔记</strong>
          </div>
        )}
      </section>
    </main>
  )
}
