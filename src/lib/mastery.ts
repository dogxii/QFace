import { useCallback, useEffect, useState } from 'react'
import { getRemoteNotes, saveRemoteNote } from '@/lib/community-api'
import { useSession } from '@/lib/session'

export type MasteryMap = Record<string, number>

const masteryKey = 'qface:mastery:v1'
export const masteryChangedEvent = 'qface:mastery-changed'

function isBrowser() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

function emitMasteryChanged() {
  if (!isBrowser()) return
  window.queueMicrotask(() => window.dispatchEvent(new Event(masteryChangedEvent)))
}

export function readMastery() {
  if (!isBrowser()) return {}

  try {
    return JSON.parse(localStorage.getItem(masteryKey) ?? '{}') as MasteryMap
  } catch {
    return {}
  }
}

export function persistMastery(next: MasteryMap) {
  if (!isBrowser()) return

  localStorage.setItem(masteryKey, JSON.stringify(next))
  emitMasteryChanged()
}

export function useMastery() {
  const { user } = useSession()
  const [masteryMap, setMasteryMap] = useState<MasteryMap>({})

  useEffect(() => {
    const updateMastery = () => setMasteryMap(readMastery())

    updateMastery()
    window.addEventListener(masteryChangedEvent, updateMastery)
    window.addEventListener('storage', updateMastery)

    return () => {
      window.removeEventListener(masteryChangedEvent, updateMastery)
      window.removeEventListener('storage', updateMastery)
    }
  }, [])

  useEffect(() => {
    if (!user) return

    getRemoteNotes()
      .then((payload) => {
        const remoteMastery = Object.fromEntries(
          payload.notes
            .filter((note) => note.mastery > 0)
            .map((note) => [note.sourceId, note.mastery]),
        )

        setMasteryMap((current) => {
          const next = { ...current, ...remoteMastery }
          persistMastery(next)
          return next
        })
      })
      .catch(() => undefined)
  }, [user])

  const setMastery = useCallback(
    (sourceId: string, value: number) => {
      setMasteryMap((current) => {
        const next = { ...current }
        if (value) next[sourceId] = value
        else delete next[sourceId]
        persistMastery(next)
        if (user) saveRemoteNote({ sourceId, mastery: value }).catch(() => undefined)
        return next
      })
    },
    [user],
  )

  return { masteryMap, setMastery }
}
