import { json } from './_lib/http'
import type { Env } from './_lib/types'

export const onRequest: PagesFunction<Env> = async ({ next }) => {
  try {
    return await next()
  } catch (caught) {
    if (caught instanceof Response) return caught

    console.error(caught)

    return json({ error: 'Internal server error' }, { status: 500 })
  }
}
