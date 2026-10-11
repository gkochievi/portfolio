/** Shown while the first lazy route loads: the mark, dropping in. */
import { Logo } from '@/components/brand'

export function BootFallback() {
  return (
    <div className="grid min-h-dvh place-items-center bg-surface" aria-busy="true" role="status" aria-label="Tova">
      <div className="animate-drop-in">
        <Logo size={48} />
      </div>
    </div>
  )
}
