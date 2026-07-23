import { ChevronLeft, ChevronRight } from 'lucide-react'

interface PaginationProps {
  page: number
  pageCount: number
  onPageChange: (page: number) => void
}

export function Pagination({ page, pageCount, onPageChange }: PaginationProps) {
  if (pageCount <= 1) return null

  const pages = Array.from(
    new Set(
      [1, page - 1, page, page + 1, pageCount].filter((item) => item > 0 && item <= pageCount),
    ),
  )

  return (
    <nav className="pagination" aria-label="问题分页">
      {page > 1 ? (
        <button type="button" onClick={() => onPageChange(page - 1)} aria-label="上一页">
          <ChevronLeft size={16} />
        </button>
      ) : (
        <span className="pagination__disabled">
          <ChevronLeft size={16} />
        </span>
      )}

      {pages.map((item, index) => (
        <span className="pagination__group" key={item}>
          {index > 0 && pages[index - 1] !== item - 1 ? (
            <span className="pagination__ellipsis">…</span>
          ) : null}
          <button
            type="button"
            onClick={() => onPageChange(item)}
            aria-current={item === page ? 'page' : undefined}
          >
            {item}
          </button>
        </span>
      ))}

      {page < pageCount ? (
        <button type="button" onClick={() => onPageChange(page + 1)} aria-label="下一页">
          <ChevronRight size={16} />
        </button>
      ) : (
        <span className="pagination__disabled">
          <ChevronRight size={16} />
        </span>
      )}
    </nav>
  )
}
