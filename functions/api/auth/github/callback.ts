import { createSession, oauthRedirectCookieName, oauthStateCookieName } from '../../../_lib/auth'
import { clearCookie, isSecureRequest, parseCookies } from '../../../_lib/cookies'
import { verifySignedValue } from '../../../_lib/crypto'
import { getSiteOrigin } from '../../../_lib/http'
import type { Env } from '../../../_lib/types'

interface GitHubTokenResponse {
  access_token?: string
  error?: string
  error_description?: string
}

interface GitHubUserResponse {
  id: number
  login: string
  name?: string | null
  avatar_url?: string | null
  html_url?: string | null
}

async function exchangeCode(request: Request, env: Env, code: string) {
  const origin = getSiteOrigin(request, env.SITE_URL)
  const response = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      'user-agent': 'QFace',
    },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: `${origin}/api/auth/github/callback`,
    }),
  })

  return response.json<GitHubTokenResponse>()
}

async function fetchGitHubUser(accessToken: string) {
  const response = await fetch('https://api.github.com/user', {
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${accessToken}`,
      'user-agent': 'QFace',
      'x-github-api-version': '2022-11-28',
    },
  })

  if (!response.ok) {
    throw new Response('Failed to fetch GitHub user', { status: 502 })
  }

  return response.json<GitHubUserResponse>()
}

async function upsertUser(env: Env, githubUser: GitHubUserResponse) {
  const existing = await env.DB.prepare('SELECT id FROM users WHERE github_id = ? LIMIT 1')
    .bind(githubUser.id)
    .first<{ id: string }>()

  const userId = existing?.id ?? crypto.randomUUID()

  if (existing) {
    await env.DB.prepare(
      `UPDATE users
       SET login = ?,
           name = ?,
           avatar_url = ?,
           html_url = ?,
           updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
       WHERE id = ?`,
    )
      .bind(
        githubUser.login,
        githubUser.name ?? null,
        githubUser.avatar_url ?? null,
        githubUser.html_url ?? null,
        userId,
      )
      .run()
  } else {
    await env.DB.prepare(
      `INSERT INTO users (id, github_id, login, name, avatar_url, html_url)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        userId,
        githubUser.id,
        githubUser.login,
        githubUser.name ?? null,
        githubUser.avatar_url ?? null,
        githubUser.html_url ?? null,
      )
      .run()
  }

  return userId
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const cookies = parseCookies(request)
  const signedState = cookies[oauthStateCookieName]
  const redirectPath = cookies[oauthRedirectCookieName] || '/'

  if (!code || !state || !signedState) {
    return new Response('Invalid OAuth callback', { status: 400 })
  }

  const verifiedState = await verifySignedValue(signedState, env.COOKIE_SECRET)
  if (verifiedState !== state) {
    return new Response('Invalid OAuth state', { status: 400 })
  }

  const token = await exchangeCode(request, env, code)
  if (!token.access_token) {
    return new Response(token.error_description || token.error || 'GitHub OAuth failed', {
      status: 502,
    })
  }

  const githubUser = await fetchGitHubUser(token.access_token)
  const userId = await upsertUser(env, githubUser)
  const session = await createSession(env, userId, isSecureRequest(request))

  const headers = new Headers({
    location: redirectPath.startsWith('/') && !redirectPath.startsWith('//') ? redirectPath : '/',
  })
  headers.append('set-cookie', session.cookie)
  headers.append('set-cookie', clearCookie(oauthStateCookieName))
  headers.append('set-cookie', clearCookie(oauthRedirectCookieName))

  return new Response(null, {
    status: 302,
    headers,
  })
}
