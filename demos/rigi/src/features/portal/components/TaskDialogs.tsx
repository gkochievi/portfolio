/** Cancel, approve & verify and send-back dialogs for the partner task page. Owner: portal. */
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { errorMessage, fieldErrorsOf } from '@/api/client'
import { Button, ConfirmDialog, Dialog, Field, Textarea, toast } from '@/components/ui'
import { formatMoney, formatPoints } from '@/lib/format'

import { useCancelPortalTask, useSendBackPortalTask, useVerifyPortalTask, type PortalTaskDetail } from '../api'

interface DialogProps {
  task: PortalTaskDetail
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CancelTaskDialog({ task, open, onOpenChange }: DialogProps) {
  const { t } = useTranslation('portal')
  const cancel = useCancelPortalTask(task.id)
  const [note, setNote] = useState('')

  useEffect(() => {
    if (open) setNote('')
  }, [open])

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      tone="danger"
      title={t('task.cancel.title')}
      description={t('task.cancel.body')}
      confirmLabel={t('task.cancel.confirm')}
      cancelLabel={t('task.cancel.keep')}
      pending={cancel.isPending}
      onConfirm={() =>
        cancel.mutate(note.trim(), {
          onSuccess: () => {
            toast.success(t('task.cancel.done'))
            onOpenChange(false)
          },
          onError: (error) => toast.error(errorMessage(error)),
        })
      }
    >
      <Field label={t('task.cancel.note')} htmlFor="cancel-note">
        <Textarea id="cancel-note" rows={3} value={note} maxLength={2000} placeholder={t('task.cancel.notePlaceholder')} onChange={(e) => setNote(e.target.value)} />
      </Field>
    </ConfirmDialog>
  )
}

export function VerifyTaskDialog({ task, open, onOpenChange }: DialogProps) {
  const { t } = useTranslation('portal')
  const verify = useVerifyPortalTask(task.id)
  const p = task.verifyPreview
  const money = (n: number) => formatMoney(n, p.currency)

  let billing: string
  if (!p.billable) billing = t('task.verify.notBillable')
  else if (p.chargeable <= 0) billing = t('task.verify.covered', { points: formatPoints(p.points, { unit: false }), free: formatPoints(p.freeRemaining, { unit: false }) })
  else if (p.freeRemaining <= 0) {
    billing = t('task.verify.overAll', { points: formatPoints(p.points, { unit: false }), over: formatPoints(p.chargeable, { unit: false }), amount: money(p.chargeAmount), rate: money(p.ratePerPoint) })
  } else {
    billing = t('task.verify.over', {
      points: formatPoints(p.points, { unit: false }),
      free: formatPoints(p.freeRemaining, { unit: false }),
      over: formatPoints(p.chargeable, { unit: false }),
      amount: money(p.chargeAmount),
      rate: money(p.ratePerPoint),
    })
  }

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('task.verify.title', { number: task.number })}
      description={t('task.verify.intro')}
      confirmLabel={t('task.verify.confirm')}
      pending={verify.isPending}
      onConfirm={() =>
        verify.mutate(undefined, {
          onSuccess: () => {
            toast.success(t('task.verify.done'))
            onOpenChange(false)
          },
          onError: (error) => toast.error(errorMessage(error)),
        })
      }
    >
      <p className="rounded-md bg-sunken px-3 py-2.5 text-[13px] leading-relaxed">{billing}</p>
    </ConfirmDialog>
  )
}

export function SendBackDialog({ task, open, onOpenChange }: DialogProps) {
  const { t } = useTranslation('portal')
  const sendBack = useSendBackPortalTask(task.id)
  const [comment, setComment] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setComment('')
      setError(null)
    }
  }, [open])

  const submit = () => {
    const text = comment.trim()
    if (!text) return setError(t('task.sendBack.required'))
    if (text.length > 10000) return setError(t('task.sendBack.max'))
    setError(null)
    sendBack.mutate(text, {
      onSuccess: () => {
        toast.success(t('task.sendBack.done'))
        onOpenChange(false)
      },
      onError: (err) => {
        const fields = fieldErrorsOf(err)
        if (fields.comment) setError(fields.comment)
        else toast.error(errorMessage(err))
      },
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !sendBack.isPending && onOpenChange(next)}
      title={t('task.sendBack.title')}
      description={t('task.sendBack.body')}
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={sendBack.isPending}>
            {t('common:actions.cancel')}
          </Button>
          <Button onClick={submit} loading={sendBack.isPending}>
            {t('task.sendBack.confirm')}
          </Button>
        </>
      }
    >
      <Field label={t('task.sendBack.comment')} htmlFor="sendback-comment" required error={error ?? undefined}>
        <Textarea
          id="sendback-comment"
          rows={5}
          value={comment}
          invalid={Boolean(error)}
          placeholder={t('task.sendBack.placeholder')}
          onChange={(e) => {
            setComment(e.target.value)
            if (error) setError(null)
          }}
        />
      </Field>
    </Dialog>
  )
}
