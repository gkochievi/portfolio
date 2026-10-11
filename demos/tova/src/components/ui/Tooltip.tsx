import * as RT from '@radix-ui/react-tooltip'
import type { ReactNode } from 'react'

export interface TooltipProps {
  content: ReactNode
  /** One focusable element (a button, a link). */
  children: ReactNode
  side?: 'top' | 'right' | 'bottom' | 'left'
  /** Skip the tooltip entirely (e.g. when a label is already visible). */
  disabled?: boolean
}

export function Tooltip({ content, children, side = 'top', disabled }: TooltipProps) {
  if (disabled) return <>{children}</>
  return (
    <RT.Provider delayDuration={250}>
      <RT.Root>
        <RT.Trigger asChild>{children}</RT.Trigger>
        <RT.Portal>
          <RT.Content
            side={side}
            sideOffset={6}
            className="z-[90] max-w-[260px] rounded-chip bg-ink px-2.5 py-1.5 text-xs font-medium text-surface shadow-pop data-[state=delayed-open]:animate-fade-in"
          >
            {content}
            <RT.Arrow className="fill-ink" />
          </RT.Content>
        </RT.Portal>
      </RT.Root>
    </RT.Provider>
  )
}
