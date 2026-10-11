/**
 * Toasts (sonner). `<Toaster />` is mounted once in RootLayout; call
 * `toast.success(t('...'))` anywhere, or `toastError(error)` for a caught
 * ApiError (its message is an i18n key).
 */
import { Toaster as Sonner, toast } from 'sonner'

import i18n from '@/i18n'
import { ApiError } from '@/lib/api'
import { useResolvedTheme } from '@/shell/theme'

export { toast }

export function toastError(error: unknown): void {
  const message =
    error instanceof ApiError
      ? i18n.t(error.message, { defaultValue: i18n.t('common:errors.generic') })
      : i18n.t('common:errors.generic')
  toast.error(message)
}

export function Toaster() {
  const theme = useResolvedTheme()
  return (
    <Sonner
      theme={theme}
      position="top-center"
      offset={76}
      gap={8}
      visibleToasts={3}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            'flex w-[min(380px,calc(100vw-32px))] items-start gap-3 rounded-card border-[1.5px] border-line bg-panel px-4 py-3 text-[15px] text-ink shadow-pop font-sans',
          title: 'font-semibold leading-snug',
          description: 'text-sm text-muted',
          icon: 'mt-0.5 shrink-0 [&_svg]:size-5',
          success: '[&_[data-icon]]:text-success',
          error: 'border-danger/40 [&_[data-icon]]:text-danger',
          warning: '[&_[data-icon]]:text-warning',
          info: '[&_[data-icon]]:text-info',
          actionButton: 'ml-auto rounded-chip bg-primary px-2.5 py-1 text-sm font-semibold text-on-primary',
          cancelButton: 'rounded-chip px-2.5 py-1 text-sm text-muted',
        },
      }}
    />
  )
}
