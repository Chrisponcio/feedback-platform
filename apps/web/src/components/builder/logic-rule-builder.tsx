'use client'

import { useState } from 'react'
import type {
  LogicConfig,
  LogicRule,
  LogicComparator,
  LogicAction,
} from '@/lib/logic-evaluator'

interface Question {
  id: string
  title: string
  type: string
}

interface LogicRuleBuilderProps {
  currentQuestionId: string
  questions: Question[]   // all questions (to select FROM)
  value: LogicConfig | null
  onChange: (config: LogicConfig | null) => void
}

const COMPARATOR_LABELS: Record<LogicComparator, string> = {
  eq:       '= equals',
  neq:      '≠ not equals',
  lt:       '< less than',
  lte:      '≤ at most',
  gt:       '> greater than',
  gte:      '≥ at least',
  contains: 'contains',
}

const ACTION_LABELS: Record<LogicAction, string> = {
  skip_to:    'Skip to question',
  end_survey: 'End survey',
  show:       'Show this question if',
}

const BLANK_RULE: LogicRule = { question_id: '', comparator: 'eq', value: '' }

export function LogicRuleBuilder({
  currentQuestionId,
  questions,
  value,
  onChange,
}: LogicRuleBuilderProps) {
  const [enabled, setEnabled] = useState(!!value)

  const prevQuestions = questions.filter((q) => q.id !== currentQuestionId)
  const laterQuestions = questions.filter(
    (q, idx) => q.id !== currentQuestionId && idx > questions.findIndex((q2) => q2.id === currentQuestionId)
  )

  function handleEnable() {
    setEnabled(true)
    onChange({
      action: 'skip_to',
      target_question_id: laterQuestions[0]?.id,
      condition: { operator: 'and', rules: [{ ...BLANK_RULE, question_id: prevQuestions[0]?.id ?? '' }] },
    })
  }

  function handleDisable() {
    setEnabled(false)
    onChange(null)
  }

  if (!enabled) {
    return (
      <button
        onClick={handleEnable}
        className="w-full rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors"
      >
        + Add skip logic
      </button>
    )
  }

  if (!value) return null

  function update(patch: Partial<LogicConfig>) {
    onChange({ ...value!, ...patch })
  }

  function updateRule(idx: number, patch: Partial<LogicRule>) {
    const rules = value!.condition.rules.map((r, i) => i === idx ? { ...r, ...patch } : r)
    update({ condition: { ...value!.condition, rules } })
  }

  function addRule() {
    update({
      condition: {
        ...value!.condition,
        rules: [...value!.condition.rules, { ...BLANK_RULE, question_id: prevQuestions[0]?.id ?? '' }],
      },
    })
  }

  function removeRule(idx: number) {
    const rules = value!.condition.rules.filter((_, i) => i !== idx)
    if (rules.length === 0) { handleDisable(); return }
    update({ condition: { ...value!.condition, rules } })
  }

  return (
    <div className="space-y-3 rounded-md border bg-muted/30 p-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Skip logic</p>
        <button onClick={handleDisable} className="text-xs text-destructive hover:underline">Remove</button>
      </div>

      {/* Action */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-medium">If</span>
        <select
          value={value.condition.operator}
          onChange={(e) => update({ condition: { ...value.condition, operator: e.target.value as 'and' | 'or' } })}
          className="rounded border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="and">ALL conditions are met</option>
          <option value="or">ANY condition is met</option>
        </select>
        <span className="text-sm font-medium">→ then</span>
        <select
          value={value.action}
          onChange={(e) => update({ action: e.target.value as LogicAction })}
          className="rounded border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="skip_to">skip to</option>
          <option value="end_survey">end survey</option>
        </select>
        {value.action === 'skip_to' && (
          <select
            value={value.target_question_id ?? ''}
            onChange={(e) => update({ target_question_id: e.target.value })}
            className="rounded border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {laterQuestions.map((q, idx) => (
              <option key={q.id} value={q.id}>
                Q{questions.findIndex((x) => x.id === q.id) + 1}: {q.title.slice(0, 30)}{q.title.length > 30 ? '…' : ''}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Rules */}
      <div className="space-y-2">
        {value.condition.rules.map((rule, idx) => (
          <div key={idx} className="flex items-center gap-2 flex-wrap">
            {idx > 0 && (
              <span className="text-xs text-muted-foreground w-8 text-center">
                {value.condition.operator === 'and' ? 'AND' : 'OR'}
              </span>
            )}
            {/* Source question */}
            <select
              value={rule.question_id}
              onChange={(e) => updateRule(idx, { question_id: e.target.value })}
              className="rounded border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary flex-1 min-w-0"
            >
              <option value="">Select question…</option>
              {prevQuestions.map((q, qi) => (
                <option key={q.id} value={q.id}>
                  Q{questions.findIndex((x) => x.id === q.id) + 1}: {q.title.slice(0, 25)}
                </option>
              ))}
            </select>

            {/* Comparator */}
            <select
              value={rule.comparator}
              onChange={(e) => updateRule(idx, { comparator: e.target.value as LogicComparator })}
              className="rounded border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {(Object.entries(COMPARATOR_LABELS) as [LogicComparator, string][]).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>

            {/* Value */}
            <input
              value={String(rule.value)}
              onChange={(e) => updateRule(idx, { value: e.target.value })}
              placeholder="value"
              className="w-16 rounded border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
            />

            <button
              onClick={() => removeRule(idx)}
              className="text-muted-foreground hover:text-destructive"
              aria-label="Remove rule"
            >
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
      </div>

      <button
        onClick={addRule}
        className="text-xs text-primary hover:underline"
      >
        + Add condition
      </button>
    </div>
  )
}
