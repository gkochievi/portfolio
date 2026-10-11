# Tova UI cheat-sheet

Import everything from `@/components/ui` (brand art from `@/components/brand`). Colours are tokens, never hex: `bg-surface` (page), `bg-panel` (cards), `bg-sunken` (wells), `border-line`, `text-ink`, `text-muted`, `bg-primary`/`text-on-primary`, `text-primary`, `bg-primary-soft`, `bg-accent` (persimmon: the ONE thing to look at; `text-on-accent` on it, never white), `text-accent-ink` (orange text), `bg-accent-soft`, `success|warning|danger|info` plus `-soft`, `bg-own-row`, `bg-zebra`, `from-sky-top to-sky-bottom` (game only). Radii: `rounded-chip` 6, `rounded-card` 10, `rounded-hero` 16. Shadows: `shadow-card`, `shadow-pop`. Fonts: `font-display` (Unbounded 800), `font-sans`, `font-mono` (scores, timers, codes). Numbers: `tabular-nums`. Motion: `animate-drop-in`, `animate-float-up`, `animate-timer-pulse`, `animate-live-dot`; framer presets in `@/lib/motion` (`dropIn`, `stagger`, `floatUp`, `flip`, `slideIn`, `dropInProps`). Dark mode is automatic through the tokens; `dark:` works too. Never `uppercase` Georgian text (the CSS neutralises it under `:lang(ka)` anyway).

Helpers: `cn()` from `@/lib/cn`; `formatDate|formatDateTime|formatTime|formatDayMonth|formatNumber|formatSigned|formatPercent|formatRelative|formatCountdown|formatDuration|dateLocale` from `@/lib/format` (optional `lang` arg, defaults to the UI language); `useBrandColors()` / `chartTheme(colors)` from `@/lib/brand` for Recharts and canvas; `assetUrl()` from `@/lib/assets` for media.

## Actions
- `Button` — `variant?: 'primary'|'accent'|'secondary'|'outline'|'ghost'|'danger'|'danger-ghost'|'link'` (primary), `size?: 'sm'(36)|'md'(48)|'lg'(56)`, `block?`, `loading?`, `leftIcon?`, `rightIcon?`, `asChild?` (wrap a `<Link>`), all button attrs; `type` defaults to `button`. Admin toolbars: `size="sm"`. Player screens: `size="lg" block`.
- `IconButton` — `label` (required, aria + title), `icon`, `variant?: 'ghost'|'outline'|'primary'|'danger-ghost'`, `size?: 'sm'|'md'|'lg'`, `loading?`.
- `InlineConfirm` — inline delete: `onConfirm` (may return a promise), `question?`, `confirmLabel?`, `label?`, `iconOnly?`, `busy?`, `disabled?`, `size?`. Use for every delete (no modal).

## Forms (all inputs forward refs: spread `register('x')`)
- `Field` — `label?`, `htmlFor?` (or children as `(id) => …`), `hint?`, `error?` (i18n key like `content:errors.nameRequired` or array; translated for you), `required?`, `aside?`, `children`.
- `Label` — styled `<label>`.
- `Input` — input attrs + `invalid?`, `leading?`, `trailing?` (icons/units inside), `inputSize?: 'sm'|'md'|'lg'`.
- `Textarea` — textarea attrs + `invalid?`.
- `Checkbox` — input attrs + `label?`, `description?`.
- `Select` — `value`, `onValueChange(v)`, `options: {value, label, hint?, disabled?}[]` (non-empty string values), `placeholder?`, `size?: 'sm'|'md'`, `icon?`, `invalid?`, `disabled?`, `id?`, `aria-label?`. With RHF use `<Controller>`.
- `Switch` — `checked`, `onCheckedChange`, `label?`, `description?`, `disabled?`, `aria-label?`.
- `Segmented<T>` — `value`, `onChange(v)`, `options: {value, label, title?, disabled?}[]`, `aria-label` (required), `size?: 'sm'|'md'`, `block?`. For difficulty/speed/filters.
- `SearchInput` — `value`, `onChange(string)`, `placeholder?`, `inputSize?`; Esc clears.

## Layout & data
- `PageHeader` — `title`, `description?`, `eyebrow?`, `actions?`, `back?: {to, label}`, `variant?: 'admin'|'player'` (player = Unbounded 32–44px).
- `Toolbar` / `FilterBar` — wrapping flex row above tables; `ToolbarSpacer` pushes the rest right.
- `Section` — `title?`, `description?`, `actions?`, `children`.
- `Card` — div attrs + `padding?: 'none'|'sm'|'md'|'lg'`, `hero?` (16px radius), `sunken?`, `interactive?`.
- `CardHeader` — `title`, `description?`, `actions?`, `icon?`.
- `StatTile` (= `StatCard`) — `label`, `value`, `hint?`, `icon?`, `tone?: 'default'|'primary'|'accent'`, `loading?`.
- `DataTable<T>` — `columns: Column<T>[]`, `rows: T[] | undefined` (undefined = loading), `getRowId`, `loading?`, `emptyTitle?`, `emptyDescription?`, `empty?`, `pageSize?` (20; 0 = off), `initialSort?: {id, dir}`, `onRowClick?`, `rowClassName?(row)` (e.g. `'bg-own-row'`), `maxHeight?` (enables sticky header scroll), `caption?`. `Column<T>`: `id`, `header`, `cell(row, i)`, `sortValue?(row)`, `align?: 'left'|'right'|'center'`, `width?`, `hideBelow?: 'sm'|'md'|'lg'`, `className?`, `headerClassName?`. 44px rows, zebra.
- `Table`, `THead`, `TBody`, `TR`, `TH`, `TD` — low-level table with the same look (`Table maxHeight?`).
- `Pagination` — `page` (1-based), `pageCount`, `onPageChange`, `total?`, `pageSize?`.
- `Tabs`, `TabsList`, `TabsTrigger value`, `TabsContent value` — Radix tabs, underline style.

## Overlays
- `SideSheet` (= `Drawer`) — `open`, `onOpenChange`, `title`, `description?`, `children`, `footer?` (sticky; for a form put `<form id="x">` in children and `<Button type="submit" form="x">` in footer), `width?` (480). Every create/edit form uses this.
- `Modal` — same props + `size?: 'sm'|'md'|'lg'|'xl'`. Drill-downs and short dialogs.
- `BottomSheet` — same props; phone menus.
- `DropdownMenu`, `DropdownMenuTrigger asChild`, `DropdownMenuContent align?`, `DropdownMenuItem onSelect danger?`, `DropdownMenuLabel`, `DropdownMenuSeparator`, `DropdownMenuGroup`.
- `Tooltip` — `content`, `children` (one focusable element), `side?`, `disabled?`.
- `toast` (sonner: `toast.success(t('…'))`, `toast.error`, `toast(…)`) and `toastError(error)` (translates an ApiError's i18n key). `<Toaster/>` is already mounted.

## Status & feedback
- `Badge` — `tone?: 'neutral'|'primary'|'accent'|'success'|'warning'|'danger'|'info'|'ink'`, `dot?`, `pulse?`, `icon?`, `size?: 'sm'|'md'`, `children`.
- `StatusBadge` — `status: EventStatus` (hold/upcoming/open/closed; open pulses).
- `RoleBadge` — `role: Role`. `ItemTypeBadge` — `type: ItemType`. `ViewOnlyTag` — muted "view only" (supervisor).
- `Chip` — filter toggle: button attrs + `active?`, `count?`, `icon?`.
- `EmptyState` — `title`, `description?`, `action?`, `icon?`, `compact?` (drifting flakes above).
- `ErrorState` — `error`, `onRetry?` (translated message). `useErrorMessage()` → `(error) => string`.
- `Skeleton` — `className` (size it). `SkeletonText` — `lines?`. `Spinner` — `className?`, `label?`.
- `Avatar` — `name` (initials), `size?: 'sm'|'md'|'lg'|'xl'`, `tone?: 'primary'|'ink'|'accent'|'muted'`.
- `Countdown` — `to` (ISO/Date/ms), `onDone?`, `size?: 'sm'|'md'|'lg'|'xl'`; `Dd HH:MM:SS`, 0 at/after target. `useCountdown(to, intervalMs?)` → ms left.

## Brand (`@/components/brand`)
- `Logo` — `size?` (px, min 20), `tone?: 'default'|'inverse'`, `title?`.
- `Wordmark` — `lang?` ("tova" with a persimmon disc / "თოვა" with a persimmon ო); size via font-size on a parent.
- `Lockup` — mark + wordmark: `size?`, `tone?`, `lang?`, `compact?`.
- `Flakes` — decorative snowfall filling a `relative` parent: `count?`, `persimmon?` (one disc), `tone?: 'default'|'light'`, `speed?`. Still under reduced motion. `FlakeGlyph` — `size?`.
- `ItemToken` — coin token: `type`, `imageUrl?`, `name`, `size?` (40), `bonus?` (persimmon ring). Hazards get a danger ring, slash and glyph.

## Shell (`@/shell/*`, for pages that need it)
- `useAdminEventId()` (`@/shell/adminEvent`) — route `:eventId`, else `?event=`, else the current event.
- `useMe()`, `useCurrentEvents()` (`@/lib/queries`). `useCurrentUser()` (`@/shell/session`) is the synchronous signed-in `User`.
- `LanguageToggle`, `ThemeToggle` (`@/shell/controls`) for full-bleed pages (landing, play) that sit outside the shells.
- `setLang()`, `useLang()` from `@/i18n`.
- PlayerShell renders a 520px column (the `/leaderboard` route gets 1200px); AdminShell content is up to 1200px. Pages do not add their own outer padding.
