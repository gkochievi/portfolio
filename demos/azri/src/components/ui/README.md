# Azri UI cheat-sheet

Import from `@/components/ui` (charts from `@/components/ui/charts`). Icons: lucide-react, `strokeWidth={1.75}`, 20px. No emoji.
Every visible string goes through i18n; shared words live in the `common` namespace (`t('common:actions.viewAll')`, `status.*`, `rating.1..5`, `kpi.*`, `filters.*`, `units.*`, `window.lastDays`).

## Tokens (Tailwind classes; light + dark automatic)
- Surfaces: `bg-surface` (page mist), `bg-panel` (cards), `bg-panel-2` (table top row / subtle), `bg-sunken`. Text: `text-ink`, `text-muted`, `text-subtle`. Lines: `border-border`, `border-border-strong`.
- Brand: `bg-primary text-on-primary` (mulberry; mint in dark), `bg-primary-soft text-on-primary-soft`, `text-link`, `bg-accent text-on-accent`. Fixed: `mulberry`, `mint`, `mist`, `plum`, `mulberry-light`.
- Semantic: `success`, `warning`, `danger`, `info` (use `/12` soft fills: `bg-success/12 text-success`).
- Respondent white-label (inside `RespondentLayout`): `bg-brand text-on-brand`, `bg-brand-tint`, `text-brand`, `border-brand`, `fill-brand`.
- Shapes: `rounded-bubble` (20px, bottom-left 4px), `rounded-bubble-sm`; cards `rounded-2xl`; inputs 14px; tables 12px. `shadow-float` only for sticky bars / popovers.
- Type: `font-display` (Fraunces; Noto Serif Georgian under ka), `font-sans` (Figtree / Noto Sans Georgian), `font-mono` (tokens, sender IDs, short links), `tabular` (numbers).
- Motion: `ease-azri`, `animate-rise` (bars; add `origin-bottom`), `animate-pop`, `animate-fade-up`, `animate-fade-in`, `animate-flash` (new live row), `animate-live` (pulsing dot). Reduced motion is handled globally.
- Never `uppercase` Georgian (a global guard neutralises it, but don't rely on it for meaning).

## Layout / scaffolding
- `PageHeader` `{title, description?, eyebrow?, actions?, back?: {to, label}}` - page h1 row.
- `Section` `{title?, description?, actions?, children}` - h2 block with spacing.
- `Card` `{as?, padding?: 'none'|'sm'|'md'|'lg', interactive?}` + HTML attrs. `CardHeader` `{title, description?, actions?, icon?}`.
- `BubbleCard` `{tone?: 'panel'|'tint'|'brand'|'sunken', padding?: 'sm'|'md'|'lg'}` - the signature speech-bubble card (questions, SMS bubbles, empty states).
- `Toolbar` / `FilterBar` `{children, label?}` - wrapping row of filters; `ToolbarSpacer` pushes the rest right.
- `ActionBar` `{children}` - sticky bottom bar for the respondent flow (put `<Button size="xl" variant="brand">` in it).
- `DescriptionList` `{items: {label, value, mono?}[], columns?: 1|2}` - label/value rows for drawers and settings.
- `EmptyState` `{title, description?, illustration?: IllustrationKind|null, icon?, action?, compact?, framed?}`. `ErrorState` `{title?, description?, onRetry?, compact?}`.
- `Skeleton` `{className}` (size it with h-/w-), `SkeletonText` `{lines?}`.
- `Illustration` `{kind: 'thanks'|'already'|'expired'|'invalid'|'not-found'|'empty'|'inbox'|'error'|'locked', size?: px, animated?}` - flat mulberry + mint art (thanks + animated = bars rise, spark pops).

## Controls
- `Button` `{variant?: 'primary'|'brand'|'secondary'|'soft'|'ghost'|'danger'|'link', size?: 'sm'|'md'|'lg'|'xl'(56px full-width), loading?, leftIcon?, rightIcon?, fullWidth?, asChild?}` - pill. Router links: `<Button asChild><Link to="/x">…</Link></Button>`.
- `IconButton` `{label (required, aria + tooltip), icon, variant?, size?: 'sm'|'md'|'lg', tooltip?: boolean, pressed?}`.
- `Field` `{label?, hint?, error?, optional?, aside?, id?, children}` - wraps one control and wires id / aria-describedby / invalid automatically.
- `Input` `{leftIcon?, rightSlot?, invalid?, size?: 'sm'|'md'|'lg', mono?}` + input attrs (forwardRef, works with RHF `register`).
- `Textarea` `{showCount?, maxLength?, invalid?, mono?, rows?}` + textarea attrs - `showCount` renders "123 / 500".
- `Select` `{value, onValueChange, options: {value, label, textValue?, description?, icon?, disabled?}[], placeholder?, variant?: 'field'|'pill', size?: 'sm'|'md', icon?, disabled?, invalid?, aria-label?}` - value `''` is allowed (use for "All …").
- `Checkbox` `{label?, description?}` + input attrs (forwardRef). `Switch` `{checked, onCheckedChange, label?, disabled?}`.
- `SearchInput` `{value, onChange(value), placeholder?, debounce? (ms, default 200), size?}` - clear button + Esc clears.
- `SegmentedControl<V>` `{value, onChange, options: {value, label, icon?}[], label (aria), size?, fullWidth?}` - e.g. 7 / 30 / 90 days.
- `Tabs` (Radix root: `value`/`onValueChange`) → `TabsList {variant?: 'underline'|'pill'}` → `TabsTrigger {value, count?, icon?}`; `TabsContent {value}`.
- `Chip` `{selected?, icon?, color? (dot), count?, size?: 'sm'|'md'}` + button attrs - toggle pill (`aria-pressed`).
- `LangSwitch` `{size?}` (ENG / ქარ), `ThemeToggle` `{size?}`, `CopyButton` `{value, label?, size?, variant?}`.

## Overlays
- `Modal` (alias `Dialog`) `{open, onOpenChange, title, description?, children?, footer?, size?: 'sm'|'md'|'lg', hideClose?}`.
- `Drawer` `{open, onOpenChange, title, description?, eyebrow?, children?, footer?, width?: 'sm'|'md'|'lg'}` - right sheet, full width on phones.
- `DropdownMenu` / `DropdownMenuTrigger asChild` / `DropdownMenuContent {align?}` / `DropdownMenuItem {icon?, danger?, hint?, onSelect}` / `DropdownMenuLabel` / `DropdownMenuSeparator`.
- `Tooltip` `{content, children (one focusable element), side?, delay?, disabled?}`.
- `toast(...)` (sonner; `toast.success`, `toast.error`, `toast('Title', { description, action: { label, onClick } })`). `<Toaster/>` is already mounted.

## Data display
- `DataTable<T>` `{columns: Column<T>[], rows, getRowId, loading?, empty?: node | {title, description?, action?}, onRowClick?, isRowActive?, rowClassName?, highlightIds?: Set|array (flash mint), defaultSort?, sort? + onSortChange? (server sort), pageSize? (client paging) | pagination?: {page, pageSize, total, onPageChange} (server, 1-based), caption?, bare?}`.
  - `Column<T>` `{id, header, cell: (row, i) => node, sortValue?: row => string|number|null, sortable?, align?: 'left'|'right'|'center', width?, className?, headerClassName?, hideBelow?: 'sm'|'md'|'lg'}`.
- `Pagination` `{page (1-based), pageSize, total, onPageChange}` - "21–40 of 248".
- `StatTile` (alias `StatCard`) `{label, value (pre-formatted), unit?, delta?: number|null, deltaLabel?, invertDelta?, hint?, icon?, chart?: node, loading?, highlight?}` - KPI tile.
- `Badge` `{tone?: 'neutral'|'primary'|'accent'|'success'|'warning'|'danger'|'info', variant?: 'soft'|'outline', size?: 'sm'|'md', dot?, icon?, mono?}`.
- `StatusBadge` `{status: 'pending'|'completed'|'expired'|'unknown'|'missing', detail? (e.g. "expires in 5 days"), size?}`.
- `ScorePill` `{value: number|null, max?, showLabel?, size?}` - mint pill "4 / 5 · Good" (averages show one decimal). `ratingLabelKey(n)` → `'rating.4'`.
- `Stars` `{value: number|null, max?, size? (px, default 14), className?}` - read-only, fractional; `className="text-brand"` inside the respondent frame. `STAR_SVG_PATH` = the 24x24 rounded star path (for the interactive rating control).
- `Avatar` `{name, color?, size?: 'xs'|'sm'|'md'|'lg'|'xl', badge?}` - initials; `initials(name)`, `readableOn(hex)`.
- `TenantMark` `{monogram, primary, onPrimary?, size?: 'xs'|'sm'|'md'|'lg'|'xl', title?}` - tenant monogram tile in its colours (bubble shape).
- `BarsLoader` `{size?: 'xs'|'sm'|'md'|'lg', label?}` - the brand spinner (currentColor, default `text-primary`). `CenteredLoader` `{size?, label?, className?}`.
- `SignalBars` `{value, max?, animateIn?, size?, fillClassName? (default bg-brand), label?}` - five ascending bars as a progress meter.
- `LiveDot` `{tone?: 'accent'|'primary'|'success'|'danger'}` - pulsing "live / new" dot.
- `AzriMark` `{size?, variant?: 'auto'|'color'|'inverse'|'mono', animated?, title?}`, `AzriLogo` `{size?, variant?, script?: 'latin'|'georgian', markOnly?, animated?}` (lockup follows the UI language).

## Charts (`@/components/ui/charts`, recharts; colours follow the theme)
- `Sparkline` `{values: (number|null)[], height? (36), color? (CSS colour, default var(--primary)), area?, label?}`.
- `TrendChart` `{data: {date: 'yyyy-MM-dd', responses, avgRating|null}[], height? (220), hideRating?}` + `TrendLegend` `{hideRating?}` - bars = responses, mint line = average rating (right axis 1-5).
- `DistributionBars` `{distribution: [n1..n5], showPercent?, barClassName?}` - 5★ on top.
- `Meter` `{value 0..100, tone?, label?}` - thin progress bar (response rate).

## Formatting (`@/lib/format`; pass `useLang()`)
`formatDate(v, lang, pattern?)`, `formatDateShort`, `formatDateTime`, `formatTime`, `formatRelative(v, lang, now?)` ("3 hours ago" / "in 5 days"; pass `clock.now()` when it must follow time travel), `daysUntil(v, now?)`, `formatNumber(n, lang, digits?)`, `formatPercent(n0to100, lang, digits?)`, `formatRating(n, lang)` (one decimal), `formatDelta(n, lang)`, `formatMs(n)`.

## Shell contracts
- `SiteLayout` gives pages a `max-w-6xl` padded `<main>`; `ConsoleLayout` a `max-w-[1280px]` padded `<main>` with 14px base text; `RespondentLayout` a 420px column with 20px gutters and 17px base text. Pages don't add outer padding.
- Respondent theming: `useRespondentTenant(tenant)` and `useCurrentRespondentTenant()` from `@/components/layout/RespondentLayout`.
- Theme: `useTheme()` → `{theme, setTheme, toggle}` (in memory; follows the OS until chosen).
