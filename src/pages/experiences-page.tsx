import { Link, useNavigate } from '@tanstack/react-router'
import { PencilLine, Search, UserRound } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { ExperiencePost } from '@/components/experience-post'
import { githubLoginUrl } from '@/lib/community-api'
import { deleteExperience, getExperiences } from '@/lib/experiences-api'
import { useSession } from '@/lib/session'
import { experiencesRoute } from '@/router'
import type { Experience, ExperienceSort } from '@/types/experience'

export interface ExperiencesSearch {
  q?: string
  mine?: boolean
  sort?: ExperienceSort
}

function cleanSearch(search: ExperiencesSearch) {
  return {
    q: search.q?.trim() ?? '',
    mine: Boolean(search.mine),
    sort: search.sort === 'hot' ? 'hot' : ('latest' as ExperienceSort),
  }
}

function toRouterSearch(search: ReturnType<typeof cleanSearch>): ExperiencesSearch {
  return {
    ...(search.q ? { q: search.q } : {}),
    ...(search.mine ? { mine: true } : {}),
    ...(search.sort === 'hot' ? { sort: 'hot' as const } : {}),
  }
}

export function ExperiencesPage() {
  const routeSearch = experiencesRoute.useSearch()
  const navigate = useNavigate({ from: '/experiences' })
  const { user, loading: sessionLoading } = useSession()
  const clean = cleanSearch(routeSearch)
  const [experiences, setExperiences] = useState<Experience[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    document.title = '面经 · QFace'
  }, [])

  useEffect(() => {
    if (clean.mine && !user && !sessionLoading && !import.meta.env.DEV) {
      window.location.href = githubLoginUrl('/experiences?mine=1')
      return
    }

    if (clean.mine && !user && !import.meta.env.DEV) return

    setLoading(true)
    setError('')
    getExperiences({ query: clean.q, mine: clean.mine, sort: clean.sort })
      .then((payload) => setExperiences(payload.experiences))
      .catch((caught) => setError(caught instanceof Error ? caught.message : '面经加载失败'))
      .finally(() => setLoading(false))
  }, [clean.mine, clean.q, clean.sort, sessionLoading, user])

  const countText = useMemo(() => `${experiences.length} 篇`, [experiences.length])
  const updateSearch = (next: Partial<ReturnType<typeof cleanSearch>>) => {
    navigate({ search: toRouterSearch({ ...clean, ...next }), replace: true })
  }
  const replaceExperience = (nextExperience: Experience) => {
    setExperiences((current) =>
      current.map((experience) =>
        experience.id === nextExperience.id ? nextExperience : experience,
      ),
    )
  }
  const removeExperience = async (experience: Experience) => {
    if (!window.confirm('删除这篇面经？')) return
    await deleteExperience(experience.id)
    setExperiences((current) => current.filter((item) => item.id !== experience.id))
  }
  const toggleMine = () => {
    if (!user && !import.meta.env.DEV) {
      window.location.href = githubLoginUrl('/experiences?mine=1')
      return
    }

    updateSearch({ mine: !clean.mine })
  }

  return (
    <main className="page-shell experiences-page">
      <section className="experiences-head" aria-labelledby="experiences-heading">
        <div className="experiences-head__summary">
          <h1 id="experiences-heading">面经</h1>
          <span>{countText}</span>
        </div>
        <div className="experiences-head__actions">
          <button
            className="experience-write-link"
            type="button"
            data-active={clean.mine ? 'true' : undefined}
            onClick={toggleMine}
          >
            <UserRound size={14} aria-hidden="true" />
            我的
          </button>
          <Link className="experience-write-link" to="/experiences/new">
            <PencilLine size={14} aria-hidden="true" />
            写面经
          </Link>
        </div>
      </section>

      <div className="experience-toolbar">
        <div className="experience-search">
          <Search size={15} aria-hidden="true" />
          <input
            type="search"
            value={clean.q}
            onChange={(event) => updateSearch({ q: event.currentTarget.value })}
            placeholder="搜索面经"
            aria-label="搜索面经"
          />
        </div>
        <fieldset className="community-sort experience-sort" aria-label="面经排序">
          <button
            type="button"
            data-active={clean.sort === 'latest' ? 'true' : undefined}
            onClick={() => updateSearch({ sort: 'latest' })}
          >
            最新
          </button>
          <button
            type="button"
            data-active={clean.sort === 'hot' ? 'true' : undefined}
            onClick={() => updateSearch({ sort: 'hot' })}
          >
            热度
          </button>
        </fieldset>
      </div>

      {error ? <div className="community-message">{error}</div> : null}
      {loading ? <div className="community-message">加载中</div> : null}

      {!loading ? (
        <section className="experience-list" aria-label="面经列表">
          {experiences.length ? (
            experiences.map((experience) => (
              <ExperiencePost
                experience={experience}
                onVoted={replaceExperience}
                onDelete={() => removeExperience(experience)}
                key={experience.id}
              />
            ))
          ) : (
            <div className="empty-list">
              <strong>还没有面经</strong>
            </div>
          )}
        </section>
      ) : null}
    </main>
  )
}
