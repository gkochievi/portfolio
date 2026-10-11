/**
 * Lets a page put controls in the top bar's left slot.
 *
 *   <TopBarPortal><CampaignSwitcher/><AgentStatePill/></TopBarPortal>
 *
 * Renders nothing until the slot is mounted; unmounts with the page.
 */
import { useSyncExternalStore, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

let slot: HTMLElement | null = null
const listeners = new Set<() => void>()

/** Called by the top bar with its slot element (ref callback). */
export function registerTopBarSlot(el: HTMLElement | null): void {
  if (slot === el) return
  slot = el
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function TopBarPortal({ children }: { children: ReactNode }) {
  const target = useSyncExternalStore(subscribe, () => slot, () => null)
  return target ? createPortal(children, target) : null
}
