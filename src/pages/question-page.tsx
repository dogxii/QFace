import { Link } from '@tanstack/react-router'
import { ChevronRight } from 'lucide-react'
import { useEffect } from 'react'
import { BookmarkButton } from '@/components/bookmark-button'
import { CommunityComments } from '@/components/community-comments'
import { DifficultyBadge } from '@/components/difficulty-badge'
import { MasteryStars } from '@/components/progress'
import { QuestionModuleDrawer, QuestionStepNav } from '@/components/question-module-navigator'
import { ShareButton } from '@/components/share-button'
import { useMastery } from '@/lib/mastery'
import { allQuestions, getQuestion } from '@/lib/questions'
import { questionRoute } from '@/router'

export function QuestionPage() {
  const { sourceId } = questionRoute.useParams()
  const question = getQuestion(sourceId)
  const { masteryMap, setMastery } = useMastery()

  useEffect(() => {
    document.title = question ? `${question.title} · QFace` : '问题不存在 · QFace'
  }, [question])

  if (!question) {
    return (
      <main className="page-shell centered-page">
        <p className="error-code">404</p>
        <h1>问题不存在</h1>
        <Link className="text-link" to="/">
          返回题库
        </Link>
      </main>
    )
  }

  const moduleQuestions = allQuestions.filter(
    (item) => item.category === question.category && item.module === question.module,
  )
  const currentIndex = Math.max(
    0,
    moduleQuestions.findIndex((item) => item.sourceId === question.sourceId),
  )
  const previousQuestion = currentIndex > 0 ? moduleQuestions[currentIndex - 1] : undefined
  const nextQuestion =
    currentIndex < moduleQuestions.length - 1 ? moduleQuestions[currentIndex + 1] : undefined
  const drawerQuestions = moduleQuestions.map((item) => ({
    sourceId: item.sourceId,
    title: item.title,
  }))

  return (
    <main className="page-shell question-page">
      <nav className="question-breadcrumb" aria-label="当前位置">
        <Link to="/">题库</Link>
        <ChevronRight size={10} aria-hidden="true" />
        <QuestionModuleDrawer
          module={question.module}
          questions={drawerQuestions}
          currentSourceId={question.sourceId}
        />
        <ChevronRight size={10} aria-hidden="true" />
        <span>{question.title}</span>
      </nav>

      <div className="question-main">
        <article className="question-card">
          <div className="question-card__actions">
            <BookmarkButton sourceId={question.sourceId} />
            <ShareButton title={question.title} />
          </div>
          <h1>{question.title}</h1>
          <div className="question-card__meta">
            <DifficultyBadge difficulty={question.difficulty} />
            {question.tags.slice(0, 6).map((tag) => (
              <span className="tag" key={tag}>
                #{tag}
              </span>
            ))}
            <MasteryStars
              sourceId={question.sourceId}
              value={masteryMap[question.sourceId] ?? 0}
              onChange={setMastery}
            />
          </div>
        </article>

        <CommunityComments sourceId={question.sourceId} />

        <QuestionStepNav
          previous={
            previousQuestion
              ? { sourceId: previousQuestion.sourceId, title: previousQuestion.title }
              : undefined
          }
          next={
            nextQuestion
              ? { sourceId: nextQuestion.sourceId, title: nextQuestion.title }
              : undefined
          }
          listSearch={{ category: question.category, module: question.module }}
        />
      </div>
    </main>
  )
}
