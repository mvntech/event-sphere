import { phaseOf, opensIn } from '@/lib/expoPhase';
import { cn } from '@/lib/utils';
import type { Expo } from '@/types';

export function WhenChip({ expo, className }: { expo: Expo; className?: string }) {
  const phase = phaseOf(expo);

  if (phase === 'live') {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full bg-live px-2.5 py-0.5 text-meta text-live-foreground',
          className
        )}
      >
        <span className="size-1.5 rounded-full bg-live-foreground" aria-hidden="true" />
        On now
      </span>
    );
  }

  const label =
    phase === 'cancelled' ? 'Cancelled' : phase === 'past' ? 'Finished' : opensIn(expo.startDate);

  return <span className={cn('text-meta text-muted-foreground', className)}>{label}</span>;
}
