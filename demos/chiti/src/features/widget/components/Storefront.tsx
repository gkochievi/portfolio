/**
 * The Vazi Wine Cellar shop page: the "host website" the Chiti widget is
 * embedded in. Pure presentation + a local cart counter (nothing persists).
 */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Gift, PackageCheck, ShoppingBasket, Truck } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { toast } from '@/components/ui'
import { cn } from '@/lib/cn'

const media = (name: string) => `${import.meta.env.BASE_URL}media/store/${name}`

export const PRODUCTS = [
  { id: 'saperavi', price: 38 },
  { id: 'rkatsiteli', price: 34 },
  { id: 'mtsvane', price: 28 },
  { id: 'kindzmarauli', price: 32 },
  { id: 'tsolikouri', price: 26 },
  { id: 'mukuzani', price: 46 },
] as const

const WINE = '#5b1e2b'
const CREAM = '#fbf6ef'
const INK = '#2a1a1a'

/** In-page jump (never a real `#hash` change: that would fight the hash router). */
function jump(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

export interface StorefrontProps {
  /** Shorter page for the live-desk pane. */
  compact?: boolean
  /** Hide the "Open the live desk" ribbon (already there). */
  hideRibbon?: boolean
  className?: string
}

export function Storefront({ compact = false, hideRibbon = false, className }: StorefrontProps) {
  const { t } = useTranslation('widget')
  const [cart, setCart] = useState(0)
  const products = compact ? PRODUCTS.slice(0, 3) : PRODUCTS

  const add = (id: string) => {
    setCart((count) => count + 1)
    toast.success(t('store.added', { name: t(`store.products.${id}.name`) }))
  }

  return (
    <div className={cn('font-sans', className)} style={{ background: CREAM, color: INK, colorScheme: 'light' }}>
      {!hideRibbon && (
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 px-4 py-2 text-center text-[13px]" style={{ background: INK, color: CREAM }}>
          <span>{t('store.ribbon')}</span>
          <Link
            to="/live"
            className="inline-flex items-center gap-1 rounded-full border-[1.5px] px-3 py-0.5 font-medium no-underline hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            style={{ borderColor: '#f2c12e', color: '#f2c12e' }}
          >
            {t('store.ribbonCta')}
            <span aria-hidden>→</span>
          </Link>
        </div>
      )}

      <header className="border-b" style={{ borderColor: 'rgb(42 26 26 / 0.14)' }}>
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3.5 sm:px-6">
          <a href="#shop" onClick={(event) => { event.preventDefault(); jump('shop') }} className="flex items-center gap-2.5 no-underline" style={{ color: WINE }}>
            <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden>
              <circle cx="16" cy="16" r="15" fill={WINE} />
              <path d="M16 7c-3 0-5 2-5 4.500 0 2 1.300 3.200 2.500 4.500C14.500 17.200 15 18.500 15 20h2c0-1.500.5-2.800 1.500-4 1.200-1.300 2.500-2.500 2.500-4.500C21 9 19 7 16 7Z" fill="#f2c12e" />
              <path d="M16 20v5M13 24h6" stroke="#f2c12e" strokeWidth="1.600" strokeLinecap="round" />
            </svg>
            <span className="font-display text-[19px] font-bold leading-none tracking-tight">{t('store.brand')}</span>
          </a>
          <nav aria-label={t('store.nav.label')} className="hidden items-center gap-6 text-[14px] md:flex">
            {(['wines', 'qvevri', 'gifts', 'delivery'] as const).map((key) => (
              <a key={key} href={`#${key}`} onClick={(event) => { event.preventDefault(); jump(key === 'delivery' || key === 'gifts' ? 'delivery' : 'wines') }} className="no-underline hover:underline" style={{ color: INK }}>
                {t(`store.nav.${key}`)}
              </a>
            ))}
          </nav>
          <span className="inline-flex items-center gap-2 text-[14px]" aria-label={t('store.cart', { count: cart })}>
            <ShoppingBasket size={20} strokeWidth={1.75} aria-hidden />
            <span className="tabular grid min-w-5 place-items-center rounded-full px-1.5 text-[12px] font-semibold leading-5" style={{ background: cart ? WINE : 'rgb(42 26 26 / 0.12)', color: cart ? CREAM : INK }}>
              {cart}
            </span>
          </span>
        </div>
      </header>

      <section className="relative isolate overflow-hidden" id="shop" style={{ background: '#3a1620' }}>
        <img src={media('hero.svg')} alt="" aria-hidden className="absolute inset-0 -z-10 size-full object-cover opacity-80" />
        <div className="absolute inset-0 -z-10" style={{ background: 'rgb(42 15 23 / 0.58)' }} />
        <div className={cn('mx-auto max-w-6xl px-4 sm:px-6', compact ? 'py-10' : 'py-16 sm:py-24')}>
          <p className="m-0 mb-3 text-[12.5px] font-medium tracking-[0.12em]" style={{ color: '#f2c12e' }}>{t('store.hero.eyebrow')}</p>
          <h1 className={cn('m-0 max-w-[16ch] font-display font-bold tracking-tight', compact ? 'text-[34px]' : 'text-[40px] sm:text-[56px]')} style={{ color: CREAM, lineHeight: 1.08 }}>
            {t('store.hero.title')}
          </h1>
          <p className="mb-6 mt-4 max-w-[46ch] text-[16px] leading-relaxed" style={{ color: 'rgb(251 246 239 / 0.86)' }}>{t('store.hero.body')}</p>
          <div className="flex flex-wrap gap-3">
            <a
              href="#wines"
              onClick={(event) => { event.preventDefault(); jump('wines') }}
              className="rounded-ui border-[1.5px] px-5 py-2.5 text-[15px] font-semibold no-underline"
              style={{ background: '#f2c12e', borderColor: '#1e1b12', color: '#1e1b12', boxShadow: '2px 2px 0 #1e1b12' }}
            >
              {t('store.hero.cta')}
            </a>
            <a href="#delivery" onClick={(event) => { event.preventDefault(); jump('delivery') }} className="rounded-ui border-[1.5px] px-5 py-2.5 text-[15px] font-medium no-underline" style={{ borderColor: 'rgb(251 246 239 / 0.7)', color: CREAM }}>
              {t('store.hero.secondary')}
            </a>
          </div>
        </div>
      </section>

      <section id="wines" className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h2 className="m-0 font-display text-[26px] font-bold tracking-tight" style={{ color: WINE }}>{t('store.products.title')}</h2>
            <p className="m-0 mt-1 text-[14px]" style={{ color: 'rgb(42 26 26 / 0.7)' }}>{t('store.products.subtitle')}</p>
          </div>
        </div>
        <ul className={cn('m-0 grid list-none gap-4 p-0', compact ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-2 lg:grid-cols-3')}>
          {products.map((product) => (
            <li key={product.id} className="flex flex-col overflow-hidden rounded-ui border bg-white" style={{ borderColor: 'rgb(42 26 26 / 0.14)' }}>
              <img src={media(`${product.id}.svg`)} alt={t(`store.products.${product.id}.name`)} className="aspect-[4/5] w-full object-cover" loading="lazy" />
              <div className="flex flex-1 flex-col gap-1 p-3.5">
                <h3 className="m-0 font-display text-[16px] font-semibold leading-tight">{t(`store.products.${product.id}.name`)}</h3>
                <p className="m-0 text-[12.5px] leading-snug" style={{ color: 'rgb(42 26 26 / 0.68)' }}>{t(`store.products.${product.id}.meta`)}</p>
                <p className="m-0 mt-1 text-[13px] leading-snug">{t(`store.products.${product.id}.note`)}</p>
                <div className="mt-auto flex items-center justify-between gap-2 pt-3">
                  <span className="tabular text-[17px] font-bold">{product.price} ₾</span>
                  <button
                    type="button"
                    onClick={() => add(product.id)}
                    className="rounded-ui border-[1.5px] px-3 py-1.5 text-[13px] font-semibold hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2"
                    style={{ borderColor: WINE, color: WINE, background: 'transparent' }}
                  >
                    {t('store.add')}
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section id="delivery" className="border-y" style={{ background: '#f3e9dc', borderColor: 'rgb(42 26 26 / 0.12)' }}>
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
          <h2 className="m-0 mb-5 font-display text-[24px] font-bold tracking-tight" style={{ color: WINE }}>{t('store.delivery.title')}</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {([
              ['tbilisi', Truck],
              ['regions', PackageCheck],
              ['gifts', Gift],
            ] as const).map(([key, Icon]) => (
              <div key={key} className="rounded-ui border bg-white/70 p-4" style={{ borderColor: 'rgb(42 26 26 / 0.12)' }}>
                <Icon size={24} strokeWidth={1.75} aria-hidden style={{ color: WINE }} />
                <h3 className="m-0 mb-1 mt-2.5 font-display text-[16px] font-semibold">{t(`store.delivery.${key}.title`)}</h3>
                <p className="m-0 text-[13.5px] leading-snug" style={{ color: 'rgb(42 26 26 / 0.78)' }}>{t(`store.delivery.${key}.body`)}</p>
              </div>
            ))}
          </div>
          <p className="m-0 mt-5 text-[14px]" style={{ color: 'rgb(42 26 26 / 0.78)' }}>{t('store.delivery.help')}</p>
        </div>
      </section>

      <footer className="mx-auto max-w-6xl px-4 py-8 text-[13px] sm:px-6" style={{ color: 'rgb(42 26 26 / 0.7)' }}>
        <p className="m-0 font-medium" style={{ color: INK }}>{t('store.footer.name')}</p>
        <p className="m-0 mt-1">{t('store.footer.address')}</p>
        <p className="m-0">{t('store.footer.hours')}</p>
        <p className="m-0 mt-3 text-[12px]">{t('store.footer.note')}</p>
      </footer>
    </div>
  )
}
