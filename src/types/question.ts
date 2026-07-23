export const categories = ['前端', 'AI Agent', 'Golang', 'Java'] as const

export type QuestionCategory = (typeof categories)[number]
export type QuestionDifficulty = 1 | 2 | 3

export interface Question {
  sourceId: string
  category: QuestionCategory
  module: string
  difficulty: QuestionDifficulty
  title: string
  tags: string[]
  source?: string
  contentHash: string
}

export interface QuestionCatalog {
  source: 'iface'
  sourceVersion: string
  count: number
  categories: Array<{ name: QuestionCategory; count: number }>
  questions: Question[]
}
