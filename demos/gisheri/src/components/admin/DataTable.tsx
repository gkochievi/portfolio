import { Inbox } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

export interface Column<T> {
  key: string;
  header: React.ReactNode;
  cell: (row: T) => React.ReactNode;
  className?: string;
  headerClassName?: string;
}

export interface DataTableSelection<K extends string | number = number> {
  selectedIds: K[];
  onChange: (ids: K[]) => void;
}

interface DataTableProps<T, K extends string | number = number> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => K;
  loading?: boolean;
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
  selection?: DataTableSelection<K>;

  // Pagination
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}

const SKELETON_ROWS = 5;

export function DataTable<T, K extends string | number = number>({
  columns,
  rows,
  rowKey,
  loading,
  emptyMessage,
  onRowClick,
  selection,
  page,
  pageSize,
  total,
  onPageChange,
}: DataTableProps<T, K>) {
  const { t } = useTranslation();
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  const fallbackEmpty = emptyMessage ?? t('admin.common.noResults', { defaultValue: 'No results.' });

  const selectedSet = selection ? new Set(selection.selectedIds) : null;
  const visibleIds = rows.map((r) => rowKey(r));
  const allVisibleSelected =
    !!selectedSet && visibleIds.length > 0 && visibleIds.every((id) => selectedSet.has(id));
  const someVisibleSelected =
    !!selectedSet && visibleIds.some((id) => selectedSet.has(id)) && !allVisibleSelected;

  const toggleAllVisible = () => {
    if (!selection) return;
    const next = new Set(selection.selectedIds);
    if (allVisibleSelected) {
      visibleIds.forEach((id) => next.delete(id));
    } else {
      visibleIds.forEach((id) => next.add(id));
    }
    selection.onChange(Array.from(next));
  };

  const toggleRow = (id: K) => {
    if (!selection) return;
    const next = new Set(selection.selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    selection.onChange(Array.from(next));
  };

  const totalCols = columns.length + (selection ? 1 : 0);

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {selection && (
                <TableHead className="w-10">
                  <Checkbox
                    checked={
                      allVisibleSelected ? true : someVisibleSelected ? 'indeterminate' : false
                    }
                    onCheckedChange={toggleAllVisible}
                    aria-label={t('admin.common.selectAll', { defaultValue: 'Select all' })}
                  />
                </TableHead>
              )}
              {columns.map((col) => (
                <TableHead key={col.key} className={col.headerClassName}>
                  {col.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && rows.length === 0 ? (
              Array.from({ length: SKELETON_ROWS }).map((_, i) => (
                <TableRow key={`skeleton-${i}`}>
                  {selection && (
                    <TableCell className="w-10">
                      <Skeleton className="h-4 w-4" />
                    </TableCell>
                  )}
                  {columns.map((col) => (
                    <TableCell key={col.key} className={col.className}>
                      <Skeleton className="h-4 w-full max-w-[160px]" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={totalCols} className="h-48">
                  <div className="flex flex-col items-center justify-center gap-3 text-center text-muted-foreground py-6">
                    <div className="h-12 w-12 rounded-full bg-muted/50 flex items-center justify-center">
                      <Inbox size={20} className="opacity-60" />
                    </div>
                    <p className="text-sm max-w-md">{fallbackEmpty}</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => {
                const id = rowKey(row);
                const isSelected = !!selectedSet && selectedSet.has(id);
                return (
                  <TableRow
                    key={id}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    data-state={isSelected ? 'selected' : undefined}
                    className={cn(
                      onRowClick && 'cursor-pointer hover:bg-muted/40',
                      isSelected && 'bg-muted/30',
                    )}
                  >
                    {selection && (
                      <TableCell
                        className="w-10"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleRow(id)}
                          aria-label={t('admin.common.selectRow', { defaultValue: 'Select row' })}
                        />
                      </TableCell>
                    )}
                    {columns.map((col) => (
                      <TableCell key={col.key} className={col.className}>
                        {col.cell(row)}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-between px-4 py-3 border-t border-border">
        <p className="text-xs text-muted-foreground">
          {total === 0
            ? t('admin.common.noResults', { defaultValue: 'No results.' })
            : t('admin.common.ofTotal', { start, end, total, defaultValue: `${start}–${end} of ${total}` })}
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1 || loading}
            onClick={() => onPageChange(page - 1)}
          >
            {t('admin.common.previous', { defaultValue: 'Previous' })}
          </Button>
          <span className="text-xs text-muted-foreground tabular-nums">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages || loading}
            onClick={() => onPageChange(page + 1)}
          >
            {t('admin.common.next', { defaultValue: 'Next' })}
          </Button>
        </div>
      </div>
    </div>
  );
}
