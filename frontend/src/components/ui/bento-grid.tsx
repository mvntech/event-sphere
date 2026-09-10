import { Slot } from '@radix-ui/react-slot';
import { cn } from '@/lib/utils';

export type TileSpan = 'lead' | 'half' | 'third';

const SPAN: Record<TileSpan, string> = {
  lead: 'col-span-full',
  half: 'col-span-full sm:col-span-3',
  third: 'col-span-full sm:col-span-2',
};

export function BentoGrid({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('grid grid-cols-1 gap-4 sm:grid-cols-6', className)}>{children}</div>
  );
}

const ELEVATION: Record<TileSpan, string> = {
  lead: 'shadow-lg',
  half: 'shadow-sm',
  third: 'shadow-2xs',
};

export function BentoTile({
  span = 'third',
  asChild = false,
  flush = false,
  className,
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement> & { span?: TileSpan; asChild?: boolean; flush?: boolean }) {
  const Comp = asChild ? Slot : 'div';

  return (
    <Comp
      className={cn(
        'rounded-2xl border border-border',
        flush ? 'overflow-hidden' : 'bg-card p-5',
        SPAN[span],
        ELEVATION[span],
        className
      )}
      {...rest}
    >
      {children}
    </Comp>
  );
}
