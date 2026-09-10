import { cn } from '@/lib/utils';
import { formatTime } from '@/lib/format';

export type SessionState = 'finished' | 'now' | 'next' | 'upcoming';

const STATE_TEXT: Record<SessionState, string | null> = {
  finished: 'finished',
  now: 'on now',
  next: 'up next',
  upcoming: null,
};

export function SessionTime({
  start,
  end,
  state = 'upcoming',
  className,
}: {
  start: string | Date;
  end?: string | Date;
  state?: SessionState;
  className?: string;
}) {
  const label = STATE_TEXT[state];

  return (
    <div className={cn('flex shrink-0 flex-col gap-0.5 sm:w-28', className)}>
      <span
        className={cn(
          'font-mono text-item tabular-nums',
          state === 'now' && 'text-live',
          state === 'next' && 'text-primary',
          state === 'finished' && 'text-muted-foreground'
        )}
      >
        {formatTime(start)}
      </span>

      {end && state !== 'finished' && (
        <span className="font-mono text-meta text-muted-foreground">to {formatTime(end)}</span>
      )}

      {label && (
        <span
          className={cn(
            'text-meta',
            state === 'now' && 'text-live',
            state === 'next' && 'text-primary',
            state === 'finished' && 'text-muted-foreground'
          )}
        >
          {label}
        </span>
      )}
    </div>
  );
}
