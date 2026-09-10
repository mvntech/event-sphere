import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function SettingsSection({
  title,
  hint,
  footnote,
  children,
  className,
}: {
  title: string;
  hint?: ReactNode;
  footnote?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        'grid gap-x-10 gap-y-4 border-t border-border py-8 first:border-t-0 first:pt-0',
        'lg:grid-cols-[minmax(0,17rem)_minmax(0,1fr)]',
        className
      )}
    >
      <div className="lg:sticky lg:top-24 lg:self-start">
        <h2 className="text-section">{title}</h2>
        {hint && <p className="mt-2 text-body text-muted-foreground">{hint}</p>}
      </div>

      <div className="min-w-0">
        {children}
        {footnote && <p className="mt-3 text-meta text-muted-foreground">{footnote}</p>}
      </div>
    </section>
  );
}
