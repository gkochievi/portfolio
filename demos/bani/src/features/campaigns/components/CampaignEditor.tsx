/** Editor card: dedicated ports (capped for non-superadmins), lines per port slider, max dial attempts. */
import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { Banner, Button, Card, CardBody, CardHeader, Field, Input, SegmentedControl } from '@/components/ui'
import { fieldErrors, messageOf } from '@/api/client'
import type { Campaign, CampaignSettings, CampaignUpdate } from '@/types'
import { campaignKeys, supportsPorts, useUpdateCampaign } from '../api'

type Attempts = 1 | 2 | 3
const REFETCH_AFTER_SAVE_MS = 1500

export function CampaignEditor({ campaign, settings }: { campaign: Campaign; settings: CampaignSettings | undefined }) {
  const { t } = useTranslation('campaigns')
  const qc = useQueryClient()
  const update = useUpdateCampaign()

  const [ports, setPorts] = useState(String(campaign.numDedicatedPorts))
  const [lines, setLines] = useState(campaign.linesPerPort)
  const [attempts, setAttempts] = useState<Attempts>(campaign.maxDialAttempts)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [portsError, setPortsError] = useState<string | null>(null)
  const timer = useRef<number | undefined>(undefined)

  const withPorts = supportsPorts(campaign.type)
  const cap = settings?.isSuperAdmin === false ? settings.maxDedicatedPortsNonSuperAdmin : null

  // Adopt server values (after the post-save refetch, or a change made elsewhere) unless the user has unsaved edits.
  const dirty = isDirty()
  const syncKey = `${campaign.numDedicatedPorts}|${campaign.linesPerPort}|${campaign.maxDialAttempts}`
  useEffect(() => {
    if (dirty) return
    setPorts(String(campaign.numDedicatedPorts))
    setLines(campaign.linesPerPort)
    setAttempts(campaign.maxDialAttempts)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncKey])

  useEffect(() => () => window.clearTimeout(timer.current), [])

  function isDirty(): boolean {
    const portsChanged = withPorts && ports.trim() !== String(campaign.numDedicatedPorts)
    const linesChanged = withPorts && Math.abs(lines - campaign.linesPerPort) > 0.001
    return portsChanged || linesChanged || attempts !== campaign.maxDialAttempts
  }

  const portsNum = ports.trim() === '' ? Number.NaN : Number(ports)
  const portsInvalid = withPorts && (!Number.isInteger(portsNum) || portsNum < 0)
  const portsChanged = withPorts && ports.trim() !== String(campaign.numDedicatedPorts)
  const overCap = withPorts && cap !== null && Number.isFinite(portsNum) && portsNum > cap

  const portsMessage =
    portsError ??
    (portsInvalid
      ? t('editor.errPortsInvalid')
      : overCap
        ? t(portsChanged ? 'editor.errPortsCap' : 'editor.errPortsCapExisting', { cap })
        : null)

  const touch = () => {
    setSaved(false)
    setError(null)
    setPortsError(null)
  }

  const discard = () => {
    setPorts(String(campaign.numDedicatedPorts))
    setLines(campaign.linesPerPort)
    setAttempts(campaign.maxDialAttempts)
    touch()
  }

  const save = () => {
    touch()
    if (portsChanged && (portsInvalid || overCap)) return
    const body: CampaignUpdate = {}
    if (portsChanged) body.numDedicatedPorts = portsNum
    if (withPorts && Math.abs(lines - campaign.linesPerPort) > 0.001) body.linesPerPort = lines
    if (attempts !== campaign.maxDialAttempts) body.maxDialAttempts = attempts
    update.mutate(
      { id: campaign.id, update: body },
      {
        onSuccess: () => {
          setSaved(true)
          // The original console re-reads the campaign from the contact centre a moment after saving.
          window.clearTimeout(timer.current)
          timer.current = window.setTimeout(() => {
            void qc.invalidateQueries({ queryKey: campaignKeys.one(campaign.id) })
            void qc.invalidateQueries({ queryKey: campaignKeys.list })
          }, REFETCH_AFTER_SAVE_MS)
        },
        onError: (err) => {
          const fields = fieldErrors(err)
          if (fields.numDedicatedPorts) setPortsError(fields.numDedicatedPorts)
          else setError(messageOf(err))
        },
      },
    )
  }

  return (
    <Card>
      <CardHeader title={t('editor.title')} subtitle={t('editor.subtitle')} />
      <CardBody className="space-y-6">
        {withPorts ? (
          <>
            <Field
              label={t('editor.ports')}
              htmlFor="cmp-ports"
              hint={portsMessage ? undefined : t('editor.portsHint')}
              error={portsMessage ?? undefined}
            >
              <Input
                id="cmp-ports"
                type="number"
                inputMode="numeric"
                min={0}
                step={1}
                value={ports}
                invalid={Boolean(portsMessage)}
                aria-invalid={Boolean(portsMessage)}
                className="max-w-[180px]"
                mono
                onChange={(e) => {
                  setPorts(e.target.value)
                  touch()
                }}
              />
            </Field>

            <Field label={t('editor.lines')} htmlFor="cmp-lines" hint={t('editor.linesHint')}>
              <div className="flex items-center gap-4">
                <input
                  id="cmp-lines"
                  type="range"
                  min={1}
                  max={3}
                  step={0.1}
                  value={lines}
                  onChange={(e) => {
                    setLines(Math.round(Number(e.target.value) * 10) / 10)
                    touch()
                  }}
                  className="h-2 min-w-0 flex-1 cursor-pointer accent-primary"
                />
                <output htmlFor="cmp-lines" className="w-12 shrink-0 text-right font-mono text-[15px] font-semibold tabular text-ink">
                  {lines.toFixed(1)}
                </output>
              </div>
              <div className="flex justify-between font-mono text-[11px] text-faint" aria-hidden>
                <span>1.0</span>
                <span>3.0</span>
              </div>
            </Field>
          </>
        ) : (
          <Banner tone="info">{t('editor.previewNote')}</Banner>
        )}

        <Field label={t('editor.attempts')} htmlFor="cmp-attempts" hint={t('editor.attemptsHint')}>
          <SegmentedControl<'1' | '2' | '3'>
            aria-label={t('editor.attempts')}
            value={String(attempts) as '1' | '2' | '3'}
            onChange={(v) => {
              setAttempts(Number(v) as Attempts)
              touch()
            }}
            options={[
              { value: '1', label: '1' },
              { value: '2', label: '2' },
              { value: '3', label: '3' },
            ]}
          />
        </Field>

        {saved && (
          <Banner tone="success" title={t('editor.saved')}>
            {t('editor.savedBody')}
          </Banner>
        )}
        {error && <Banner tone="danger">{error}</Banner>}

        <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
          <Button variant="primary" onClick={save} loading={update.isPending} disabled={!dirty || update.isPending}>
            {t('editor.save')}
          </Button>
          <Button variant="ghost" onClick={discard} disabled={!dirty || update.isPending}>
            {t('editor.discard')}
          </Button>
        </div>
      </CardBody>
    </Card>
  )
}
