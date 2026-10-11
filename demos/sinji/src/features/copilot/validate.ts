/**
 * Validation of a bot configuration, shared by the form (instant feedback)
 * and the mock handler (authoritative). Errors are keyed by dotted path and
 * carry a code plus parameters so each side words them in its own language.
 * OWNED BY: copilot.
 */
import type { BotConfig, Weekday } from '@/types'

export interface FieldIssue {
  code: 'required' | 'range' | 'integer' | 'order' | 'time' | 'languages' | 'tooLong'
  min?: number
  max?: number
}

export type Issues = Record<string, FieldIssue>

export const WEEKDAYS: Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/

export function validateBot(cfg: BotConfig, opts: { isDefault: boolean }): Issues {
  const issues: Issues = {}
  const range = (path: string, value: number, min: number, max: number, integer = false) => {
    if (!Number.isFinite(value)) issues[path] = { code: 'required' }
    else if (integer && !Number.isInteger(value)) issues[path] = { code: 'integer' }
    else if (value < min || value > max) issues[path] = { code: 'range', min, max }
  }
  const s = cfg.settings

  if (!cfg.persona.trim()) issues.persona = { code: 'required' }
  else if (cfg.persona.length > 800) issues.persona = { code: 'tooLong', max: 800 }

  if (cfg.languages.length === 0) issues.languages = { code: 'languages' }
  for (const lang of cfg.languages) {
    if (!cfg.greeting[lang]?.trim()) issues[`greeting.${lang}`] = { code: 'required' }
    if (!cfg.refusal_copy[lang]?.trim()) issues[`refusal_copy.${lang}`] = { code: 'required' }
    if (!s.handoff_notice[lang]?.trim()) issues[`settings.handoff_notice.${lang}`] = { code: 'required' }
  }

  range('min_score', cfg.min_score, 0, 1)
  range('min_hits', cfg.min_hits, 1, 10, true)
  range('top_k', cfg.top_k, 1, 20, true)
  range('suggestion_count', cfg.suggestion_count, 1, 3, true)
  if (!issues.min_hits && !issues.top_k && cfg.min_hits > cfg.top_k) issues.min_hits = { code: 'order', max: cfg.top_k }

  range('settings.limits.per_minute', s.limits.per_minute, 1, 120, true)
  range('settings.limits.per_conversation', s.limits.per_conversation, 1, 500, true)
  if (opts.isDefault) {
    for (const channel of ['web', 'instagram', 'messenger', 'whatsapp'] as const) {
      range(`settings.limits.per_channel.${channel}`, s.limits.per_channel[channel], 0, 100000, true)
    }
  }
  range('settings.max_reply_chars', s.max_reply_chars, 100, 2000, true)
  range('settings.off_topic_warn_after', s.off_topic_warn_after, 1, 20, true)
  range('settings.off_topic_cutoff_after', s.off_topic_cutoff_after, 1, 50, true)
  if (!issues['settings.off_topic_warn_after'] && !issues['settings.off_topic_cutoff_after'] && s.off_topic_cutoff_after <= s.off_topic_warn_after) {
    issues['settings.off_topic_cutoff_after'] = { code: 'order', min: s.off_topic_warn_after + 1 }
  }

  if (!s.business_scope.trim()) issues['settings.business_scope'] = { code: 'required' }
  else if (s.business_scope.length > 600) issues['settings.business_scope'] = { code: 'tooLong', max: 600 }

  for (const day of WEEKDAYS) {
    s.hours[day].forEach((slot, i) => {
      const path = `settings.hours.${day}.${i}`
      if (!TIME.test(slot.from) || !TIME.test(slot.to)) issues[path] = { code: 'time' }
      else if (slot.from >= slot.to) issues[path] = { code: 'order' }
    })
  }

  cfg.canned.forEach((c, i) => {
    if (!c.trigger.trim()) issues[`canned.${i}.trigger`] = { code: 'required' }
    if (!c.reply.trim()) issues[`canned.${i}.reply`] = { code: 'required' }
  })
  return issues
}

/** English wording for the mock API's validation errors. */
export function issueMessage(issue: FieldIssue): string {
  switch (issue.code) {
    case 'required':
      return 'This field is required.'
    case 'integer':
      return 'Enter a whole number.'
    case 'range':
      return `Enter a value between ${issue.min} and ${issue.max}.`
    case 'order':
      return issue.min !== undefined ? `Must be at least ${issue.min}.` : issue.max !== undefined ? `Must not exceed ${issue.max}.` : 'The end must be after the start.'
    case 'time':
      return 'Use the HH:MM format.'
    case 'languages':
      return 'Keep at least one language.'
    case 'tooLong':
      return `At most ${issue.max} characters.`
  }
}
