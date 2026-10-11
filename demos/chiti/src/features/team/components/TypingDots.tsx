export function TypingDots() {
  return (
    <span className="inline-flex items-end gap-0.5" aria-hidden>
      {[0, 1, 2].map((i) => (
        <span key={i} className="size-1 animate-dot-hop rounded-full bg-muted" style={{ animationDelay: `${i * 140}ms` }} />
      ))}
    </span>
  )
}
