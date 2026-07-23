import { Link } from '@tanstack/react-router'
import { ChevronDown, Cloud, ExternalLink, FileText, LogIn, LogOut, Monitor } from 'lucide-react'
import type { ChangeEvent } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { githubLoginUrl, saveRemoteNote } from '@/lib/community-api'
import { downloadTextFile, exportDate } from '@/lib/download'
import { bookmarksChangedEvent, getLocalBookmarkCount } from '@/lib/local-bookmarks'
import {
  exportNotesAsJson,
  importNotesPayload,
  notesChangedEvent,
  readLocalNotes,
} from '@/lib/local-notes'
import { useMastery } from '@/lib/mastery'
import { allQuestions, getModules } from '@/lib/questions'
import { useSession } from '@/lib/session'
import { categories, type QuestionCategory } from '@/types/question'

const repoUrl = import.meta.env.VITE_QFACE_REPO_URL || 'https://github.com/dogxii/QFace'
const accountProgressScopeKey = 'qface:account-progress-scope:v1'

interface AccountProgressScope {
  category: QuestionCategory | ''
  module: string
}

function isQuestionCategory(value: string): value is QuestionCategory {
  return categories.includes(value as QuestionCategory)
}

function readAccountProgressScope(): AccountProgressScope {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(accountProgressScopeKey) ?? '{}') as {
      category?: unknown
      module?: unknown
    }
    const category =
      typeof parsed.category === 'string' && isQuestionCategory(parsed.category)
        ? parsed.category
        : ''
    const module = typeof parsed.module === 'string' ? parsed.module : ''

    return {
      category,
      module: category && module && getModules(category).includes(module) ? module : '',
    }
  } catch {
    return { category: '', module: '' }
  }
}

function writeAccountProgressScope(scope: AccountProgressScope) {
  window.localStorage.setItem(accountProgressScopeKey, JSON.stringify(scope))
}

export function AccountMenu() {
  const rootRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { user, stats, logout, refresh } = useSession()
  const { masteryMap } = useMastery()
  const [open, setOpen] = useState(false)
  const [localNotes, setLocalNotes] = useState(() => readLocalNotes())
  const [bookmarkCount, setBookmarkCount] = useState(() => getLocalBookmarkCount())
  const [progressScope, setProgressScope] = useState<AccountProgressScope>(() =>
    readAccountProgressScope(),
  )

  useEffect(() => {
    const updateLocalStats = () => {
      setLocalNotes(readLocalNotes())
      setBookmarkCount(getLocalBookmarkCount())
    }

    updateLocalStats()
    window.addEventListener(notesChangedEvent, updateLocalStats)
    window.addEventListener(bookmarksChangedEvent, updateLocalStats)
    window.addEventListener('storage', updateLocalStats)

    return () => {
      window.removeEventListener(notesChangedEvent, updateLocalStats)
      window.removeEventListener(bookmarksChangedEvent, updateLocalStats)
      window.removeEventListener('storage', updateLocalStats)
    }
  }, [])

  useEffect(() => {
    if (!open) return

    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }

    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)

    return () => {
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const localNoteCount = Object.keys(localNotes).length
  const visibleNoteCount = user ? Math.max(stats.noteCount, localNoteCount) : localNoteCount
  const progressModules = useMemo(
    () => (progressScope.category ? getModules(progressScope.category) : []),
    [progressScope.category],
  )
  const doneSourceIds = useMemo(() => {
    const ids = new Set<string>()

    for (const note of Object.values(localNotes)) {
      if (note.answerContent.trim() || note.explainContent.trim()) ids.add(note.sourceId)
    }

    for (const [sourceId, mastery] of Object.entries(masteryMap)) {
      if (mastery > 0) ids.add(sourceId)
    }

    return ids
  }, [localNotes, masteryMap])
  const progressQuestions = useMemo(
    () =>
      allQuestions.filter((question) => {
        if (progressScope.category && question.category !== progressScope.category) return false
        if (progressScope.module && question.module !== progressScope.module) return false
        return true
      }),
    [progressScope],
  )
  const progressDone = progressQuestions.reduce(
    (count, question) => count + (doneSourceIds.has(question.sourceId) ? 1 : 0),
    0,
  )
  const progressTotal = progressQuestions.length
  const progressPercent = progressTotal ? Math.round((progressDone / progressTotal) * 100) : 0

  const updateProgressScope = (next: AccountProgressScope) => {
    setProgressScope(next)
    writeAccountProgressScope(next)
  }

  const exportJson = async () => {
    if (user) {
      const response = await fetch('/api/notes/export', { credentials: 'include' })
      downloadTextFile(
        `qface-notes-${exportDate()}.json`,
        await response.text(),
        'application/json;charset=utf-8',
      )
      setOpen(false)
      return
    }

    downloadTextFile(
      `qface-notes-${exportDate()}.json`,
      exportNotesAsJson(),
      'application/json;charset=utf-8',
    )
    setOpen(false)
  }

  const importJson = () => {
    fileInputRef.current?.click()
  }

  const onImportFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (!file) return

    try {
      const imported = importNotesPayload(await file.text())
      if (user && imported) {
        const notes = Object.values(readLocalNotes())
        await Promise.all(
          notes.flatMap((note) => [
            note.answerContent.trim()
              ? saveRemoteNote({
                  sourceId: note.sourceId,
                  kind: 'answer',
                  content: note.answerContent,
                })
              : undefined,
            note.explainContent.trim()
              ? saveRemoteNote({
                  sourceId: note.sourceId,
                  kind: 'explain',
                  content: note.explainContent,
                })
              : undefined,
          ]),
        )
        await refresh()
      }
      window.alert(imported ? `已导入 ${imported} 条笔记` : '没有可导入的笔记')
      setOpen(false)
    } catch {
      window.alert('导入失败，请选择 QFace 导出的 JSON 文件')
    }
  }

  return (
    <div className="account-menu" ref={rootRef}>
      <button
        className="account-trigger avatar-trigger"
        type="button"
        aria-label="我的"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((current) => !current)}
      >
        <Avatar avatarUrl={user?.avatarUrl} label={user?.login ?? 'Q'} />
        <ChevronDown size={13} aria-hidden="true" />
      </button>

      {open ? (
        <div className="account-popover" role="menu">
          <div className="account-summary">
            <Link to="/notes" onClick={() => setOpen(false)}>
              <Avatar avatarUrl={user?.avatarUrl} label={user?.login ?? 'Q'} large />
              <span>
                <strong>{user?.name || user?.login || '本地账户'}</strong>
                <small>
                  {user
                    ? `@${user.login}`
                    : visibleNoteCount
                      ? `${visibleNoteCount} 条本地笔记`
                      : '未登录'}
                </small>
              </span>
            </Link>
          </div>

          <div className="account-progress">
            <div className="account-progress__head">
              <span>学习进度</span>
              <strong>
                {progressDone}/{progressTotal}
              </strong>
            </div>
            <div
              className="account-progress__bar"
              role="progressbar"
              aria-valuenow={progressPercent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="完成进度"
            >
              <span style={{ width: `${progressPercent}%` }} />
            </div>
            <div className="account-progress__meta">
              <span>{doneSourceIds.size} 题做过</span>
              <span>{bookmarkCount} 收藏</span>
            </div>
            <div className="account-progress__filters">
              <select
                value={progressScope.category}
                aria-label="选择岗位进度"
                onChange={(event) => {
                  const value = event.currentTarget.value
                  updateProgressScope({
                    category: isQuestionCategory(value) ? value : '',
                    module: '',
                  })
                }}
              >
                <option value="">全部岗位</option>
                {categories.map((item) => (
                  <option value={item} key={item}>
                    {item}
                  </option>
                ))}
              </select>
              <select
                value={progressScope.module}
                aria-label="选择模块进度"
                disabled={!progressScope.category}
                onChange={(event) => {
                  const value = event.currentTarget.value
                  updateProgressScope({
                    category: progressScope.category,
                    module: value && progressModules.includes(value) ? value : '',
                  })
                }}
              >
                <option value="">全部模块</option>
                {progressModules.map((item) => (
                  <option value={item} key={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="account-menu-section">
            {!user ? (
              <a className="account-row" href={githubLoginUrl()}>
                <LogIn size={17} aria-hidden="true" />
                <span>GitHub 登录</span>
              </a>
            ) : null}
            <Link className="account-row" to="/notes" onClick={() => setOpen(false)}>
              <FileText size={17} aria-hidden="true" />
              <span>笔记</span>
              <small>{visibleNoteCount}</small>
            </Link>
            <div className="account-inline-actions">
              <button type="button" onClick={exportJson}>
                <span>备份</span>
              </button>
              <span aria-hidden="true" />
              <button type="button" onClick={importJson}>
                <span>导入</span>
              </button>
            </div>
            <button className="account-row account-row--muted" type="button" disabled>
              <Cloud size={17} aria-hidden="true" />
              <span>云端同步</span>
              <small>{user ? '已启用' : '登录后启用'}</small>
            </button>
            <a className="account-row" href={repoUrl} target="_blank" rel="noreferrer">
              <ExternalLink size={17} aria-hidden="true" />
              <span>仓库</span>
            </a>
          </div>

          <div className="account-menu-section">
            <button className="account-row account-row--muted" type="button" disabled>
              <Monitor size={17} aria-hidden="true" />
              <span>外观</span>
              <small>浅色</small>
            </button>
          </div>

          {user ? (
            <button
              className="account-row account-logout"
              type="button"
              onClick={async () => {
                await logout()
                setOpen(false)
              }}
            >
              <LogOut size={17} aria-hidden="true" />
              <span>退出登录</span>
            </button>
          ) : null}
        </div>
      ) : null}

      <input
        hidden
        type="file"
        accept="application/json,.json"
        ref={fileInputRef}
        onChange={onImportFile}
        tabIndex={-1}
      />
    </div>
  )
}

function Avatar({
  avatarUrl,
  label,
  large,
}: {
  avatarUrl?: string | null
  label: string
  large?: boolean
}) {
  return (
    <span
      className={large ? 'account-avatar account-avatar--large' : 'account-avatar'}
      aria-hidden="true"
    >
      {avatarUrl ? <img src={avatarUrl} alt="" /> : label.slice(0, 1).toUpperCase()}
    </span>
  )
}
