/**
 * Client-side skip logic evaluator.
 *
 * A logic rule tree is stored in question.logic (JSONB):
 *
 * {
 *   action: "skip_to" | "end_survey",
 *   target_question_id?: string,   // for "skip_to"
 *   condition: {
 *     operator: "and" | "or",
 *     rules: LogicRule[]
 *   }
 * }
 *
 * A LogicRule:
 * {
 *   question_id: string,
 *   comparator: "eq" | "neq" | "lt" | "lte" | "gt" | "gte" | "contains",
 *   value: string | number
 * }
 */

export type LogicComparator = 'eq' | 'neq' | 'lt' | 'lte' | 'gt' | 'gte' | 'contains'
export type LogicAction     = 'skip_to' | 'end_survey' | 'show'

export interface LogicRule {
  question_id: string
  comparator:  LogicComparator
  value:       string | number
}

export interface LogicCondition {
  operator: 'and' | 'or'
  rules:    LogicRule[]
}

export interface LogicConfig {
  action:             LogicAction
  target_question_id?: string   // required when action === 'skip_to'
  condition:          LogicCondition
}

export type AnswerMap = Record<string, number | string | boolean | null | undefined>

/**
 * Evaluate a logic config against the current answer state.
 * Returns true if the condition is met (action should fire).
 */
export function evaluateLogic(config: LogicConfig, answers: AnswerMap): boolean {
  const { condition } = config
  const results = condition.rules.map((rule) => evaluateRule(rule, answers))

  return condition.operator === 'and'
    ? results.every(Boolean)
    : results.some(Boolean)
}

function evaluateRule(rule: LogicRule, answers: AnswerMap): boolean {
  const answer = answers[rule.question_id]
  if (answer === undefined || answer === null) return false

  const av = typeof answer === 'string' ? answer : Number(answer)
  const rv = typeof rule.value === 'string' ? rule.value : Number(rule.value)

  switch (rule.comparator) {
    case 'eq':       return av == rv
    case 'neq':      return av != rv
    case 'lt':       return Number(av) < Number(rv)
    case 'lte':      return Number(av) <= Number(rv)
    case 'gt':       return Number(av) > Number(rv)
    case 'gte':      return Number(av) >= Number(rv)
    case 'contains': return String(av).toLowerCase().includes(String(rv).toLowerCase())
  }
}

/**
 * Given the current question index and all questions, compute what the next
 * question index should be after applying any applicable logic rules.
 *
 * Returns:
 *   - next question index (may skip ahead)
 *   - 'end' if the survey should end early
 */
export function computeNextQuestion(
  currentIndex: number,
  questions: { id: string; logic?: LogicConfig | null }[],
  answers: AnswerMap
): number | 'end' {
  const current = questions[currentIndex]
  if (!current?.logic) return currentIndex + 1

  const { logic } = current
  if (!evaluateLogic(logic, answers)) return currentIndex + 1

  if (logic.action === 'end_survey') return 'end'

  if (logic.action === 'skip_to' && logic.target_question_id) {
    const targetIdx = questions.findIndex((q) => q.id === logic.target_question_id)
    if (targetIdx > currentIndex) return targetIdx
  }

  return currentIndex + 1
}
