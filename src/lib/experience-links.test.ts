import { describe, expect, it } from 'vitest'
import {
  appendQuestionLink,
  extractExperienceLinks,
  questionLinkHref,
  searchExperienceQuestions,
} from './experience-links'

describe('experience question links', () => {
  it('keeps inserted question links readable while extracting source ids', () => {
    const content = appendQuestionLink('XSS 是什么', 'net-044', '↗', '什么是 XSS 攻击？如何防御？')

    expect(content).toBe('XSS 是什么 [↗](/q/net-044?t=什么是XSS攻击？如何防御？)')

    const [link] = extractExperienceLinks(content)
    expect(link).toMatchObject({
      sourceId: 'net-044',
      label: 'XSS 是什么',
    })
  })

  it('continues to support old question links without title queries', () => {
    const [link] = extractExperienceLinks('说一下事件循环 [↗](/q/js-006)')

    expect(link).toMatchObject({
      sourceId: 'js-006',
      label: '说一下事件循环',
    })
  })

  it('filters association search by category', () => {
    expect(
      searchExperienceQuestions('闭包', 8, { category: '前端' }).every(
        (question) => question.category === '前端',
      ),
    ).toBe(true)
    expect(
      searchExperienceQuestions('goroutine', 8, { category: 'Golang' }).every(
        (question) => question.category === 'Golang',
      ),
    ).toBe(true)
  })

  it('strips markdown-breaking characters from title query', () => {
    expect(questionLinkHref('react-010', 'React 的虚拟 DOM（Virtual DOM）是什么？')).toBe(
      '/q/react-010?t=React的虚拟DOM（VirtualDOM）是什么？',
    )
  })
})
