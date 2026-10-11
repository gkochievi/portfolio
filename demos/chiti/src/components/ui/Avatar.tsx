import { useEffect, useState, type CSSProperties } from 'react'
import { Upload } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import type { OperatorStatus } from '@/types'
import { cn } from '@/lib/cn'
import { hueFromString, initials } from '@/lib/format'
import { Button } from './Button'
import { Modal } from './Modal'

const SIZES = { xs: 20, sm: 28, md: 36, lg: 48, xl: 72 } as const
export type AvatarSize = keyof typeof SIZES

/* ---- 16 locally drawn geometric bird/nest presets: ids nest-01 … nest-16 ---- */
const BG = ['#F2C12E', '#4E5C17', '#B02A1F', '#A65400', '#C3D06E', '#E7DFCB', '#4D5866', '#1E1B12'] as const
const FG = ['#1E1B12', '#F2C12E', '#FBF7EE', '#FBF7EE', '#1E1B12', '#4E5C17', '#F2C12E', '#F2C12E'] as const
export const AVATAR_PRESETS: string[] = Array.from({ length: 16 }, (_, i) => `nest-${String(i + 1).padStart(2, '0')}`)

function PresetArt({ id }: { id: string }) {
  const n = Math.max(0, (parseInt(id.slice(5), 10) || 1) - 1) % 16
  const bg = BG[n % 8] ?? BG[0]
  const fg = FG[n % 8] ?? FG[0]
  const variant = Math.floor(n / 8) // 0: bird facing right, 1: nest + egg
  return (
    <svg viewBox="0 0 40 40" className="size-full" aria-hidden>
      <rect width="40" height="40" fill={bg} />
      {variant === 0 ? (
        <>
          <circle cx="18" cy="22" r="11" fill={fg} />
          <path d="M28 18 L34 21 L28 24 Z" fill={bg === '#1E1B12' ? '#FBF7EE' : '#1E1B12'} />
          <circle cx="22" cy="18" r="1.8" fill={bg} />
          <rect x="11" y="23" width="10" height="2.4" rx="1.2" fill={bg} opacity={0.8} />
        </>
      ) : (
        <>
          <circle cx="20" cy="18" r="6.5" fill={fg} />
          <path d="M7 24 Q20 38 33 24" stroke={fg} strokeWidth="2.4" fill="none" strokeLinecap="round" />
          <path d="M9 28 Q20 36 31 28" stroke={fg} strokeWidth="2" fill="none" strokeLinecap="round" opacity={0.7} />
          <path d="M6 24 L34 24" stroke={fg} strokeWidth="2.4" strokeLinecap="round" />
        </>
      )}
    </svg>
  )
}

const STATUS_CLS: Record<OperatorStatus, string> = {
  online: 'bg-success',
  away: 'bg-warning',
  offline: 'bg-line-strong',
}

export interface AvatarProps {
  name: string
  /** Preset id 'nest-01'…'nest-16'. */
  avatarId?: string | null
  /** Uploaded image (object URL) or a public/ media path. */
  avatarUrl?: string | null
  size?: AvatarSize | number
  status?: OperatorStatus | null
  /** Rounded-square instead of circle (tenants, rooms). */
  square?: boolean
  className?: string
}

/** Initials on a hashed warm hue, a geometric preset, or an image; optional presence dot. */
export function Avatar({ name, avatarId, avatarUrl, size = 'md', status, square, className }: AvatarProps) {
  const px = typeof size === 'number' ? size : SIZES[size]
  const hue = 18 + (hueFromString(name) % 100) // warm band: red-orange to olive
  const [broken, setBroken] = useState(false)
  useEffect(() => setBroken(false), [avatarUrl])
  const shape = square ? 'rounded-[28%]' : 'rounded-full'
  let inner
  if (avatarUrl && !broken) inner = <img src={avatarUrl} alt="" className="size-full object-cover" onError={() => setBroken(true)} />
  else if (avatarId && avatarId.startsWith('nest-')) inner = <PresetArt id={avatarId} />
  else
    inner = (
      <span
        className="grid size-full place-items-center bg-[var(--av-bg)] font-semibold text-[var(--av-fg)] dark:bg-[var(--av-bg-d)] dark:text-[var(--av-fg-d)]"
        style={
          {
            '--av-bg': `hsl(${hue} 52% 86%)`,
            '--av-fg': `hsl(${hue} 55% 22%)`,
            '--av-bg-d': `hsl(${hue} 28% 26%)`,
            '--av-fg-d': `hsl(${hue} 55% 82%)`,
            fontSize: Math.max(9, Math.round(px * 0.38)),
          } as CSSProperties
        }
      >
        {initials(name)}
      </span>
    )
  return (
    <span className={cn('relative inline-flex shrink-0', className)} style={{ width: px, height: px }} title={name}>
      <span className={cn('size-full overflow-hidden', shape)} role="img" aria-label={name}>
        {inner}
      </span>
      {status ? (
        <span
          aria-hidden
          className={cn('absolute bottom-0 right-0 rounded-full ring-2 ring-panel', STATUS_CLS[status])}
          style={{ width: Math.max(8, px * 0.28), height: Math.max(8, px * 0.28) }}
        />
      ) : null}
    </span>
  )
}

/** Overlapping avatars with a +N tail. */
export function AvatarGroup({ people, max = 4, size = 'sm' }: { people: { name: string; avatarId?: string | null; avatarUrl?: string | null }[]; max?: number; size?: AvatarSize }) {
  const shown = people.slice(0, max)
  const rest = people.length - shown.length
  const px = SIZES[size]
  return (
    <span className="inline-flex items-center">
      {shown.map((p, i) => (
        <span key={i} className="-ml-1.5 rounded-full ring-2 ring-panel first:ml-0">
          <Avatar {...p} size={size} />
        </span>
      ))}
      {rest > 0 ? (
        <span className="-ml-1.5 grid place-items-center rounded-full bg-sunken text-[11px] font-medium text-muted ring-2 ring-panel" style={{ width: px, height: px }}>
          +{rest}
        </span>
      ) : null}
    </span>
  )
}

export interface AvatarPickerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  name: string
  /** Current selection: preset id, or null for initials. */
  value: { avatarId: string | null; avatarUrl: string | null }
  onChange: (value: { avatarId: string | null; avatarUrl: string | null }) => void
}

/** Dialog: 16 geometric presets, initials, or upload (kept as an object URL for the session). */
export function AvatarPicker({ open, onOpenChange, name, value, onChange }: AvatarPickerProps) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState(value)
  useEffect(() => {
    if (open) setDraft(value)
  }, [open, value])
  const tile = (selected: boolean) =>
    cn('grid place-items-center rounded-full p-0.5 ring-offset-2 ring-offset-panel transition', selected ? 'ring-2 ring-accent' : 'hover:ring-2 hover:ring-line-strong')
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={t('avatar.title')}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t('actions.cancel')}
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              onChange(draft)
              onOpenChange(false)
            }}
          >
            {t('actions.save')}
          </Button>
        </>
      }
    >
      <div className="mb-4 flex items-center gap-4">
        <Avatar name={name} avatarId={draft.avatarId} avatarUrl={draft.avatarUrl} size="xl" />
        <div className="flex flex-col gap-2">
          <Button size="sm" variant="outline" onClick={() => setDraft({ avatarId: null, avatarUrl: null })}>
            {t('avatar.initials')}
          </Button>
          <label className="inline-flex h-8 cursor-pointer items-center gap-2 rounded-ui border border-line-strong bg-panel px-3 text-[13px] font-medium hover:bg-hover">
            <Upload size={16} strokeWidth={1.75} />
            {t('avatar.upload')}
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) setDraft({ avatarId: null, avatarUrl: URL.createObjectURL(file) })
              }}
            />
          </label>
        </div>
      </div>
      <div role="radiogroup" aria-label={t('avatar.presets')} className="grid grid-cols-4 gap-3 sm:grid-cols-8">
        {AVATAR_PRESETS.map((id) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={draft.avatarId === id}
            aria-label={id}
            className={tile(draft.avatarId === id)}
            onClick={() => setDraft({ avatarId: id, avatarUrl: null })}
          >
            <Avatar name={name} avatarId={id} size="lg" />
          </button>
        ))}
      </div>
    </Modal>
  )
}
