import { Card } from '@/components/ui'
import { formatMoney } from '@/lib/format'
import type { Currency } from '@/types'

/** One tile per currency: a label, the headline amount and a quiet detail line. */
export function CurrencyTotals({ tiles, empty }: { tiles: Array<{ currency: Currency; label: string; amount: number; detail?: string }>; empty: string }) {
  if (tiles.length === 0) {
    return (
      <Card className="p-4">
        <p className="text-sm text-muted">{empty}</p>
      </Card>
    )
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {tiles.map((tile) => (
        <Card key={tile.currency} className="p-4">
          <p className="eyebrow">
            {tile.label} · {tile.currency}
          </p>
          <p className="font-display mt-2 text-3xl font-semibold num">{formatMoney(tile.amount, tile.currency)}</p>
          {tile.detail ? <p className="mt-1 text-xs text-muted">{tile.detail}</p> : null}
        </Card>
      ))}
    </div>
  )
}
