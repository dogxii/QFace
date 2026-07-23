export interface Env {
  DB: D1Database
  GITHUB_CLIENT_ID: string
  GITHUB_CLIENT_SECRET: string
  COOKIE_SECRET: string
  SITE_URL?: string
}

export interface AuthUser {
  id: string
  githubId: number
  login: string
  name: string | null
  avatarUrl: string | null
  htmlUrl: string | null
  role: 'user' | 'moderator' | 'admin'
}

export interface AuthContext {
  user: AuthUser
  sessionId: string
}
