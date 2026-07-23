import { destroySession, requireAuth } from '../../_lib/auth'
import { assertSameOrigin, json } from '../../_lib/http'
import type { Env } from '../../_lib/types'

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  assertSameOrigin(request)
  await requireAuth(request, env)
  const cookie = await destroySession(request, env)

  return json(
    { ok: true },
    {
      headers: {
        'set-cookie': cookie,
      },
    },
  )
}
