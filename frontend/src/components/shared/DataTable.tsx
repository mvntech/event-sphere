import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { EmptyState } from '@/components/shared/EmptyState';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export interface Column<T> {
  header: string;
  cell: (row: T) => ReactNode;
  align?: 'end';
  secondary?: boolean;
  className?: string;
}

interface Props<T> {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  isLoading?: boolean;
  empty: { icon: LucideIcon; title: string; description: string; action?: ReactNode };
  highlight?: (row: T) => boolean;
  caption?: string;
  className?: string;
}

export function DataTable<T>({
  rows,
  columns,
  rowKey,
  isLoading,
  empty,
  highlight,
  caption,
  className,
}: Props<T>) {
  if (isLoading) {
    return (
      <div className={cn('overflow-hidden rounded-xl border border-border bg-card shadow-sm', className)}>
        <div className="divide-y divide-border">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 p-4">
              <Skeleton className="h-4 w-1/4" />
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="ml-auto h-4 w-16" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (rows.length === 0) {
    return <EmptyState icon={empty.icon} title={empty.title} description={empty.description} action={empty.action} />;
  }

  return (
    <div
      className={cn(
        'overflow-x-auto overflow-y-visible rounded-xl border border-border bg-card shadow-sm',
        className
      )}
    >
      <Table>
        {caption && <caption className="sr-only">{caption}</caption>}

        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {columns.map((column, i) => (
              <TableHead
                key={column.header || `col-${i}`}
                className={cn(
                  'text-meta font-medium text-muted-foreground',
                  column.align === 'end' && 'text-right',
                  column.secondary && 'hidden sm:table-cell',
                  column.className
                )}
              >
                {column.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>

        <TableBody>
          {rows.map((row) => (
            <TableRow
              key={rowKey(row)}
              className={cn(
                'transition-colors hover:bg-accent',
                highlight?.(row) && 'border-l-2 border-l-warning'
              )}
            >
              {columns.map((column, i) => (
                <TableCell
                  key={column.header || `col-${i}`}
                  className={cn(
                    'text-body',
                    column.align === 'end' && 'text-right',
                    column.secondary && 'hidden sm:table-cell',
                    column.className
                  )}
                >
                  {column.cell(row)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
