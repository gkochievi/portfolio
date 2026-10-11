/**
 * The Azri primitive set. Import from '@/components/ui'.
 * Charts live in '@/components/ui/charts' (kept out of this barrel so the
 * recharts chunk only loads on pages that draw charts).
 * Cheat-sheet: src/components/ui/README.md. Owner: design-system agent.
 */
export { Button, IconButton, buttonVariants, type ButtonProps, type IconButtonProps } from './Button'
export {
  Field,
  Label,
  Input,
  Textarea,
  Checkbox,
  Switch,
  SearchInput,
  controlClass,
  useFieldControl,
  type FieldProps,
  type InputProps,
  type TextareaProps,
} from './Field'
export { Select, type SelectOption, type SelectProps } from './Select'
export {
  Badge,
  StatusBadge,
  Chip,
  ScorePill,
  Stars,
  ratingLabelKey,
  STAR_SVG_PATH,
  type BadgeTone,
  type LinkStatusKind,
} from './Badge'
export { Avatar, TenantMark, initials, readableOn } from './Avatar'
export {
  Card,
  CardHeader,
  BubbleCard,
  StatTile,
  StatCard,
  Skeleton,
  SkeletonText,
  EmptyState,
  ErrorState,
  PageHeader,
  Toolbar,
  FilterBar,
  ToolbarSpacer,
  ActionBar,
  DescriptionList,
  Section,
  type DescriptionItem,
} from './Card'
export { DataTable, Pagination, type Column, type SortState, type SortDir, type DataTableProps } from './DataTable'
export { Tabs, TabsList, TabsTrigger, TabsContent, SegmentedControl, type SegmentOption } from './Tabs'
export {
  Modal,
  Dialog,
  Drawer,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuGroup,
  Tooltip,
} from './Overlay'
export { BarsLoader, SignalBars, CenteredLoader, LiveDot, Toaster, toast } from './Feedback'
export { Illustration, type IllustrationKind } from './Illustration'
export { LangSwitch, ThemeToggle, CopyButton } from './controls'
export { useTheme, setTheme, toggleTheme, initTheme, type Theme } from './theme'
export { AzriMark, AzriLogo, AZRI_BUBBLE_PATH, AZRI_BARS } from '@/components/brand/Logo'
