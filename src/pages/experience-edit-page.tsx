import { Link, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import {
  ExperienceEditor,
  type ExperienceEditorValue,
  emptyExperienceEditorValue,
  toExperienceInput,
} from '@/components/experience-editor'
import { githubLoginUrl } from '@/lib/community-api'
import {
  clearExperienceDraft,
  editExperienceDraftKey,
  newExperienceDraftKey,
  readExperienceDraft,
  sameExperienceDraftValue,
  selectExperienceDraftValue,
  writeExperienceDraft,
} from '@/lib/experience-drafts'
import { createExperience, getExperience, updateExperience } from '@/lib/experiences-api'
import { useSession } from '@/lib/session'
import { experienceEditRoute } from '@/router'
import type { Experience } from '@/types/experience'

function toEditorValue(experience: Experience): ExperienceEditorValue {
  return {
    title: experience.title,
    interviewDate: experience.interviewDate,
    content: experience.content,
  }
}

export function NewExperiencePage() {
  const navigate = useNavigate()
  const { user } = useSession()
  const [value, setValue] = useState<ExperienceEditorValue>(
    () => readExperienceDraft(newExperienceDraftKey)?.value ?? emptyExperienceEditorValue,
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const canWrite = Boolean(user || import.meta.env.DEV)

  useEffect(() => {
    document.title = '写面经 · QFace'
  }, [])

  useEffect(() => {
    writeExperienceDraft(newExperienceDraftKey, value)
  }, [value])

  const submit = async () => {
    if (!canWrite) {
      window.location.href = githubLoginUrl()
      return
    }

    setSaving(true)
    setError('')
    try {
      const payload = await createExperience(toExperienceInput(value))
      if (payload.experience) {
        clearExperienceDraft(newExperienceDraftKey)
        navigate({ to: '/experiences' })
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="page-shell experience-edit-page">
      <section className="experiences-head" aria-labelledby="new-experience-heading">
        <div>
          <h1 id="new-experience-heading">写面经</h1>
        </div>
      </section>

      {!canWrite ? (
        <div className="comment-login">
          <a href={githubLoginUrl()}>登录后发布</a>
        </div>
      ) : null}
      {error ? <div className="community-message">{error}</div> : null}

      <ExperienceEditor
        value={value}
        onChange={setValue}
        onSubmit={submit}
        submitLabel="发布"
        saving={saving}
      />
    </main>
  )
}

export function EditExperiencePage() {
  const { experienceId } = experienceEditRoute.useParams()
  const navigate = useNavigate()
  const [value, setValue] = useState<ExperienceEditorValue>(emptyExperienceEditorValue)
  const [baseValue, setBaseValue] = useState<ExperienceEditorValue | null>(null)
  const [baseUpdatedAt, setBaseUpdatedAt] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const draftKey = editExperienceDraftKey(experienceId)

    setLoading(true)
    setError('')
    setBaseValue(null)
    getExperience(experienceId)
      .then((payload) => {
        if (!payload.experience) {
          setError('面经不存在')
          return
        }
        if (!payload.experience.canEdit) {
          setError('没有编辑权限')
          return
        }

        const serverValue = toEditorValue(payload.experience)
        setBaseValue(serverValue)
        setBaseUpdatedAt(payload.experience.updatedAt)
        setValue(
          selectExperienceDraftValue(
            serverValue,
            payload.experience.updatedAt,
            readExperienceDraft(draftKey),
          ),
        )
        document.title = `编辑 ${payload.experience.title} · QFace`
      })
      .catch((caught) => setError(caught instanceof Error ? caught.message : '面经加载失败'))
      .finally(() => setLoading(false))
  }, [experienceId])

  useEffect(() => {
    if (loading || !baseValue) return

    const draftKey = editExperienceDraftKey(experienceId)
    if (sameExperienceDraftValue(value, baseValue)) {
      clearExperienceDraft(draftKey)
      return
    }

    writeExperienceDraft(draftKey, value, { baseUpdatedAt })
  }, [baseUpdatedAt, baseValue, experienceId, loading, value])

  const submit = async () => {
    setSaving(true)
    setError('')
    try {
      const payload = await updateExperience(experienceId, toExperienceInput(value))
      if (payload.experience) {
        clearExperienceDraft(editExperienceDraftKey(experienceId))
        navigate({ to: '/experiences' })
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <main className="page-shell experience-edit-page">
        <div className="community-message">加载中</div>
      </main>
    )
  }

  if (error && !value.content) {
    return (
      <main className="page-shell centered-page">
        <p className="error-code">403</p>
        <h1>{error}</h1>
        <Link className="text-link" to="/experiences">
          返回面经
        </Link>
      </main>
    )
  }

  return (
    <main className="page-shell experience-edit-page">
      <section className="experiences-head" aria-labelledby="edit-experience-heading">
        <div>
          <h1 id="edit-experience-heading">编辑面经</h1>
        </div>
      </section>
      {error ? <div className="community-message">{error}</div> : null}
      <ExperienceEditor
        value={value}
        onChange={setValue}
        onSubmit={submit}
        submitLabel="保存"
        saving={saving}
      />
    </main>
  )
}
