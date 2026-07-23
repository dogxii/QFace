import { oauthRedirectCookieName, oauthStateCookieName } from '../../../_lib/auth'
import { isSecureRequest, serializeCookie } from '../../../_lib/cookies'
import { randomToken, signValue } from '../../../_lib/crypto'
import { getRedirectPath, getSiteOrigin } from '../../../_lib/http'
import type { Env } from '../../../_lib/types'

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  if (!env.GITHUB_CLIENT_ID) {
    return new Response('Missing GITHUB_CLIENT_ID', { status: 500 })
  }

  const origin = getSiteOrigin(request, env.SITE_URL)
  const redirectPath = getRedirectPath(request)
  const state = randomToken(24)
  const signedState = await signValue(state, env.COOKIE_SECRET)
  const url = new URL('https://github.com/login/oauth/authorize')

  url.searchParams.set('client_id', env.GITHUB_CLIENT_ID)
  url.searchParams.set('redirect_uri', `${origin}/api/auth/github/callback`)
  url.searchParams.set('scope', 'read:user')
  url.searchParams.set('state', state)

  const headers = new Headers({ location: url.toString() })
  headers.append(
    'set-cookie',
    serializeCookie(oauthStateCookieName, signedState, {
      httpOnly: true,
      maxAge: 60 * 10,
      path: '/',
      sameSite: 'Lax',
      secure: isSecureRequest(request),
    }),
  )
  headers.append(
    'set-cookie',
    serializeCookie(oauthRedirectCookieName, redirectPath, {
      httpOnly: true,
      maxAge: 60 * 10,
      path: '/',
      sameSite: 'Lax',
      secure: isSecureRequest(request),
    }),
  )

  return new Response(null, {
    status: 302,
    headers,
  })
}
