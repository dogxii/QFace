import { describe, expect, it } from 'vitest'
import { allQuestions, filterQuestions, getQuestion, questionCatalog } from './questions'

describe('generated iFace catalog', () => {
  it('contains the expected unique question set', () => {
    expect(questionCatalog.count).toBe(1222)
    expect(allQuestions).toHaveLength(1222)
    expect(new Set(allQuestions.map((question) => question.sourceId)).size).toBe(1222)
  })

  it('never exposes the source AI answer', () => {
    for (const question of allQuestions) {
      expect(question).not.toHaveProperty('answer')
    }
  })

  it('looks up and filters real questions', () => {
    expect(getQuestion('agent-001')?.title).toContain('AI Agent')
    expect(filterQuestions({ category: 'AI Agent' })).toHaveLength(280)
    expect(filterQuestions({ query: 'Planning' }).length).toBeGreaterThan(0)
    expect(filterQuestions({ category: '前端', difficulty: 1 }).length).toBeGreaterThan(0)
  })
})
