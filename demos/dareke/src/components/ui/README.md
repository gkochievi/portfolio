# Dareke UI cheat-sheet

Import everything from `@/components/ui`; brand pieces from `@/components/brand`. Icons are `lucide-react` at `size={18} strokeWidth={1.75}`. Never write hex in features: use the tokens below or `Tone`.

## Tokens (Tailwind 4)
- Colours: `bg-paper` (page) `bg-panel` (cards) `bg-sunken` (wells, table head, hover) `bg-carbon` `bg-lime` · `text-ink` `text-muted` `text-on-lime` `text-on-carbon` (lime) · `border-hairline` `border-hairline-strong` · `text-/bg-/border-` `success warning danger info`. Opacity modifiers work (`bg-info/12`).
- Fonts: `font-display` (Archivo; titles + numerals) `font-sans` (default) `font-mono` (phones, timers, IDs). `tabular` = tabular numerals, `numeral-wide` = scoreboard width.
- Shape: `rounded-control` (6px) `rounded-card` (10px) `rounded-full` (pills) · `shadow-pop` (popovers/drawers only) · `hatch` (diagonal hatch, paused) · `dial-grid` (faint dot grid) · `animate-ring` `animate-tick`.
- Dark: `dark:` variant works under `<html class="dark">` **and** inside any `.theme-dark` subtree. The supervisor wall wraps itself in `<div className="theme-dark ...">` to stay dark in light mode.
- Lime is a fill on light surfaces, never text/thin lines. Lime as text only inside dark (`dark:text-lime`).
- Layout: `<main>` already has `px-4 sm:px-6 lg:px-8 pt-5 pb-24`. Full-bleed: `-mx-4 sm:-mx-6 lg:-mx-8 -mt-5`. Top bar is 56px sticky (`top-14` for sticky sub-headers).

## Libs
- `cn(...classes)` from `@/lib/cn`.
- `toneClasses(tone)` -> `{dot, text, soft, solid, border, edge}`; `toneColor(tone)` -> CSS var for charts/SVG; `CHART_SERIES` (7 theme-aware colours); `TONE_LIST` - `@/lib/tone`.
- `@/lib/format`: `formatDate` (DD.MM.YYYY) `formatTime(v, withSeconds?)` `formatDateTime` `formatDuration(sec)` (m:ss / h:mm:ss) `secondsSince(iso, now?)` `formatPhone` (+995 500 01 23 45) `maskPhone` (+995 5•• ••• 345) `formatPercent(0-100, digits?)` `formatNumber` `formatMoney` (₾) `formatRelative(v, lang)` `isToday` `toDateInput` `toDateTimeInput` `initials`.
- `@/lib/csv`: `parseCsv(text)` -> string[][] · `parseCsvObjects(text)` -> header-keyed records (lower-cased keys) · `toCsv(rows|records)` · `downloadCsv(filename, rows|records)` · `downloadText(name, text, type?)` · `readFileText(file)`.
- `@/lib/toast`: `toast.success|error|info|warning|message(title, {description?})`, `toastError(err, title?)`. `<Toaster/>` is already mounted.
- `@/lib/localized`: `useLocalized()` -> `l(value)`; `useLang()`; `pickText(value, lang)`.

## Components (props)
- **Button** `variant: 'dial'|'call'|'outline'|'ghost'|'subtle'|'danger'|'link'` (default outline) · `size: 'xs'|'sm'|'md'|'lg'` (md = 36px) · `block` · `loading` · `icon` · `iconRight` · `asChild` (wrap a `<Link>`). `dial` = primary CTA (carbon + lime label). `call` = lime fill, ONLY for Call / Connect / Next lead / Answer.
- **IconButton** `label` (required; aria + tooltip) · `icon` · `tooltip?=true` · Button `variant`/`size` (default ghost/md).
- **Field** `label` `hint?` `error?` `required?` `htmlFor?` `aside?` `children` - label + control + error line.
- **Input** native props + `size: 'sm'|'md'` `icon?` `suffix?` `invalid?` `mono?`.
- **Textarea** native props + `invalid?` (rows 3).
- **SearchInput** `value` `onChange(string)` `placeholder?` `size?` - icon + clear button.
- **DateInput** / **DateTimeInput** - Input with `type=date` / `datetime-local` (use `toDateInput` / `toDateTimeInput`).
- **Select** `value` `onValueChange(v)` `options: {value,label,icon?,description?,disabled?}[]` `placeholder?` `size?` `disabled?` `invalid?` `icon?` `aria-label?` `className?` (width; default full). Values must be non-empty: use `'all'`.
- **Checkbox** `checked` `onCheckedChange(bool)` `label?` `description?` `indeterminate?` `disabled?`.
- **Switch** `checked` `onCheckedChange(bool)` `label?` `description?` `disabled?` - with a label it renders a label-left/switch-right row.
- **Segmented** `value` `onChange(v)` `options: {value,label,icon?,disabled?}[]` `size?` `aria-label?`.
- **ToneSwatchPicker** `value: Tone` `onChange(tone)`.
- **Dialog** (= **Modal**) `open` `onOpenChange` `title` `description?` `children` `footer?` `size: 'sm'|'md'|'lg'|'xl'` `hideClose?`.
- **ConfirmDialog** `open` `onOpenChange` `title` `description?` `confirmLabel?` `cancelLabel?` `tone: 'dial'|'danger'` `loading?` `onConfirm` `children?`.
- **Drawer** `open` `onOpenChange` `title` `description?` `eyebrow?` `children` `footer?` `width?=480` - right side, scrolls its body.
- **Sheet** `open` `onOpenChange` `title` `children` - left sheet (used by the shell's mobile nav).
- **Tooltip** `content` `children` (one element) `side?` `align?` `disabled?`.
- **DropdownMenu** / `DropdownMenuTrigger asChild` / `DropdownMenuContent align?` / `DropdownMenuItem icon? shortcut? danger? onSelect` / `DropdownMenuRadioGroup value onValueChange` + `DropdownMenuRadioItem value` / `DropdownMenuLabel` / `DropdownMenuSeparator` / `DropdownMenuGroup`.
- **Tabs** `value|defaultValue` `onValueChange` > **TabsList** > **TabsTrigger** `value` `icon?` `count?` ; **TabsContent** `value` (radix).
- **Panel** (= **Card**) `title?` `description?` `actions?` `icon?` `footer?` `padded?=true` `bodyClassName?` - bordered card with header row.
- **PageHeader** `title` `description?` `eyebrow?` (breadcrumb/back link) `actions?`.
- **Toolbar** (= **FilterBar**) `children` (left, wraps) `end?` (right-aligned).
- **DataTable<T>** `rows` `columns: Column<T>[]` `rowKey(row)` `loading?` `empty?` (node) `onRowClick?` `selectedKey?` `pageSize?=10` (0 = all) `pagination?` (server: `{page,pageSize,total,onPageChange}`) `initialSort?` `sort?`+`onSortChange?` (controlled/server) `rowClassName?` `framed?=true` `skeletonRows?`. **Column<T>**: `key` `header` `cell(row,i)` `sortValue?(row)` (enables sort) `align?` `width?` `className?` `headerClassName?` `hideOnMobile?`. 40px rows, skeleton while loading, EmptyState when empty.
- **Table / THead / TBody / TR (`interactive?` `selected?`) / TH (`align?`) / TD (`align?`)** - raw table primitives with the same styling.
- **Pagination** `page` (1-based) `pageSize` `total` `onPageChange`.
- **Badge** `tone?='muted'` `variant: 'soft'|'solid'|'outline'` `icon?` `size: 'sm'|'md'` `mono?`.
- **StatusPill** `tone` `label` `icon?` `pattern: 'solid'|'hatch'|'outline'|'call'` `meta?` (mono timer) `size?`. Agent states: Ready `success`; On call `pattern="call"` (lime + ring); Wrap-up `info`; Break/Lunch `warning` (hatch when paused type); Meeting/Training `muted` + `hatch`; Offline `pattern="outline"`. Always pass an icon.
- **ToneDot** `tone` `pulse?` `size?=8`.
- **Stat** (= **StatCard**) `label` `value` `hint?` `icon?` `tone?` (3px top rule + coloured value) `size: 'sm'|'md'|'wall'` (wall = 48-64px Archivo) `bare?` (no frame).
- **KpiNumeral** `value` `wide?` - Archivo 800 tabular numeral that ticks over (200ms) on change.
- **ProgressBar** `value` (0-100) `tone?='ink'` `size: 'xs'|'sm'|'md'` `label?` `valueLabel?` `segments?: {value,tone,label?}[]` (stacked).
- **Avatar** `name` (initials) `size?=32` `tone?` (default carbon + lime).
- **Kbd** `children` - key cap (hotkeys 1-9 on disposition chips).
- **Skeleton** `className` (size it) · **Spinner** `size?` `label?` · **LoadingBlock** `label?` (centered RingPulse).
- **EmptyState** `title` `description?` `action?` `icon?` (default brand motif) `compact?`.
- **Alert** `tone: 'info'|'success'|'warning'|'danger'` `title?` `children?` `action?` - inline banner with a tone edge.
- **DescriptionList** `items: {label, value, mono?}[]` `columns: 1|2` - label/value pairs (lead card, drawers).
- **Toaster** - mounted by the shell; don't mount again.

## Brand (`@/components/brand`)
- **Mark** `size?=32` `variant: 'default'|'reversed'` `title?` - the outbound-ring tile.
- **Logo** `size?=28` `markOnly?` `lang?` `wordmarkClassName?` - mark + "dareke" / "დარეკე".
- **RingPulse** `state: 'idle'|'ringing'|'connected'` `size?=64` `label?` - ringing arcs (1.2s loop, static under reduced motion), solid lime ring when connected. Use for requesting/dialing/ringing/incoming.
- **DialMotif** `size?=120` `litLeads?=1` `className?` - empty-state illustration (currentColor line work + lime dots).

## Shell hooks (`@/app/*`)
- `TopBarPortal` from `@/app/TopBarPortal`: `<TopBarPortal>{controls}</TopBarPortal>` puts page controls in the top bar's left slot.
- `useTheme()` / `toggleTheme()` / `setTheme()` from `@/app/theme`; `useMe()` (`{account, user, name}`) and `useSignOut()` from `@/app/controls`.
- Shortcuts dialog (`?`) and the Cmd/Ctrl+K palette belong to the shell. The workspace binds M / H / E / 1-9 / Enter itself and must ignore keys while focus is in an input.

## i18n
`common` namespace (default): `actions.*` (save, cancel, close, confirm, create, add, edit, delete, remove, search, filter(s), clear, clearFilters, apply, reset, refresh, retry, back, next, previous, export, exportCsv, import, importCsv, download, upload, copy, copied, view, viewAll, details, more, start, pause, resume, stop, test, yes, no, signIn, signOut), `states.*` (loading, saving, saved, empty, emptyHint, noResults, noResultsHint, error, errorHint, required, invalid, all, any, none, unknown, notSet, live, on, off, enabled, disabled, active, inactive), `roles.<Role>`, `tones.<Tone>`, `campaignStatus.<CampaignStatus>`, `dialingMode.<DialingMode>`, `numberStatus.<NumberStatus>`, `callOutcome.<CallOutcome>`, `callMode.<CallMode>`, `hangupBy.<HangupBy>`, `statusType.<AgentStatusType>`, `dncSource.<DncSource>`, `time.*` (today, yesterday, last7, last30, thisMonth, from, to, seconds/minutes/hours {{count}}, never, justNow), `table.*`, `errors.*`, `demoDataNote`, `tenant`, `tagline`. Use `t('numberStatus.' + status)` etc. Feature strings go in the feature namespace.
