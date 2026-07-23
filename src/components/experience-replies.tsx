import { useCallback, useEffect, useId, useMemo, useState } from 'react'
import {
  buildTree,
  CommentComposer,
  CommentItem,
  type CommentSort,
  sortRootComments,
} from '@/components/community-comments'
import { getComments } from '@/lib/community-api'
import { useSession } from '@/lib/session'
import type { CommunityComment } from '@/types/community'

const sortOptions: Array<{ value: CommentSort; label: string }> = [
  { value: 'hot', label: '热度' },
  { value: 'latest', label: '最新' },
]

export function experienceReplySourceId(experienceId: string) {
  return `exp-${experienceId}`
}

export function ExperienceReplies({
  experienceId,
  onCountChange,
}: {
  experienceId: string
  onCountChange?: (count: number) => void
}) {
  const { refresh } = useSession()
  const headingId = useId()
  const sourceId = experienceReplySourceId(experienceId)
  const [comments, setComments] = useState<CommunityComment[]>([])
  const [sort, setSort] = useState<CommentSort>('hot')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadReplies = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const payload = await getComments(sourceId)
      setComments(payload.comments)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '回复加载失败')
    } finally {
      setLoading(false)
    }
  }, [sourceId])

  useEffect(() => {
    loadReplies()
  }, [loadReplies])

  const { roots, replies } = useMemo(() => buildTree(comments), [comments])
  const sortedRoots = useMemo(() => sortRootComments(roots, replies, sort), [replies, roots, sort])
  const replyCount = comments.length

  useEffect(() => {
    onCountChange?.(replyCount)
  }, [onCountChange, replyCount])

  const replaceComment = (nextComment: CommunityComment) => {
    setComments((current) =>
      current.map((comment) => (comment.id === nextComment.id ? nextComment : comment)),
    )
  }

  const removeComment = (commentId: string) => {
    setComments((current) => current.filter((comment) => comment.id !== commentId))
  }

  return (
    <section className="experience-replies" aria-labelledby={headingId}>
      <div className="community-list-toolbar experience-replies__toolbar">
        <h2 id={headingId}>{replyCount} 回复</h2>
        <fieldset className="community-sort" aria-label="回复排序">
          {sortOptions.map((item) => (
            <button
              type="button"
              data-active={sort === item.value ? 'true' : undefined}
              onClick={() => setSort(item.value)}
              key={item.value}
            >
              {item.label}
            </button>
          ))}
        </fieldset>
      </div>

      <CommentComposer
        sourceId={sourceId}
        kind="discussion"
        placeholder="写回复"
        showCount={false}
        submitLabel="回复"
        onCreated={async (comment) => {
          setComments((current) => [...current, comment])
          await refresh()
        }}
      />

      {error ? <div className="community-message">{error}</div> : null}
      {loading ? <div className="community-message">加载中</div> : null}

      {!loading && !sortedRoots.length ? (
        <div className="community-empty">
          <span>暂无回复</span>
        </div>
      ) : null}

      <div className="comment-list">
        {sortedRoots.map((comment) => (
          <CommentItem
            comment={comment}
            replies={replies.get(comment.id) ?? []}
            sourceId={sourceId}
            showKindLabel={false}
            onCreated={async (reply) => {
              setComments((current) => [...current, reply])
              await refresh()
            }}
            onUpdated={replaceComment}
            onDeleted={removeComment}
            key={comment.id}
          />
        ))}
      </div>
    </section>
  )
}
