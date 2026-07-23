import { Link } from '@tanstack/react-router'
import { ChevronDown, ChevronUp, X } from 'lucide-react'
import {
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  ExperienceQuestionPanelContext,
  type ExperienceQuestionPanelPayload,
} from '@/lib/experience-question-panel-state'
import { getQuestion } from '@/lib/questions'

const panelSize = {
  width: 344,
  height: 380,
  margin: 14,
}

interface PanelPosition {
  x: number
  y: number
}

interface PanelState extends ExperienceQuestionPanelPayload {
  open: boolean
  visitedSourceIds: string[]
}

function clampPosition(position: PanelPosition): PanelPosition {
  if (typeof window === 'undefined') return position

  const maxX = Math.max(panelSize.margin, window.innerWidth - panelSize.width - panelSize.margin)
  const maxY = Math.max(panelSize.margin, window.innerHeight - panelSize.height - panelSize.margin)

  return {
    x: Math.min(Math.max(panelSize.margin, position.x), maxX),
    y: Math.min(Math.max(panelSize.margin, position.y), maxY),
  }
}

function defaultPosition(): PanelPosition {
  if (typeof window === 'undefined') return { x: 24, y: 88 }

  return clampPosition({
    x: window.innerWidth - panelSize.width - 28,
    y: 96,
  })
}

export function ExperienceQuestionPanelProvider({ children }: { children: ReactNode }) {
  const [panel, setPanel] = useState<PanelState | null>(null)
  const [position, setPosition] = useState(defaultPosition)
  const [collapsed, setCollapsed] = useState(false)
  const dragOffsetRef = useRef<PanelPosition | null>(null)

  const linkedQuestions = useMemo(
    () =>
      panel?.links.map((link) => ({
        link,
        question: getQuestion(link.sourceId),
      })) ?? [],
    [panel?.links],
  )

  const togglePanel = useCallback((payload: ExperienceQuestionPanelPayload) => {
    setPosition(defaultPosition())
    setPanel((current) => {
      if (current?.open && current.experienceId === payload.experienceId) {
        return { ...current, open: false }
      }

      return {
        ...payload,
        open: true,
        visitedSourceIds:
          current?.experienceId === payload.experienceId ? current.visitedSourceIds : [],
      }
    })
    setCollapsed(false)
  }, [])

  const closePanel = useCallback(() => {
    setPanel((current) => (current ? { ...current, open: false } : current))
    setCollapsed(false)
  }, [])

  const markVisited = (sourceId: string) => {
    setPanel((current) => {
      if (!current || current.visitedSourceIds.includes(sourceId)) return current
      return { ...current, visitedSourceIds: [...current.visitedSourceIds, sourceId] }
    })
  }

  useEffect(() => {
    if (!panel?.open) return

    const handleResize = () => setPosition((current) => clampPosition(current))

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [panel?.open])

  const startDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return

    dragOffsetRef.current = {
      x: event.clientX - position.x,
      y: event.clientY - position.y,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const drag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragOffsetRef.current) return

    setPosition(
      clampPosition({
        x: event.clientX - dragOffsetRef.current.x,
        y: event.clientY - dragOffsetRef.current.y,
      }),
    )
  }

  const stopDrag = () => {
    dragOffsetRef.current = null
  }

  return (
    <ExperienceQuestionPanelContext.Provider
      value={{
        activeExperienceId: panel?.open ? panel.experienceId : null,
        togglePanel,
        closePanel,
      }}
    >
      {children}

      {panel?.open ? (
        <div
          className={
            collapsed
              ? 'experience-question-float experience-question-float--collapsed'
              : 'experience-question-float'
          }
          style={{
            transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
          }}
          role="dialog"
          aria-label={panel.title}
        >
          <div
            className="experience-question-float__head"
            onPointerDown={startDrag}
            onPointerMove={drag}
            onPointerUp={stopDrag}
            onPointerCancel={stopDrag}
          >
            <span title={panel.title}>{panel.title}</span>
            <div className="experience-question-float__controls">
              <button
                type="button"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={() => setCollapsed((current) => !current)}
                aria-label={collapsed ? '展开' : '折叠'}
                title={collapsed ? '展开' : '折叠'}
              >
                {collapsed ? (
                  <ChevronUp size={13} aria-hidden="true" />
                ) : (
                  <ChevronDown size={13} aria-hidden="true" />
                )}
              </button>
              <button
                type="button"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={closePanel}
                aria-label="关闭"
              >
                <X size={13} aria-hidden="true" />
              </button>
            </div>
          </div>
          {!collapsed ? (
            <div className="experience-question-float__body">
              {linkedQuestions.length ? (
                <div className="experience-question-panel__list">
                  {linkedQuestions.map(({ link, question }) => {
                    const visited = panel.visitedSourceIds.includes(link.sourceId)

                    return (
                      <Link
                        to="/q/$sourceId"
                        params={{ sourceId: link.sourceId }}
                        data-visited={visited ? 'true' : undefined}
                        onClick={() => markVisited(link.sourceId)}
                        key={link.id}
                      >
                        <span>{question?.title ?? (link.label || link.sourceId)}</span>
                        {question ? (
                          <small>
                            {question.category} · {question.module}
                          </small>
                        ) : null}
                      </Link>
                    )
                  })}
                </div>
              ) : (
                <div className="experience-question-float__empty">暂无关联题目</div>
              )}
            </div>
          ) : null}
        </div>
      ) : null}
    </ExperienceQuestionPanelContext.Provider>
  )
}
