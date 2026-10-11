# Sinji UI cheat-sheet

Import from `@/components/ui` (primitives) and `@/components/brand` (signature pieces). Format with `@/lib/format`
(`useFormat()` or `formatX(value, lang)`), join classes with `cn` from `@/lib/cn`. All strings you pass in come
from your own namespace; primitives localise their own chrome via `common`.

## Tokens (Tailwind 4 utilities; light/dark switch automatically)

Colours: `bg` (page), `panel` (cards), `sunken` (wells, table header), `line` / `line-strong` (hairlines), `ink`,
`muted`, `subtle`, `primary` (+`on-primary`, `primary-hover`), `accent` (bronze, +`on-accent`), `success`,
`warning`, `danger`, `info`. Use tints with opacity: `bg-primary/12 text-primary`, `border-accent/30`.
Radii: `rounded-card` (10px), `rounded-ctl` (8px), `rounded-pill`. Shadow: `shadow-pop` (menus only; cards are flat).
Fonts: `font-display` (Newsreader; headings + big numbers), `font-sans` (default), `font-mono` (timestamps, ids,
tokens, keys). Add `tabular` to any score/number. `caps` = small uppercase label (auto-disabled in Georgian; never
use Tailwind `uppercase` on text that may be Georgian). Motion: `animate-panel-in`, `animate-fade-in`,
`animate-drawer-in`, `animate-shimmer`. Claim underlines: `claim-supported`, `claim-partial`,
`claim-contradicted`, `claim-not-in-kb`. Layout: AppShell already gives max-width 1360 + page padding.
Chart colours: `chartColors.series` (primary, accent, info, success, muted, ...), `chartTheme.axis/grid/tooltip`
spread into recharts `<XAxis {...chartTheme.axis}/>`, `<CartesianGrid {...chartTheme.grid}/>`, `<Tooltip {...chartTheme.tooltip}/>`.

## Primitives (`@/components/ui`)

- `Button` {variant: primary|secondary(default)|ghost|subtle|accent|danger|danger-ghost|link, size: xs|sm|md|lg, loading, icon, iconRight, asChild} — `asChild` wraps a `<Link>`.
- `IconButton` {label (required, a11y + tooltip), icon, variant='ghost', size, noTooltip, ...button props}
- `CopyButton` {value, label?, withText?, size?, variant?}
- `Field` {label, hint, error, optional, inline} wraps ONE control and wires id/aria. `<Field label="Name"><Input .../></Field>`
- `Input` {leading?: icon, trailing?: node, size: sm|md, mono, ...input props} (forwardRef; works with react-hook-form `register`)
- `Textarea` {mono, rows, ...textarea props} (forwardRef)
- `SearchInput` {value, onChange(string), placeholder?, size?}
- `Select` {value, onValueChange(string), options: {value,label,hint?,disabled?}[], placeholder, size, disabled} (Radix; values are strings)
- `Switch` {checked, onCheckedChange, label?, description?, size: sm|md, disabled}
- `Checkbox` {checked: boolean|'indeterminate', onCheckedChange(boolean), label?, description?}
- `Slider` {value, onValueChange(number), min, max, step, format?(v) => node}
- `SegmentedControl` {value, onValueChange, options: {value,label,icon?}[], size}
- `Card` {padded=true, as} — plain hairline card. `Panel` {title, description, actions, icon, flush, bodyClassName} — card with header row.
- `PageHeader` {title, description, actions, eyebrow, back, meta} — every page starts with one.
- `Toolbar` / `FilterBar` {children, end} — filter row above tables; `end` is right-aligned.
- `Badge` {tone: neutral|primary|accent|success|warning|danger|info, shape: pill|tag, size: sm|md, outline, icon}
- `StatusChip` {tone, pulse, size} — badge with dot (running jobs: `pulse`).
- `FilterChip` {active, onClick, count?, onRemove?, icon?}
- `Avatar` {name, color?, size=32} — initials.
- `StatTile` / `StatCard` {label, value (pre-formatted), hint, icon, delta?: {value, direction: up|down|flat, good?}, tone, onClick}
- `KeyValue` {items: {label, value, mono?}[], columns: 1|2|3}
- `ReadOnlyNote` {children?} — bronze lock note for members on settings screens (default copy from common).
- `Callout` {tone, title, children, icon, action}
- `EmptyState` {title?, body?, action?, icon?, compact} — bell-curve illustration by default.
- `Spinner` {size, label}; `Skeleton` {className}; `SkeletonText` {lines}
- `ProgressBar` {value, max=100, tone, indeterminate, label, showValue}
- `Meter` {value, max=100, ticks=20, tone?} — ticked assay-rim bar; tone follows score bands if omitted.
- `Tabs` {items: {value,label,icon?,count?,content?}[], value?, onValueChange?, defaultValue?, variant: underline|pill} (+ `TabPanel` {value} when items have no content). In-page only.
- `TabNav` {items: {to,label,icon?,count?,end?,hidden?}[]} — route tabs with NavLink (use for layout sub-pages; never #hash).
- `Pagination` {page (1-based), pageSize, total, onPageChange, onPageSizeChange?, pageSizes?}
- `DataTable<T>` {rows, columns: Column<T>[], rowKey, loading, empty?, onRowClick?, activeKey?, selectedKeys?, onSelectionChange?, pageSize=25 (client paging, 0=off), serverPagination?: {page,pageSize,total,onPageChange,onPageSizeChange?}, defaultSort?: {key,dir}, sort?/onSortChange? (server sort), dense, bare, rowClassName, caption}
  - `Column<T>` {key, header, cell?(row,i), sortable?: true | (row) => value, align, width, className, hideBelow?: sm|md|lg}
- `Dialog` / `Modal` {open, onOpenChange, title, description?, footer?, size: sm|md|lg|xl, locked?}
- `ConfirmDialog` {open, onOpenChange, title, body?, confirmLabel?, danger?, onConfirm (may return a promise; spinner while pending), confirmDisabled?, children? (e.g. password field)}
- `SecretOnceDialog` {open, onOpenChange, secret, title?, label?, note?} — show a key/password once, with copy.
- `Drawer` {open, onOpenChange, title, description?, footer?, width=440, side: right|left}
- `DropdownMenu` {trigger (one focusable element), items: MenuItem[], align, side, header?}
  - `MenuItem`: {label, icon?, onSelect, danger?, disabled?, hint?} | {type:'separator'} | {type:'label', label} | {type:'check', label, checked, onCheckedChange} | {type:'sub', label, items}
- `Tooltip` {content, side, align, disabled} wraps one focusable child.
- `HoverCard` {trigger, children, side, align, width=360} — evidence popovers (hover/focus; content stays open while hovered).
- `toast` (sonner): `toast.success(t('...'))`, `toast.error(msg)`, `toast.promise(...)`. Toaster is mounted by the shell.

## Brand (`@/components/brand`)

- `LogoMark` {size, title?}; `Wordmark` {lang?}; `Logo` {size, withWordmark}
- `AssayGauge` {value (0-100 or null), max, size=200, label?, sublabel?, animate=true} — 180° rim, 21 ticks, bronze bead, count-up.
- `Hallmark` {value, suffix?, label?, size: sm|md|lg} — clipped-corner final-score cartouche.
- `ScorePill` {score, tone?, suffix?, size: sm|md|lg}; `scoreTone(score)` -> success|primary|warning|danger|muted (85/70/50 bands).
- `Waveform` {peaks: number[] (0..1), duration (s), currentTime (s), onSeek?(seconds), ribbon?: {start,end,sentiment: negative|neutral|positive}[], height=56, label}
- `BellCurve` {className, ticks=21, bead=0.5} — line illustration (empty states, heroes).

## Shell helpers other groups may use

- `@/components/shell/SystemMessage` {code?, title, body?, actions?}; `@/features/auth/pages/ForbiddenPage` (403 body).
- `@/components/shell/actions`: `actAs(tenantId)` (operator act-as + cache clear), `homeFor(accountId)`.
- `@/components/shell/theme`: `useTheme()` -> {theme: light|dark}.
