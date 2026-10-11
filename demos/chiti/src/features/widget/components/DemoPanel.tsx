/**
 * The storefront's demo control panel (demo chrome, not product): flips the
 * hidden states of the widget so every screen can be shown in a minute.
 */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, Copy, ExternalLink, MonitorPlay, RotateCcw, SlidersHorizontal, X, Zap } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button, IconButton, Select, SegmentedControl, Switch, toast } from '@/components/ui'
import { cn } from '@/lib/cn'
import type { Lang, ThemePreset, WidgetPosition } from '@/types'

import { useDemoControls, usePatchDemoControls, usePatchWidgetControls, useWidgetConfig, type HoursMode } from '../api'
import { getWidget, useWidget } from '../controller'
import { THEME_PRESETS, themeSwatch } from '../themes'

const BANNED_IP = '203.0.113.66'
const NORMAL_IP = '198.51.100.24'
const BANNED_PHONE = '+995 555 00 66 66'

function embedSnippet(tenant: string, locale: Lang, position: WidgetPosition): string {
  return `<script src="https://cdn.chiti.example/widget.js"></script>\n<script>\n  new ChitiWidget({ tenant: '${tenant}', locale: '${locale}', position: '${position}' }).mount()\n</script>`
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const area = document.createElement('textarea')
    area.value = text
    area.setAttribute('readonly', '')
    area.style.position = 'fixed'
    area.style.opacity = '0'
    document.body.appendChild(area)
    area.select()
    let ok = false
    try {
      ok = document.execCommand('copy')
    } catch {
      ok = false
    }
    area.remove()
    return ok
  }
}

function Row({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 border-t border-line pt-3">
      <p className="m-0 text-[12px] font-medium text-muted">{title}</p>
      {children}
    </div>
  )
}

export function DemoPanel({ slug }: { slug: string }) {
  const { t, i18n } = useTranslation('widget')
  const lang: Lang = i18n.language?.startsWith('ka') ? 'ka' : 'en'
  const config = useWidgetConfig(slug).data
  const controls = useDemoControls().data
  const patchControls = usePatchDemoControls()
  const patchWidget = usePatchWidgetControls(slug)
  const [widgetState] = useWidget(slug)
  const [open, setOpen] = useState(() => typeof window !== 'undefined' && window.matchMedia('(min-width: 1440px)').matches)
  const [copied, setCopied] = useState(false)

  const side: WidgetPosition = config?.widgetPosition ?? 'right'
  const banned = controls?.simulatedIp === BANNED_IP
  const snippet = embedSnippet(slug, lang, side)

  const setBanned = (on: boolean) => {
    patchControls.mutate({ simulatedIp: on ? BANNED_IP : NORMAL_IP })
    const phoneField = config?.fields.find((field) => field.type === 'phone')
    const widget = getWidget(slug)
    if (phoneField && !widget.getSnapshot().sessionId) widget.setValue(phoneField.id, on ? BANNED_PHONE : '+995 555 00 12 34')
  }

  const copy = async () => {
    const ok = await copyText(snippet)
    if (ok) {
      setCopied(true)
      toast.success(t('demo.copied'))
      setTimeout(() => setCopied(false), 1_800)
    } else {
      toast.error(t('demo.copyFailed'))
    }
  }

  const wrapper = cn('fixed bottom-[68px] z-[45]', side === 'right' ? 'left-4' : 'right-4', open && 'max-sm:inset-x-3', widgetState.open && 'max-sm:hidden')

  if (!open) {
    return (
      <div className={wrapper}>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded={false}
          className="inline-flex items-center gap-2 rounded-full border-[1.5px] border-ink bg-panel px-4 py-2.5 text-[13.5px] font-medium text-ink shadow-pop hover:bg-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <SlidersHorizontal size={16} strokeWidth={1.75} aria-hidden />
          {t('demo.title')}
        </button>
      </div>
    )
  }

  return (
    <aside className={wrapper} aria-label={t('demo.title')}>
      <div className="flex max-h-[calc(100dvh-6rem)] w-[320px] flex-col gap-3 overflow-y-auto rounded-modal border border-line bg-panel p-4 text-ink shadow-pop animate-pop-in max-sm:w-auto">
        <div className="flex items-center justify-between gap-2">
          <h2 className="m-0 flex items-center gap-2 font-display text-[16px] font-semibold">
            <SlidersHorizontal size={17} strokeWidth={1.75} aria-hidden />
            {t('demo.title')}
          </h2>
          <IconButton label={t('demo.collapse')} icon={<X size={17} strokeWidth={1.75} />} variant="ghost" size="sm" onClick={() => setOpen(false)} />
        </div>
        <p className="m-0 text-[12.5px] leading-snug text-muted">{t('demo.intro')}</p>

        <Button asChild variant="primary" block leftIcon={<MonitorPlay size={17} strokeWidth={1.75} />}>
          <Link to="/live">{t('demo.liveDesk')}</Link>
        </Button>
        <Button asChild variant="outline" size="sm" block leftIcon={<ExternalLink size={15} strokeWidth={1.75} />}>
          <Link to="/widget">{t('demo.widgetPage')}</Link>
        </Button>

        <Row title={t('demo.position')}>
          <SegmentedControl<WidgetPosition>
            aria-label={t('demo.position')}
            value={side}
            onChange={(value) => patchWidget.mutate({ widgetPosition: value })}
            options={[
              { value: 'left', label: t('demo.left') },
              { value: 'right', label: t('demo.right') },
            ]}
          />
        </Row>

        <Row title={t('demo.language')}>
          <SegmentedControl<Lang>
            aria-label={t('demo.language')}
            value={lang}
            onChange={(value) => void i18n.changeLanguage(value)}
            options={[
              { value: 'en', label: 'English' },
              { value: 'ka', label: 'ქართული' },
            ]}
          />
        </Row>

        <Row title={t('demo.theme')}>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t('demo.theme')}>
            {THEME_PRESETS.map((preset: ThemePreset) => {
              const active = config?.clientTheme === preset
              return (
                <button
                  key={preset}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  aria-label={t(`demo.themes.${preset}`)}
                  title={t(`demo.themes.${preset}`)}
                  onClick={() => patchWidget.mutate({ clientTheme: preset })}
                  className={cn(
                    'grid size-7 place-items-center rounded-full border-[1.5px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                    active ? 'border-ink ring-2 ring-accent ring-offset-2 ring-offset-panel' : 'border-line-strong',
                  )}
                  style={{ background: themeSwatch(preset) }}
                >
                  {active && <Check size={14} strokeWidth={2.5} aria-hidden className={preset === 'canary' ? 'text-ink' : 'text-white'} />}
                </button>
              )
            })}
          </div>
        </Row>

        <Row title={t('demo.hours')}>
          <Select<HoursMode>
            aria-label={t('demo.hours')}
            value={config?.hours.mode}
            onValueChange={(value) => patchWidget.mutate({ hoursMode: value })}
            options={[
              { value: 'open', label: t('demo.hoursOpen') },
              { value: 'closed', label: t('demo.hoursClosed') },
              { value: 'temporary', label: t('demo.hoursTemporary') },
              { value: 'auto', label: t('demo.hoursAuto') },
            ]}
          />
        </Row>

        <Row title={t('demo.behaviour')}>
          <Switch
            labelFirst
            checked={!!config?.aiBotEnabled}
            onCheckedChange={(value) => patchWidget.mutate({ aiBotEnabled: value })}
            label={t('demo.bot')}
            description={t('demo.botHint')}
          />
          <Switch
            labelFirst
            checked={!!controls?.fastInactivity}
            onCheckedChange={(value) => patchControls.mutate({ fastInactivity: value })}
            label={t('demo.fastInactivity')}
            description={t('demo.fastInactivityHint')}
          />
          <Switch
            labelFirst
            checked={!!controls?.spawnerEnabled}
            onCheckedChange={(value) => patchControls.mutate({ spawnerEnabled: value })}
            label={t('demo.spawner')}
            description={t('demo.spawnerHint')}
          />
          <Switch labelFirst checked={banned} onCheckedChange={setBanned} label={t('demo.banned')} description={t('demo.bannedHint', { phone: BANNED_PHONE, ip: BANNED_IP })} />
        </Row>

        <Row title={t('demo.tools')}>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" leftIcon={<Zap size={15} strokeWidth={1.75} />} onClick={() => patchControls.mutate({ aiOutageSeconds: 45 })}>
              {t('demo.aiOutage')}
            </Button>
            <Button variant="outline" size="sm" leftIcon={<RotateCcw size={15} strokeWidth={1.75} />} onClick={() => getWidget(slug).reset()}>
              {t('demo.resetChat')}
            </Button>
          </div>
        </Row>

        <Row title={t('demo.embed')}>
          <pre className="m-0 overflow-x-auto rounded-ui border border-line bg-sunken p-2.5 font-mono text-[11px] leading-snug text-ink">{snippet}</pre>
          <Button variant="secondary" size="sm" leftIcon={copied ? <Check size={15} strokeWidth={2} /> : <Copy size={15} strokeWidth={1.75} />} onClick={copy}>
            {copied ? t('demo.copiedShort') : t('demo.copy')}
          </Button>
        </Row>
      </div>
    </aside>
  )
}
