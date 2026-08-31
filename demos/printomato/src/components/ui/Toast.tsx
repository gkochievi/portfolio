import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AlertOctagon, CheckCircle2, Info, X } from 'lucide-react'

import { cn } from '@/lib/cn'

export type ToastTone = 'success' | 'error' | 'info' | 'alert'

export interface Toast {
  id: number
  tone: ToastTone
  title: string
  body?: string
  /** Milliseconds before auto-dismissal; 0 keeps it until dismissed. */
  duration?: number
  href?: string
}

interface ToastContextValue {
  push: (toast: Omit<Toast, 'id'>) => number
  dismiss: (id: number) => void
  success: (title: string, body?: string) => void
  error: (title: string, body?: string) => void
  info: (title: string, body?: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const TONE_STYLES: Record<ToastTone, { icon: typeof Info; accent: string; ring: string }> = {
  success: { icon: CheckCircle2, accent: 'text-online', ring: 'border-online/30' },
  error: { icon: AlertOctagon, accent: 'text-danger', ring: 'border-danger/30' },
  alert: { icon: AlertOctagon, accent: 'text-warn', ring: 'border-warn/30' },
  info: { icon: Info, accent: 'text-info', ring: 'border-info/30' },
}

const MAX_VISIBLE = 5

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(1)
  const timers = useRef(new Map<number, number>())

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id)
    if (timer) {
      window.clearTimeout(timer)
      timers.current.delete(id)
    }
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const push = useCallback(
    (toast: Omit<Toast, 'id'>) => {
      const id = nextId.current++
      setToasts((current) => [...current, { ...toast, id }].slice(-MAX_VISIBLE))

      const duration = toast.duration ?? 5000
      if (duration > 0) {
        timers.current.set(id, window.setTimeout(() => dismiss(id), duration))
      }
      return id
    },
    [dismiss],
  )

  const value = useMemo<ToastContextValue>(
    () => ({
      push,
      dismiss,
      success: (title, body) => void push({ tone: 'success', title, body }),
      error: (title, body) => void push({ tone: 'error', title, body, duration: 7000 }),
      info: (title, body) => void push({ tone: 'info', title, body }),
    }),
    [push, dismiss],
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      {createPortal(
        <div
          className="pointer-events-none fixed top-3 right-3 z-[200] flex w-[min(23rem,calc(100vw-1.5rem))] flex-col gap-2"
          role="region"
          aria-label="Notifications"
        >
          {toasts.map((toast) => {
            const { icon: Icon, accent, ring } = TONE_STYLES[toast.tone]
            return (
              <div
                key={toast.id}
                role="status"
                className={cn(
                  'animate-slide-in pointer-events-auto flex gap-3 rounded-control border bg-surface-2/95 p-3',
                  'shadow-raised backdrop-blur-md',
                  ring,
                )}
              >
                <Icon className={cn('mt-0.5 size-4.5 shrink-0', accent)} aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ink">{toast.title}</p>
                  {toast.body && <p className="mt-0.5 text-xs leading-relaxed text-ink-faint">{toast.body}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => dismiss(toast.id)}
                  aria-label="Dismiss"
                  className="-m-1 h-fit shrink-0 rounded p-1 text-ink-faint transition-colors hover:text-ink"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            )
          })}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast must be used inside a ToastProvider')
  return context
}
