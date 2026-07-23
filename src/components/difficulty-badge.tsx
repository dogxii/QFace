import type { QuestionDifficulty } from '@/types/question'

const labels: Record<QuestionDifficulty, string> = {
  1: '初级',
  2: '中级',
  3: '高级',
}

export function DifficultyBadge({ difficulty }: { difficulty: QuestionDifficulty }) {
  return (
    <span className={`difficulty difficulty--${difficulty}`}>
      <span aria-hidden="true" />
      {labels[difficulty]}
    </span>
  )
}
