import { Fragment, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'motion/react';
import { Bookmark, CalendarDays, MapPin, Mic, Trash2, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/EmptyState';
import { PageHeader } from '@/components/shared/PageHeader';
import { useCancelRegistration, useMyRegistrations } from '@/hooks/useRegistrations';
import { ApiError } from '@/lib/api';
import { dayKey, formatDayHeading, formatTime } from '@/lib/format';
import { DURATION, EASE } from '@/lib/motion';
import { cn } from '@/lib/utils';
import type { Registration, Session } from '@/types';

interface SessionRegistration extends Registration {
  sessionRef: Session;
}

const hasSession = (registration: Registration): registration is SessionRegistration =>
  Boolean(registration.sessionRef) && typeof registration.sessionRef === 'object';

function NowLine({ reduceMotion }: { reduceMotion: boolean | null }) {
  return (
    <li aria-hidden="true" className="relative px-5">
      <motion.div
        initial={reduceMotion ? false : { scaleX: 0, opacity: 0 }}
        animate={{ scaleX: 1, opacity: 1 }}
        transition={{ duration: DURATION.reveal, ease: EASE }}
        style={{ transformOrigin: 'left' }}
        className="flex items-center gap-2 py-1"
      >
        <span className="size-1.5 shrink-0 rounded-full bg-live" />
        <span className="text-meta text-live">now</span>
        <span className="h-px flex-1 bg-live/40" />
      </motion.div>
    </li>
  );
}

export default function AttendeeSchedulePage() {
  const { data, isPending, isError, error, refetch } = useMyRegistrations();
  const cancel = useCancelRegistration();
  const reduceMotion = useReducedMotion();

  const registrations = useMemo(() => (data?.items ?? []).filter(hasSession), [data]);

  const days = useMemo(() => {
    const map = new Map<string, SessionRegistration[]>();
    registrations.forEach((registration) => {
      const key = dayKey(registration.sessionRef.startTime);
      map.set(key, [...(map.get(key) ?? []), registration]);
    });

    return [...map.values()]
      .map((group) =>
        [...group].sort(
          (a, b) => new Date(a.sessionRef.startTime).getTime() - new Date(b.sessionRef.startTime).getTime()
        )
      )
      .sort(
        (a, b) => new Date(a[0].sessionRef.startTime).getTime() - new Date(b[0].sessionRef.startTime).getTime()
      );
  }, [registrations]);

  const nextId = useMemo(() => {
    const now = Date.now();
    return (
      registrations
        .filter((r) => new Date(r.sessionRef.startTime).getTime() > now)
        .sort(
          (a, b) => new Date(a.sessionRef.startTime).getTime() - new Date(b.sessionRef.startTime).getTime()
        )[0]?.id ?? null
    );
  }, [registrations]);

  const remove = async (registration: SessionRegistration) => {
    try {
      await cancel.mutateAsync(registration.id);
      toast.success(`"${registration.sessionRef.title}" removed from your schedule`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not remove that session');
    }
  };

  const now = Date.now();

  return (
    <div className="mx-auto max-w-full space-y-8">
      <PageHeader
        title="My schedule"
        description="Everything you have bookmarked, grouped by day. Reminders go out before each one starts."
        actions={
          registrations.length > 0 ? (
            <Badge variant="muted">
              {registrations.length} session{registrations.length === 1 ? '' : 's'}
            </Badge>
          ) : undefined
        }
      />

      {isPending && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full rounded-xl" />
          ))}
        </div>
      )}

      {isError && (
        <Card className="border-destructive/40">
          <CardContent className="flex flex-col items-start gap-3 p-6">
            <p className="flex items-center gap-2 text-body font-medium text-destructive">
              <TriangleAlert className="size-4" aria-hidden="true" />
              {error instanceof ApiError ? error.message : 'Could not load your schedule'}
            </p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Try again
            </Button>
          </CardContent>
        </Card>
      )}

      {!isPending && !isError && registrations.length === 0 && (
        <EmptyState
          icon={Bookmark}
          title="Nothing bookmarked yet"
          description="Browse an expo and bookmark the talks and workshops you want to attend — they will collect here."
          action={
            <Button asChild>
              <Link to="/attendee/expos">
                <CalendarDays className="size-4" aria-hidden="true" />
                Browse expos
              </Link>
            </Button>
          }
        />
      )}

      {days.map((group) => {
        const dayStart = new Date(group[0].sessionRef.startTime);
        const isToday = new Date(now).toDateString() === dayStart.toDateString();

        return (
          <section key={dayKey(group[0].sessionRef.startTime)}>
            <div className="sticky top-16 z-10 -mx-1 flex items-baseline justify-between gap-4 bg-background/85 px-1 py-2 backdrop-blur-sm">
              <h2 className="text-section">{formatDayHeading(group[0].sessionRef.startTime)}</h2>
              <span className="text-meta text-muted-foreground">
                {group.length} session{group.length === 1 ? '' : 's'}
              </span>
            </div>

            <Card className="mt-2 overflow-hidden shadow-sm">
              <ul className="divide-y divide-border">
                {group.map((registration, index) => {
                  const session = registration.sessionRef;
                  const expo = typeof registration.expoRef === 'object' ? registration.expoRef : null;
                  const start = new Date(session.startTime).getTime();
                  const previous = index > 0 ? new Date(group[index - 1].sessionRef.startTime).getTime() : null;
                  const showNow = isToday && start > now && (previous === null || previous <= now);
                  const isNext = registration.id === nextId;
                  const past = start < now;

                  return (
                    <Fragment key={registration.id}>
                      {showNow && <NowLine reduceMotion={reduceMotion} />}

                      <li
                        className={cn(
                          'flex flex-col gap-4 px-5 py-4 transition-colors sm:flex-row sm:items-center',
                          'hover:bg-accent'
                        )}
                      >
                        <div
                          className={cn(
                            'flex shrink-0 flex-col sm:w-28',
                            isNext ? 'text-live' : 'text-foreground'
                          )}
                        >
                          <span className="font-mono text-body font-semibold">
                            {formatTime(session.startTime)}
                          </span>
                          <span className="font-mono text-meta text-muted-foreground">
                            {past ? 'finished' : `to ${formatTime(session.endTime)}`}
                          </span>
                        </div>

                        <div className="min-w-0 flex-1">
                          <h3 className="flex items-center gap-2 text-item">
                            {registration.bookmarked && (
                              <Bookmark
                                className="size-3.5 shrink-0 text-muted-foreground"
                                aria-label="Bookmarked"
                              />
                            )}
                            <span className="truncate">{session.title}</span>
                          </h3>

                          <dl className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-body text-muted-foreground">
                            {session.speaker && (
                              <div className="flex items-center gap-1.5">
                                <Mic className="size-3.5 shrink-0" aria-hidden="true" />
                                <dt className="sr-only">Speaker</dt>
                                <dd>{session.speaker}</dd>
                              </div>
                            )}
                            {session.location && (
                              <div className="flex items-center gap-1.5">
                                <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
                                <dt className="sr-only">Location</dt>
                                <dd>{session.location}</dd>
                              </div>
                            )}
                            {expo && (
                              <div className="flex items-center gap-1.5">
                                <CalendarDays className="size-3.5 shrink-0" aria-hidden="true" />
                                <dt className="sr-only">Expo</dt>
                                <dd>
                                  <Link
                                    to={`/attendee/expos/${expo.id}`}
                                    className="hover:text-foreground hover:underline"
                                  >
                                    {expo.title}
                                  </Link>
                                </dd>
                              </div>
                            )}
                          </dl>
                        </div>

                        <Button
                          variant="ghost"
                          size="icon"
                          className="shrink-0 text-muted-foreground hover:text-destructive"
                          onClick={() => remove(registration)}
                          loading={cancel.isPending}
                          aria-label={`Remove ${session.title} from my schedule`}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </li>
                    </Fragment>
                  );
                })}
              </ul>
            </Card>
          </section>
        );
      })}
    </div>
  );
}
