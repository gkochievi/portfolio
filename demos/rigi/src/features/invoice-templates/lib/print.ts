/**
 * CROSS-GROUP CONTRACT. Owner: invoice-templates.
 * Print a rendered invoice document (HTML from GET /api/invoices/:id/document
 * or GET /api/portal/invoices/:id/document) through a hidden iframe, so the
 * browser's "Save as PDF" produces the PDF. Consumed by invoicing and ledger.
 *
 * The frame is sandboxed without `allow-scripts`: whatever a template author
 * wrote can style the page but never run code. `allow-same-origin` lets the
 * bundled fonts load (same origin, no network) and `allow-modals` lets the
 * print dialog open.
 */
export function printHtml(html: string, title = 'Invoice'): void {
  const label = title.replace(/\.pdf$/i, '')
  const frame = document.createElement('iframe')
  frame.setAttribute('aria-hidden', 'true')
  frame.setAttribute('sandbox', 'allow-same-origin allow-modals')
  frame.title = label
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:210mm;height:297mm;border:0;opacity:0;pointer-events:none;'

  const previousTitle = document.title
  let cleaned = false
  const cleanup = () => {
    if (cleaned) return
    cleaned = true
    document.title = previousTitle
    frame.remove()
  }

  frame.onload = () => {
    const win = frame.contentWindow
    if (!win) return cleanup()
    const finish = () => window.setTimeout(cleanup, 500)
    win.addEventListener('afterprint', finish)
    // Browsers name the saved PDF after the top document's title.
    document.title = label
    const fonts = (frame.contentDocument as (Document & { fonts?: { ready: Promise<unknown> } }) | null)?.fonts
    const go = () => {
      try {
        win.focus()
        win.print()
      } finally {
        // Browsers that do not fire afterprint still get tidied up.
        window.setTimeout(cleanup, 60_000)
      }
    }
    // Wait for the Georgian face so the first print is not set in a fallback font.
    if (fonts?.ready) void fonts.ready.then(go, go)
    else go()
  }
  frame.srcdoc = html
  document.body.appendChild(frame)
}
