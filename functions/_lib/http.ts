export function json(data: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers)
  headers.set('content-type', 'application/json; charset=utf-8')

  return new Response(JSON.stringify(data), {
    ...init,
    headers,
  })
}

export function error(message: string, status = 400) {
  return json({ error: message }, { status })
}

export async function readJson<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T
  } catch {
    throw new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'content-type': 'application/json; charset=utf-8' },
    })
  }
}

export function assertSameOrigin(request: Request) {
  const origin = request.headers.get('origin')
  if (!origin) return

  const requestUrl = new URL(request.url)
  if (new URL(origin).host !== requestUrl.host) {
    throw new Response(JSON.stringify({ error: 'Invalid request origin' }), {
      status: 403,
      headers: { 'content-type': 'application/json; charset=utf-8' },
    })
  }
}

export function getSiteOrigin(request: Request, siteUrl?: string) {
  if (siteUrl) return siteUrl.replace(/\/$/, '')

  const url = new URL(request.url)
  return url.origin
}

export function getRedirectPath(request: Request) {
  const url = new URL(request.url)
  const redirect = url.searchParams.get('redirect')

  if (!redirect?.startsWith('/') || redirect.startsWith('//')) return '/'

  return redirect
}

export function noStore(response: Response) {
  response.headers.set('cache-control', 'no-store')
  return response
}
