import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export interface FilterTab<T extends string> {
  value: T;
  label: string;
  count?: number;
}

export function FilterTabs<T extends string>({
  tabs,
  value,
  onChange,
  label,
  className,
}: {
  tabs: FilterTab<T>[];
  value: T;
  onChange: (next: T) => void;
  label: string;
  className?: string;
}) {
  return (
    <div role="group" aria-label={label} className={cn('flex flex-wrap items-center gap-2', className)}>
      {tabs.map((tab) => {
        const active = tab.value === value;

        return (
          <button
            key={tab.value}
            type="button"
            onClick={() => onChange(tab.value)}
            aria-pressed={active}
            className={cn(
              'inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-body font-medium transition-colors',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
              active
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border text-muted-foreground hover:bg-accent hover:text-foreground'
            )}
          >
            {tab.label}
            {typeof tab.count === 'number' && (
              <Badge variant={active ? 'secondary' : 'muted'} className="text-meta">
                {tab.count}
              </Badge>
            )}
          </button>
        );
      })}
    </div>
  );
}
