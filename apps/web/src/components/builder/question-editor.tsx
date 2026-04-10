'use client'

import { useBuilderStore, type BuilderQuestion, type QuestionOption } from '@/stores/builder-store'
import { Input, Button } from '@pulse/ui'

interface QuestionEditorProps {
  question: BuilderQuestion
}

export function QuestionEditor({ question }: QuestionEditorProps) {
  const updateQuestion = useBuilderStore((s) => s.updateQuestion)

  function update(patch: Partial<BuilderQuestion>) {
    updateQuestion(question.id, patch)
  }

  function addOption() {
    update({
      options: [
        ...question.options,
        { id: crypto.randomUUID(), label: `Option ${question.options.length + 1}` },
      ],
    })
  }

  function updateOption(id: string, label: string) {
    update({
      options: question.options.map((o) => (o.id === id ? { ...o, label } : o)),
    })
  }

  function removeOption(id: string) {
    update({ options: question.options.filter((o) => o.id !== id) })
  }

  return (
    <div className="space-y-4 p-4">
      <div className="space-y-1.5">
        <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Question text
        </label>
        <Input
          value={question.title}
          onChange={(e) => update({ title: e.target.value })}
          placeholder="Enter your question…"
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Description (optional)
        </label>
        <Input
          value={question.description}
          onChange={(e) => update({ description: e.target.value })}
          placeholder="Add helper text…"
        />
      </div>

      <div className="flex items-center gap-2">
        <input
          id={`required-${question.id}`}
          type="checkbox"
          checked={question.required}
          onChange={(e) => update({ required: e.target.checked })}
          className="h-4 w-4 rounded border-input accent-primary"
        />
        <label htmlFor={`required-${question.id}`} className="text-sm">
          Required
        </label>
      </div>

      {question.type === 'star_rating' && (
        <div className="flex items-center gap-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Min stars</label>
            <Input
              type="number"
              min={1}
              max={question.scale_max ?? 5}
              value={question.scale_min ?? 1}
              onChange={(e) => update({ scale_min: Number(e.target.value) })}
              className="w-20"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Max stars</label>
            <Input
              type="number"
              min={question.scale_min ?? 1}
              max={10}
              value={question.scale_max ?? 5}
              onChange={(e) => update({ scale_max: Number(e.target.value) })}
              className="w-20"
            />
          </div>
        </div>
      )}

      {question.type === 'multiple_choice' && (
        <div className="space-y-2">
          <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Options
          </label>
          {question.options.map((option) => (
            <div key={option.id} className="flex items-center gap-2">
              <Input
                value={option.label}
                onChange={(e) => updateOption(option.id, e.target.value)}
                placeholder="Option label"
                className="flex-1"
              />
              <button
                onClick={() => removeOption(option.id)}
                className="text-muted-foreground hover:text-destructive"
                aria-label="Remove option"
              >
                ×
              </button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={addOption} className="w-full">
            + Add option
          </Button>
        </div>
      )}
    </div>
  )
}
