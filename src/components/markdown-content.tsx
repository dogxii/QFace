import ReactMarkdown, { type Components } from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import remarkGfm from 'remark-gfm'

const markdownComponents: Components = {
  a({ href, children, ...props }) {
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
