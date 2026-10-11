/** Mail HTML in a fully sandboxed iframe (sandbox="": no scripts, no forms, no same-origin). */
export function HtmlBody({ html, title }: { html: string; title: string }) {
  const doc = `<!doctype html><html><head><meta charset="utf-8"><base target="_blank"><style>
    body{margin:16px;font:14px/1.55 -apple-system,"Segoe UI",system-ui,"Noto Sans Georgian",sans-serif;color:#1d1f1c;background:#fff;word-wrap:break-word}
    img{max-width:100%;height:auto}a{color:#17613a}table{border-collapse:collapse}td,th{padding:4px 8px;border:1px solid #ddd}blockquote{margin:8px 0;padding-left:12px;border-left:3px solid #ddd;color:#555}
  </style></head><body>${html}</body></html>`
  return <iframe title={title} sandbox="" srcDoc={doc} className="h-[420px] w-full rounded-md border border-hairline bg-white" />
}
