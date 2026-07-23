import { Link, useNavigate } from '@tanstack/react-router'
import { ChevronDown, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

interface ModuleQuestion {
  sourceId: string
  title: string
}

function questionHref(sourceId: string) {
  return `/q/${encodeURIComponent(sourceId)}`
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
}

export function QuestionModuleDrawer({
  module,
  questions,
  currentSourceId,
}: {
  module: string
  questions: ModuleQuestion[]
  currentSourceId: string
}) {
  const [open, setOpen] = useState(false)
  const activeItemRef = useRef<HTMLAnchorElement>(null)

  useEffect(() => {
    if (!open) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.body.dataset.moduleDrawerOpen = 'true'

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }

    window.addEventListener('keydown', closeOnEscape)
    requestAnimationFrame(() => activeItemRef.current?.scrollIntoView({ block: 'center' }))

    return () => {
      window.removeEventListener('keydown', closeOnEscape)
      document.body.style.overflow = previousOverflow
      delete document.body.dataset.moduleDrawerOpen
    }
  }, [open])

  return (
    <>
      <button
        className="question-breadcrumb__module"
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span>{module}</span>
        <ChevronDown size={12} aria-hidden="true" />
      </button>

      {open ? (
        <div className="module-drawer" role="dialog" aria-modal="true" aria-label={`${module}题目`}>
          <button
            className="module-drawer__backdrop"
            type="button"
            onClick={() => setOpen(false)}
            aria-label="关闭模块题目"
          />
          <aside className="module-drawer__panel">
            <header className="module-drawer__header">
              <div>
                <strong>{module}</strong>
                <span>{questions.length} 道问题</span>
              </div>
              <button
                className="module-drawer__close"
                type="button"
                onClick={() => setOpen(false)}
                aria-label="关闭"
              >
                <X size={16} aria-hidden="true" />
              </button>
            </header>
            <nav className="module-drawer__list" aria-label={`${module}题目`}>
              {questions.map((question, index) => {
                const active = question.sourceId === currentSourceId

                return (
                  <Link
                    className="module-drawer__item"
                    data-active={active ? 'true' : undefined}
                    to="/q/$sourceId"
                    params={{ sourceId: question.sourceId }}
                    onClick={() => setOpen(false)}
                    ref={active ? activeItemRef : undefined}
                    key={question.sourceId}
                  >
                    <span>{String(index + 1).padStart(2, '0')}</span>
                    <strong>{question.title}</strong>
                  </Link>
                )
              })}
            </nav>
          </aside>
        </div>
      ) : null}
    </>
  )
}

export function QuestionStepNav({
  previous,
  next,
  listSearch,
}: {
  previous?: ModuleQuestion
  next?: ModuleQuestion
  listSearch: { category: string; module: string }
}) {
  const navigate = useNavigate()
  const previousHref = previous ? questionHref(previous.sourceId) : undefined
  const nextHref = next ? questionHref(next.sourceId) : undefined
  const previousSourceId = previous?.sourceId
  const nextSourceId = next?.sourceId

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (document.body.dataset.moduleDrawerOpen === 'true') return
      if (
        event.defaultPrevented ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        event.shiftKey
      ) {
        return
      }
      if (isEditableTarget(event.target)) return

      if (event.key === 'ArrowLeft' && previousHref) {
        event.preventDefault()
        if (previousSourceId)
          navigate({ to: '/q/$sourceId', params: { sourceId: previousSourceId } })
      }
      if (event.key === 'ArrowRight' && nextHref) {
        event.preventDefault()
        if (nextSourceId) navigate({ to: '/q/$sourceId', params: { sourceId: nextSourceId } })
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [navigate, nextHref, nextSourceId, previousHref, previousSourceId])

  return (
    <nav className="question-step-nav" aria-label="题目切换">
      {previous ? (
        <Link
          className="question-step-link question-step-link--previous"
          to="/q/$sourceId"
          params={{ sourceId: previous.sourceId }}
          aria-keyshortcuts="ArrowLeft"
        >
          <ChevronLeft size={13} strokeWidth={1.9} aria-hidden="true" />
          上一题
        </Link>
      ) : (
        <span className="question-step-link question-step-link--disabled">
          <ChevronLeft size={13} strokeWidth={1.9} aria-hidden="true" />
          上一题
        </span>
      )}

      <Link className="question-step-link" to="/" search={listSearch}>
        返回列表
      </Link>

      {next ? (
        <Link
          className="question-step-link question-step-link--next"
          to="/q/$sourceId"
          params={{ sourceId: next.sourceId }}
          aria-keyshortcuts="ArrowRight"
        >
          下一题
          <ChevronRight size={13} strokeWidth={1.9} aria-hidden="true" />
        </Link>
      ) : (
        <span className="question-step-link question-step-link--next question-step-link--disabled">
          下一题
          <ChevronRight size={13} strokeWidth={1.9} aria-hidden="true" />
        </span>
      )}
    </nav>
  )
}
