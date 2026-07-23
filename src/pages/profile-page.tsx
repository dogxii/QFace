import { Link } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { DifficultyBadge } from '@/components/difficulty-badge'
import { getRemoteNotes } from '@/lib/community-api'
import { bookmarksChangedEvent, readLocalBookmarks } from '@/lib/local-bookmarks'
import { getLocalNoteList, notesChangedEvent } from '@/lib/local-notes'
import { useMastery } from '@/lib/mastery'
import { getQuestion } from '@/lib/questions'
import { useSession } from '@/lib/session'
import type { Question } from '@/types/question'

interface ProfileNote {
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

interface FavoriteItem {
  sourceId: string
  question: Question | undefined
  note: ProfileNote['note'] | undefined
  mastery: number
}

function getAnswerContent(note: ProfileNote['note']) {
  return note.answerContent ?? note.answer?.content ?? ''
}

function getExplainContent(note: ProfileNote['note']) {
  return note.explainContent ?? note.explain?.content ?? ''
}

function hasNoteContent(note: ProfileNote['note']) {
  return Boolean(
    getAnswerContent(note).trim() || getExplainContent(note).trim() || note.content.trim(),
  )
}

function getPreviewContent(note: ProfileNote['note']) {
  const answer = getAnswerContent(note).trim()
  const explain = getExplainContent(note).trim()
  const typedContent = [answer ? `回答：${answer}` : '', explain ? `详解：${explain}` : ''].filter(
    Boolean,
  )

  return typedContent.length ? typedContent.join(' ') : note.content
}

function createPreview(content: string) {
  return content.replace(/\s+/g, ' ').trim().slice(0, 120)
}

function getQuestionSearchText(question: Question | undefined) {
  if (!question) return ''

  return [question.title, question.category, question.module, ...question.tags].join('\n')
}

function noteMatchesQuery({ note, question }: ProfileNote, keyword: string) {
  if (!keyword) return true

  return [
    getQuestionSearchText(question),
    note.content,
    getAnswerContent(note),
    getExplainContent(note),
    note.sourceId,
  ]
    .filter(Boolean)
    .join('\n')
    .toLocaleLowerCase('zh-CN')
    .includes(keyword)
}

function favoriteMatchesQuery(item: FavoriteItem, keyword: string) {
  if (!keyword) return true

  return [
    getQuestionSearchText(item.question),
    item.note ? getPreviewContent(item.note) : '',
    item.sourceId,
  ]
    .filter(Boolean)
    .join('\n')
    .toLocaleLowerCase('zh-CN')
    .includes(keyword)
}

function mergeNotes(localNotes: ProfileNote[], remoteNotes: ProfileNote[]) {
  const notes = new Map<string, ProfileNote>()

  for (const item of localNotes) notes.set(item.note.sourceId, item)
  for (const item of remoteNotes) {
    const previous = notes.get(item.note.sourceId)
    if (!previous || item.note.updatedAt.localeCompare(previous.note.updatedAt) >= 0) {
      notes.set(item.note.sourceId, item)
    }
  }

  return [...notes.values()].sort((left, right) =>
    right.note.updatedAt.localeCompare(left.note.updatedAt),
  )
}

function readBookmarkSourceIds() {
  return [...readLocalBookmarks()].reverse()
}

function ProfileQuestionRow({
  sourceId,
  question,
  note,
  mastery,
  emptyText,
}: {
  sourceId: string
  question: Question | undefined
  note: ProfileNote['note'] | undefined
  mastery?: number
  emptyText?: string
}) {
  const answer = note ? getAnswerContent(note).trim() : ''
  const explain = note ? getExplainContent(note).trim() : ''
  const preview = note ? createPreview(getPreviewContent(note)) : ''

  return (
    <article className="note-row">
      <div className="note-row__content">
        <Link className="note-row__title" to="/q/$sourceId" params={{ sourceId }}>
          {question?.title ?? sourceId}
        </Link>
        <div className="note-row__meta">
          {question ? (
            <>
              <span>{question.category}</span>
              <span>{question.module}</span>
              <DifficultyBadge difficulty={question.difficulty} />
            </>
          ) : (
            <span>{sourceId}</span>
          )}
          {answer ? <span>回答</span> : null}
          {explain ? <span>详解</span> : null}
          {mastery ? <span>{mastery} 星</span> : null}
        </div>
        {preview ? <p>{preview}</p> : null}
        {!preview && emptyText ? <p className="note-row__placeholder">{emptyText}</p> : null}
      </div>
      <Link className="answer-state" to="/q/$sourceId" params={{ sourceId }}>
        打开
      </Link>
    </article>
  )
}

export function ProfilePage() {
  const { user } = useSession()
  const { masteryMap } = useMastery()
  const [notes, setNotes] = useState<ProfileNote[]>([])
  const [bookmarkSourceIds, setBookmarkSourceIds] = useState<string[]>(() =>
    readBookmarkSourceIds(),
  )
  const [query, setQuery] = useState('')

  useEffect(() => {
    const updateLocalNotes = () =>
      setNotes(getLocalNoteList().filter(({ note }) => hasNoteContent(note)))

    document.title = '我的 · QFace'
    updateLocalNotes()

    if (user) {
      getRemoteNotes()
        .then((payload) => {
          const localNotes = getLocalNoteList().filter(({ note }) => hasNoteContent(note))
          const remoteNotes = payload.notes.filter(hasNoteContent).map((note) => ({
            note,
            question: getQuestion(note.sourceId),
          }))

          setNotes(mergeNotes(localNotes, remoteNotes))
        })
        .catch(updateLocalNotes)
    }

    window.addEventListener(notesChangedEvent, updateLocalNotes)
    window.addEventListener('storage', updateLocalNotes)

    return () => {
      window.removeEventListener(notesChangedEvent, updateLocalNotes)
      window.removeEventListener('storage', updateLocalNotes)
    }
  }, [user])

  useEffect(() => {
    const updateBookmarks = () => setBookmarkSourceIds(readBookmarkSourceIds())

    updateBookmarks()
    window.addEventListener(bookmarksChangedEvent, updateBookmarks)
    window.addEventListener('storage', updateBookmarks)

    return () => {
      window.removeEventListener(bookmarksChangedEvent, updateBookmarks)
      window.removeEventListener('storage', updateBookmarks)
    }
  }, [])

  const noteBySourceId = useMemo(
    () => new Map(notes.map(({ note }) => [note.sourceId, note])),
    [notes],
  )
  const favoriteItems = useMemo(
    () =>
      bookmarkSourceIds.map((sourceId) => ({
        sourceId,
        question: getQuestion(sourceId),
        note: noteBySourceId.get(sourceId),
        mastery: masteryMap[sourceId] ?? 0,
      })),
    [bookmarkSourceIds, masteryMap, noteBySourceId],
  )
  const doneSourceIds = useMemo(() => {
    const ids = new Set<string>()

    for (const { note } of notes) {
      if (hasNoteContent(note)) ids.add(note.sourceId)
    }

    for (const [sourceId, mastery] of Object.entries(masteryMap)) {
      if (mastery > 0) ids.add(sourceId)
    }

    return ids
  }, [masteryMap, notes])
  const masteredCount = useMemo(
    () => Object.values(masteryMap).filter((value) => value >= 3).length,
    [masteryMap],
  )
  const keyword = query.trim().toLocaleLowerCase('zh-CN')
  const filteredNotes = useMemo(
    () => notes.filter((item) => noteMatchesQuery(item, keyword)),
    [keyword, notes],
  )
  const filteredFavorites = useMemo(
    () => favoriteItems.filter((item) => favoriteMatchesQuery(item, keyword)),
    [favoriteItems, keyword],
  )
  const recentNotes = filteredNotes.slice(0, 6)

  return (
    <main className="page-shell profile-page">
      <section className="notes-head profile-head" aria-labelledby="profile-heading">
        <div>
          <h1 id="profile-heading">我的</h1>
          <span>{user ? `@${user.login}` : '本地数据'}</span>
        </div>
        <div className="notes-head__actions">
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
            placeholder="搜索收藏或笔记"
            aria-label="搜索收藏或笔记"
          />
          <Link className="profile-head__link" to="/notes">
            全部笔记
          </Link>
        </div>
      </section>

      <section className="profile-stats" aria-label="数据概览">
        <div>
          <strong>{notes.length}</strong>
          <span>笔记</span>
        </div>
        <div>
          <strong>{favoriteItems.length}</strong>
          <span>收藏</span>
        </div>
        <div>
          <strong>{doneSourceIds.size}</strong>
          <span>做过</span>
        </div>
        <div>
          <strong>{masteredCount}</strong>
          <span>掌握</span>
        </div>
      </section>

      <div className="profile-sections">
        <section className="profile-section" aria-labelledby="favorites-heading">
          <div className="profile-section__head">
            <h2 id="favorites-heading">收藏</h2>
            <span>{filteredFavorites.length} 题</span>
          </div>
          <div className="notes-list">
            {filteredFavorites.length ? (
              filteredFavorites.map((item) => (
                <ProfileQuestionRow {...item} emptyText="未写作答" key={item.sourceId} />
              ))
            ) : (
              <div className="empty-list empty-list--compact">
                <strong>还没有收藏</strong>
              </div>
            )}
          </div>
        </section>

        <section className="profile-section" aria-labelledby="recent-notes-heading">
          <div className="profile-section__head">
            <h2 id="recent-notes-heading">最近笔记</h2>
            <span>{filteredNotes.length} 条</span>
          </div>
          <div className="notes-list">
            {recentNotes.length ? (
              recentNotes.map(({ note, question }) => (
                <ProfileQuestionRow
                  sourceId={note.sourceId}
                  question={question}
                  note={note}
                  key={note.sourceId}
                />
              ))
            ) : (
              <div className="empty-list empty-list--compact">
                <strong>还没有笔记</strong>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  )
}
