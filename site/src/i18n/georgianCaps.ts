import { useLayoutEffect } from 'react'

import type { Lang } from './lang'

/**
 * Georgian titles in capitals (Mtavruli) — a port of boulder-website's
 * `src/i18n/georgianCaps.js`.
 *
 * Why JavaScript and not `text-transform: uppercase`: Georgian has had a
 * capital alphabet in Unicode since 11.0 (U+1C90–1CBF), and
 * `String.prototype.toUpperCase` maps ordinary Mkhedruli onto it — but browsers
 * deliberately leave Georgian out of CSS `uppercase`, so it is a no-op there.
 * The letters are therefore converted in the DOM, inside the title elements
 * below, for as long as the page is in Georgian. The matching CSS rule in
 * `styles/boulder.css` ("Georgian titles") still uppercases any Latin in the
 * same titles, so every character of a title is a capital.
 *
 * Text nodes are rewritten in place and a MutationObserver re-applies it when
 * React writes new text into one. React diffs its own previous string against
 * its next one, never against the DOM, so a rewritten node stays rewritten
 * until React has something new to put there — which the observer catches.
 * Switching to English needs no undo: React replaces every string.
 *
 * `.ka-caps` is the portal's opt-in for anything that is a title but not one of
 * the classes below. Keep this list and the CSS rule's list the same.
 */
export const GEORGIAN_TITLE_SELECTOR = [
  'h1',
  'h2',
  'h3',
  'h4',
  '.ka-caps',
  '.hero-headline',
  '.section-title__word',
  '.section-title__sub',
  '.works-deck__label',
  '.works-card__name',
  '.detail-eyebrow',
  '.detail-title',
  '.detail-more__heading',
  '.detail-more__title',
  '.site-footer__title',
  '.site-footer__sub',
  '.site-footer__heading',
].join(',')

// Lowercase (Mkhedruli) letters that have a Mtavruli capital: U+10D0–10FA and
// U+10FD–10FF.
const MKHEDRULI = /[ა-ჺჽ-ჿ]/

function capitaliseText(node: Node): void {
  const text = node.nodeValue
  if (text && MKHEDRULI.test(text)) node.nodeValue = text.toUpperCase()
}

function capitaliseWithin(el: Element): void {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
  for (let node = walker.nextNode(); node; node = walker.nextNode()) capitaliseText(node)
}

/** Anything that changed: a text node inside a title, a title, or a subtree holding titles. */
function apply(node: Node): void {
  if (node.nodeType === Node.TEXT_NODE) {
    if (node.parentElement?.closest(GEORGIAN_TITLE_SELECTOR)) capitaliseText(node)
    return
  }
  if (!(node instanceof Element)) return
  if (node.closest(GEORGIAN_TITLE_SELECTOR)) {
    capitaliseWithin(node)
    return
  }
  node.querySelectorAll(GEORGIAN_TITLE_SELECTOR).forEach(capitaliseWithin)
}

/**
 * A layout effect, not boulder.ge's plain effect: this is a client-only SPA, so
 * the first Georgian render would otherwise paint once in lower case and then
 * jump. The provider's layout effect runs after its children are in the DOM
 * and before the browser paints.
 */
export function useGeorgianCaps(lang: Lang): void {
  useLayoutEffect(() => {
    if (lang !== 'ka') return undefined
    apply(document.body)
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        if (record.type === 'characterData') apply(record.target)
        else record.addedNodes.forEach(apply)
      }
    })
    observer.observe(document.body, { subtree: true, childList: true, characterData: true })
    return () => observer.disconnect()
  }, [lang])
}
