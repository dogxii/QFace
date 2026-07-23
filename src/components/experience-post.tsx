import { Link } from '@tanstack/react-router'
import { ArrowDown, ArrowUp, CircleHelp, Edit3, MessageCircle, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import {
  CollapsibleCommentContent,
  CommentAuthor,
  CommentAvatar,
  CommentTime,
} from '@/components/community-comments'
import { ExperienceReplies } from '@/components/experience-replies'
import { githubLoginUrl } from '@/lib/community-api'
import { useExperienceQuestionPanel } from '@/lib/experience-question-panel-state'
import { getExperience, voteExperience } from '@/lib/experiences-api'
import { useSession } from '@/lib/session'
import type { Experience, ExperienceQuestionLink } from '@/types/experience'

function formatInterviewDate(value: string) {
  const date = new Date(`${value}T00:00:00`)
  if (!value || Number.isNaN(date.getTime())) return ''

  const monthDay = `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  if (date.getFullYear() === new Date().getFullYear()) return monthDay
  return `${date.getFullYear()}-${monthDay}`
}

function ExperienceVoteButtons({
  experience,
  onVoted,
}: {
  experience: Experience
  onVoted: (experience: Experience) => void
}) {
  const { user } = useSession()

  const vote = async (value: -1 | 1) => {
    if (!user) {
      window.location.href = githubLoginUrl()
      return
    }

    const nextValue = experience.viewerVote === value ? 0 : value
    const payload = await voteExperience(experience.id, nextValue)
    if (payload.experience) onVoted(payload.experience)
  }

  return (
    <>
      <button
        className="comment-vote"
        type="button"
        data-active={experience.viewerVote === 1 ? 'true' : undefined}
        onClick={() => vote(1)}
        aria-label="顶贴"
        title="顶贴"
      >
        <ArrowUp size={14} aria-hidden="true" />
        <span>{experience.upvotes}</span>
      </button>
      <button
        className="comment-vote comment-vote--down"
        type="button"
        data-active={experience.viewerVote === -1 ? 'true' : undefined}
        onClick={() => vote(-1)}
        aria-label="踩贴"
        title="踩贴"
      >
        <ArrowDown size={14} aria-hidden="true" />
      </button>
    </>
  )
}

export function ExperiencePost({
  experience,
  onVoted,
  onDelete,
}: {
  experience: Experience
  onVoted: (experience: Experience) => void
  onDelete?: () => void | Promise<void>
}) {
  const { activeExperienceId, togglePanel } = useExperienceQuestionPanel()
  const [questionLinks, setQuestionLinks] = useState<ExperienceQuestionLink[]>(experience.links)
  const [questionsLoading, setQuestionsLoading] = useState(false)
  const [repliesOpen, setRepliesOpen] = useState(false)
  const questionPanelOpen = activeExperienceId === experience.id

  useEffect(() => {
    if (experience.links.length) setQuestionLinks(experience.links)
  }, [experience.links])

  const openQuestions = async () => {
    if (questionLinks.length || !experience.linkCount) {
      togglePanel({
        experienceId: experience.id,
        title: experience.title,
        links: questionLinks,
      })
      return
    }

    setQuestionsLoading(true)
    try {
      const payload = await getExperience(experience.id)
      if (payload.experience) {
        setQuestionLinks(payload.experience.links)
        onVoted(payload.experience)
        togglePanel({
          experienceId: payload.experience.id,
          title: payload.experience.title,
          links: payload.experience.links,
        })
      }
    } finally {
      setQuestionsLoading(false)
    }
  }

  const updateReplyCount = (replyCount: number) => {
    if (experience.replyCount !== replyCount) {
      onVoted({ ...experience, replyCount })
    }
  }

  return (
    <article className="comment-item experience-post">
      <CommentAvatar user={experience.user} />

      <div className="comment-item__main">
        <div className="comment-item__meta">
          <CommentAuthor user={experience.user} />
          <CommentTime createdAt={experience.createdAt} updatedAt={experience.updatedAt} />
          {experience.interviewDate ? (
            <span className="experience-post__date">
              面试 {formatInterviewDate(experience.interviewDate)}
            </span>
          ) : null}
          <span className="comment-kind-label">#面经</span>
        </div>

        <h2 className="experience-post__title">{experience.title}</h2>

        <CollapsibleCommentContent content={experience.content} className="experience-content" />

        <div className="comment-actions experience-post__actions">
          <ExperienceVoteButtons experience={experience} onVoted={onVoted} />

          {experience.linkCount ? (
            <button
              className="experience-post__action-link"
              type="button"
              onClick={openQuestions}
              aria-expanded={questionPanelOpen}
              aria-label={questionPanelOpen ? '收起关联题目' : '查看关联题目'}
              title={
                questionsLoading ? '加载中' : questionPanelOpen ? '收起关联题目' : '查看关联题目'
              }
              disabled={questionsLoading}
            >
              <CircleHelp size={14} aria-hidden="true" />
            </button>
          ) : null}

          <button
            className="experience-post__action-link"
            type="button"
            onClick={() => setRepliesOpen((current) => !current)}
            aria-expanded={repliesOpen}
            aria-label={repliesOpen ? '收起回复' : '查看回复'}
            title={repliesOpen ? '收起回复' : '查看回复'}
          >
            <MessageCircle size={14} aria-hidden="true" />
            <span>{experience.replyCount}</span>
          </button>

          {experience.canEdit ? (
            <>
              <Link
                className="experience-post__action-link"
                to="/experiences/$experienceId/edit"
                params={{ experienceId: experience.id }}
              >
                <Edit3 size={14} aria-hidden="true" />
                <span>编辑</span>
              </Link>
              {onDelete ? (
                <button
                  className="comment-delete-button"
                  type="button"
                  onClick={onDelete}
                  aria-label="删除面经"
                  title="删除面经"
                >
                  <Trash2 size={14} aria-hidden="true" />
                </button>
              ) : null}
            </>
          ) : null}
        </div>

        {repliesOpen ? (
          <div className="experience-post__inline">
            <ExperienceReplies experienceId={experience.id} onCountChange={updateReplyCount} />
          </div>
        ) : null}
      </div>
    </article>
  )
}
