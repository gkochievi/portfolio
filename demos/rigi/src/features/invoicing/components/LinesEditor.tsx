import { Plus, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button, IconButton, Input, Money } from '@/components/ui'
import { cn } from '@/lib/cn'
import type { Currency } from '@/types'

import { blankLine, linesTotal, rowAmount, type LineDraft, type LinesValidation } from '../lib/lines'

interface LinesEditorProps {
  value: LineDraft[]
  onChange: (lines: LineDraft[]) => void
  currency: Currency
  /** Shown only after a submit attempt. */
  validation?: LinesValidation | null
  disabled?: boolean
}

/** Description, decimal quantity, unit price; live row amounts and total. Blank rows are dropped on save. */
export function LinesEditor({ value, onChange, currency, validation, disabled }: LinesEditorProps) {
  const { t } = useTranslation('invoicing')
  const update = (key: string, patch: Partial<LineDraft>) => onChange(value.map((l) => (l.key === key ? { ...l, ...patch } : l)))
  const remove = (key: string) => onChange(value.length > 1 ? value.filter((l) => l.key !== key) : [blankLine()])

  return (
    <div className="flex flex-col gap-2">
      <div className="hidden grid-cols-[1fr_96px_128px_120px_36px] gap-2 px-1 text-xs text-muted sm:grid">
        <span className="eyebrow">{t('lines.description')}</span>
        <span className="eyebrow text-right">{t('lines.quantity')}</span>
        <span className="eyebrow text-right">{t('lines.unitPrice')}</span>
        <span className="eyebrow text-right">{t('lines.amount')}</span>
        <span />
      </div>
      <ol className="flex flex-col gap-2">
        {value.map((line, index) => {
          const errs = validation?.rowErrors[line.key]
          const dropped = !line.description.trim() && (line.unitPrice.trim() !== '' || value.length > 1)
          return (
            <li
              key={line.key}
              className={cn(
                'grid grid-cols-[1fr_1fr] gap-2 rounded-md border border-hairline bg-panel p-2 sm:grid-cols-[1fr_96px_128px_120px_36px] sm:border-0 sm:bg-transparent sm:p-0',
                dropped && 'opacity-70',
              )}
            >
              <div className="col-span-2 sm:col-span-1">
                <Input
                  aria-label={`${t('lines.description')} ${index + 1}`}
                  value={line.description}
                  placeholder={t('lines.descriptionPlaceholder')}
                  maxLength={500}
                  disabled={disabled}
                  invalid={!!errs?.description}
                  onChange={(e) => update(line.key, { description: e.target.value })}
                />
              </div>
              <div>
                <Input
                  aria-label={`${t('lines.quantity')} ${index + 1}`}
                  inputMode="decimal"
                  className="text-right"
                  mono
                  value={line.quantity}
                  disabled={disabled}
                  invalid={!!errs?.quantity}
                  onChange={(e) => update(line.key, { quantity: e.target.value })}
                />
                {errs?.quantity ? <p className="mt-1 text-xs text-danger">{t(errs.quantity)}</p> : null}
              </div>
              <div>
                <Input
                  aria-label={`${t('lines.unitPrice')} ${index + 1}`}
                  inputMode="decimal"
                  className="text-right"
                  mono
                  placeholder="0.00"
                  value={line.unitPrice}
                  disabled={disabled}
                  invalid={!!errs?.unitPrice}
                  onChange={(e) => update(line.key, { unitPrice: e.target.value })}
                />
                {errs?.unitPrice ? <p className="mt-1 text-xs text-danger">{t(errs.unitPrice)}</p> : null}
              </div>
              <div className="flex h-9 items-center justify-start text-sm sm:justify-end">
                <span className="mr-2 text-xs text-muted sm:hidden">{t('lines.amount')}</span>
                <Money amount={rowAmount(line)} currency={currency} />
              </div>
              <div className="flex items-center justify-end">
                <IconButton label={t('lines.remove')} icon={<Trash2 />} variant="ghost" size="sm" disabled={disabled} onClick={() => remove(line.key)} />
              </div>
            </li>
          )
        })}
      </ol>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-hairline pt-3">
        <Button variant="secondary" size="sm" icon={<Plus />} disabled={disabled || value.length >= 100} onClick={() => onChange([...value, blankLine()])}>
          {t('lines.add')}
        </Button>
        <div className="flex items-baseline gap-3">
          <span className="eyebrow">{t('lines.total')}</span>
          <span className="font-display text-xl font-semibold num">
            <Money amount={linesTotal(value)} currency={currency} />
          </span>
        </div>
      </div>
      <p className="text-xs text-muted">{t('lines.blankHint')}</p>
      {validation?.error ? <p className="text-sm text-danger">{t(validation.error)}</p> : null}
    </div>
  )
}
