import type { ReactNode } from 'react'
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { apiGet, apiSend } from '@/lib/community-api'
import type { SessionStats, SessionUser } from '@/types/community'

interface SessionPayload {
  user: SessionUser | null
  stats: SessionStats
}

interface SessionContextValue extends SessionPayload {
  loading: boolean
  refresh: () => Promise<void>
  logout: () => Promise<void>
}

const emptyStats: SessionStats = {
  noteCount: 0,
  commentCount: 0,
}

const SessionContext = createContext<SessionContextValue | undefined>(undefined)

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null)
  const [stats, setStats] = useState<SessionStats>(emptyStats)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const payload = await apiGet<SessionPayload>('/api/session')
      setUser(payload.user)
      setStats(payload.stats)
    } catch {
      setUser(null)
      setStats(emptyStats)
    } finally {
      setLoading(false)
    }
  }, [])

  const logout = useCallback(async () => {
    await apiSend('/api/auth/logout', 'POST')
    setUser(null)
    setStats(emptyStats)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const value = useMemo(
    () => ({ user, stats, loading, refresh, logout }),
    [user, stats, loading, refresh, logout],
  )

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession() {
  const value = useContext(SessionContext)
  if (!value) throw new Error('useSession must be used inside SessionProvider')

  return value
}
