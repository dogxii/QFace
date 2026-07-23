import type { CommunityUser } from '@/types/community'

export type ExperienceSort = 'latest' | 'hot'

export interface ExperienceQuestionLink {
  id: string
  sourceId: string
  label: string
  position: number
}

export interface Experience {
  id: string
  title: string
  interviewDate: string
  content: string
  status: 'visible' | 'deleted' | 'hidden'
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  linkCount: number
  replyCount: number
  upvotes: number
  downvotes: number
  viewerVote: -1 | 0 | 1
  links: ExperienceQuestionLink[]
  canEdit: boolean
  canDelete: boolean
  user: CommunityUser
}

export interface ExperienceInput {
  title: string
  interviewDate?: string
  content: string
  links?: Array<{
    sourceId: string
    label?: string
    position?: number
  }>
}
