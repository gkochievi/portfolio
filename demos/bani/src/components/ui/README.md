# Bani UI primitives: cheat-sheet

Import everything from `@/components/ui` (and brand art from `@/components/brand`). Toasts: `import { toast } from '@/components/ui'` (sonner; the shell mounts `<Toaster/>`). Built-in copy comes from `common:` (actions.*, states.*, ui.*); pass your own labels for everything else.

Tokens (Tailwind utilities, light + dark): `bg-bg` page, `bg-panel` cards, `bg-sunken` wells/table heads, `bg-hover`, `text-ink`, `text-muted`, `text-faint`, `border-line`, `border-line-strong`, `bg-primary`/`text-primary` (bronze), `text-on-primary`, `text-brass` (decorative only, never status), `bg-pine`, `text-linen`, `text-success|warning|danger|info` (use `/12` for fills), `font-display`, `font-mono`, `tabular`, `eyebrow` (uppercase label; auto sentence case in ka), `skeleton`, `animate-breathe`. Chart series order: `#A3441A`, `#2F5D4E`, `#D9A33B`, `#3F6178`, `#8AA394` (dark mode: read `var(--bani-primary)` etc.). Radii: cards `rounded-[10px]`, controls `rounded-[8px]`, chips `rounded-full`. Icons: lucide 18px, `strokeWidth={1.75}`. Never `uppercase` Georgian text.

## Actions and form controls
- `Button` {variant?: 'primary'|'secondary'(default)|'ghost'|'danger'|'link'; size?: 'sm'|'md'; loading?; icon?: LucideIcon; iconRight?: LucideIcon; asChild?} + button attrs (type defaults to "button").
- `IconButton` {label (required, aria + title); icon: LucideIcon; size?: 'sm'|'md'; variant?: 'ghost'|'secondary'|'danger'}.
- `CopyButton` {value; label?} icon-only without label, small button with label; shows "Copied".
- `Field` {label; hint?; error?; required?; htmlFor?; children} label + control + hint/error line.
- `Input` {invalid?; mono?; icon?: LucideIcon} + input attrs (forwardRef, works with react-hook-form `register`).
- `Textarea` {invalid?; mono?; rows?=4} + textarea attrs (forwardRef).
- `SearchInput` {value; onChange(v: string); onDebouncedChange?(v); debounceMs?=250; placeholder?} with clear button.
- `Select<V>` {value; onValueChange(v: V); options: {value, label, disabled?}[]; placeholder?; size?: 'sm'|'md'; disabled?; invalid?; id?; aria-label?} (radix).
- `Combobox` {items: {value, label, meta?, disabled?}[]; value; onChange(v); placeholder?; searchPlaceholder?; emptyText?; disabled?} searchable (cmdk).
- `Switch` {checked; onCheckedChange(b); label?; disabled?; aria-label?}.
- `Checkbox` {checked: boolean | 'indeterminate'; onCheckedChange(b); label?; disabled?}.
- `SegmentedControl<V>` {options: {value, label, icon?, disabled?}[]; value; onChange(v); size?: 'sm'|'md'; aria-label?}.

## Surfaces and layout
- `PageHeader` {title; subtitle?; actions?; meta?; eyebrow?} every page starts with it (2px bronze baseline). The shell already gives page padding, max width and breadcrumbs.
- `SectionTitle` {children; actions?} h2 inside a page.
- `Card` (div attrs) / `CardHeader` {title; subtitle?; actions?; icon?} / `CardBody` (div attrs, padded).
- `Toolbar` (alias `FilterBar`) {children (left: filters); actions? (right)} sits above a table.
- `ChipRow` {children} + `FilterChip` {label; value?; active?; onClick?; onClear?; icon?} the single chip row of filters.
- `DescriptionList` {items: {label, value, mono?}[]; columns?: 1|2} label/value grid for drawers.
- `Tabs` (radix Root: value/onValueChange/defaultValue) / `TabsList` / `TabsTrigger` {value} / `TabsContent` {value}.

## Status and data display
- `StatusChip` {tone: 'success'|'warning'|'danger'|'info'|'neutral'|'bronze'; icon?: LucideIcon | false; size?: 'sm'|'md'; title?; children} 12% fill + default icon per tone.
- `Badge` {tone?; mono?; children} plain pill without icon (counts, types).
- `SourceBadge` {source: 'core'|'edge'} Core Cluster / Edge PBX tag.
- `RoleBadge` {role: UserRole} translated role label.
- `LiveDot` {tone?='success'; still?} slow 2.4s breathing dot.
- `Avatar` {name; color?; size?=28} initials; `initials(name)` helper.
- `KpiTile` (alias `StatCard`) {label; value; hint?; tone?; spark?: number[]; icon?}.
- `Sparkline` {values: number[]; tone?='bronze'; height?=28}.
- `Banner` {tone; title?; children?; actions?; onDismiss?} inline alert.
- `Mono` {children; muted?} tabular mono span (IDs, numbers, durations).
- `Tooltip` {content; side?; children (one focusable element)}. Provider is mounted by the shell.
- `toneClass(tone)` text colour class; `TONE_ICON[tone]` default icon.

## Feedback
- `EmptyState` {title; body?; action?; icon? (replaces the polyphony motif); compact?}.
- `ErrorState` {error?; onRetry?} for failed queries.
- `Skeleton` {className (size it, e.g. "h-4 w-40"); style?}; `SkeletonText` {lines?=3}.
- `Spinner` {size?=16; label?}.
- Toasts: `toast.success(t('...'))`, `toast.error(message)`; keep copy short and factual.

## Overlays
- `Dialog` (alias `Modal`) {open; onOpenChange; title; description?; footer?; size?: 'sm'|'md'|'lg'|'xl'; dismissible?=true; children}.
- `ConfirmDialog` {open; onOpenChange; title; body?; confirmLabel?; cancelLabel?; tone?: 'default'|'danger'; busy?; confirmDisabled?; onConfirm; children? (e.g. a password Field)}.
- `Drawer` {open; onOpenChange; title; subtitle?; actions?; footer?; width?=480; children} right-side detail panel, full width on phones.
- `DropdownMenu` (Root) / `DropdownMenuTrigger` (use `asChild`) / `DropdownMenuContent` {align?='end'} / `DropdownMenuItem` {icon?; tone?: 'default'|'danger'; checked?; hint?; onSelect} / `DropdownMenuLabel` / `DropdownMenuSeparator`.

## Tables
- `DataTable<T>` {columns: Column<T>[]; rows; rowKey(row); loading?; emptyTitle?; emptyBody?; empty?; onRowClick?; selectedKey?; compact?; pageSize? (client paging, 0 = off); pageSizes?; paging? {page, pageSize, total, onPageChange, onPageSizeChange?} (server paging); sort?/onSortChange? (controlled) or defaultSort?; renderExpanded?(row) + expandedKeys?: Set<string>; maxHeight? (sticky header scroll); rowClassName?}.
- `Column<T>` {id; header; cell?(row, i); sortValue?(row) (client sort); sortable? (server sort); align?: 'left'|'right'|'center'; mono?; width?; className?; headerClassName?; hideBelow?: 'sm'|'md'|'lg'}. Numbers: `align: 'right', mono: true`.
- Low-level: `Table` {compact?; wrapperClassName?; wrapperStyle?} / `THead` / `TBody` / `Tr` {selected?; onClick?} / `Th` {sort?: 'asc'|'desc'|null; onSort?; align?} / `Td` {align?; mono?; muted?}. Rows 40px (34px compact), sticky head.
- `Pagination` {page; pageSize; total; onPageChange; onPageSizeChange?; pageSizes?=[25,50,100]}.

## Brand (`@/components/brand`)
- `LogoMark` {size?=32; mono?: 'ink'|'linen'; title?}; `Wordmark` {lang?; tone?: 'ink'|'linen'|'current'; animate?}; `Lockup` {lang?; size?; tone?}.
- `PolyphonyMotif` {ground?: 'linen'|'pine'; animate?; dots?; className (set the width)}; `BassDivider` {className} section divider.

## Shell helpers (`@/shell/...`, read-only for features)
- `useMe()` from `@/shell/useMe`: {me, role, can(feature), cdrSources}. `useLang()` from `@/shell/state` returns 'en'|'ka' for `@/lib/format` calls.
