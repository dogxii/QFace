import { type AnchorHTMLAttributes, useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import ReactMarkdown, { type Components } from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import remarkGfm from 'remark-gfm'
import { getQuestion } from '@/lib/questions'

function getQuestionLinkTitle(href: string) {
  const match = href.match(/^\/q\/([^/?#]+)/)
  if (!match) return ''

  try {
    return getQuestion(decodeURIComponent(match[1]))?.title ?? ''
  } catch {
    return getQuestion(match[1])?.title ?? ''
  }
}

function QuestionTooltipAnchor({
  href,
  children,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement>) {
  const anchorRef = useRef<HTMLAnchorElement | null>(null)
  const [tooltip, setTooltip] = useState<{
    title: string
    x: number
    y: number
    placement: 'top' | 'bottom'
  } | null>(null)
  const title = href ? getQuestionLinkTitle(href) : ''

  const updateTooltip = useCallback(() => {
    if (!title || !anchorRef.current) return

    const rect = anchorRef.current.getBoundingClientRect()
    const placement = rect.top > 64 ? 'top' : 'bottom'
    const x = Math.min(Math.max(rect.left + rect.width / 2, 24), window.innerWidth - 24)
    const y = placement === 'top' ? rect.top - 8 : rect.bottom + 8

    setTooltip({ title, x, y, placement })
  }, [title])

  useEffect(() => {
    if (!tooltip) return

    window.addEventListener('scroll', updateTooltip, true)
    window.addEventListener('resize', updateTooltip)

    return () => {
      window.removeEventListener('scroll', updateTooltip, true)
      window.removeEventListener('resize', updateTooltip)
    }
  }, [tooltip, updateTooltip])

  if (!title) {
    return (
      <a href={href} {...props}>
        {children}
      </a>
    )
  }

  return (
    <>
      <a
        href={href}
        {...props}
        ref={anchorRef}
        aria-label={`打开题目：${title}`}
        onBlur={() => setTooltip(null)}
        onFocus={updateTooltip}
        onMouseEnter={updateTooltip}
        onMouseLeave={() => setTooltip(null)}
      >
        {children}
      </a>
      {tooltip
        ? createPortal(
            <span
              className="qface-link-tooltip"
              data-placement={tooltip.placement}
              style={{ left: tooltip.x, top: tooltip.y }}
              role="tooltip"
            >
              {tooltip.title}
            </span>,
            document.body,
          )
        : null}
    </>
  )
}

const markdownComponents: Components = {
  a({ href, children, ...props }) {
    if (href?.startsWith('/')) {
      return (
        <QuestionTooltipAnchor href={href} {...props}>
          {children}
        </QuestionTooltipAnchor>
      )
    }

    return (
      <a href={href} target="_blank" rel="noreferrer" {...props}>
        {children}
      </a>
    )
  },
}

export function MarkdownContent({
  content,
  emptyText,
  className,
}: {
  content: string
  emptyText?: string
  className?: string
}) {
  const value = content.trim()

  if (!value) {
    return emptyText ? <div className={className}>{emptyText}</div> : null
  }

  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={markdownComponents}
      >
        {value}
      </ReactMarkdown>
    </div>
  )
}

export default MarkdownContent
