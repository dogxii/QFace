import { Bookmark } from 'lucide-react'
import { useEffect, useState } from 'react'
import { bookmarksChangedEvent, isLocalBookmarked, setLocalBookmark } from '@/lib/local-bookmarks'

export function BookmarkButton({ sourceId }: { sourceId: string }) {
  const [bookmarked, setBookmarked] = useState(false)

  useEffect(() => {
    const updateBookmark = () => setBookmarked(isLocalBookmarked(sourceId))

    updateBookmark()
    window.addEventListener(bookmarksChangedEvent, updateBookmark)
    window.addEventListener('storage', updateBookmark)

    return () => {
      window.removeEventListener(bookmarksChangedEvent, updateBookmark)
      window.removeEventListener('storage', updateBookmark)
    }
  }, [sourceId])

  const toggle = () => {
    const next = !bookmarked
    setBookmarked(next)
    setLocalBookmark(sourceId, next)
  }

  return (
    <button
      className="quiet-action"
      type="button"
      aria-label={bookmarked ? '取消收藏' : '收藏'}
      title={bookmarked ? '取消收藏' : '收藏'}
      data-active={bookmarked ? 'true' : undefined}
      onClick={toggle}
    >
      <Bookmark size={15} aria-hidden="true" />
      收藏
    </button>
  )
}
