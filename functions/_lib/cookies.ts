export function parseCookies(request: Request) {
  const cookies: Record<string, string> = {}
  const header = request.headers.get('cookie')
  if (!header) return cookies

  for (const part of header.split(';')) {
    const [rawName, ...rawValue] = part.trim().split('=')
    if (!rawName) continue
    cookies[rawName] = decodeURIComponent(rawValue.join('='))
  }

  return cookies
}

export interface CookieOptions {
  httpOnly?: boolean
  secure?: boolean
  sameSite?: 'Lax' | 'Strict' | 'None'
  path?: string
  maxAge?: number
  expires?: Date
}

export function serializeCookie(name: string, value: string, options: CookieOptions = {}) {
  const segments = [`${name}=${encodeURIComponent(value)}`]

  if (options.maxAge !== undefined) segments.push(`Max-Age=${Math.floor(options.maxAge)}`)
  if (options.expires) segments.push(`Expires=${options.expires.toUTCString()}`)
  segments.push(`Path=${options.path ?? '/'}`)
  if (options.httpOnly) segments.push('HttpOnly')
  if (options.secure !== false) segments.push('Secure')
  segments.push(`SameSite=${options.sameSite ?? 'Lax'}`)

  return segments.join('; ')
}

export function clearCookie(name: string) {
  return serializeCookie(name, '', {
    httpOnly: true,
    maxAge: 0,
    path: '/',
    sameSite: 'Lax',
  })
}

export function isSecureRequest(request: Request) {
  return new URL(request.url).protocol === 'https:'
}
