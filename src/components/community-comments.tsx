import type { ReactCodeMirrorRef } from '@uiw/react-codemirror'
import {
  ChevronDown,
  Maximize2,
  MessageSquareText,
  Minimize2,
  ThumbsDown,
  ThumbsUp,
  Trash2,
} from 'lucide-react'
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  acceptComment,
  createComment,
  deleteComment,
  getComments,
  getRemoteNote,
  githubLoginUrl,
  saveRemoteNote,
  updateComment,
  voteComment,
} from '@/lib/community-api'
import { getLocalNote, saveLocalNote } from '@/lib/local-notes'
import { useSession } from '@/lib/session'
import type {
  CommentKind,
  CommunityComment,
  PublicCommentKind,
  RemoteNote,
} from '@/types/community'

const MarkdownEditor = lazy(() => import('./markdown-editor'))
const MarkdownContent = lazy(() => import('./markdown-content'))

function LazyMarkdownContent({
  content,
  emptyText,
  className,
}: {
  content: string
  emptyText?: string
  className?: string
}) {
  const fallback = content.trim() || emptyText || null

  return (
    <Suspense fallback={fallback ? <div className={className}>{fallback}</div> : null}>
      <MarkdownContent content={content} emptyText={emptyText} className={className} />
    </Suspense>
  )
}

const kindOptions: Array<{ value: CommentKind | 'all'; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'answer', label: '回答' },
  { value: 'explain', label: '详解' },
]

const kindLabels: Record<CommentKind, string> = {
  answer: '回答',
  explain: '详解',
  question: '提问',
  discussion: '讨论',
}

const markdownTools = [
  { id: 'bold', label: 'B', title: '加粗' },
  { id: 'heading', label: 'H2', title: '二级标题' },
  { id: 'bullet', label: '- ', title: '无序列表' },
  { id: 'quote', label: '>', title: '引用' },
  { id: 'code', label: '</>', title: '代码块' },
  { id: 'link', label: 'link', title: '链接' },
  { id: 'table', label: 'table', title: '表格' },
] as const

type MarkdownToolId = (typeof markdownTools)[number]['id']

function formatTime(value: string) {
  try {
    return new Date(value).toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
  } catch {
    return value
  }
}

function buildTree(comments: CommunityComment[]) {
  const roots: CommunityComment[] = []
  const replies = new Map<string, CommunityComment[]>()

  for (const comment of comments) {
    if (comment.parentId) {
      replies.set(comment.parentId, [...(replies.get(comment.parentId) ?? []), comment])
    } else {
      roots.push(comment)
    }
  }

  return { roots, replies }
}

function getSelectedLineRange(content: string, start: number, end: number) {
  const lineStart = content.lastIndexOf('\n', Math.max(0, start - 1)) + 1
  const nextNewline = content.indexOf('\n', end)
  const lineEnd = nextNewline === -1 ? content.length : nextNewline

  return { lineStart, lineEnd }
}

function prefixSelectedLines(content: string, start: number, end: number, prefix: string) {
  const { lineStart, lineEnd } = getSelectedLineRange(content, start, end)
  const selected = content.slice(lineStart, lineEnd)

  if (!selected.trim()) {
    const fallback = prefix === '## ' ? '标题' : prefix === '- ' ? '列表项' : '引用'
    return insertMarkdownBlock(content, start, end, `${prefix}${fallback}`)
  }

  const nextSelected = selected
    .split('\n')
    .map((line) => (line.trim() ? `${prefix}${line.replace(/^(- |> |## )/, '')}` : ''))
    .join('\n')

  return {
    nextContent: `${content.slice(0, lineStart)}${nextSelected}${content.slice(lineEnd)}`,
    nextCursor: lineStart + nextSelected.length,
  }
}

function wrapSelection(
  content: string,
  start: number,
  end: number,
  before: string,
  after: string,
  fallback: string,
) {
  const selected = content.slice(start, end)
  const value = selected || fallback
  const insertion = `${before}${value}${after}`

  return {
    nextContent: `${content.slice(0, start)}${insertion}${content.slice(end)}`,
    nextCursor: selected ? start + insertion.length : start + before.length + value.length,
  }
}

function insertMarkdownBlock(content: string, start: number, end: number, block: string) {
  const before = content.slice(0, start)
  const after = content.slice(end)
  const prefix = before.trim() && !before.endsWith('\n\n') ? '\n\n' : ''
  const suffix = after.trim() && !after.startsWith('\n\n') ? '\n\n' : ''
  const insertion = `${prefix}${block}${suffix}`

  return {
    nextContent: `${before}${insertion}${after}`,
    nextCursor: before.length + insertion.length,
  }
}

function applyMarkdownTool(content: string, tool: MarkdownToolId, start: number, end: number) {
  switch (tool) {
    case 'bold':
      return wrapSelection(content, start, end, '**', '**', '重点')
    case 'heading':
      return prefixSelectedLines(content, start, end, '## ')
    case 'bullet':
      return prefixSelectedLines(content, start, end, '- ')
    case 'quote':
      return prefixSelectedLines(content, start, end, '> ')
    case 'code':
      return insertMarkdownBlock(
        content,
        start,
        end,
        `\`\`\`ts\n${content.slice(start, end).trim() || '代码'}\n\`\`\``,
      )
    case 'link':
      return wrapSelection(content, start, end, '[', '](https://)', '链接文字')
    case 'table':
      return insertMarkdownBlock(content, start, end, '| 项目 | 说明 |\n| --- | --- |\n|  |  |')
  }
}

export function CommunityComments({ sourceId }: { sourceId: string }) {
  const { refresh } = useSession()
  const [comments, setComments] = useState<CommunityComment[]>([])
  const [kind, setKind] = useState<CommentKind | 'all'>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadComments = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const payload = await getComments(sourceId, kind)
      setComments(payload.comments)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '评论加载失败')
    } finally {
      setLoading(false)
    }
  }, [kind, sourceId])

  useEffect(() => {
    loadComments()
  }, [loadComments])

  const syncCommunity = useCallback(async () => {
    await loadComments()
    await refresh()
  }, [loadComments, refresh])

  const { roots, replies } = useMemo(() => buildTree(comments), [comments])

  const replaceComment = (nextComment: CommunityComment) => {
    setComments((current) =>
      current.map((comment) => (comment.id === nextComment.id ? nextComment : comment)),
    )
  }

  const removeComment = (commentId: string) => {
    setComments((current) => current.filter((comment) => comment.id !== commentId))
  }

  return (
    <section
      className="answer-section community-section"
      id="discussion"
      aria-labelledby="answer-heading"
    >
      <div className="section-heading community-heading">
        <h2 id="answer-heading" className="community-title">
          <span className="community-title__icon" aria-hidden="true">
            <MessageSquareText size={15} strokeWidth={1.9} />
          </span>
          回答
        </h2>
      </div>

      <div className="community-body">
        <AnswerEditor sourceId={sourceId} onSynced={syncCommunity} />

        <div className="community-list-toolbar">
          <fieldset className="community-tabs" aria-label="评论筛选">
            {kindOptions.map((item) => (
              <button
                type="button"
                data-active={kind === item.value ? 'true' : undefined}
                onClick={() => setKind(item.value)}
                key={item.value}
              >
                {item.label}
              </button>
            ))}
          </fieldset>
        </div>

        {error ? <div className="community-message">{error}</div> : null}
        {loading ? <div className="community-message">加载中</div> : null}

        {!loading && !roots.length ? (
          <div className="community-empty">
            <span>{kind === 'all' ? '暂无回答' : `暂无${kindLabels[kind]}`}</span>
          </div>
        ) : null}

        <div className="comment-list">
          {roots.map((comment) => (
            <CommentItem
              comment={comment}
              replies={replies.get(comment.id) ?? []}
              sourceId={sourceId}
              onCreated={async (reply) => {
                setComments((current) => [...current, reply])
                await refresh()
              }}
              onUpdated={replaceComment}
              onDeleted={removeComment}
              key={comment.id}
            />
          ))}
        </div>
      </div>
    </section>
  )
}

const draftKindOptions: Array<{ value: PublicCommentKind; label: string }> = [
  { value: 'answer', label: '回答' },
  { value: 'explain', label: '详解' },
]

const draftKindLabels: Record<PublicCommentKind, string> = {
  answer: '回答',
  explain: '详解',
}

const answerEditorCollapsedKey = 'qface:answer-editor-collapsed:v1'

function readAnswerEditorCollapsed() {
  try {
    return window.localStorage.getItem(answerEditorCollapsedKey) === '1'
  } catch {
    return false
  }
}

function writeAnswerEditorCollapsed(collapsed: boolean) {
  try {
    window.localStorage.setItem(answerEditorCollapsedKey, collapsed ? '1' : '0')
  } catch {
    // 忽略隐私模式或存储不可用场景，折叠只是本地偏好。
  }
}

interface EditorDraft {
  content: string
  publicCommentId: string | null
  publishedAt: string | null
  publishedContent: string
}

type EditorDrafts = Record<PublicCommentKind, EditorDraft>

function createEmptyDraft(): EditorDraft {
  return {
    content: '',
    publicCommentId: null,
    publishedAt: null,
    publishedContent: '',
  }
}

function createEmptyDrafts(): EditorDrafts {
  return {
    answer: createEmptyDraft(),
    explain: createEmptyDraft(),
  }
}

function localDraftContent(
  note: ReturnType<typeof getLocalNote> | undefined,
  kind: PublicCommentKind,
) {
  return kind === 'answer' ? (note?.answerContent ?? '') : (note?.explainContent ?? '')
}

function localDraftUpdatedAt(
  note: ReturnType<typeof getLocalNote> | undefined,
  kind: PublicCommentKind,
) {
  return kind === 'answer' ? note?.answerUpdatedAt : note?.explainUpdatedAt
}

function mergeLocalAndRemoteDrafts(sourceId: string, remoteNote: RemoteNote | null) {
  const localNote = getLocalNote(sourceId)
  const drafts = createEmptyDrafts()

  for (const { value } of draftKindOptions) {
    const remoteDraft = remoteNote?.[value]
    const localContent = localDraftContent(localNote, value)
    const localUpdatedAt = localDraftUpdatedAt(localNote, value)
    const useLocal = Boolean(
      localContent.trim() &&
        (!remoteNote || (localUpdatedAt && localUpdatedAt > remoteNote.updatedAt)),
    )

    drafts[value] = {
      content: useLocal ? localContent : remoteDraft?.content || localContent,
      publicCommentId: remoteDraft?.publicCommentId ?? null,
      publishedAt: remoteDraft?.publishedAt ?? null,
      publishedContent: remoteDraft?.publishedContent ?? '',
    }
  }

  return drafts
}

function updateDraftFromRemote(current: EditorDrafts, note: RemoteNote, kind: PublicCommentKind) {
  return {
    ...current,
    [kind]: {
      content: note[kind].content,
      publicCommentId: note[kind].publicCommentId,
      publishedAt: note[kind].publishedAt,
      publishedContent: note[kind].publishedContent,
    },
  }
}

function AnswerEditor({
  sourceId,
  onSynced,
}: {
  sourceId: string
  onSynced: () => void | Promise<void>
}) {
  const { user, refresh } = useSession()
  const initializedRef = useRef(false)
  const draftDirtyRef = useRef<Record<PublicCommentKind, boolean>>({
    answer: false,
    explain: false,
  })
  const draftsRef = useRef<EditorDrafts>(createEmptyDrafts())
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const codeEditorRef = useRef<ReactCodeMirrorRef | null>(null)
  const modeScrollYRef = useRef<number | null>(null)
  const [drafts, setDrafts] = useState<EditorDrafts>(() => createEmptyDrafts())
  const [activeKind, setActiveKind] = useState<PublicCommentKind>('answer')
  const [mode, setMode] = useState<'edit' | 'preview'>('edit')
  const [fullscreen, setFullscreen] = useState(false)
  const [collapsed, setCollapsedState] = useState(() => readAnswerEditorCollapsed())
  const [pendingCursor, setPendingCursor] = useState<number | null>(null)
  const [syncError, setSyncError] = useState('')
  const [publishing, setPublishing] = useState(false)
  const [unpublishing, setUnpublishing] = useState(false)

  const activeDraft = drafts[activeKind]
  const activeLabel = draftKindLabels[activeKind]
  const content = activeDraft.content
  const hasPublished = Boolean(activeDraft.publicCommentId)
  const hasUnpublishedChanges =
    hasPublished && activeDraft.content.trim() !== activeDraft.publishedContent.trim()
  const publishDisabled =
    publishing || !user || content.trim().length < 2 || (hasPublished && !hasUnpublishedChanges)
  const publishLabel = hasPublished
    ? hasUnpublishedChanges
      ? `更新${activeLabel}`
      : '已公开'
    : `发布${activeLabel}`
  const statusText = hasPublished
    ? hasUnpublishedChanges
      ? '有修改未公开'
      : `${activeLabel}已公开`
    : content.trim()
      ? '本地草稿'
      : '本地保存'
  const placeholder =
    activeKind === 'answer'
      ? '写回答，适合整理成面试时能直接说出的版本'
      : '写详解，可以展开原理、例子和代码'
  const collapsedSummary =
    [
      drafts.answer.content.trim() ? '回答草稿' : '',
      drafts.explain.content.trim() ? '详解草稿' : '',
    ]
      .filter(Boolean)
      .join(' · ') || '只看大家的回答'

  const setEditorCollapsed = (next: boolean) => {
    setCollapsedState(next)
    writeAnswerEditorCollapsed(next)
    if (next) setFullscreen(false)
  }

  useEffect(() => {
    draftsRef.current = drafts
  }, [drafts])

  useEffect(() => {
    const nextDrafts = mergeLocalAndRemoteDrafts(sourceId, null)
    setDrafts(nextDrafts)
    setActiveKind('answer')
    setMode('edit')
    setFullscreen(false)
    setSyncError('')
    initializedRef.current = false
    draftDirtyRef.current = { answer: false, explain: false }
  }, [sourceId])

  useEffect(() => {
    if (!user) {
      initializedRef.current = true
      return
    }

    let cancelled = false

    getRemoteNote(sourceId)
      .then(({ note }) => {
        if (cancelled) return

        const nextDrafts = mergeLocalAndRemoteDrafts(sourceId, note)
        setDrafts(nextDrafts)
        saveLocalNote(sourceId, nextDrafts.answer.content, 'answer')
        saveLocalNote(sourceId, nextDrafts.explain.content, 'explain')
        setSyncError('')
      })
      .catch((caught) => {
        if (cancelled) return
        setSyncError(caught instanceof Error ? caught.message : '同步失败')
      })
      .finally(() => {
        if (!cancelled) initializedRef.current = true
      })

    return () => {
      cancelled = true
    }
  }, [sourceId, user])

  useEffect(() => {
    if (!user || !initializedRef.current || !draftDirtyRef.current[activeKind]) return

    const contentToSync = activeDraft.content
    const kindToSync = activeKind
    const timer = window.setTimeout(() => {
      saveRemoteNote({
        sourceId,
        kind: kindToSync,
        content: contentToSync,
        action: 'draft',
      })
        .then(async () => {
          if (draftsRef.current[kindToSync].content === contentToSync) {
            draftDirtyRef.current[kindToSync] = false
          }
          setSyncError('')
          await refresh()
        })
        .catch((caught) => {
          setSyncError(caught instanceof Error ? caught.message : '同步失败')
        })
    }, 30000)

    return () => window.clearTimeout(timer)
  }, [activeDraft.content, activeKind, refresh, sourceId, user])

  useEffect(() => {
    if (!fullscreen) return

    const previousOverflow = document.body.style.overflow
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setFullscreen(false)
    }

    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [fullscreen])

  const updateContent = (value: string) => {
    draftDirtyRef.current[activeKind] = true
    setDrafts((current) => ({
      ...current,
      [activeKind]: {
        ...current[activeKind],
        content: value,
      },
    }))
    saveLocalNote(sourceId, value, activeKind)
  }

  const syncRemoteResult = async (note: RemoteNote | null, kind: PublicCommentKind) => {
    if (note) {
      setDrafts((current) => updateDraftFromRemote(current, note, kind))
      saveLocalNote(sourceId, note[kind].content, kind)
    }

    draftDirtyRef.current[kind] = false
    setSyncError('')
    await onSynced()
  }

  const publishDraft = async () => {
    if (!user) {
      window.location.href = githubLoginUrl()
      return
    }
    if (publishDisabled) return

    setPublishing(true)
    try {
      const payload = await saveRemoteNote({
        sourceId,
        kind: activeKind,
        content,
        action: 'publish',
      })
      await syncRemoteResult(payload.note, activeKind)
    } catch (caught) {
      setSyncError(caught instanceof Error ? caught.message : '发布失败')
    } finally {
      setPublishing(false)
    }
  }

  const unpublishDraft = async () => {
    if (!user || !hasPublished) return
    if (!window.confirm(`取消公开这份${activeLabel}？草稿会保留。`)) return

    setUnpublishing(true)
    try {
      const payload = await saveRemoteNote({
        sourceId,
        kind: activeKind,
        content,
        action: 'unpublish',
      })
      await syncRemoteResult(payload.note, activeKind)
    } catch (caught) {
      setSyncError(caught instanceof Error ? caught.message : '取消公开失败')
    } finally {
      setUnpublishing(false)
    }
  }

  const openEditMode = () => {
    if (mode === 'preview') {
      modeScrollYRef.current = window.scrollY
    }

    setMode('edit')
  }

  const openPreviewMode = () => {
    modeScrollYRef.current = null
    setMode('preview')
  }

  const insertMarkdown = (tool: MarkdownToolId) => {
    const editorSelection = codeEditorRef.current?.view?.state.selection.main
    const textarea = textareaRef.current
    const start = editorSelection?.from ?? textarea?.selectionStart ?? content.length
    const end = editorSelection?.to ?? textarea?.selectionEnd ?? content.length
    const result = applyMarkdownTool(content, tool, start, end)

    openEditMode()
    setPendingCursor(result.nextCursor)
    updateContent(result.nextContent)
  }

  useLayoutEffect(() => {
    if (mode !== 'edit' || modeScrollYRef.current === null) return

    const top = modeScrollYRef.current
    modeScrollYRef.current = null
    window.scrollTo({ top, left: window.scrollX, behavior: 'auto' })

    let secondFrame = 0
    const firstFrame = window.requestAnimationFrame(() => {
      window.scrollTo({ top, left: window.scrollX, behavior: 'auto' })
      secondFrame = window.requestAnimationFrame(() => {
        window.scrollTo({ top, left: window.scrollX, behavior: 'auto' })
      })
    })

    return () => {
      window.cancelAnimationFrame(firstFrame)
      if (secondFrame) window.cancelAnimationFrame(secondFrame)
    }
  }, [mode])

  useEffect(() => {
    if ((mode !== 'edit' && !fullscreen) || pendingCursor === null) return

    const timer = window.setTimeout(() => {
      const editorView = codeEditorRef.current?.view

      if (editorView) {
        editorView.dispatch({
          selection: { anchor: pendingCursor },
          scrollIntoView: true,
        })
        editorView.focus()
      } else {
        textareaRef.current?.focus()
        textareaRef.current?.setSelectionRange(pendingCursor, pendingCursor)
      }

      setPendingCursor(null)
    }, 0)

    return () => window.clearTimeout(timer)
  }, [fullscreen, mode, pendingCursor])

  if (collapsed && !fullscreen) {
    return (
      <div className="answer-editor answer-editor--collapsed">
        <button
          className="answer-editor__collapsed-trigger"
          type="button"
          onClick={() => setEditorCollapsed(false)}
          aria-expanded="false"
        >
          <span>
            <strong>我的作答</strong>
            <small>{collapsedSummary}</small>
          </span>
          <em>展开</em>
        </button>
      </div>
    )
  }

  return (
    <div className={fullscreen ? 'answer-editor answer-editor--fullscreen' : 'answer-editor'}>
      <div className="answer-editor__paper">
        <div className="answer-editor__head">
          <fieldset className="answer-editor__kind" aria-label="作答类型">
            {draftKindOptions.map((item) => (
              <button
                type="button"
                data-active={activeKind === item.value ? 'true' : undefined}
                onClick={() => {
                  setActiveKind(item.value)
                  if (!drafts[item.value].content.trim()) setMode('edit')
                }}
                key={item.value}
              >
                {item.label}
              </button>
            ))}
          </fieldset>
          <div className="answer-editor__head-actions">
            <span className="answer-editor__state">{statusText}</span>
            {!fullscreen ? (
              <button
                className="answer-editor__collapse-button"
                type="button"
                onClick={() => setEditorCollapsed(true)}
              >
                收起
              </button>
            ) : null}
          </div>
        </div>

        <div className="answer-editor__toolbar">
          <div className="answer-editor__tools">
            {markdownTools.map((tool) => (
              <button
                type="button"
                onClick={() => insertMarkdown(tool.id)}
                title={tool.title}
                key={tool.id}
              >
                {tool.label}
              </button>
            ))}
          </div>
          <div className="answer-editor__view-actions">
            {!fullscreen ? (
              <fieldset className="answer-editor__mode" aria-label="编辑模式">
                <button
                  type="button"
                  data-active={mode === 'edit' ? 'true' : undefined}
                  onClick={openEditMode}
                >
                  编辑
                </button>
                <button
                  type="button"
                  data-active={mode === 'preview' ? 'true' : undefined}
                  onClick={openPreviewMode}
                >
                  预览
                </button>
              </fieldset>
            ) : null}
            <button
              className="answer-editor__fullscreen-button"
              type="button"
              onClick={() => setFullscreen((current) => !current)}
              aria-label={fullscreen ? '退出全屏' : '全屏编辑'}
              title={fullscreen ? '退出全屏' : '全屏编辑'}
            >
              {fullscreen ? (
                <Minimize2 size={14} aria-hidden="true" />
              ) : (
                <Maximize2 size={14} aria-hidden="true" />
              )}
            </button>
          </div>
        </div>

        {fullscreen ? (
          <div className="answer-editor__fullscreen-grid">
            <div className="answer-editor__fullscreen-pane">
              <Suspense
                fallback={
                  <textarea
                    ref={textareaRef}
                    value={content}
                    onChange={(event) => updateContent(event.currentTarget.value)}
                    placeholder={placeholder}
                    aria-label={`我的${activeLabel}`}
                  />
                }
              >
                <MarkdownEditor
                  value={content}
                  onChange={updateContent}
                  placeholder={placeholder}
                  editorRef={codeEditorRef}
                />
              </Suspense>
            </div>
            <LazyMarkdownContent
              content={content}
              className="answer-editor__preview answer-editor__preview--split markdown-content"
              emptyText="预览为空"
            />
          </div>
        ) : mode === 'preview' ? (
          <LazyMarkdownContent
            content={content}
            className="answer-editor__preview markdown-content"
            emptyText="预览为空"
          />
        ) : (
          <Suspense
            fallback={
              <textarea
                ref={textareaRef}
                value={content}
                onChange={(event) => updateContent(event.currentTarget.value)}
                placeholder={placeholder}
                aria-label={`我的${activeLabel}`}
              />
            }
          >
            <MarkdownEditor
              value={content}
              onChange={updateContent}
              placeholder={placeholder}
              editorRef={codeEditorRef}
            />
          </Suspense>
        )}
      </div>

      <div className="answer-editor__footer">
        {syncError ? <span className="answer-editor__error">{syncError}</span> : null}

        <div className="answer-editor__actions">
          {user ? (
            <>
              {hasPublished ? (
                <button
                  className="answer-editor__secondary-action"
                  type="button"
                  onClick={unpublishDraft}
                  disabled={unpublishing}
                >
                  {unpublishing ? '取消中' : '取消公开'}
                </button>
              ) : null}
              <button
                className="answer-editor__publish"
                type="button"
                onClick={publishDraft}
                disabled={publishDisabled}
              >
                {publishing ? '发布中' : publishLabel}
              </button>
            </>
          ) : (
            <a className="answer-editor__login" href={githubLoginUrl()}>
              登录发布
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

function CommentComposer({
  sourceId,
  parentId,
  compact,
  onCreated,
}: {
  sourceId: string
  parentId?: string
  compact?: boolean
  onCreated: (comment: CommunityComment) => void | Promise<void>
}) {
  const { user } = useSession()
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const submit = async () => {
    if (!user) {
      window.location.href = githubLoginUrl()
      return
    }
    if (!content.trim()) return

    setSubmitting(true)
    try {
      const payload = await createComment({
        sourceId,
        parentId,
        content,
      })
      setContent('')
      await onCreated(payload.comment)
    } finally {
      setSubmitting(false)
    }
  }

  if (!user) {
    return (
      <div className="comment-login comment-login--compact">
        <a href={githubLoginUrl()}>登录回复</a>
      </div>
    )
  }

  return (
    <div className={compact ? 'comment-composer comment-composer--compact' : 'comment-composer'}>
      <textarea
        value={content}
        onChange={(event) => setContent(event.currentTarget.value)}
        placeholder={parentId ? '回复' : '写回答'}
      />
      <div className="comment-composer__footer">
        <span>{content.trim().length} 字</span>
        <button type="button" onClick={submit} disabled={submitting || !content.trim()}>
          {submitting ? '发布中' : parentId ? '回复' : '发布'}
        </button>
      </div>
    </div>
  )
}

function CommentItem({
  comment,
  replies,
  sourceId,
  onCreated,
  onUpdated,
  onDeleted,
}: {
  comment: CommunityComment
  replies: CommunityComment[]
  sourceId: string
  onCreated: (comment: CommunityComment) => void | Promise<void>
  onUpdated: (comment: CommunityComment) => void
  onDeleted: (commentId: string) => void
}) {
  const { user } = useSession()
  const [replying, setReplying] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(comment.content)

  const saveEdit = async () => {
    if (!draft.trim()) return

    const payload = await updateComment(comment.id, draft)
    onUpdated(payload.comment)
    setEditing(false)
  }

  const remove = async () => {
    if (!window.confirm('删除这条评论？')) return

    await deleteComment(comment.id)
    onDeleted(comment.id)
  }

  const vote = async (value: -1 | 1) => {
    if (!user) {
      window.location.href = githubLoginUrl()
      return
    }

    const nextValue = comment.viewerVote === value ? 0 : value
    const payload = await voteComment(comment.id, nextValue)
    onUpdated(payload.comment)
  }

  const accept = async () => {
    const payload = await acceptComment(comment.id, !comment.acceptedAt)
    onUpdated(payload.comment)
  }

  return (
    <article className="comment-item">
      <div className="comment-item__avatar">
        {comment.user.avatarUrl ? (
          <img src={comment.user.avatarUrl} alt="" />
        ) : (
          comment.user.login.slice(0, 1)
        )}
      </div>

      <div className="comment-item__main">
        <div className="comment-item__meta">
          <strong>{comment.user.name || comment.user.login}</strong>
          <span>@{comment.user.login}</span>
          <span>{formatTime(comment.createdAt)}</span>
          {!comment.parentId ? <em>{kindLabels[comment.kind]}</em> : null}
          {comment.acceptedAt ? <em>已采纳</em> : null}
        </div>

        {editing ? (
          <div className="comment-edit">
            <textarea value={draft} onChange={(event) => setDraft(event.currentTarget.value)} />
            <div>
              <button type="button" onClick={() => setEditing(false)}>
                取消
              </button>
              <button type="button" onClick={saveEdit}>
                保存
              </button>
            </div>
          </div>
        ) : (
          <LazyMarkdownContent
            content={comment.content}
            className="comment-content markdown-content"
          />
        )}

        <div className="comment-actions">
          <button
            type="button"
            data-active={comment.viewerVote === 1 ? 'true' : undefined}
            onClick={() => vote(1)}
          >
            <ThumbsUp size={14} aria-hidden="true" />
            {comment.upvotes}
          </button>
          <button
            type="button"
            data-active={comment.viewerVote === -1 ? 'true' : undefined}
            onClick={() => vote(-1)}
          >
            <ThumbsDown size={14} aria-hidden="true" />
            {comment.downvotes}
          </button>
          {!comment.parentId ? (
            <button type="button" onClick={() => setReplying((current) => !current)}>
              <ChevronDown size={14} aria-hidden="true" />
              回复
            </button>
          ) : null}
          {comment.canEdit ? (
            <button type="button" onClick={() => setEditing(true)}>
              编辑
            </button>
          ) : null}
          {comment.canAccept ? (
            <button type="button" onClick={accept}>
              {comment.acceptedAt ? '取消采纳' : '采纳'}
            </button>
          ) : null}
          {comment.canDelete ? (
            <button type="button" onClick={remove}>
              <Trash2 size={14} aria-hidden="true" />
              删除
            </button>
          ) : null}
        </div>

        {replying ? (
          <CommentComposer
            sourceId={sourceId}
            parentId={comment.id}
            compact
            onCreated={(reply) => {
              onCreated(reply)
              setReplying(false)
            }}
          />
        ) : null}

        {replies.length ? (
          <div className="comment-replies">
            {replies.map((reply) => (
              <CommentItem
                comment={reply}
                replies={[]}
                sourceId={sourceId}
                onCreated={onCreated}
                onUpdated={onUpdated}
                onDeleted={onDeleted}
                key={reply.id}
              />
            ))}
          </div>
        ) : null}
      </div>
    </article>
  )
}
