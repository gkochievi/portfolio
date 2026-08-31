import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'

/**
 * Shared behaviour for every layer that covers the page: the modal, the photo
 * lightbox, the command palette and the mobile drawer.
 *
 * Each used to hand-roll this, which produced two bugs: nested overlays saved
 * and restored `body.style.overflow` in the wrong order (leaving the page
 * permanently unscrollable after deleting a photo from the lightbox), and
 * Escape closed every open layer at once instead of just the top one.
 */

/* ------------------------------------------------------------ scroll lock */

let lockCount = 0
let savedOverflow = ''
let savedPaddingRight = ''

function lockBodyScroll(): () => void {
  if (lockCount === 0) {
    savedOverflow = document.body.style.overflow
    savedPaddingRight = document.body.style.paddingRight
    const scrollbar = window.innerWidth - document.documentElement.clientWidth
    document.body.style.overflow = 'hidden'
    if (scrollbar > 0) document.body.style.paddingRight = `${scrollbar}px`
  }
  lockCount += 1

  let released = false
  return () => {
    if (released) return
    released = true
    lockCount = Math.max(0, lockCount - 1)
    // Only the outermost overlay restores, so nesting cannot strand the page.
    if (lockCount === 0) {
      document.body.style.overflow = savedOverflow
      document.body.style.paddingRight = savedPaddingRight
    }
  }
}

/* ------------------------------------------------------------ focus trap */

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ')

function focusableWithin(container: HTMLElement | null): HTMLElement[] {
  if (!container) return []
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (element) => element.offsetParent !== null || element === document.activeElement,
  )
}

function keepFocusInside(container: HTMLElement | null, event: KeyboardEvent): void {
  const focusable = focusableWithin(container)
  if (!focusable.length) return

  const first = focusable[0]
  const last = focusable[focusable.length - 1]

  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}

/* --------------------------------------------------------- overlay stack */

const stack: symbol[] = []

function isTopmost(id: symbol): boolean {
  return stack[stack.length - 1] === id
}

/* ----------------------------------------------------------- useOverlay */

export interface OverlayOptions {
  open: boolean
  onClose: () => void
  containerRef: RefObject<HTMLElement | null>
  /** Move focus into the layer once it opens. */
  autoFocus?: boolean
}

export function useOverlay({ open, onClose, containerRef, autoFocus = true }: OverlayOptions): void {
  // Callers pass a fresh arrow function every render; depending on it here
  // would tear the effect down mid-interaction and steal focus back.
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!open) return

    const id = Symbol('overlay')
    stack.push(id)

    const previouslyFocused = document.activeElement as HTMLElement | null
    const releaseScroll = lockBodyScroll()

    const onKeyDown = (event: KeyboardEvent) => {
      if (!isTopmost(id)) return
      if (event.key === 'Escape') {
        event.stopPropagation()
        onCloseRef.current()
        return
      }
      if (event.key === 'Tab') {
        keepFocusInside(containerRef.current, event)
      }
    }

    document.addEventListener('keydown', onKeyDown, true)

    let focusTimer = 0
    if (autoFocus) {
      focusTimer = window.setTimeout(() => {
        const container = containerRef.current
        if (!container) return
        const preferred = container.querySelector<HTMLElement>('[data-autofocus]')
        ;(preferred ?? focusableWithin(container)[0] ?? container).focus()
      }, 40)
    }

    return () => {
      window.clearTimeout(focusTimer)
      document.removeEventListener('keydown', onKeyDown, true)
      releaseScroll()

      const index = stack.lastIndexOf(id)
      if (index !== -1) stack.splice(index, 1)

      // Returning focus to whatever opened the layer keeps keyboard flow intact.
      if (previouslyFocused?.isConnected) previouslyFocused.focus?.()
    }
  }, [open, autoFocus, containerRef])
}
