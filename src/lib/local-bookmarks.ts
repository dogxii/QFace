export const bookmarksStorageKey = 'qface:bookmarks:v1'
export const bookmarksChangedEvent = 'qface:bookmarks-changed'

function isBrowser() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

function emitBookmarksChanged() {
  if (!isBrowser()) return
  window.dispatchEvent(new Event(bookmarksChangedEvent))
}

export function readLocalBookmarks() {
  if (!isBrowser()) return new Set<string>()

  try {
    const parsed = JSON.parse(window.localStorage.getItem(bookmarksStorageKey) ?? '[]')
    if (!Array.isArray(parsed)) return new Set<string>()

    return new Set(parsed.filter((item): item is string => typeof item === 'string'))
  } catch {
    return new Set<string>()
  }
}

export function isLocalBookmarked(sourceId: string) {
  return readLocalBookmarks().has(sourceId)
}

export function setLocalBookmark(sourceId: string, bookmarked: boolean) {
  const bookmarks = readLocalBookmarks()

  if (bookmarked) bookmarks.add(sourceId)
  else bookmarks.delete(sourceId)

  window.localStorage.setItem(bookmarksStorageKey, JSON.stringify([...bookmarks]))
  emitBookmarksChanged()

  return bookmarked
}

export function getLocalBookmarkCount() {
  return readLocalBookmarks().size
}
