/**
 * Toasts: a thin sonner wrapper so every feature uses
 * the same calls. `<Toaster/>` (from `@/components/ui`) is mounted once by the shell.
 *
 *   toast.success(t('saved'))
 *   toast.error(errorMessage(err))   or   toastError(err)
 */
import { toast as sonner } from 'sonner'

import { errorMessage } from '@/lib/api'

type Opts = { description?: string; duration?: number; id?: string | number }

export const toast = {
  message: (title: string, opts?: Opts) => sonner(title, opts),
  success: (title: string, opts?: Opts) => sonner.success(title, opts),
  error: (title: string, opts?: Opts) => sonner.error(title, opts),
  info: (title: string, opts?: Opts) => sonner.info(title, opts),
  warning: (title: string, opts?: Opts) => sonner.warning(title, opts),
  dismiss: (id?: string | number) => sonner.dismiss(id),
}

/** Toast whatever a request rejected with. */
export function toastError(error: unknown, fallbackTitle?: string): void {
  const message = errorMessage(error)
  if (fallbackTitle) sonner.error(fallbackTitle, { description: message })
  else sonner.error(message)
}
