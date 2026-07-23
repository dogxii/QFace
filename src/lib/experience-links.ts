import { allQuestions } from '@/lib/questions'
import type { Question, QuestionCategory } from '@/types/question'

const sourceIdPattern = '[a-z0-9][a-z0-9-]{1,63}'
const qfaceQuestionLinkPattern = new RegExp(
  `\\[[^\\]]*\\]\\(\\/q\\/(${sourceIdPattern})(?:\\?[^\\s)]*)?\\)`,
  'gi',
)
const qfaceQuestionLinkReplacePattern = new RegExp(
  `\\[[^\\]]*\\]\\(\\/q\\/${sourceIdPattern}(?:\\?[^\\s)]*)?\\)`,
  'gi',
)

function readableTitleParam(value: string) {
  return value
    .replace(/\s+/g, '')
    .replace(/[`*_~[\](){}<> "'?#&=%/\\]/g, '')
    .trim()
    .slice(0, 72)
}

export function questionLinkHref(sourceId: string, title?: string) {
  const titleParam = title ? readableTitleParam(title) : ''

  return `/q/${sourceId}${titleParam ? `?t=${titleParam}` : ''}`
}

function normalize(value: string) {
  return value
    .toLocaleLowerCase('zh-CN')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

function tokens(value: string) {
  return normalize(value)
    .split(/\s+/)
    .filter((token) => token.length >= 2)
}

function searchableQuestionText(question: Question) {
  return normalize([question.title, question.category, question.module, ...question.tags].join(' '))
}

function scoreQuestion(query: string, question: Question) {
  const normalizedQuery = normalize(query)
  if (!normalizedQuery) return 0

  const title = normalize(question.title)
  const searchable = searchableQuestionText(question)
  let score = 0

  if (title.includes(normalizedQuery)) score += normalizedQuery.length * 3
  if (normalizedQuery.includes(title)) score += title.length * 2

  for (const token of tokens(normalizedQuery)) {
    if (title.includes(token)) score += token.length * 3
    else if (searchable.includes(token)) score += token.length
  }

  return score
}

export interface ExperienceQuestionSearchOptions {
  category?: QuestionCategory
}

export function searchExperienceQuestions(
  query: string,
  limit = 8,
  options: ExperienceQuestionSearchOptions = {},
) {
  const normalizedQuery = normalize(query)
  if (!normalizedQuery) return []

  return allQuestions
    .filter((question) => !options.category || question.category === options.category)
    .map((question) => ({ question, score: scoreQuestion(normalizedQuery, question) }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit)
    .map((item) => item.question)
}

export function extractExperienceLinks(content: string) {
  const seen = new Set<string>()
  const links: Array<{ sourceId: string; label: string; position: number }> = []

  for (const match of content.matchAll(qfaceQuestionLinkPattern)) {
    const sourceId = match[1]
    if (seen.has(sourceId)) continue
    seen.add(sourceId)

    const lineStart = content.lastIndexOf('\n', match.index ?? 0) + 1
    const lineEnd = content.indexOf('\n', match.index ?? 0)
    const line = content.slice(lineStart, lineEnd === -1 ? content.length : lineEnd)

    links.push({
      sourceId,
      label: line.replace(qfaceQuestionLinkReplacePattern, '').trim().slice(0, 80),
      position: match.index ?? links.length,
    })
  }

  return links
}

export function appendQuestionLink(content: string, sourceId: string, label = '↗', title?: string) {
  const link = `[${label}](${questionLinkHref(sourceId, title)})`
  if (!content.trim()) return link

  return `${content}${content.endsWith(' ') ? '' : ' '}${link}`
}

function likelyQuestionLine(line: string) {
  const value = line.trim()
  if (value.length < 4 || value.length > 180) return false
  if (/^#{1,6}\s/.test(value)) return false
  if (/^[-*+]\s*$/.test(value)) return false
  return /[？?]|是什么|如何|怎么|为什么|讲下|说一下|流程|原理|区别|防御|实现/.test(value)
}

export function autoLinkExperienceContent(
  content: string,
  options: ExperienceQuestionSearchOptions = {},
) {
  let added = 0
  const next = content
    .split('\n')
    .map((line) => {
      if (!likelyQuestionLine(line) || line.includes('](/q/')) return line

      const [match] = searchExperienceQuestions(line, 1, options)
      if (!match || scoreQuestion(line, match) < 6) return line

      added += 1
      return appendQuestionLink(line, match.sourceId, '↗', match.title)
    })
    .join('\n')

  return { content: next, added }
}
