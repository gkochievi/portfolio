# Rigi UI cheat-sheet

Import from `@/components/ui` (primitives), `@/components/status` (chips), `@/components/brand` (Logo, QueueMotif), `@/lib/format`, `@/lib/csv`, `@/lib/cn`. Build pages ONLY from these. Icons: `lucide-react` (they pick up size/stroke inside our components; elsewhere use `className="size-4 stroke-[1.75]"`).

## Tokens (Tailwind classes)
`bg-surface` page, `bg-panel` cards, `bg-sunken` wells, `text-ink`, `text-muted`, `text-subtle`, `border-hairline` / `border-hairline-strong`, `bg-primary` + `text-on-primary` (green for staff, ochre automatically inside the partner portal), `text-accent` (ochre), `text-success|warning|danger|info` and tints like `bg-danger/12`, `bg-row-hover`, `text-signal`/`border-signal`. Charts: `var(--chart-1..5)` (ink, green, ochre, slate, teal). Fonts: `font-display`, `font-sans` (default), `font-mono`. Helpers: `.eyebrow` (mono label; normal case in Georgian - NEVER use Tailwind `uppercase` on translated text), `.serving` (3px "now serving" left rule), `.ticket` + `.ticket-perf`, `.num` (tabular figures), `.link` (ink text + 2px signal underline). Radii: `rounded` 4 chips, `rounded-md` 6 controls, `rounded-lg` 8 cards, `rounded-xl` 12 dialogs. Motion: `animate-rise` (new list items), `ease-rigi`.

## Layout
- `PageHeader({eyebrow?, title, description?, actions?, back?: string | {to, label}, meta?, icon?})` - every page starts with one. The shell already gives padding + max-width; do not add page gutters.
- `Section({title?, description?, eyebrow?, actions?, children})` - titled block with bottom margin.
- `Card({active?, className, ...div})`, `CardHeader({title, description?, eyebrow?, actions?})`, `CardBody`, `CardFooter` (right-aligned actions).
- `TicketCard({active?, footer?, to?, onClick?, children})` - tasks/invoices as ticket stubs (notched corner, dashed perforation above footer).
- `KpiStrip({children})` - responsive 1/2/4 grid for KpiTiles.
- `KpiTile({index?, label, value: number|node, format?: (n)=>string, delta?, deltaLabel?, inverse?, trend?: number[], href?, tone?, hint?, loading?})` - numbers count up once; `StatCard` = alias.
- `DescriptionList({items: [{label, value, mono?, full?} | null | false], columns?: 1|2|3})` - detail facts.
- `FilterBar({children, actions?, onClear?})` - filter row above tables (`Toolbar` = alias).
- `Tabs` (Radix Root: `value`/`onValueChange` or `defaultValue`), `TabsList`, `TabsTrigger({value, count?, icon?})`, `TabsContent({value})`. Sync with `?tab=` via useSearchParams.
- `SegmentedControl({value, onChange, options: [{value, label, icon?}], size?: 'sm'|'md'})` - view toggles (threads/flat, 1h/24h/7d).

## Data
- `DataTable<T>({columns, rows (undefined = loading), getRowId, loading?, error?, onRetry?, rowNumbers?, selectable?, selectedIds?, onSelectedChange?, activeRowId?, onRowClick?, rowHref?, rowClassName?, empty? (node, or EmptyState props `{title, description?, action?}`), initialSort?: {key, dir}, sort?/onSortChange? (controlled = server-side, no local sort), pageSize? = 25 (0 = off), footer?, caption?})`.
  `Column<T> = {key, header, cell?: (row, i) => node, sortable?, sortValue?: (row) => primitive, align?: 'left'|'right'|'center', width?, mono?, hideBelow?: 'sm'|'md'|'lg', className?}`. Clicks on links/buttons/inputs inside a row do not trigger the row action. Put amounts in `align: 'right'`.
- `Pagination({page (1-based), pageSize, total, onPageChange, onPageSizeChange?, pageSizes?})` - for server-paged lists (with DataTable `pageSize={0}`).
- `EmptyState({title, description?, action?, icon?, compact?})` - queue-motif art by default. Use `common:states.allCaughtUp` for empty queues.
- `Skeleton({className})`, `Spinner({label?})`, `PageSkeleton()`.
- `JsonView({value, collapseAt? = 2})` - audit diffs, log payloads.
- `Sparkline({values, tone?, width?, height?, fill?})`, `ProgressBar({value, max?, tone?, label?, showValue?})`.

## Inline
- `Badge({tone?: 'neutral'|'primary'|'accent'|'success'|'warning'|'danger'|'info'|'outline', dot? = true, icon?, children})` - square-ish chip with square dot.
- `Mono({children, chip? = true})` - ids (TCK-1187, INV-2026-09-000142, keys).
- `Money({amount, currency, tone?: 'auto'})` - `formatMoney`, tabular; `auto` colours negatives.
- `DateText({value, withTime?, relative?})` - DD.MM.YYYY, title shows full date-time.
- `Avatar({name, size?: 'xs'|'sm'|'md'|'lg', color?})` - initials on a square tile.
- `Kbd`, `Tooltip({content, side?, children: single element})`.
- `Banner({tone?: 'info'|'success'|'warning'|'danger'|'neutral', title?, children?, action?})`.

## Controls (all 36px tall; `size="sm"` = 32px)
- `Button({variant?: 'primary'|'secondary'|'outline'|'ghost'|'destructive'|'destructive-ghost'|'link', size?: 'xs'|'sm'|'md'|'lg', loading?, icon?, iconRight?, asChild?})` - `asChild` wraps a `<Link>`. Default type="button"; pass `type="submit"` in forms.
- `IconButton({label (required, also the tooltip), icon, variant?: 'ghost'|'outline'|'primary'|'destructive-ghost', size?: 'sm'|'md', tooltip? = true, loading?})`.
- `CopyButton({value, label?, size?})` - clipboard + toast.
- `Field({label?, hint?, error?, required?, htmlFor?, inline?, children})` - wrap every control; `htmlFor` = control id.
- `Input({invalid?, icon?, suffix?, size?, mono?, ...input})` - forwardRef, works with `register`.
- `Textarea({invalid?, mono?, rows?})` - forwardRef.
- `NativeSelect({options?: [{value, label}], placeholder?, invalid?, size?, ...select})` - forwardRef; best with react-hook-form `register`.
- `Select({value, onValueChange, placeholder?, size?, invalid?, aria-label})` + `SelectItem({value, children})` - Radix; values must be non-empty (use `'all'` for "any").
- `Checkbox({label?, description?, indeterminate?, ...input})` - native, forwardRef.
- `Switch({checked, onCheckedChange, label?, description?, disabled?})` - Radix.
- `SearchInput({value, onChange(value), placeholder?, debounce? = 200})`.
- `Label({required?})`.

## Overlays
- `Dialog({open, onOpenChange, title, description?, footer?, size?: 'sm'|'md'|'lg'|'xl', dismissible? = true, children})` - `Modal` = alias.
- `Drawer({open, onOpenChange, title, description?, footer?, side?: 'right'|'left', widthClassName?, children})` - side sheet.
- `ConfirmDialog({open, onOpenChange, title, description?, confirmLabel?, cancelLabel?, tone?: 'primary'|'danger', onConfirm, pending?, confirmDisabled?, children?})` - put reason/password inputs in children.
- `DropdownMenu` (Root), `DropdownMenuTrigger asChild`, `DropdownMenuContent({align?})`, `DropdownMenuItem({onSelect?, icon?, tone?: 'danger', hint?, disabled?, asChild?})`, `DropdownMenuCheckboxItem({checked, onCheckedChange})`, `DropdownMenuLabel`, `DropdownMenuSeparator`.
- `toast` (re-export of sonner): `toast.success(t('...'))`, `toast.error(...)`. The shell mounts the Toaster bottom-right.

## Status chips (`@/components/status`)
`TaskStateChip({state, realm?: 'staff'|'partner'})` (partner: finished = "Awaiting verification"), `InvoiceStatusChip({status})`, `InvoiceDisplayStatusChip({status})`, `MailStatusChip({status})`, `ProjectStateChip({state})`, `ActiveChip({active})`, `LogLevelChip({level})`, `ServiceStatusDot({status, withLabel?})`, `OverdueChip()`.

## Brand (`@/components/brand`)
`Logo({variant?: 'staff'|'partner', withWordmark? = true, size? = 28})`, `LogoMark`, `QueueMotif({count?, size?, animate?, withTicket?})`.

## Format (`@/lib/format`, all language-aware)
`formatMoney(amount, currency)` ("₾1,234.50" / "1 234,50 ₾"), `formatNumber(n, opts?)`, `formatPoints(n, {unit?})` ("12.5 pts"), `formatPercent(ratio)`, `formatDate(iso)` DD.MM.YYYY, `formatDateTime(iso, withSeconds?)`, `formatTime`, `formatPeriod(year, month1to12, short?)`, `monthName(m)`, `formatRelative(iso)`, `formatBytes(n)`, `formatTaskNumber(n)` TCK-n, `formatProjectNumber(n)` PRJ-n, `formatIndex(n)` "01", `localName({fullName|name, fullNameKa|nameKa})` (Georgian spelling in ka), `currentLang()`, `CURRENCY_SYMBOL`.
Components that call format helpers in render should call `useTranslation()` so they re-render on language change.
CSV: `toCsv(rows, [{key, header, value?}])`, `downloadText(filename, text, mime?)`.

## Shell services
`@/lib/session`: `useMe()`, `useStaffMe()`, `canOpenArea(me, area)`, `signOutTo(path?)`, `switchAccount(id, next?)`. `@/app/layouts/PortalLayout`: `usePortalMe()` -> `{account, partner: {id, name, legalName, currency}}` (query key `['me','portal']`). `@/app/theme`: `useTheme()`. `@/i18n`: `setLanguage('en'|'ka')`.

## Shared labels (`common` namespace)
`actions.*`, `states.*` (`allCaughtUp`, `nextUp`, `noResults`…), `fields.*`, `filters.*`, `units.*`, `role.*`, `taskState.*`, `taskStatePartner.*`, `invoiceStatus.*`, `invoiceDisplayStatus.*`, `invoiceKind.*`, `lineKind.*`, `mailStatus.*`, `projectState.*`, `technicianType.*`, `licenseKind.*`, `architecture.*`, `contactRole.*`, `documentKind.*`, `logLevel.*`, `serviceStatus.*`, `dependency.*` (health deps), `active.true|false`, `internal`, `overdue`, `yes`/`no`/`none`, `table.selected` ("{{count}} selected"), `nav.*`.
