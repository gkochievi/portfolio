import type { ReactNode } from 'react'
import * as RT from '@radix-ui/react-tooltip'

/** Mounted once by the RootLayout. */
export function TooltipProvider({ children }: { children: ReactNode }) {
  return (
    <RT.Provider delayDuration={350} skipDelayDuration={150}>
      {children}
    </RT.Provider>
  )
}

export interface TooltipProps {
  content: ReactNode
  children: ReactNode
  side?: 'top' | 'right' | 'bottom' | 'left'
  align?: 'start' | 'center' | 'end'
  /** Render children without a tooltip (e.g. when the label is visible). */
  disabled?: boolean
}

/** Ink tooltip; children must be a single focusable element (it is used asChild). */
export function Tooltip({ content, children, side = 'top', align = 'center', disabled }: TooltipProps) {
  if (disabled || content == null || content === '') return <>{children}</>
  return (
    <RT.Root>
      <RT.Trigger asChild>{children}</RT.Trigger>
      <RT.Portal>
        <RT.Content
          side={side}
          align={align}
          sideOffset={6}
          collisionPadding={8}
          className="z-[70] max-w-64 rounded-md bg-ink px-2 py-1 text-xs font-medium text-bg animate-fade-in"
        >
          {content}
        </RT.Content>
      </RT.Portal>
    </RT.Root>
  )
}
