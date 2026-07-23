import { describe, expect, it } from 'vitest'
import {
  type ExperienceDraftValue,
  hasExperienceDraftContent,
  sameExperienceDraftValue,
  selectExperienceDraftValue,
} from './experience-drafts'

const serverValue: ExperienceDraftValue = {
  title: '原面经',
  interviewDate: '2026-07-23',
  content: '原内容',
}

const draftValue: ExperienceDraftValue = {
  title: '原面经',
  interviewDate: '2026-07-23',
  content: '本地未发布内容',
}

describe('experience drafts', () => {
  it('detects meaningful draft content', () => {
    expect(hasExperienceDraftContent({ title: '', interviewDate: '', content: '' })).toBe(false)
    expect(hasExperienceDraftContent({ title: '', interviewDate: '', content: '草稿' })).toBe(true)
  })

  it('compares draft values exactly', () => {
    expect(sameExperienceDraftValue(serverValue, { ...serverValue })).toBe(true)
    expect(sameExperienceDraftValue(serverValue, draftValue)).toBe(false)
  })

  it('restores edit draft from the same server version', () => {
    expect(
      selectExperienceDraftValue(serverValue, '2026-07-23T08:00:00.000Z', {
        value: draftValue,
        savedAt: '2026-07-23T08:05:00.000Z',
        baseUpdatedAt: '2026-07-23T08:00:00.000Z',
      }),
    ).toEqual(draftValue)
  })

  it('ignores stale edit drafts after the server content changes', () => {
    expect(
      selectExperienceDraftValue(serverValue, '2026-07-23T09:00:00.000Z', {
        value: draftValue,
        savedAt: '2026-07-23T08:05:00.000Z',
        baseUpdatedAt: '2026-07-23T08:00:00.000Z',
      }),
    ).toEqual(serverValue)
  })
})
