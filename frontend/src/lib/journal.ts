// Journal display helpers. Who wrote an entry comes from the "viewing as" persona (lib/persona.tsx).

/** "just now" / "6m ago" / "3h ago" / "yesterday" / "Sep 8" / "Sep 8, 2025". */
export function relativeTime(iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const secs = Math.round((Date.now() - then) / 1000)
  if (secs < 45) return 'just now'
  if (secs < 3600) return `${Math.round(secs / 60)}m ago`
  if (secs < 86400) return `${Math.round(secs / 3600)}h ago`
  const days = Math.round(secs / 86400)
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days}d ago`
  const d = new Date(iso)
  const sameYear = d.getFullYear() === new Date().getFullYear()
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  })
}
