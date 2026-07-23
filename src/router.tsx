import { createRootRoute, createRoute, createRouter, Outlet } from '@tanstack/react-router'
import { SiteHeader } from '@/components/site-header'
import { HomePage, type HomeSearch } from '@/pages/home-page'
import { NotesPage } from '@/pages/notes-page'
import { QuestionPage } from '@/pages/question-page'

function parseString(value: unknown) {
  return typeof value === 'string' ? value.trim() : undefined
}

function parseDifficulty(value: unknown) {
  const difficulty = Number(value)
  return [1, 2, 3].includes(difficulty) ? (difficulty as 1 | 2 | 3) : undefined
}

function parsePage(value: unknown) {
  const page = Number(value)
  return Number.isInteger(page) && page > 0 ? page : 1
}

function parseHomeSearch(search: Record<string, unknown>): HomeSearch {
  const next: HomeSearch = {}
  const q = parseString(search.q)
  const category = parseString(search.category)
  const module = parseString(search.module)
  const difficulty = parseDifficulty(search.difficulty)
  const sort = parseString(search.sort)
  const page = parsePage(search.page)

  if (q) next.q = q
  if (category) next.category = category
  if (module) next.module = module
  if (difficulty) next.difficulty = difficulty
  if (sort && sort !== 'default') next.sort = sort
  if (page > 1) next.page = page
  if (search.resetFilters === '1' || search.resetFilters === true) next.resetFilters = true
  if (search.remember === '1' || search.remember === true) next.remember = true

  return next
}

const rootRoute = createRootRoute({
  component: () => (
    <>
      <SiteHeader />
      <Outlet />
    </>
  ),
})

export const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  validateSearch: parseHomeSearch,
  component: HomePage,
})

export const questionRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/q/$sourceId',
  component: QuestionPage,
})

export const notesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/notes',
  component: NotesPage,
})

const routeTree = rootRoute.addChildren([homeRoute, questionRoute, notesRoute])

export const router = createRouter({
  routeTree,
  scrollRestoration: true,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
