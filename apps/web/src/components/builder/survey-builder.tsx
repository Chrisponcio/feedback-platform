'use client'

import { useEffect, useTransition, useState } from 'react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { restrictToVerticalAxis } from '@dnd-kit/modifiers'
import { Button } from '@pulse/ui'
import {
  useBuilderStore,
  type QuestionType,
  type BuilderQuestion,
  type SurveySettings,
} from '@/stores/builder-store'
import { SortableQuestionCard } from './sortable-question-card'
import { QuestionTypePicker } from './question-type-picker'
import { QuestionEditor } from './question-editor'
import { SurveySettingsPanel } from './survey-settings-panel'
import { saveSurvey } from '@/lib/survey-actions'

interface SurveyBuilderProps {
  surveyId: string
  initialSettings: SurveySettings
  initialQuestions: BuilderQuestion[]
}

// ── Component ─────────────────────────────────────────────────────────────────

export function SurveyBuilder({
  surveyId,
  initialSettings,
  initialQuestions,
}: SurveyBuilderProps) {
  const { init, addQuestion, reorderQuestions, selectQuestion, markSaved, isDirty } =
    useBuilderStore((s) => ({
      init: s.init,
      addQuestion: s.addQuestion,
      reorderQuestions: s.reorderQuestions,
      selectQuestion: s.selectQuestion,
      markSaved: s.markSaved,
      isDirty: s.isDirty,
    }))

  const questions = useBuilderStore((s) => s.questions)
  const selectedQuestionId = useBuilderStore((s) => s.selectedQuestionId)
  const selectedQuestion = questions.find((q) => q.id === selectedQuestionId) ?? null

  const [isPending, startTransition] = useTransition()
  const [saveError, setSaveError] = useState<string | null>(null)
  const [rightPanel, setRightPanel] = useState<'edit' | 'settings'>('edit')
  const [showTypePicker, setShowTypePicker] = useState(false)

  // Initialise store from server data on mount
  useEffect(() => {
    init(surveyId, initialSettings, initialQuestions)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (over && active.id !== over.id) {
      reorderQuestions(String(active.id), String(over.id))
    }
  }

  function handleAddQuestion(type: QuestionType) {
    addQuestion(type)
    setShowTypePicker(false)
    setRightPanel('edit')
  }

  function handleSave() {
    setSaveError(null)
    const { settings, questions: qs } = useBuilderStore.getState()
    startTransition(async () => {
      const result = await saveSurvey(surveyId, settings, qs)
      if (result?.error) {
        setSaveError(result.error)
      } else {
        markSaved()
      }
    })
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
      {/* ── Left sidebar: question list ───────────────────────────────── */}
      <aside className="flex w-72 flex-col border-r bg-background">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-sm font-semibold">Questions</h2>
          <span className="text-xs text-muted-foreground">{questions.length}</span>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={questions.map((q) => q.id)}
              strategy={verticalListSortingStrategy}
            >
              {questions.map((q) => (
                <SortableQuestionCard
                  key={q.id}
                  question={q}
                  isSelected={q.id === selectedQuestionId}
                />
              ))}
            </SortableContext>
          </DndContext>

          {questions.length === 0 && !showTypePicker && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No questions yet. Add your first one below.
            </p>
          )}

          {showTypePicker && (
            <div className="rounded-lg border bg-muted/40 p-3">
              <p className="mb-3 text-xs font-medium text-muted-foreground">
                Choose question type
              </p>
              <QuestionTypePicker onSelect={handleAddQuestion} />
              <button
                className="mt-2 w-full text-xs text-muted-foreground hover:text-foreground"
                onClick={() => setShowTypePicker(false)}
              >
                Cancel
              </button>
            </div>
          )}
        </div>

        <div className="border-t p-3">
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => { setShowTypePicker(true); selectQuestion(null) }}
          >
            + Add question
          </Button>
        </div>
      </aside>

      {/* ── Right panel: editor or settings ──────────────────────────── */}
      <aside className="flex w-80 flex-col border-l bg-background">
        <div className="flex border-b">
          <button
            className={[
              'flex-1 px-4 py-3 text-sm font-medium transition-colors',
              rightPanel === 'edit'
                ? 'border-b-2 border-primary text-foreground'
                : 'text-muted-foreground hover:text-foreground',
            ].join(' ')}
            onClick={() => setRightPanel('edit')}
          >
            Edit
          </button>
          <button
            className={[
              'flex-1 px-4 py-3 text-sm font-medium transition-colors',
              rightPanel === 'settings'
                ? 'border-b-2 border-primary text-foreground'
                : 'text-muted-foreground hover:text-foreground',
            ].join(' ')}
            onClick={() => setRightPanel('settings')}
          >
            Settings
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {rightPanel === 'settings' ? (
            <SurveySettingsPanel />
          ) : selectedQuestion ? (
            <QuestionEditor question={selectedQuestion} />
          ) : (
            <div className="flex h-full items-center justify-center p-8 text-center text-sm text-muted-foreground">
              Select a question to edit it, or add a new one.
            </div>
          )}
        </div>

        <div className="border-t p-3 space-y-2">
          {saveError && (
            <p className="text-xs text-destructive">{saveError}</p>
          )}
          <Button
            className="w-full"
            onClick={handleSave}
            disabled={isPending || !isDirty}
          >
            {isPending ? 'Saving…' : isDirty ? 'Save changes' : 'Saved'}
          </Button>
        </div>
      </aside>
    </div>
  )
}
