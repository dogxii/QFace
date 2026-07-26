import { Link, useNavigate } from '@tanstack/react-router'
import { ArrowDown, ArrowUp, Search, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { DifficultyBadge } from '@/components/difficulty-badge'
import { Pagination } from '@/components/pagination'
import { MasteryStars } from '@/components/progress'
import { getQuestionStats, type QuestionStatsMap } from '@/lib/community-api'
import { notesChangedEvent, readLocalNotes } from '@/lib/local-notes'
import { type MasteryMap, useMastery } from '@/lib/mastery'
import { filterQuestions, getModules, questionCatalog } from '@/lib/questions'
import { homeRoute } from '@/router'
import type { Question } from '@/types/question'
import { categories, type QuestionDifficulty } from '@/types/question'

type SortField = 'difficulty' | 'discussion' | 'mastery'
type QuestionSort =
  | 'default'
  | 'difficulty'
  | '-difficulty'
  | 'discussion'
  | '-discussion'
  | 'mastery'
  | '-mastery'

export interface HomeSearch {
  q?: string
  category?: string
  module?: string
  difficulty?: QuestionDifficulty
  sort?: string
  page?: number
  resetFilters?: boolean
  remember?: boolean
}

const pageSize = 24
const memoryKey = 'qface:home-filter:v3'

const difficultyLabels: Record<QuestionDifficulty, string> = {
  1: '初级',
  2: '中级',
  3: '高级',
}

const sortLabels: Record<SortField, string> = {
  difficulty: '难度',
  discussion: '讨论',
  mastery: '掌握',
}

function normalizedSort(sort: string): QuestionSort {
  if (
    ['difficulty', '-difficulty', 'discussion', '-discussion', 'mastery', '-mastery'].includes(sort)
  ) {
    return sort as QuestionSort
  }
  return 'default'
}

function getSortField(sort: QuestionSort) {
  if (sort === 'default') return undefined
  return sort.replace('-', '') as SortField
}

function nextSortFor(field: SortField, current: QuestionSort): QuestionSort {
  const currentField = getSortField(current)
  if (currentField !== field)
    return field === 'difficulty' ? 'difficulty' : (`-${field}` as QuestionSort)
  return current.startsWith('-') ? field : (`-${field}` as QuestionSort)
}

function sortLabel(sort: QuestionSort) {
  const field = getSortField(sort)
  if (!field) return ''
  return `${sortLabels[field]} ${sort.startsWith('-') ? '↓' : '↑'}`
}

function sortQuestions(
  questions: Question[],
  sort: QuestionSort,
  masteryMap: MasteryMap,
  questionStats: QuestionStatsMap,
) {
  if (sort === 'default') return questions

  const order = new Map(questions.map((question, index) => [question.sourceId, index]))
  const descending = sort.startsWith('-')
  const field = getSortField(sort)

  return [...questions].sort((left, right) => {
    let value = 0
    if (field === 'difficulty') value = left.difficulty - right.difficulty
    if (field === 'discussion')
      value =
        (questionStats[left.sourceId]?.commentCount ?? 0) -
        (questionStats[right.sourceId]?.commentCount ?? 0)
    if (field === 'mastery')
      value = (masteryMap[left.sourceId] ?? 0) - (masteryMap[right.sourceId] ?? 0)
    if (value !== 0) return descending ? -value : value
    return (order.get(left.sourceId) ?? 0) - (order.get(right.sourceId) ?? 0)
  })
}

function cleanSearch(search: Partial<HomeSearch>) {
  const category = categories.includes(search.category as (typeof categories)[number])
    ? search.category
    : undefined
  const modules = getModules(category)
  const module = search.module && modules.includes(search.module) ? search.module : undefined
  const sort = normalizedSort(search.sort ?? 'default')

  return {
    q: search.q?.trim() ?? '',
    category,
    module,
    difficulty: search.difficulty,
    sort,
    page: search.page && search.page > 0 ? search.page : 1,
  }
}

function hasUsefulCleanSearch(search: ReturnType<typeof cleanSearch>) {
  return Boolean(
    search.q ||
      search.category ||
      search.module ||
      search.difficulty ||
      search.sort !== 'default' ||
      search.page > 1,
  )
}

function toCache(search: ReturnType<typeof cleanSearch>) {
  const params = new URLSearchParams()
  if (search.q) params.set('q', search.q)
  if (search.category) params.set('category', search.category)
  if (search.module) params.set('module', search.module)
  if (search.difficulty) params.set('difficulty', String(search.difficulty))
  if (search.sort !== 'default') params.set('sort', search.sort)
  if (search.page > 1) params.set('page', String(search.page))
  return params.toString()
}

function toRouterSearch(search: ReturnType<typeof cleanSearch>): HomeSearch {
  return {
    ...(search.q ? { q: search.q } : {}),
    ...(search.category ? { category: search.category } : {}),
    ...(search.module ? { module: search.module } : {}),
    ...(search.difficulty ? { difficulty: search.difficulty } : {}),
    ...(search.sort !== 'default' ? { sort: search.sort } : {}),
    ...(search.page > 1 ? { page: search.page } : {}),
  }
}

function parseCache(value: string) {
  const params = new URLSearchParams(value)
  return cleanSearch({
    q: params.get('q') ?? '',
    category: params.get('category') ?? undefined,
    module: params.get('module') ?? undefined,
    difficulty: Number(params.get('difficulty')) as QuestionDifficulty,
    sort: params.get('sort') ?? 'default',
    page: Number(params.get('page') ?? 1),
  })
}

export function HomePage() {
  const search = homeRoute.useSearch()
  const navigate = useNavigate({ from: '/' })
  const { masteryMap, setMastery } = useMastery()
  const [questionStats, setQuestionStats] = useState<QuestionStatsMap>({})
  const [localNotes, setLocalNotes] = useState(() => readLocalNotes())
  const clean = cleanSearch(search)
  const modules = getModules(clean.category)

  useEffect(() => {
    document.title = '问题 · QFace'
  }, [])

  useEffect(() => {
    const updateLocalNotes = () => setLocalNotes(readLocalNotes())

    window.addEventListener(notesChangedEvent, updateLocalNotes)
    window.addEventListener('storage', updateLocalNotes)

    return () => {
      window.removeEventListener(notesChangedEvent, updateLocalNotes)
      window.removeEventListener('storage', updateLocalNotes)
    }
  }, [])

  useEffect(() => {
    if (search.resetFilters) {
      localStorage.removeItem(memoryKey)
      navigate({ search: {}, replace: true })
      return
    }

    if (hasUsefulCleanSearch(clean)) {
      localStorage.setItem(memoryKey, toCache(clean))
      return
    }

    if (search.remember) {
      navigate({ search: {}, replace: true })
      return
    }

    const cached = localStorage.getItem(memoryKey)
    if (cached) navigate({ search: toRouterSearch(parseCache(cached)), replace: true })
  }, [clean, navigate, search.remember, search.resetFilters])

  const filtered = useMemo(
    () =>
      filterQuestions({
        query: clean.q,
        category: clean.category,
        module: clean.module,
        difficulty: clean.difficulty,
      }),
    [clean.category, clean.difficulty, clean.module, clean.q],
  )
  const sortedQuestions = useMemo(
    () => sortQuestions(filtered, clean.sort, masteryMap, questionStats),
    [clean.sort, filtered, masteryMap, questionStats],
  )
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
  const page = Math.min(clean.page, pageCount)
  const pageQuestions = useMemo(
    () => sortedQuestions.slice((page - 1) * pageSize, page * pageSize),
    [page, sortedQuestions],
  )

  useEffect(() => {
    let cancelled = false

    getQuestionStats()
      .then((payload) => {
        if (!cancelled) setQuestionStats(payload.stats)
      })
      .catch(() => {
        if (!cancelled) setQuestionStats({})
      })

    return () => {
      cancelled = true
    }
  }, [])

  const updateSearch = (changes: Partial<HomeSearch>) => {
    const nextClean = cleanSearch({
      ...clean,
      ...changes,
      page: changes.page ?? 1,
    })

    if (hasUsefulCleanSearch(nextClean)) {
      localStorage.setItem(memoryKey, toCache(nextClean))
    } else {
      localStorage.removeItem(memoryKey)
    }

    navigate({ search: toRouterSearch(nextClean) })
  }

  const activeFilterChips = [
    clean.q
      ? { label: '搜索', value: clean.q, clear: () => updateSearch({ q: '', page: 1 }) }
      : undefined,
    clean.category
      ? {
          label: '岗位',
          value: clean.category,
          clear: () => updateSearch({ category: undefined, module: undefined, page: 1 }),
        }
      : undefined,
    clean.module
      ? {
          label: '模块',
          value: clean.module,
          clear: () => updateSearch({ module: undefined, page: 1 }),
        }
      : undefined,
    clean.difficulty
      ? {
          label: '难度',
          value: difficultyLabels[clean.difficulty],
          clear: () => updateSearch({ difficulty: undefined, page: 1 }),
        }
      : undefined,
    clean.sort !== 'default'
      ? {
          label: '排序',
          value: sortLabel(clean.sort),
          clear: () => updateSearch({ sort: 'default', page: 1 }),
        }
      : undefined,
  ].filter((chip): chip is { label: string; value: string; clear: () => void } => Boolean(chip))

  return (
    <main className="page-shell home-shell">
      <section className="catalog" aria-labelledby="catalog-heading">
        <form
          className="filter-bar"
          onSubmit={(event) => {
            event.preventDefault()
            const form = new FormData(event.currentTarget)
            updateSearch({
              q: String(form.get('q') ?? ''),
              category: String(form.get('category') || '') || undefined,
              module: String(form.get('module') || '') || undefined,
              page: 1,
            })
          }}
        >
          <label className="search-field">
            <Search size={17} aria-hidden="true" />
            <input
              type="search"
              name="q"
              defaultValue={clean.q}
              placeholder="搜索题目、模块、标签"
              aria-label="搜索题目、模块、标签"
            />
          </label>
          <div className="filter-actions">
            <select
              className="filter-select"
              name="category"
              value={clean.category ?? ''}
              onChange={(event) =>
                updateSearch({
                  category: event.currentTarget.value || undefined,
                  module: undefined,
                  page: 1,
                })
              }
              aria-label="岗位"
            >
              <option value="">岗位</option>
              {questionCatalog.categories.map((item) => (
                <option value={item.name} key={item.name}>
                  {item.name}
                </option>
              ))}
            </select>
            <select
              className="filter-select filter-select--module"
              name="module"
              value={clean.module ?? ''}
              onChange={(event) =>
                updateSearch({ module: event.currentTarget.value || undefined, page: 1 })
              }
              aria-label="模块"
            >
              <option value="">模块</option>
              {modules.map((item) => (
                <option value={item} key={item}>
                  {item}
                </option>
              ))}
            </select>
            <Link
              className="filter-reset-button"
              to="/"
              search={{ resetFilters: true }}
              aria-label="重置筛选"
            >
              ↻
            </Link>
          </div>
        </form>

        <div className="active-filter-slot">
          {activeFilterChips.length ? (
            <nav className="active-filter-row" aria-label="当前筛选">
              {activeFilterChips.map((chip) => (
                <button
                  className="active-filter-chip"
                  type="button"
                  onClick={chip.clear}
                  key={chip.label}
                >
                  <span>{chip.label}</span>
                  <strong>{chip.value}</strong>
                  <X size={14} aria-hidden="true" />
                </button>
              ))}
            </nav>
          ) : null}
        </div>

        <div className="catalog-heading">
          <h1 id="catalog-heading">{filtered.length} 道问题</h1>
        </div>

        <div className="question-table">
          <div className="question-table__header">
            <span className="question-table__head question-table__head--title">题目</span>
            <SortHead field="difficulty" label="难度" sort={clean.sort} onSort={updateSearch} />
            <SortHead field="discussion" label="讨论" sort={clean.sort} onSort={updateSearch} />
            <SortHead field="mastery" label="掌握" sort={clean.sort} onSort={updateSearch} />
            <span className="question-table__head question-table__head--action">作答</span>
          </div>

          <div className="question-list">
            {pageQuestions.length ? (
              pageQuestions.map((question, index) => {
                const note = localNotes[question.sourceId]
                const answered = Boolean(note?.answerContent.trim() || note?.explainContent.trim())
                const commentCount = questionStats[question.sourceId]?.commentCount ?? 0

                return (
                  <article className="question-row" key={question.sourceId}>
                    <div className="question-row__index" aria-hidden="true">
                      {String((page - 1) * pageSize + index + 1).padStart(2, '0')}
                    </div>
                    <div className="question-row__content">
                      <Link
                        className="question-row__title"
                        to="/q/$sourceId"
                        params={{ sourceId: question.sourceId }}
                      >
                        {question.title}
                      </Link>
                    </div>
                    <div className="question-row__difficulty">
                      <DifficultyBadge difficulty={question.difficulty} />
                    </div>
                    <Link
                      className="question-discussion-count"
                      to="/q/$sourceId"
                      params={{ sourceId: question.sourceId }}
                      aria-label={`${commentCount} 条讨论`}
                    >
                      {commentCount}
                    </Link>
                    <MasteryStars
                      sourceId={question.sourceId}
                      value={masteryMap[question.sourceId] ?? 0}
                      onChange={setMastery}
                    />
                    <Link
                      className="answer-state"
                      data-answered={answered ? 'true' : undefined}
                      to="/q/$sourceId"
                      params={{ sourceId: question.sourceId }}
                    >
                      {answered ? '已答' : '未答'}
                    </Link>
                  </article>
                )
              })
            ) : (
              <div className="empty-list">
                <strong>没有匹配的问题</strong>
              </div>
            )}
          </div>
        </div>

        <Pagination
          page={page}
          pageCount={pageCount}
          onPageChange={(nextPage) => updateSearch({ page: nextPage })}
        />
      </section>
    </main>
  )
}

function SortHead({
  field,
  label,
  sort,
  onSort,
}: {
  field: SortField
  label: string
  sort: QuestionSort
  onSort: (changes: Partial<HomeSearch>) => void
}) {
  const active = getSortField(sort) === field
  const nextSort = nextSortFor(field, sort)

  return (
    <button
      className="question-table__head question-table__sort"
      type="button"
      onClick={() => onSort({ sort: nextSort, page: 1 })}
      data-active={active ? 'true' : undefined}
      aria-label={`${label}${active ? (sort.startsWith('-') ? '降序' : '升序') : '排序'}`}
    >
      <span>{label}</span>
      {active ? sort.startsWith('-') ? <ArrowDown size={14} /> : <ArrowUp size={14} /> : null}
    </button>
  )
}
