# Chiti UI cheat-sheet

Import everything from `@/components/ui`; brand art from `@/components/brand`; helpers from `@/lib/cn` (`cn`) and `@/lib/format`.
Icons: `lucide-react`, `strokeWidth={1.75}`, 20px in the app, 18px in dense lists. Strings for shared words live in the `common` namespace (`t('actions.save')`, `t('channel.whatsapp')`, `t('sessionStatus.waiting')` …).

## Tokens (Tailwind classes)
- Surfaces: `bg-bg` (page cream), `bg-panel` (cards), `bg-sunken` (wells, table header), `bg-hover`. Text: `text-ink`, `text-muted`. Lines: `border-line` (1px hairline), `border-line-strong` (inputs).
- Brand: `bg-primary text-on-primary` (yellow is a FILL only, never text on light), `text-accent` / `bg-accent text-on-accent` (olive: links, selection, focus), `bg-accent-soft` (= `bg-bot`, AI-bubble tint).
- Status: `text-success|warning|danger|info` + `bg-*-soft`. All flip automatically in dark mode (`dark:` variant = `.dark` on <html>).
- Radii: `rounded-ui` (10px), `rounded-modal` (14px), `rounded-bubble` (18px), `rounded-full` (pills/avatars). Shadows: `shadow-hard` (primary CTA only), `shadow-pop` (menus/popovers). Cards have no shadow.
- Fonts: `font-display` (headings), `font-sans` (body, default), `font-mono` (ids, keys, snippets), `font-georgian`. Utility classes: `tabular` (tabular numbers), `link` (olive underlined link), `flight-path` (2/6 dotted SVG stroke).
- Motion: `animate-hop` (new message), `animate-fade-in`, `animate-pop-in`, `animate-slide-in-right|left`, `animate-fly-off` (bot badge handover), `animate-dot-hop` (typing dots; set `style={{animationDelay}}`), `ease-chirp`. Reduced motion is handled globally.
- Never use `uppercase` on Georgian text (a CSS guard neutralises it under `:lang(ka)` anyway).

## Primitives (one line each)
- `Button` `{ variant?: 'primary'|'secondary'|'accent'|'outline'|'ghost'|'subtle'|'danger'|'danger-outline'|'link', size?: 'xs'|'sm'|'md'|'lg', block?, loading?, leftIcon?, rightIcon?, asChild? }` + native button props. Use `asChild` with `<Link>`. One `primary` per view.
- `IconButton` `{ label (required, aria + tooltip), icon, variant?: 'ghost'|'muted'|'outline'|'secondary'|'primary'|'danger', size?: 'xs'|'sm'|'md'|'lg', round?, active?, badge?: number, loading?, tooltip?: boolean, tooltipSide? }`.
- `Input` `{ invalid?, leftIcon?, rightSlot?, size?: 'sm'|'md'|'lg', mono? }` + native input props (forwardRef, works with react-hook-form `register`).
- `Textarea` `{ invalid?, autoGrow?, maxRows? }` + native props.
- `Field` `{ label?, hint?, error?, required?, htmlFor?, aside?, children }` wraps any control. `useFieldId()` gives a stable id.
- `SearchInput` `{ value, onChange(value), debounceMs?, placeholder?, size? }` (magnifier, clear button, Esc clears).
- `Select` `{ value, onValueChange, options: {value,label,icon?,description?,disabled?,textValue?}[], placeholder?, size?: 'sm'|'md', invalid?, disabled?, id?, 'aria-label'? }` (Radix; values must be non-empty strings).
- `Checkbox` `{ checked, onCheckedChange, label?, description?, indeterminate?, disabled? }`.
- `Switch` `{ checked, onCheckedChange, label?, description?, size?: 'sm'|'md', labelFirst? (settings rows: label left, switch right), disabled? }`.
- `Badge` / `Pill` `{ tone?: 'neutral'|'muted'|'accent'|'primary'|'success'|'warning'|'danger'|'info'|'ink'|'outline', size?: 'sm'|'md', dot?, icon? }`. `CountBubble { count, tone?: 'primary'|'danger'|'muted' }` (hidden at 0).
- `Card` `{ padding?: 'none'|'sm'|'md'|'lg', interactive?, muted? }` + div props. `CardHeader { title, description?, icon?, actions? }`, `CardFooter` (right-aligned buttons, top hairline).
- `StatCard` / `KpiTile` `{ label, value, hint?, icon?, delta?: {value, direction:'up'|'down'|'flat', good?}, loading?, tone?: 'default'|'accent'|'warning'|'danger'|'success', onClick? }`. Dashboard KPI row: `grid gap-4 sm:grid-cols-2 lg:grid-cols-4`.
- `DataTable<T>` `{ columns: Column<T>[], rows, rowKey, loading?, empty?: node | {title, description?, action?, nest?}, pageSize? (10; 0 = off), page?/onPageChange? (controlled, 1-based), total? (server paging: rows = current page), initialSort?, sort?/onSortChange? (server sort), onRowClick?, selectedKey?, dense?, rowClassName?, caption? }`. `Column<T> = { id, header, cell(row, i), sortValue?(row), align?, width?, hideBelow?: 'sm'|'md'|'lg', className? }`.
- `Pagination` `{ page (1-based), pageCount, onPageChange, total?, pageSize? }`.
- `Tabs` `{ value|defaultValue, onValueChange, variant?: 'underline'|'pill' }` + `TabsList`, `TabsTrigger { value, count?, icon? }`, `TabsContent { value }` (Radix).
- `SegmentedControl<V>` `{ value, onChange, options: {value,label,icon?,disabled?}[], size?: 'sm'|'md', 'aria-label'? }` (Live / 1h / 24h / 7d).
- `Modal` / `Dialog` `{ open, onOpenChange, title, description?, children, footer?, size?: 'sm'|'md'|'lg'|'xl'|'full', hideClose?, dismissible?, trigger?, bodyClassName? }`.
- `Drawer` / `Sheet` `{ open, onOpenChange, title, description?, children, footer?, side?: 'right'|'left', width? (420), headerActions?, bodyClassName? }`.
- `ConfirmDialog` `{ open, onOpenChange, title, description?, confirmLabel?, cancelLabel?, tone?: 'default'|'danger', requirePassword?, passwordLabel?, onConfirm(password?) => void|Promise (closes on resolve, stays open on reject), children? }`.
- `DropdownMenu`, `DropdownMenuTrigger` (asChild), `DropdownMenuContent { align? }`, `DropdownMenuItem { icon?, tone?: 'danger', shortcut?, onSelect, asChild? }`, `DropdownMenuCheckboxItem`, `DropdownMenuRadioGroup/RadioItem`, `DropdownMenuLabel`, `DropdownMenuSeparator`. Shorthand: `Menu { trigger, items: {label, icon?, onSelect, tone?, disabled?, separated?}[], label?, align? }`.
- `Tooltip` `{ content, side?, align?, disabled?, children (single focusable element) }`. Provider is mounted by the shell.
- `toast` (sonner): `toast.success(msg)`, `toast.error(msg)`, `toast.warning`, `toast.info`, `toast(msg, { description, action: {label, onClick} })`. `<Toaster>` is mounted by the shell; never mount another.
- `EmptyState` `{ title, description?, icon?, illustration?: 'nest'|'none', action?, compact? }` (empty inbox: `illustration="nest"` + `t('emptyNest')`). `ErrorState { title, description?, onRetry?, retryLabel? }`.
- `Skeleton { className }`, `SkeletonText { lines? }`, `SkeletonRow` (avatar + 2 lines). No shimmer by design.
- `Spinner { size?, label? }`, `LoadingBlock { label? }`.
- `Avatar` `{ name, avatarId? ('nest-01'…'nest-16'), avatarUrl?, size?: 'xs'|'sm'|'md'|'lg'|'xl'|number, status?: 'online'|'away'|'offline', square? }`. `AvatarGroup { people, max?, size? }`. `AvatarPicker { open, onOpenChange, name, value: {avatarId, avatarUrl}, onChange }` (upload -> object URL, session only). `AVATAR_PRESETS` lists ids. Also at `@/components/Avatar` and `@/components/AvatarPicker`.
- `PageHeader` `{ title, description?, actions?, breadcrumbs?: {label, to?}[], eyebrow?, meta? }`. `SectionTitle { title, description?, actions? }` for h2s.
- `Toolbar` / `FilterBar` `{ children (left, wraps), right? }`. `FilterChip { active?, onClick, count?, icon?, children }`.
- `DateRangePicker` `{ value: {from,to} ('yyyy-MM-dd'), onChange, presets? ([7,30,90]), max?, maxDays? }`. `lastDays(n)` builds a range ending today.
- `LocalizedTextField` `{ value: LocalizedText, onChange, multiline?, rows?, withRu? (true), required? (['ka','en']), placeholder?, maxLength?, invalid? }` (ka / en / ru tabs; dot marks missing required language).
- `LanguageSwitch { size? }` (EN / ქარ), `ThemeToggle`, `Kbd`, `Divider { vertical? }`.

## Brand (`@/components/brand`)
- `ChitiMark { size?, stroke?: 'auto'|'always'|'none' }`, `ChitiLauncherMark { size? (56), tone?: 'cream'|'ink' }` (widget launcher), `Wordmark { lang?: 'en'|'ka'|'both', size? }`, `Logo { size?, lang?, showWordmark? }`.
- `NestIllustration { className, withBird? }`, `BirdBadge { size?, withLabel? ('AI' tag), flying? (handover fly-off) }`, `FlightPaths { className }` (dark hero art).

## Formatting (`@/lib/format`)
`pickText(text, lang)`, `personName(name, lang)`, `formatTime`, `formatDate`, `formatDateTime`, `formatSmartDate` (list timestamps), `formatDay` (day dividers), `formatRelative(iso, lang, nowMs?)`, `formatDuration(seconds)`, `formatWait(sinceIso, nowMs) -> {label, tier: 'fresh'|'amber'|'late', seconds}`, `formatNumber`, `formatPercent(ratio)`, `initials`, `hueFromString`, `maskSecret`.

## Theme (`@/styles/theme`)
`useResolvedTheme()` ('light'|'dark', for charts), `useThemeChoice()`, `setTheme('system'|'light'|'dark')`, `toggleTheme()`. In memory only. Chart colours: read CSS vars (`var(--c-accent)`, `var(--c-primary)`, `var(--c-muted)`, `var(--c-line)`) so they follow the theme.

## Shell (`src/app`)
`useMe()` from `@/app/session` returns `{ account, tenant, settings, workingHours, operator? }` (GET /api/auth/me). `useSignOut()` signs out through the API. `SystemMessage { code: 403|404 }` from `@/app/pages/NotFoundPage` for inline 403/404 states. Layouts provide the page padding (admin/superadmin: max-w 1280, px-6, py-6); the operator layout gives the page the full remaining height (`h-full` inside).
