export type CommentKind = 'answer' | 'explain' | 'question' | 'discussion'
export type PublicCommentKind = Extract<CommentKind, 'answer' | 'explain'>
export type NoteSaveAction = 'draft' | 'publish' | 'unpublish'

export interface CommunityUser {
  id: string
  login: string
  name: string | null
  avatarUrl: string | null
  htmlUrl: string | null
}

export interface CommunityComment {
  id: string
  sourceId: string
  parentId: string | null
  kind: CommentKind
  content: string
  status: 'visible' | 'deleted' | 'hidden'
  acceptedAt: string | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  upvotes: number
  downvotes: number
  viewerVote: -1 | 0 | 1
  canEdit: boolean
  canDelete: boolean
  canAccept: boolean
  user: CommunityUser
}

export interface SessionUser extends CommunityUser {
  githubId: number
  role: 'user' | 'moderator' | 'admin'
}

export interface SessionStats {
  noteCount: number
  commentCount: number
}

export interface RemoteNoteDraft {
  content: string
  publicCommentId: string | null
  publishedAt: string | null
  publishedContent: string
}

export interface RemoteNote {
  sourceId: string
  mastery: number
  answer: RemoteNoteDraft
  explain: RemoteNoteDraft
  content: string
  createdAt: string
  updatedAt: string
}
