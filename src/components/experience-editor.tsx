import { Link } from '@tanstack/react-router'
import type { ReactCodeMirrorRef } from '@uiw/react-codemirror'
import { Copy, ExternalLink, ImageDown, Info, Moon, Search, Sun } from 'lucide-react'
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import {
  appendQuestionLink,
  autoLinkExperienceContent,
  extractExperienceLinks,
  questionLinkHref,
  searchExperienceQuestions,
} from '@/lib/experience-links'
import { copyMarkdownText, exportMarkdownImage, safeExportFilename } from '@/lib/export-image'
import { useSession } from '@/lib/session'
import type { ExperienceInput, ExperienceVisibility } from '@/types/experience'
import { categories, type Question, type QuestionCategory } from '@/types/question'

const MarkdownEditor = lazy(() => import('./markdown-editor'))
const MarkdownContent = lazy(() => import('./markdown-content'))
const questionCategoryStorageKey = 'qface:experience-question-category:v1'
const editorToneStorageKey = 'qface:experience-editor-tone:v1'
type QuestionCategoryFilter = QuestionCategory | 'all'
type ExperienceEditorTone = 'dark' | 'light'

export interface ExperienceEditorValue {
  title: string
  interviewDate: string
  content: string
  visibility: ExperienceVisibility
}

export const emptyExperienceEditorValue: ExperienceEditorValue = {
  title: '',
  interviewDate: '',
  content: '',
  visibility: 'private',
}

function readQuestionCategoryFilter(): QuestionCategoryFilter {
  if (typeof window === 'undefined') return '前端'

  try {
    const value = window.localStorage.getItem(questionCategoryStorageKey)
    if (value === 'all' || categories.includes(value as QuestionCategory)) {
      return value as QuestionCategoryFilter
    }
  } catch {
    return '前端'
  }

  return '前端'
}

function toQuestionSearchCategory(value: QuestionCategoryFilter) {
  return value === 'all' ? undefined : value
}

function readEditorTone(): ExperienceEditorTone {
  if (typeof window === 'undefined') return 'dark'

  try {
    return window.localStorage.getItem(editorToneStorageKey) === 'light' ? 'light' : 'dark'
  } catch {
    return 'dark'
  }
}

function writeEditorTone(tone: ExperienceEditorTone) {
  try {
    window.localStorage.setItem(editorToneStorageKey, tone)
  } catch {
    // 忽略隐私模式或存储不可用场景，编辑区亮暗偏好只是本地体验。
  }
}

export function toExperienceInput(value: ExperienceEditorValue): ExperienceInput {
  return {
    title: value.title.trim(),
    interviewDate: value.interviewDate.trim(),
    content: value.content.trim(),
    visibility: value.visibility,
    links: extractExperienceLinks(value.content),
  }
}

export type ExperienceSubmitAction = 'save' | 'publish' | 'private'

export function ExperienceEditor({
  value,
  saving,
  onChange,
  onSubmit,
}: {
  value: ExperienceEditorValue
  saving?: ExperienceSubmitAction | null
  onChange: (value: ExperienceEditorValue) => void
  onSubmit: (action: ExperienceSubmitAction) => void | Promise<void>
}) {
  const { user } = useSession()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const codeEditorRef = useRef<ReactCodeMirrorRef | null>(null)
  const exportContentRef = useRef<HTMLDivElement>(null)
  const [questionQuery, setQuestionQuery] = useState('')
  const [questionToolOpen, setQuestionToolOpen] = useState(false)
  const [mode, setMode] = useState<'edit' | 'preview'>('edit')
  const [editorTone, setEditorTone] = useState<ExperienceEditorTone>(() => readEditorTone())
  const [pendingCursor, setPendingCursor] = useState<number | null>(null)
  const [toolMessage, setToolMessage] = useState('')
  const [questionCategory, setQuestionCategory] = useState<QuestionCategoryFilter>(
    readQuestionCategoryFilter,
  )
  const questionResults = useMemo(
    () =>
      searchExperienceQuestions(questionQuery, 8, {
        category: toQuestionSearchCategory(questionCategory),
      }),
    [questionCategory, questionQuery],
  )

  const updateField = <K extends keyof ExperienceEditorValue>(
    field: K,
    next: ExperienceEditorValue[K],
  ) => {
    onChange({ ...value, [field]: next })
  }
  const canSubmit = value.title.trim().length >= 2 && value.content.trim().length >= 2
  const visibilityText = value.visibility === 'public' ? '公开可见' : '仅自己可见'
  const toggleEditorTone = () => {
    const nextTone = editorTone === 'dark' ? 'light' : 'dark'
    setEditorTone(nextTone)
    writeEditorTone(nextTone)
  }

  const openQuestionTool = () => {
    const editorSelection = codeEditorRef.current?.view?.state.selection.main
    const textarea = textareaRef.current
    const selected = editorSelection
      ? (codeEditorRef.current?.view?.state.doc.sliceString(
          editorSelection.from,
          editorSelection.to,
        ) ?? '')
      : textarea
        ? value.content.slice(textarea.selectionStart, textarea.selectionEnd).trim()
        : ''
    setQuestionQuery(selected.trim())
    setQuestionToolOpen(true)
    setMode('edit')
    setToolMessage('')
  }

  const insertQuestion = (question: Question) => {
    const editorSelection = codeEditorRef.current?.view?.state.selection.main
    const textarea = textareaRef.current
    const start = editorSelection?.from ?? textarea?.selectionStart ?? value.content.length
    const end = editorSelection?.to ?? textarea?.selectionEnd ?? value.content.length
    const selected = value.content.slice(start, end).trim()
    const insertion = appendQuestionLink(selected, question.sourceId, '↗', question.title)
    const nextContent = `${value.content.slice(0, start)}${insertion}${value.content.slice(end)}`

    updateField('content', nextContent)
    setMode('edit')
    setPendingCursor(start + insertion.length)
    setToolMessage(`已插入 ${question.title}`)
  }

  const autoLink = () => {
    const result = autoLinkExperienceContent(value.content, {
      category: toQuestionSearchCategory(questionCategory),
    })
    updateField('content', result.content)
    setToolMessage(result.added ? `已自动关联 ${result.added} 道题` : '暂未匹配到新题目')
  }

  const copyContent = async () => {
    if (!value.content.trim()) return

    try {
      await copyMarkdownText(value.content)
      setToolMessage('已复制')
    } catch {
      setToolMessage('复制失败')
    }
  }

  const exportImage = async () => {
    const html = exportContentRef.current?.querySelector('.markdown-content')?.innerHTML
    if (!value.content.trim() || !html) return

    try {
      await exportMarkdownImage({
        title: value.title.trim() || 'QFace 面经',
        meta: value.interviewDate ? `面试 ${value.interviewDate}` : '面经',
        author: user
          ? { name: user.name, login: user.login, avatarUrl: user.avatarUrl }
          : undefined,
        html,
        filename: `qface-experience-${safeExportFilename(value.title || 'experience')}`,
      })
      setToolMessage('已导出')
    } catch {
      setToolMessage('导出失败')
    }
  }

  useEffect(() => {
    try {
      window.localStorage.setItem(questionCategoryStorageKey, questionCategory)
    } catch {
      // Ignore storage failures; the current editor state still works.
    }
  }, [questionCategory])

  useEffect(() => {
    if (mode !== 'edit' || pendingCursor === null) return

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
  }, [mode, pendingCursor])

  return (
    <div className="experience-editor">
      <div className="experience-editor__fields">
        <div className="experience-editor__title-row">
          <input
            value={value.title}
            onChange={(event) => updateField('title', event.currentTarget.value)}
            placeholder="XX公司XX岗位日常一面"
            aria-label="面经标题"
          />
          <input
            type="date"
            value={value.interviewDate}
            onChange={(event) => updateField('interviewDate', event.currentTarget.value)}
            aria-label="面试日期"
          />
        </div>
      </div>

      <div className="experience-editor__toolbar">
        <button type="button" onClick={openQuestionTool}>
          <Search size={14} aria-hidden="true" />
          关联题目
        </button>
        <button type="button" onClick={autoLink}>
          自动匹配题库
        </button>
        {toolMessage ? <span>{toolMessage}</span> : null}
        <span className="answer-editor__toolbar-divider" aria-hidden="true" />
        <button
          type="button"
          className="answer-editor__toolbar-action"
          onClick={copyContent}
          disabled={!value.content.trim()}
          aria-label="复制全文"
          title="复制全文"
        >
          <Copy size={14} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="answer-editor__toolbar-action"
          onClick={exportImage}
          disabled={!value.content.trim()}
          aria-label="导出图片"
          title="导出图片"
        >
          <ImageDown size={14} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="answer-editor__toolbar-action"
          onClick={toggleEditorTone}
          aria-label={editorTone === 'dark' ? '切换亮色编辑区' : '切换深色编辑区'}
          title={editorTone === 'dark' ? '亮色编辑区' : '深色编辑区'}
        >
          {editorTone === 'dark' ? (
            <Sun size={14} aria-hidden="true" />
          ) : (
            <Moon size={14} aria-hidden="true" />
          )}
        </button>
        <button
          type="button"
          className="markdown-hint"
          data-tooltip="Markdown 渲染：普通换行不分段，空一行分段"
          aria-label="Markdown 渲染：普通换行不分段，空一行分段"
        >
          <Info size={13} aria-hidden="true" />
        </button>
        <fieldset className="experience-editor__mode" aria-label="编辑模式">
          <button
            type="button"
            data-active={mode === 'edit' ? 'true' : undefined}
            onClick={() => setMode('edit')}
          >
            编辑
          </button>
          <button
            type="button"
            data-active={mode === 'preview' ? 'true' : undefined}
            onClick={() => setMode('preview')}
          >
            预览
          </button>
        </fieldset>
      </div>

      {questionToolOpen ? (
        <div className="experience-question-tool">
          <div className="experience-question-tool__search">
            <input
              value={questionQuery}
              onChange={(event) => setQuestionQuery(event.currentTarget.value)}
              placeholder="搜索题目，选择后插入 [↗]"
              aria-label="搜索关联题目"
            />
            <select
              value={questionCategory}
              onChange={(event) =>
                setQuestionCategory(event.currentTarget.value as QuestionCategoryFilter)
              }
              aria-label="关联题目岗位"
            >
              <option value="all">全部岗位</option>
              {categories.map((category) => (
                <option value={category} key={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>
          {questionQuery.trim() ? (
            <div className="experience-question-results">
              {questionResults.length ? (
                questionResults.map((question) => {
                  const href = questionLinkHref(question.sourceId, question.title)

                  return (
                    <div className="experience-question-result" key={question.sourceId}>
                      <button
                        className="experience-question-result__insert"
                        type="button"
                        onClick={() => insertQuestion(question)}
                      >
                        <span>{question.title}</span>
                        <small>
                          {question.category} · {question.module}
                        </small>
                      </button>
                      <a
                        className="experience-question-result__open"
                        href={href}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`新窗口打开题目：${question.title}`}
                        title="新窗口打开"
                      >
                        <ExternalLink size={14} aria-hidden="true" />
                      </a>
                    </div>
                  )
                })
              ) : (
                <span>没有匹配题目</span>
              )}
            </div>
          ) : null}
        </div>
      ) : null}

      {mode === 'preview' ? (
        <Suspense fallback={<div className="experience-editor__preview">{value.content}</div>}>
          <MarkdownContent
            content={value.content}
            className="experience-editor__preview markdown-content experience-content"
            emptyText="预览为空"
          />
        </Suspense>
      ) : (
        <Suspense
          fallback={
            <textarea
              ref={textareaRef}
              value={value.content}
              onChange={(event) => updateField('content', event.currentTarget.value)}
              placeholder="粘贴或编写面经，每一行问题后可以插入 [↗] 跳回题库"
            />
          }
        >
          <MarkdownEditor
            value={value.content}
            onChange={(next) => updateField('content', next)}
            placeholder="粘贴或编写面经，每一行问题后可以插入 [↗] 跳回题库"
            editorRef={codeEditorRef}
            tone={editorTone}
          />
        </Suspense>
      )}

      <div className="markdown-export-source" ref={exportContentRef} aria-hidden="true">
        <Suspense fallback={null}>
          <MarkdownContent content={value.content} className="markdown-content" />
        </Suspense>
      </div>

      <div className="experience-editor__footer">
        <span className="experience-editor__visibility">{visibilityText}</span>
        <Link
          to="/experiences"
          search={value.visibility === 'private' ? { mine: true } : undefined}
        >
          取消
        </Link>
        {value.visibility === 'public' ? (
          <button
            className="experience-editor__secondary-action"
            type="button"
            onClick={() => onSubmit('private')}
            disabled={Boolean(saving) || !canSubmit}
          >
            {saving === 'private' ? '保存中' : '设为私密'}
          </button>
        ) : null}
        <button
          className="experience-editor__secondary-action"
          type="button"
          onClick={() => onSubmit('save')}
          disabled={Boolean(saving) || !canSubmit}
        >
          {saving === 'save' ? '保存中' : '保存'}
        </button>
        {value.visibility !== 'public' ? (
          <button
            type="button"
            onClick={() => onSubmit('publish')}
            disabled={Boolean(saving) || !canSubmit}
          >
            {saving === 'publish' ? '发布中' : '公开发布'}
          </button>
        ) : null}
      </div>
    </div>
  )
}
