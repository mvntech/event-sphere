import type { LucideIcon } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface Props {
  title: string;
  description?: string;
  icon?: LucideIcon;
  /** true when there is nothing to plot; shows the empty message instead. */
  isEmpty?: boolean;
  emptyMessage?: string;
  action?: React.ReactNode;
  height?: number;
  className?: string;
  children: React.ReactNode;
}

/**
 * shared shell for every chart: heading, fixed plot height, and a proper empty
 * state so a chart with no data reads as "nothing yet" rather than a broken
 * blank box.
 */
export function ChartFrame({
  title,
  description,
  icon: Icon,
  isEmpty,
  emptyMessage = 'No activity recorded yet.',
  action,
  height = 260,
  className,
  children,
}: Props) {
  return (
    <Card className={cn('flex flex-col', className)}>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2 text-item">
              {Icon && <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />}
              {title}
            </CardTitle>
            {description && <CardDescription className="mt-1">{description}</CardDescription>}
          </div>
          {action}
        </div>
      </CardHeader>

      <CardContent className="flex-1 pt-0">
        {isEmpty ? (
          <div
            className="flex items-center justify-center rounded-lg border border-dashed border-border text-center"
            style={{ height }}
          >
            <p className="max-w-xs px-6 text-body text-muted-foreground">{emptyMessage}</p>
          </div>
        ) : (
          <div style={{ height }}>{children}</div>
        )}
      </CardContent>
    </Card>
  );
}
