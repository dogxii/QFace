import catalogJson from '@/generated/questions.json'
import type { QuestionCatalog, QuestionCategory, QuestionDifficulty } from '@/types/question'

const catalog = catalogJson as QuestionCatalog

export const questionCatalog = catalog
export const allQuestions = catalog.questions

const questionById = new Map(allQuestions.map((question) => [question.sourceId, question]))

const moduleOrder: Record<QuestionCategory, string[]> = {
  前端: ['JS基础', 'CSS', '网络', 'React', 'TypeScript', 'Vue', '性能优化', '手写题', '项目深挖'],
  'AI Agent': [
    'Agent架构',
    'LLM基础',
    'Prompt工程',
    'RAG与知识库',
    '工具调用与工作流',
    'AI应用实践',
    'AI工程化',
    '评测与线上优化',
  ],
  Golang: ['Go基础', '并发编程', '内存与GC', 'Web开发', '工程化'],
  Java: ['Java基础', 'Java并发', 'JVM', 'MySQL', 'Redis', 'Spring框架', '计算机网络'],
}

function orderModules(category: string | undefined, modules: string[]) {
  if (!category || !(category in moduleOrder)) {
    return [...modules].sort((a, b) => a.localeCompare(b, 'zh-CN'))
  }

  const order = moduleOrder[category as QuestionCategory]
  return [...modules].sort((a, b) => {
    const left = order.indexOf(a)
    const right = order.indexOf(b)
    if (left === -1 && right === -1) return a.localeCompare(b, 'zh-CN')
    if (left === -1) return 1
    if (right === -1) return -1
    return left - right
  })
}

export function getQuestion(sourceId: string) {
  return questionById.get(sourceId)
}

export function getModules(category?: string) {
  const modules = new Set(
    allQuestions
      .filter((question) => !category || question.category === category)
      .map((question) => question.module),
  )

  return orderModules(category, [...modules])
}

export function getModuleSummaries(category: string) {
  const summaries = new Map<string, number>()
  for (const question of allQuestions) {
    if (question.category !== category) continue
    summaries.set(question.module, (summaries.get(question.module) ?? 0) + 1)
  }

  return orderModules(category, [...summaries.keys()]).map((name) => ({
    name,
    count: summaries.get(name) ?? 0,
  }))
}

export interface QuestionFilters {
  query?: string
  category?: string
  module?: string
  difficulty?: QuestionDifficulty
}

export function filterQuestions(filters: QuestionFilters) {
  const normalizedQuery = filters.query?.trim().toLocaleLowerCase('zh-CN')

  return allQuestions.filter((question) => {
    if (filters.category && question.category !== filters.category) return false
    if (filters.module && question.module !== filters.module) return false
    if (filters.difficulty && question.difficulty !== filters.difficulty) return false
    if (!normalizedQuery) return true

    const searchable = [question.title, question.category, question.module, ...question.tags]
      .join('\n')
      .toLocaleLowerCase('zh-CN')

    return searchable.includes(normalizedQuery)
  })
}
