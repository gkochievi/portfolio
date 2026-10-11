/**
 * Survey (/survey?id=): validate the one-time token, then collect 1-5 star
 * ratings and an optional comment, submit once and hand over to /finished.
 * Owner: feature group survey.
 */
import { CalendarClock, Info, Inbox } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'

import { useRespondentTenant } from '@/components/layout/RespondentLayout'
import { ActionBar, BarsLoader, BubbleCard, Button, EmptyState, Field, TenantMark, Textarea, toast } from '@/components/ui'
import { useLang } from '@/hooks/useLang'
import { formatDate } from '@/lib/format'
import { SURVEY_MESSAGES } from '@/types'
import { failureRoute, useSubmitSurvey, useValidateSurvey } from '../api'
import { QuestionCard } from '../components/QuestionCard'
import { SubmitButton, SurveyProgress, type SubmitPhase } from '../components/SurveyBits'

const COMMENT_MAX = 500

export default function SurveyPage() {
  const [params] = useSearchParams()
  const surveyId = params.get('id')?.trim() || null
  if (!surveyId) return <MissingId />
  return <SurveyFlow key={surveyId} surveyId={surveyId} />
}

function MissingId() {
  const { t } = useTranslation('survey')
  return (
    <div className="flex min-h-[62vh] flex-col justify-center">
      <EmptyState
        illustration="invalid"
        title={t('missing.title')}
        description={t('missing.description')}
        action={
          <Button asChild variant="brand" leftIcon={<Inbox strokeWidth={1.75} />}>
            <Link to="/">{t('missing.back')}</Link>
          </Button>
        }
      />
    </div>
  )
}

function SurveyFlow({ surveyId }: { surveyId: string }) {
  const { t } = useTranslation('survey')
  const lang = useLang()
  const navigate = useNavigate()
  const validate = useValidateSurvey(surveyId, lang)
  const submit = useSubmitSurvey()

  // Form state lives above the loading gate, keyed by question id, so it survives a language switch.
  const [ratings, setRatings] = useState<Record<number, number>>({})
  const [comment, setComment] = useState('')
  const [phase, setPhase] = useState<SubmitPhase>('idle')
  const busy = useRef(false)
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(timer.current), [])

  const envelope = validate.data
  const survey = envelope?.success ? envelope.data : null

  // Route the failures exactly like the source: by message text, always replacing history.
  useEffect(() => {
    if (validate.isPlaceholderData || phase !== 'idle') return
    if (validate.isError) {
      navigate('/finished', { replace: true })
      return
    }
    if (envelope && !envelope.success) navigate(failureRoute(envelope.message, envelope.meta?.tenantId), { replace: true })
  }, [envelope, validate.isError, validate.isPlaceholderData, phase, navigate])

  useRespondentTenant(survey?.tenant)

  if (!survey) {
    return (
      <div className="grid min-h-[68vh] place-items-center">
        <div className="flex flex-col items-center gap-4 text-brand">
          <BarsLoader size="lg" label={t('loading')} className="text-brand" />
          <p className="text-sm text-muted">{t('loading')}</p>
        </div>
      </div>
    )
  }

  const { questions, campaign, tenant, context } = survey
  const total = questions.length
  const answered = questions.filter((question) => (ratings[question.id] ?? 0) > 0).length
  const skipped = total - answered

  const onSubmit = (event?: FormEvent) => {
    event?.preventDefault()
    if (busy.current) return
    busy.current = true
    setPhase('sending')
    submit.mutate(
      {
        survey_id: surveyId,
        responses: questions.map((question) => ({ id: question.id, question_rate: ratings[question.id] ?? null })),
        comment: comment.trim(),
      },
      {
        onSuccess: (result) => {
          if (result.success) {
            setPhase('done')
            const next = `/finished?t=${encodeURIComponent(tenant.id)}&r=${encodeURIComponent(result.data.responseId)}`
            timer.current = window.setTimeout(() => navigate(next, { replace: true }), 700)
            return
          }
          busy.current = false
          setPhase('idle')
          const reason =
            result.message === SURVEY_MESSAGES.expired
              ? t('submit.errorExpired')
              : result.message === SURVEY_MESSAGES.completed
                ? t('submit.errorCompleted')
                : t('submit.errorRetry')
          toast.error(t('submit.error'), { description: reason })
        },
        onError: () => {
          busy.current = false
          setPhase('idle')
          toast.error(t('submit.error'), { description: t('submit.errorRetry') })
        },
      },
    )
  }

  const contextParts = [context.touchpoint, context.branch, context.staff, formatDate(context.interactionAt, lang)].filter(Boolean)
  const locked = phase !== 'idle'

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-1 flex-col gap-4 pb-2">
      <BubbleCard tone="tint" padding="lg" className="animate-fade-up">
        <div className="flex items-center justify-between gap-3">
          <TenantMark monogram={tenant.monogram} primary={tenant.primary} onPrimary={tenant.onPrimary} size="md" title={tenant.name} />
          <SurveyProgress answered={answered} total={total} />
        </div>
        <p className="mt-5 text-sm font-semibold text-brand">{t('intro.eyebrow')}</p>
        <h1 className="mt-1 font-display text-[27px] leading-tight font-semibold text-ink text-balance">
          {campaign.title || t('intro.fallbackTitle')}
        </h1>
        {campaign.description && <p className="mt-2.5 text-[15px] text-ink/80 text-pretty">{campaign.description}</p>}
        {contextParts.length > 0 && (
          <p className="mt-4 text-[13px] leading-relaxed text-muted">
            <span className="sr-only">{t('intro.contextLabel')}: </span>
            {contextParts.join(' · ')}
          </p>
        )}
        <p className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-muted">
          <CalendarClock aria-hidden="true" strokeWidth={1.75} className="size-3.5" />
          {t('intro.openUntil', { date: formatDate(context.expiresAt, lang) })} · {t('intro.time')}
        </p>
      </BubbleCard>

      {questions.map((question, index) => (
        <QuestionCard
          key={question.id}
          index={index}
          total={total}
          text={question.question_text}
          value={ratings[question.id] ?? 0}
          onChange={(value) => setRatings((current) => ({ ...current, [question.id]: value }))}
          disabled={locked}
        />
      ))}

      <BubbleCard padding="md" className="animate-fade-up">
        <Field label={t('comment.label')} hint={t('comment.hint')} optional>
          <Textarea
            value={comment}
            onChange={(event) => setComment(event.target.value.slice(0, COMMENT_MAX))}
            maxLength={COMMENT_MAX}
            showCount
            rows={4}
            placeholder={t('comment.placeholder')}
            disabled={locked}
          />
        </Field>
      </BubbleCard>

      <ActionBar className="mt-2 max-[520px]:pb-[76px]">
        <p role="status" className="mb-2.5 flex min-h-5 items-center justify-center gap-1.5 text-center text-[13px] text-muted">
          {answered > 0 && skipped > 0 && <Info aria-hidden="true" strokeWidth={1.75} className="size-4 shrink-0 text-brand" />}
          {answered === 0 ? t('submit.optional') : skipped > 0 ? t('submit.skipped', { count: skipped }) : t('submit.allDone')}
        </p>
        <SubmitButton phase={phase} />
      </ActionBar>
    </form>
  )
}
