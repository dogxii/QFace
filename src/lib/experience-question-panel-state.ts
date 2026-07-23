import { createContext, useContext } from 'react'
import type { ExperienceQuestionLink } from '@/types/experience'

export interface ExperienceQuestionPanelPayload {
  experienceId: string
  title: string
  links: ExperienceQuestionLink[]
}

export interface ExperienceQuestionPanelContextValue {
  activeExperienceId: string | null
  togglePanel: (payload: ExperienceQuestionPanelPayload) => void
  closePanel: () => void
}

export const ExperienceQuestionPanelContext = createContext<
  ExperienceQuestionPanelContextValue | undefined
>(undefined)

export function useExperienceQuestionPanel() {
  const value = useContext(ExperienceQuestionPanelContext)
  if (!value)
    throw new Error(
      'useExperienceQuestionPanel must be used inside ExperienceQuestionPanelProvider',
    )

  return value
}
