import { clearCookie, parseCookies, serializeCookie } from './cookies'
import { randomToken, sha256 } from './crypto'
import type { AuthContext, AuthUser, Env } from './types'

export const sessionCookieName = 'qface_session'
export const oauthStateCookieName = 'qface_oauth_state'
export const oauthRedirectCookieName = 'qface_oauth_redirect'

const sessionMaxAgeSeconds = 60 * 60 * 24 * 30

interface UserRow {
  id: string
  github_id: number
  login: string
  name: string | null
  avatar_url: string | null
  html_url: string | null
  role: AuthUser['role']
}

function toUser(row: UserRow): AuthUser {
  return {
    id: row.id,
    githubId: row.github_id,
    login: row.login,
    name: row.name,
    avatarUrl: row.avatar_url,
    htmlUrl: row.html_url,
    role: row.role,
  }
}

export async function createSession(env: Env, userId: string, secure = true) {
  const sessionId = crypto.randomUUID()
  const secret = randomToken(32)
  const tokenHash = await sha256(secret)
  const expiresAt = new Date(Date.now() + sessionMaxAgeSeconds * 1000).toISOString()

  await env.DB.prepare(
    `INSERT INTO sessions (id, user_id, token_hash, expires_at)
     VALUES (?, ?, ?, ?)`,
  )
    .bind(sessionId, userId, tokenHash, expiresAt)
    .run()

  return {
    token: `${sessionId}.${secret}`,
    cookie: serializeCookie(sessionCookieName, `${sessionId}.${secret}`, {
      httpOnly: true,
      maxAge: sessionMaxAgeSeconds,
      path: '/',
      sameSite: 'Lax',
      secure,
    }),
  }
}

export async function getAuth(request: Request, env: Env): Promise<AuthContext | undefined> {
  const token = parseCookies(request)[sessionCookieName]
  if (!token) return undefined

  const [sessionId, secret] = token.split('.')
  if (!sessionId || !secret) return undefined

  const tokenHash = await sha256(secret)
  const row = await env.DB.prepare(
    `SELECT
        sessions.id AS session_id,
        users.id,
        users.github_id,
        users.login,
        users.name,
        users.avatar_url,
        users.html_url,
        users.role
      FROM sessions
      JOIN users ON users.id = sessions.user_id
      WHERE sessions.id = ?
        AND sessions.token_hash = ?
        AND sessions.expires_at > ?
        AND users.banned_at IS NULL
      LIMIT 1`,
  )
    .bind(sessionId, tokenHash, new Date().toISOString())
    .first<UserRow & { session_id: string }>()

  if (!row) return undefined

  await env.DB.prepare(
    `UPDATE sessions
     SET last_seen_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
     WHERE id = ?`,
  )
    .bind(sessionId)
    .run()

  return {
    sessionId: row.session_id,
    user: toUser(row),
  }
}

export async function requireAuth(request: Request, env: Env) {
  const auth = await getAuth(request, env)
  if (!auth) {
    throw new Response(JSON.stringify({ error: 'Authentication required' }), {
      status: 401,
      headers: { 'content-type': 'application/json; charset=utf-8' },
    })
  }

  return auth
}

export async function destroySession(request: Request, env: Env) {
  const token = parseCookies(request)[sessionCookieName]
  const sessionId = token?.split('.')[0]

  if (sessionId) {
    await env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(sessionId).run()
  }

  return clearCookie(sessionCookieName)
}

export function canModerate(user: AuthUser) {
  return user.role === 'admin' || user.role === 'moderator'
}
