import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export function PageSpinner({
  className,
  label = 'Loading',
}: {
  className?: string;
  label?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn('flex min-h-[50vh] w-full items-center justify-center', className)}
    >
      <Loader2 className="size-6 animate-spin text-primary" aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </div>
  );
}
