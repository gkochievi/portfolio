import { useEffect, useState } from 'react'
import { Bell, Camera, Check, LogOut } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { useSignOut } from '@/app/session'
import { Avatar } from '@/components/Avatar'
import { AvatarPicker } from '@/components/AvatarPicker'
import { Badge, Button, Card, CardHeader, ConfirmDialog, ErrorState, Field, Input, Select, Skeleton, Switch, toast } from '@/components/ui'
import { errorMessage, fieldError } from '@/lib/api'
import { personName, pickText } from '@/lib/format'
import type { ContentLang } from '@/types'

import { useProfile, useUpdateProfile } from '../api'
import { OwnChats } from '../components/OwnChats'
import { StatsSection } from '../components/StatsSection'

/** /operator/profile: identity, settings, statistics and the operator's own chats. */
export default function ProfilePage() {
  const { t, i18n } = useTranslation('team')
  const lang = i18n.language === 'ka' ? 'ka' : 'en'
  const profile = useProfile()
  const update = useUpdateProfile()
  const signOut = useSignOut()
  const [pickerOpen, setPickerOpen] = useState(false)
  const [confirmOut, setConfirmOut] = useState(false)
  const [nickname, setNickname] = useState('')
  const operator = profile.data?.operator

  useEffect(() => {
    if (operator) setNickname(operator.nickname)
  }, [operator?.nickname]) // eslint-disable-line react-hooks/exhaustive-deps

  const save = (patch: Parameters<typeof update.mutate>[0], message?: string) =>
    update.mutate(patch, {
      onSuccess: () => message && toast.success(message),
      onError: (error) => toast.error(errorMessage(error)),
    })

  const nicknameError = update.isError && update.variables && 'nickname' in update.variables ? fieldError(update.error, 'nickname') : undefined
  const nicknameDirty = !!operator && nickname.trim() !== operator.nickname

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 md:px-6">
        <header>
          <h1 className="font-display text-2xl font-semibold">{t('profile.title')}</h1>
          <p className="text-sm text-muted">{t('profile.description')}</p>
        </header>

        {profile.isError ? (
          <ErrorState title={t('profile.error')} onRetry={() => void profile.refetch()} retryLabel={t('thread.retry')} />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <Card padding="md">
              <CardHeader title={t('profile.identity')} />
              {!operator ? (
                <div className="space-y-3"><Skeleton className="h-16 w-full" /><Skeleton className="h-10 w-full" /></div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <button type="button" onClick={() => setPickerOpen(true)} className="group relative rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" aria-label={t('profile.changeAvatar')}>
                      <Avatar name={personName(operator.name, lang)} avatarId={operator.avatarId} avatarUrl={operator.avatarUrl} size="xl" status={operator.status} />
                      <span className="absolute -bottom-1 -right-1 grid size-7 place-items-center rounded-full border border-line bg-panel text-ink group-hover:bg-hover" aria-hidden>
                        <Camera size={14} strokeWidth={1.75} />
                      </span>
                    </button>
                    <div className="min-w-0">
                      <h2 className="truncate font-display text-lg font-semibold">{personName(operator.name, lang)}</h2>
                      <p className="text-sm text-muted">@{operator.username} · #{operator.operatorNumber}</p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        <Badge size="sm" tone="muted">{t('role.operator')}</Badge>
                        <Badge size="sm" tone="outline">{pickText(profile.data?.tenant.name, lang)}</Badge>
                      </div>
                    </div>
                  </div>
                  <form
                    className="flex items-end gap-2"
                    onSubmit={(event) => {
                      event.preventDefault()
                      if (nicknameDirty) save({ nickname }, t('profile.saved'))
                    }}
                  >
                    <div className="flex-1">
                      <Field label={t('profile.nickname')} hint={t('profile.nicknameHint')} error={nicknameError} htmlFor="profile-nickname">
                        <Input id="profile-nickname" value={nickname} onChange={(event) => setNickname(event.target.value)} invalid={!!nicknameError} maxLength={40} />
                      </Field>
                    </div>
                    <Button type="submit" variant="secondary" size="md" disabled={!nicknameDirty} loading={update.isPending && !!update.variables && 'nickname' in update.variables} leftIcon={<Check size={16} />}>
                      {t('profile.save')}
                    </Button>
                  </form>
                  <dl className="grid grid-cols-2 gap-3 text-sm">
                    <div><dt className="text-xs text-muted">{t('profile.username')}</dt><dd className="font-mono">{operator.username}</dd></div>
                    <div><dt className="text-xs text-muted">{t('profile.number')}</dt><dd className="tabular font-mono">#{operator.operatorNumber}</dd></div>
                  </dl>
                </div>
              )}
            </Card>

            <Card padding="md">
              <CardHeader title={t('profile.settings')} />
              {!operator ? (
                <div className="space-y-3"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>
              ) : (
                <div className="space-y-5">
                  <Field label={t('profile.language')} hint={t('profile.languageHint')} htmlFor="profile-language">
                    <Select
                      id="profile-language"
                      value={operator.language}
                      onValueChange={(value) => save({ language: value as ContentLang }, t('profile.saved'))}
                      options={(['ka', 'en', 'ru'] as ContentLang[]).map((value) => ({ value, label: t(`profile.langs.${value}`) }))}
                    />
                  </Field>
                  <div className="flex items-start justify-between gap-4 border-t border-line pt-4">
                    <div className="flex items-start gap-3">
                      <Bell size={18} strokeWidth={1.75} className="mt-0.5 text-muted" aria-hidden />
                      <div>
                        <p className="text-sm font-medium">{t('profile.push')}</p>
                        <p className="text-xs text-muted">{t('profile.pushHint')}</p>
                      </div>
                    </div>
                    <Switch
                      aria-label={t('profile.push')}
                      checked={operator.pushEnabled}
                      onCheckedChange={(checked) => save({ pushEnabled: checked }, checked ? t('profile.pushOn') : t('profile.pushOff'))}
                    />
                  </div>
                  <div className="border-t border-line pt-4">
                    <Button variant="danger-outline" leftIcon={<LogOut size={16} />} onClick={() => setConfirmOut(true)}>
                      {t('profile.signOut')}
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          </div>
        )}

        <StatsSection />
        <OwnChats />
      </div>

      {operator ? (
        <AvatarPicker
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          name={personName(operator.name, lang)}
          value={{ avatarId: operator.avatarId, avatarUrl: operator.avatarUrl }}
          onChange={(value) => save(value, t('profile.avatarSaved'))}
        />
      ) : null}
      <ConfirmDialog
        open={confirmOut}
        onOpenChange={setConfirmOut}
        title={t('profile.signOutTitle')}
        description={t('profile.signOutDescription')}
        confirmLabel={t('profile.signOut')}
        tone="danger"
        onConfirm={() => signOut()}
      />
    </div>
  )
}
