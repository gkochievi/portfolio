/**
 * The bot configuration form, shared by the workspace page (/workspace/bot)
 * and the global default page (/console/default-bot). Local state, instant
 * validation with the same rules the mock handler enforces, inherited
 * markers against the global default. OWNED BY: copilot.
 */
import { Clock, Plus, RotateCcw, ShieldCheck, Trash2, X } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import {
  Badge,
  Button,
  Field,
  IconButton,
  Input,
  Panel,
  ReadOnlyNote,
  Select,
  Slider,
  Switch,
  Tabs,
  Textarea,
  Checkbox,
} from '@/components/ui'
import { cn } from '@/lib/cn'
import type { BotConfig, ContentLang, Weekday } from '@/types'
import { validateBot, WEEKDAYS, type FieldIssue } from '../validate'

const LANGS: ContentLang[] = ['ka', 'en', 'ru']
const CHANNELS = ['web', 'instagram', 'messenger', 'whatsapp'] as const

const getPath = (obj: unknown, path: string): unknown =>
  path.split('.').reduce<unknown>((acc, key) => (acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[key] : undefined), obj)

function setPath<T>(obj: T, path: string, value: unknown): T {
  const next = structuredClone(obj) as Record<string, unknown>
  const keys = path.split('.')
  let cursor = next
  for (const key of keys.slice(0, -1)) cursor = cursor[key] as Record<string, unknown>
  cursor[keys[keys.length - 1] as string] = value
  return next as T
}

/** Everything the form does not edit (the autopilot switch lives on the page). */
const plain = (c: BotConfig): BotConfig => ({ ...c, autopilot_enabled: false, version: 0, updated_at: '', updated_by: null })

interface Props {
  initial: BotConfig
  /** The global default (workspace form only): drives the inherited markers and "reset". */
  defaults?: BotConfig
  inherited?: string[]
  isDefault: boolean
  canEdit: boolean
  saving: boolean
  serverErrors?: Record<string, string[]>
  onSave: (config: BotConfig) => void
  /** Rendered above the first card (autopilot switch, kill-switch notice). */
  top?: ReactNode
}

export function BotForm({ initial, defaults, inherited, isDefault, canEdit, saving, serverErrors, onSave, top }: Props) {
  const { t } = useTranslation('copilot')
  // The form works on a snapshot taken when it mounts; the page remounts it (key) after a save.
  const [base] = useState<BotConfig>(initial)
  const [cfg, setCfg] = useState<BotConfig>(initial)
  const [attempted, setAttempted] = useState(false)
  const [keyword, setKeyword] = useState('')

  const dirty = useMemo(() => JSON.stringify(plain(cfg)) !== JSON.stringify(plain(base)), [cfg, base])
  const issues = useMemo(() => validateBot(cfg, { isDefault }), [cfg, isDefault])

  const message = (issue: FieldIssue): string => {
    if (issue.code === 'order') {
      if (issue.min !== undefined) return t('bot.validation.orderMin', { min: issue.min })
      if (issue.max !== undefined) return t('bot.validation.orderMax', { max: issue.max })
      return t('bot.validation.orderTime')
    }
    return t(`bot.validation.${issue.code}`, { min: issue.min, max: issue.max })
  }
  const err = (path: string): string | undefined => {
    const local = issues[path]
    if (local && attempted) return message(local)
    return serverErrors?.[path]?.[0]
  }

  const set = (path: string, value: unknown) => setCfg((c) => setPath(c, path, value))
  const num = (raw: string) => (raw.trim() === '' ? Number.NaN : Number(raw))

  /* "Inherited" markers (workspace form only). */
  const origin = (path: string): ReactNode => {
    if (!defaults || !inherited) return null
    if (inherited.includes(path) && JSON.stringify(getPath(cfg, path)) === JSON.stringify(getPath(defaults, path))) {
      return <Badge size="sm" tone="neutral">{t('bot.inherited')}</Badge>
    }
    return (
      <span className="inline-flex items-center gap-1.5">
        <Badge size="sm" tone="accent">{t('bot.customised')}</Badge>
        {canEdit ? (
          <button
            type="button"
            className="inline-flex items-center gap-1 text-xs font-normal text-primary hover:underline"
            onClick={() => set(path, structuredClone(getPath(defaults, path)))}
          >
            <RotateCcw className="size-3" aria-hidden />
            {t('bot.resetToDefault')}
          </button>
        ) : null}
      </span>
    )
  }
  const head = (label: string, path: string): ReactNode => (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
      {label}
      {origin(path)}
    </span>
  )

  const numField = ({ path, label, hint, min, max, step = 1, originPath }: { path: string; label: string; hint?: string; min: number; max: number; step?: number; originPath?: string }) => {
    const value = getPath(cfg, path) as number
    return (
      <Field key={path} label={originPath ? head(label, originPath) : label} hint={hint} error={err(path)}>
        <Input type="number" inputMode="decimal" min={min} max={max} step={step} className="tabular" value={Number.isFinite(value) ? value : ''} onChange={(e) => set(path, num(e.target.value))} />
      </Field>
    )
  }

  const submit = () => {
    setAttempted(true)
    if (Object.keys(issues).length > 0) return
    onSave(cfg)
  }

  /* ----------------------------------------------------------- sections */

  const languagesCard = (
    <Panel title={t('bot.persona.title')} description={t('bot.persona.description')}>
      <div className="space-y-5">
        <Field label={head(t('bot.persona.label'), 'persona')} hint={t('bot.persona.hint', { count: cfg.persona.length })} error={err('persona')}>
          <Textarea rows={4} value={cfg.persona} onChange={(e) => set('persona', e.target.value)} />
        </Field>
        <div>
          <div className="mb-2 text-[13px] font-medium">{head(t('bot.languages.label'), 'languages')}</div>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {LANGS.map((lang) => (
              <Checkbox
                key={lang}
                checked={cfg.languages.includes(lang)}
                label={t(`lang.${lang}`)}
                onCheckedChange={(on) => set('languages', on ? LANGS.filter((l) => l === lang || cfg.languages.includes(l)) : cfg.languages.filter((l) => l !== lang))}
              />
            ))}
          </div>
          {err('languages') ? <p role="alert" className="mt-1.5 text-xs text-danger">{err('languages')}</p> : <p className="mt-1.5 text-xs text-muted">{t('bot.languages.hint')}</p>}
        </div>
      </div>
    </Panel>
  )

  const copyCard = (
    <Panel title={t('bot.copy.title')} description={t('bot.copy.description')}>
      <Tabs
        variant="pill"
        defaultValue="ka"
        items={LANGS.map((lang) => ({
          value: lang,
          label: t(`lang.${lang}`),
          content: (
            <div className="mt-4 space-y-4">
              <Field label={head(t('bot.copy.greeting'), 'greeting')} error={err(`greeting.${lang}`)}>
                <Textarea rows={2} value={cfg.greeting[lang] ?? ''} onChange={(e) => set(`greeting.${lang}`, e.target.value)} lang={lang} />
              </Field>
              <Field label={head(t('bot.copy.refusal'), 'refusal_copy')} hint={t('bot.copy.refusalHint')} error={err(`refusal_copy.${lang}`)}>
                <Textarea rows={2} value={cfg.refusal_copy[lang] ?? ''} onChange={(e) => set(`refusal_copy.${lang}`, e.target.value)} lang={lang} />
              </Field>
              <Field label={head(t('bot.copy.handoff'), 'settings.handoff_notice')} hint={t('bot.copy.handoffHint')} error={err(`settings.handoff_notice.${lang}`)}>
                <Textarea rows={2} value={cfg.settings.handoff_notice[lang] ?? ''} onChange={(e) => set(`settings.handoff_notice.${lang}`, e.target.value)} lang={lang} />
              </Field>
            </div>
          ),
        }))}
      />
    </Panel>
  )

  const cannedCard = (
    <Panel
      title={head(t('bot.canned.title'), 'canned')}
      description={t('bot.canned.description')}
      actions={
        <Button size="sm" variant="secondary" icon={<Plus className="size-4" />} onClick={() => set('canned', [...cfg.canned, { trigger: '', reply: '' }])}>
          {t('bot.canned.add')}
        </Button>
      }
    >
      {cfg.canned.length === 0 ? (
        <p className="text-sm text-muted">{t('bot.canned.empty')}</p>
      ) : (
        <ul className="space-y-4">
          {cfg.canned.map((item, i) => (
            <li key={i} className="grid gap-3 rounded-ctl border border-line bg-sunken/50 p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto]">
              <Field label={t('bot.canned.trigger')} error={err(`canned.${i}.trigger`)}>
                <Input value={item.trigger} onChange={(e) => set(`canned.${i}.trigger`, e.target.value)} />
              </Field>
              <Field label={t('bot.canned.reply')} error={err(`canned.${i}.reply`)}>
                <Textarea rows={2} value={item.reply} onChange={(e) => set(`canned.${i}.reply`, e.target.value)} />
              </Field>
              <IconButton
                className="self-start sm:mt-6"
                label={t('bot.canned.remove')}
                icon={<Trash2 className="size-4" />}
                onClick={() => set('canned', cfg.canned.filter((_, j) => j !== i))}
              />
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )

  const groundingCard = (
    <Panel title={t('bot.grounding.title')} description={t('bot.grounding.description')}>
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field label={head(t('bot.grounding.minScore'), 'min_score')} hint={t('bot.grounding.minScoreHint')} error={err('min_score')}>
            <Slider value={Number.isFinite(cfg.min_score) ? cfg.min_score : 0} min={0} max={1} step={0.01} onValueChange={(v) => set('min_score', Math.round(v * 100) / 100)} format={(v) => v.toFixed(2)} />
          </Field>
        </div>
        {numField({ path: "min_hits", originPath: "min_hits", label: t('bot.grounding.minHits'), hint: t('bot.grounding.minHitsHint'), min: 1, max: 10 })}
        {numField({ path: "top_k", originPath: "top_k", label: t('bot.grounding.topK'), hint: t('bot.grounding.topKHint'), min: 1, max: 20 })}
        {numField({ path: "suggestion_count", originPath: "suggestion_count", label: t('bot.grounding.suggestions'), hint: t('bot.grounding.suggestionsHint'), min: 1, max: 3 })}
        {numField({ path: "settings.max_reply_chars", originPath: "settings.max_reply_chars", label: t('bot.grounding.maxChars'), hint: t('bot.grounding.maxCharsHint'), min: 100, max: 2000, step: 50 })}
      </div>
    </Panel>
  )

  const policies = ['kb_only', 'general', 'open'] as const
  const scopeCard = (
    <Panel title={t('bot.scope.title')} description={t('bot.scope.description')} icon={<ShieldCheck />}>
      <div className="space-y-5">
        <div>
          <div className="mb-2 text-[13px] font-medium">{head(t('bot.scope.policy'), 'settings.answer_policy')}</div>
          <div role="radiogroup" aria-label={t('bot.scope.policy')} className="grid gap-2 sm:grid-cols-3">
            {policies.map((policy) => {
              const on = cfg.settings.answer_policy === policy
              return (
                <button
                  key={policy}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => set('settings.answer_policy', policy)}
                  className={cn(
                    'rounded-ctl border p-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                    on ? 'border-primary bg-primary/8' : 'border-line hover:border-line-strong',
                  )}
                >
                  <div className="text-sm font-semibold">{t(`bot.scope.policies.${policy}.name`)}</div>
                  <div className="mt-0.5 text-xs text-muted">{t(`bot.scope.policies.${policy}.body`)}</div>
                </button>
              )
            })}
          </div>
        </div>
        <Field label={head(t('bot.scope.business'), 'settings.business_scope')} hint={t('bot.scope.businessHint')} error={err('settings.business_scope')}>
          <Textarea rows={3} value={cfg.settings.business_scope} onChange={(e) => set('settings.business_scope', e.target.value)} />
        </Field>
        <div className="grid gap-5 sm:grid-cols-3">
          <Field label={head(t('bot.scope.offTopic'), 'settings.off_topic_handling')} hint={t('bot.scope.offTopicHint')}>
            <Select
              value={cfg.settings.off_topic_handling}
              onValueChange={(v) => set('settings.off_topic_handling', v)}
              options={(['warn', 'refuse', 'handoff'] as const).map((v) => ({ value: v, label: t(`bot.scope.offTopicModes.${v}`) }))}
            />
          </Field>
          {numField({ path: "settings.off_topic_warn_after", originPath: "settings.off_topic_warn_after", label: t('bot.scope.warnAfter'), hint: t('bot.scope.warnAfterHint'), min: 1, max: 20 })}
          {numField({ path: "settings.off_topic_cutoff_after", originPath: "settings.off_topic_cutoff_after", label: t('bot.scope.cutoffAfter'), hint: t('bot.scope.cutoffAfterHint'), min: 2, max: 50 })}
        </div>
      </div>
    </Panel>
  )

  const hoursCard = (
    <Panel title={head(t('bot.hours.title'), 'settings.hours')} description={t('bot.hours.description', { tz: cfg.settings.timezone })} icon={<Clock />}>
      <ul className="divide-y divide-line">
        {WEEKDAYS.map((day: Weekday) => {
          const slots = cfg.settings.hours[day]
          return (
            <li key={day} className="flex flex-wrap items-start gap-x-4 gap-y-2 py-3 first:pt-0 last:pb-0">
              <div className="w-28 shrink-0 pt-1.5 text-sm font-medium">{t(`bot.hours.days.${day}`)}</div>
              <div className="min-w-0 flex-1 space-y-2">
                {slots.length === 0 ? <div className="pt-1.5 text-sm text-muted">{t('bot.hours.closed')}</div> : null}
                {slots.map((slot, i) => (
                  <div key={i}>
                    <div className="flex flex-wrap items-center gap-2">
                      <Input type="time" size="sm" className="tabular w-32" aria-label={t('bot.hours.from', { day: t(`bot.hours.days.${day}`) })} value={slot.from} onChange={(e) => set(`settings.hours.${day}.${i}.from`, e.target.value)} />
                      <span className="text-muted" aria-hidden>-</span>
                      <Input type="time" size="sm" className="tabular w-32" aria-label={t('bot.hours.to', { day: t(`bot.hours.days.${day}`) })} value={slot.to} onChange={(e) => set(`settings.hours.${day}.${i}.to`, e.target.value)} />
                      <IconButton label={t('bot.hours.removeSlot')} size="sm" icon={<X className="size-4" />} onClick={() => set(`settings.hours.${day}`, slots.filter((_, j) => j !== i))} />
                    </div>
                    {err(`settings.hours.${day}.${i}`) ? <p role="alert" className="mt-1 text-xs text-danger">{err(`settings.hours.${day}.${i}`)}</p> : null}
                  </div>
                ))}
              </div>
              <Button size="xs" variant="ghost" icon={<Plus className="size-3.5" />} onClick={() => set(`settings.hours.${day}`, [...slots, { from: '09:00', to: '18:00' }])}>
                {t('bot.hours.addSlot')}
              </Button>
            </li>
          )
        })}
      </ul>
    </Panel>
  )

  const addKeyword = () => {
    const word = keyword.trim()
    if (!word) return
    if (!cfg.settings.escalation_keywords.some((k) => k.toLowerCase() === word.toLowerCase())) set('settings.escalation_keywords', [...cfg.settings.escalation_keywords, word])
    setKeyword('')
  }

  const handoffCard = (
    <Panel title={t('bot.handoff.title')} description={t('bot.handoff.description')}>
      <div className="space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <Switch
            checked={cfg.settings.handoff_summary}
            onCheckedChange={(v) => set('settings.handoff_summary', v)}
            label={head(t('bot.handoff.summary'), 'settings.handoff_summary')}
            description={t('bot.handoff.summaryHint')}
          />
          <Field label={head(t('bot.handoff.disclosure'), 'settings.disclosure_mode')} hint={t('bot.handoff.disclosureHint')}>
            <Select
              value={cfg.settings.disclosure_mode}
              onValueChange={(v) => set('settings.disclosure_mode', v)}
              options={(['first', 'always', 'off'] as const).map((v) => ({ value: v, label: t(`bot.handoff.disclosureModes.${v}`) }))}
            />
          </Field>
        </div>
        <div>
          <div className="mb-1.5 text-[13px] font-medium">{head(t('bot.handoff.keywords'), 'settings.escalation_keywords')}</div>
          <div className="flex flex-wrap gap-2">
            {cfg.settings.escalation_keywords.map((word) => (
              <span key={word} className="inline-flex items-center gap-1 rounded-pill border border-line bg-sunken py-0.5 pl-2.5 pr-1 text-[13px]">
                {word}
                <button
                  type="button"
                  className="grid size-5 place-items-center rounded-full text-muted hover:bg-line hover:text-ink"
                  aria-label={t('bot.handoff.removeKeyword', { word })}
                  onClick={() => set('settings.escalation_keywords', cfg.settings.escalation_keywords.filter((k) => k !== word))}
                >
                  <X className="size-3" />
                </button>
              </span>
            ))}
            {cfg.settings.escalation_keywords.length === 0 ? <span className="text-sm text-muted">{t('bot.handoff.noKeywords')}</span> : null}
          </div>
          <div className="mt-2 flex max-w-md gap-2">
            <Input
              value={keyword}
              placeholder={t('bot.handoff.keywordPlaceholder')}
              aria-label={t('bot.handoff.keywords')}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addKeyword()
                }
              }}
            />
            <Button variant="secondary" onClick={addKeyword} disabled={!keyword.trim()}>
              {t('bot.handoff.addKeyword')}
            </Button>
          </div>
          <p className="mt-1.5 text-xs text-muted">{t('bot.handoff.keywordsHint')}</p>
        </div>
      </div>
    </Panel>
  )

  const limitsCard = (
    <Panel title={head(t('bot.limits.title'), 'settings.limits')} description={t('bot.limits.description')}>
      <div className="grid gap-5 sm:grid-cols-2">
        {numField({ path: "settings.limits.per_minute", label: t('bot.limits.perMinute'), hint: t('bot.limits.perMinuteHint'), min: 1, max: 120 })}
        {numField({ path: "settings.limits.per_conversation", label: t('bot.limits.perConversation'), hint: t('bot.limits.perConversationHint'), min: 1, max: 500 })}
      </div>
      {isDefault ? (
        <div className="mt-6">
          <div className="mb-1 text-[13px] font-medium">{t('bot.limits.perChannel')}</div>
          <p className="mb-3 text-xs text-muted">{t('bot.limits.perChannelHint')}</p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {CHANNELS.map((channel) =>
              numField({ path: `settings.limits.per_channel.${channel}`, label: t(`channels.${channel}`), min: 0, max: 100000, step: 50 }),
            )}
          </div>
        </div>
      ) : null}
    </Panel>
  )

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
      noValidate
    >
      {top}
      {!canEdit ? <ReadOnlyNote>{t('bot.readOnly')}</ReadOnlyNote> : null}
      <fieldset disabled={!canEdit || saving} className="m-0 min-w-0 space-y-5 border-0 p-0">
        {languagesCard}
        {copyCard}
        {cannedCard}
        {groundingCard}
        {scopeCard}
        {hoursCard}
        {handoffCard}
        {limitsCard}
      </fieldset>
      {canEdit ? (
        <div
          className={cn(
            'sticky bottom-3 z-10 flex flex-wrap items-center gap-3 rounded-card border bg-panel px-4 py-3 shadow-pop transition-colors',
            dirty ? 'border-accent/40' : 'border-line',
          )}
        >
          <div className="min-w-0 flex-1 text-sm">
            {attempted && Object.keys(issues).length > 0 ? (
              <span className="text-danger">{t('bot.save.invalid', { count: Object.keys(issues).length })}</span>
            ) : dirty ? (
              <span>{t('bot.save.dirty')}</span>
            ) : (
              <span className="text-muted">{t('bot.save.clean')}</span>
            )}
          </div>
          <Button
            variant="ghost"
            disabled={!dirty || saving}
            onClick={() => {
              setCfg(base)
              setAttempted(false)
            }}
          >
            {t('bot.save.discard')}
          </Button>
          <Button type="submit" variant="primary" loading={saving} disabled={!dirty}>
            {t('bot.save.save')}
          </Button>
        </div>
      ) : null}
    </form>
  )
}

/** Wire the localized chrome of the language chips used by other components. */
export { LANGS }
