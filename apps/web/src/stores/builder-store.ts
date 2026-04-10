import { create } from 'zustand'
import { temporal } from 'zundo'

// ── Types ─────────────────────────────────────────────────────────────────────

export type QuestionType =
  | 'nps'
  | 'csat'
  | 'smiley'
  | 'open_text'
  | 'multiple_choice'
  | 'star_rating'

export interface QuestionOption {
  id: string
  label: string
}

export interface BuilderQuestion {
  id: string          // uuid — matches DB row or temp 'new-{n}' while unsaved
  type: QuestionType
  title: string
  description: string
  required: boolean
  position: number
  options: QuestionOption[]  // used by multiple_choice
  scale_min?: number         // star_rating
  scale_max?: number         // star_rating
}

export interface SurveySettings {
  title: string
  language: string
  thank_you_message: string
  redirect_url: string
  response_limit: number | null
}

interface BuilderState {
  surveyId: string | null
  settings: SurveySettings
  questions: BuilderQuestion[]
  selectedQuestionId: string | null
  isDirty: boolean

  // Actions
  init: (surveyId: string, settings: SurveySettings, questions: BuilderQuestion[]) => void
  updateSettings: (patch: Partial<SurveySettings>) => void
  addQuestion: (type: QuestionType) => void
  updateQuestion: (id: string, patch: Partial<BuilderQuestion>) => void
  removeQuestion: (id: string) => void
  reorderQuestions: (activeId: string, overId: string) => void
  selectQuestion: (id: string | null) => void
  markSaved: () => void
}

// ── Helpers ───────────────────────────────────────────────────────────────────

let _tempCounter = 0

function newQuestion(type: QuestionType, position: number): BuilderQuestion {
  _tempCounter += 1
  const defaults: Partial<BuilderQuestion> = {}

  if (type === 'multiple_choice') {
    defaults.options = [
      { id: crypto.randomUUID(), label: 'Option 1' },
      { id: crypto.randomUUID(), label: 'Option 2' },
    ]
  }
  if (type === 'star_rating') {
    defaults.scale_min = 1
    defaults.scale_max = 5
  }

  return {
    id: `new-${_tempCounter}`,
    type,
    title: defaultTitle(type),
    description: '',
    required: false,
    position,
    options: [],
    ...defaults,
  }
}

function defaultTitle(type: QuestionType): string {
  const map: Record<QuestionType, string> = {
    nps: 'How likely are you to recommend us? (0–10)',
    csat: 'How satisfied are you with your experience?',
    smiley: 'How do you feel about your experience?',
    open_text: 'Any additional comments?',
    multiple_choice: 'Choose an option',
    star_rating: 'Rate your experience',
  }
  return map[type]
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useBuilderStore = create<BuilderState>()(
  temporal(
    (set, get) => ({
      surveyId: null,
      settings: {
        title: '',
        language: 'en',
        thank_you_message: 'Thank you for your feedback!',
        redirect_url: '',
        response_limit: null,
      },
      questions: [],
      selectedQuestionId: null,
      isDirty: false,

      init(surveyId, settings, questions) {
        set({ surveyId, settings, questions, selectedQuestionId: null, isDirty: false })
      },

      updateSettings(patch) {
        set((s) => ({ settings: { ...s.settings, ...patch }, isDirty: true }))
      },

      addQuestion(type) {
        const questions = get().questions
        const position = questions.length
        const q = newQuestion(type, position)
        set((s) => ({
          questions: [...s.questions, q],
          selectedQuestionId: q.id,
          isDirty: true,
        }))
      },

      updateQuestion(id, patch) {
        set((s) => ({
          questions: s.questions.map((q) => (q.id === id ? { ...q, ...patch } : q)),
          isDirty: true,
        }))
      },

      removeQuestion(id) {
        set((s) => {
          const filtered = s.questions
            .filter((q) => q.id !== id)
            .map((q, i) => ({ ...q, position: i }))
          return {
            questions: filtered,
            selectedQuestionId:
              s.selectedQuestionId === id ? null : s.selectedQuestionId,
            isDirty: true,
          }
        })
      },

      reorderQuestions(activeId, overId) {
        set((s) => {
          const qs = [...s.questions]
          const from = qs.findIndex((q) => q.id === activeId)
          const to = qs.findIndex((q) => q.id === overId)
          if (from === -1 || to === -1) return s
          const removed = qs.splice(from, 1)
          const moved = removed[0]
          if (!moved) return s
          qs.splice(to, 0, moved)
          return {
            questions: qs.map((q, i) => ({ ...q, position: i })),
            isDirty: true,
          }
        })
      },

      selectQuestion(id) {
        set({ selectedQuestionId: id })
      },

      markSaved() {
        set({ isDirty: false })
      },
    }),
    // Only track questions + settings in undo history — not UI state
    {
      partialize: (s): { questions: BuilderQuestion[]; settings: SurveySettings } => ({
        questions: s.questions,
        settings: s.settings,
      }),
    }
  )
)

// Expose undo/redo from the temporal store
export const useBuilderHistory = () => useBuilderStore.temporal.getState()
