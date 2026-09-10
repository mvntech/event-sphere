import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'motion/react';
import { ArrowRight, CalendarClock, MapPin, Mic } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/EmptyState';
import { SessionTime } from '@/components/shared/ScheduleTime';
import { useAuth } from '@/hooks/useAuth';
import { useExpos } from '@/hooks/useExpos';
import { useSessions } from '@/hooks/useSessions';
import { useFloorPlan } from '@/hooks/useBooths';
import { useExhibitors } from '@/hooks/useExhibitors';
import { useFeedbackInbox } from '@/hooks/useFeedback';
import { dayKey, formatDateRange, formatDayHeading } from '@/lib/format';
import { isRunningNow, opensIn } from '@/lib/expoPhase';
import { DURATION, EASE } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { EXPO_STATUS_LABELS, EXPO_STATUS_VARIANTS } from '@/types';

function Fact({ value, label, tone }: { value: string; label: string; tone?: 'live' }) {
  return (
    <div className="min-w-0">
      <p className={cn('text-item', tone === 'live' && 'text-live')}>{value}</p>
      <p className="text-meta text-muted-foreground">{label}</p>
    </div>
  );
}

export default function OrganizerDashboardPage() {
  const { user } = useAuth();
  const reduceMotion = useReducedMotion();

  const expos = useExpos({ mine: true, limit: 50 });
  const pending = useExhibitors({ approvalStatus: 'pending', limit: 50 });
  const feedback = useFeedbackInbox({ status: 'new' });

  const items = expos.data?.items ?? [];

  // lead with the expo that is running; failing that, the next one to open.
  const live = items.find(isRunningNow);
  const upcoming = [...items]
    .filter((expo) => new Date(expo.endDate).getTime() > Date.now())
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
  const focus = live ?? upcoming[0] ?? items[0] ?? null;

  // today's detail, for the expo being led with.
  const schedule = useSessions(focus?.id);
  const plan = useFloorPlan(focus?.id);

  const now = Date.now();
  const todayKey = dayKey(new Date(now));

  const allSessions = [...(schedule.data?.items ?? [])].sort(
    (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
  );

  const todaysSessions = allSessions.filter((session) => dayKey(session.startTime) === todayKey);

  const upcomingSessions = allSessions.filter(
    (session) => new Date(session.startTime).getTime() > now
  );
  const showingToday = todaysSessions.length > 0;
  const dayList = showingToday ? todaysSessions : upcomingSessions.slice(0, 5);

  const runningSessionId = todaysSessions.find(
    (session) => new Date(session.startTime).getTime() <= now && new Date(session.endTime).getTime() > now
  )?.id;
  const nextSessionId = todaysSessions.find((session) => new Date(session.startTime).getTime() > now)?.id;

  const booths = plan.data?.items ?? [];
  const taken = booths.filter((booth) => booth.status !== 'available').length;

  const pendingCount = pending.data?.counts.pending ?? 0;
  const newFeedback = feedback.data?.counts.new ?? 0;

  const loading = expos.isPending;

  const waiting = [
    pendingCount > 0 && {
      to: '/organizer/exhibitors',
      count: pendingCount,
      label: `application${pendingCount === 1 ? '' : 's'} to review`,
    },
    newFeedback > 0 && {
      to: '/organizer/feedback',
      count: newFeedback,
      label: `piece${newFeedback === 1 ? '' : 's'} of feedback to read`,
    },
  ].filter(Boolean) as { to: string; count: number; label: string }[];

  return (
    <div className="mx-auto max-w-full space-y-8">
      <header>
        <h1 className="text-title">{user ? `Hello, ${user.name.split(' ')[0]}` : 'Hello'}</h1>
        <p className="mt-2 text-body text-muted-foreground">
          {new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </header>

      <motion.section
        initial={reduceMotion ? false : { opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: DURATION.reveal, ease: EASE }}
        aria-labelledby="focus-expo"
        className="overflow-hidden rounded-xl border border-border bg-card shadow-lg"
      >
        {loading ? (
          <div className="space-y-3 p-6">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-7 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ) : focus ? (
          <>
            <div className="flex flex-col gap-5 p-6 sm:flex-row sm:items-start sm:p-7">
              <div className="min-w-0 flex-1">
                <p
                  id="focus-expo"
                  className={cn(
                    'flex items-center gap-2 text-meta',
                    live ? 'text-live' : 'text-muted-foreground'
                  )}
                >
                  {live && <span className="size-1.5 rounded-full bg-live" aria-hidden="true" />}
                  {live ? 'Running now' : opensIn(focus.startDate)}
                </p>
                <h2 className="mt-1 truncate text-section">{focus.title}</h2>
                <p className="mt-2 text-body text-muted-foreground">
                  {formatDateRange(focus.startDate, focus.endDate)} · {focus.location}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <Badge variant={EXPO_STATUS_VARIANTS[focus.status]}>
                  {EXPO_STATUS_LABELS[focus.status]}
                </Badge>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-10 gap-y-4 border-t border-border px-6 py-4 sm:px-7">
              {plan.isPending ? (
                <Skeleton className="h-9 w-32" />
              ) : (
                <Fact
                  value={booths.length ? `${taken} of ${booths.length}` : 'No plan yet'}
                  label={booths.length ? 'stands taken' : 'lay out the floor'}
                />
              )}

              {schedule.isPending ? (
                <Skeleton className="h-9 w-32" />
              ) : (
                <Fact
                  value={todaysSessions.length > 0 ? String(todaysSessions.length) : 'Nothing'}
                  label={
                    todaysSessions.length === 1
                      ? 'session today'
                      : todaysSessions.length > 1
                        ? 'sessions today'
                        : 'scheduled today'
                  }
                  tone={live && todaysSessions.length > 0 ? 'live' : undefined}
                />
              )}

              <div className="ml-auto flex flex-wrap gap-2">
                <Button asChild variant="outline" size="sm">
                  <Link to={`/organizer/floor-plan?expo=${focus.id}`}>Floor plan</Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link to={`/organizer/schedule?expo=${focus.id}`}>Schedule</Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link to="/organizer/analytics">Analytics</Link>
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="p-6 sm:p-7">
            <p id="focus-expo" className="text-meta text-muted-foreground">
              Nothing scheduled
            </p>
            <h2 className="mt-1 text-section">Create your first expo</h2>
            <p className="mt-2 max-w-lg text-body text-muted-foreground">
              An expo is the container for your floor plan, schedule and exhibitor list. Everything else
              follows from it.
            </p>
            <Button asChild size="sm" className="mt-4">
              <Link to="/organizer/expos">
                New expo
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </Button>
          </div>
        )}
      </motion.section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:items-start">
        {/* today in the hall */}
        <section aria-labelledby="today-heading" className="min-w-0">
          <h2 id="today-heading" className="text-section">
            {showingToday ? 'Today in the hall' : 'Coming up'}
          </h2>

          <div className="mt-3 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            {schedule.isPending ? (
              <div className="space-y-3 p-5">
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-5 w-1/2" />
              </div>
            ) : dayList.length === 0 ? (
              <EmptyState
                icon={CalendarClock}
                title={focus ? 'No sessions yet' : 'Nothing scheduled'}
                description={
                  focus
                    ? 'This expo has no schedule. Sessions you add will appear here on the day.'
                    : 'Create an expo and its schedule to see the day here.'
                }
                action={
                  focus ? (
                    <Button asChild size="sm" variant="outline">
                      <Link to={`/organizer/schedule?expo=${focus.id}`}>Build the schedule</Link>
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <ul className="divide-y divide-border">
                {dayList.map((session) => (
                  <li key={session.id} className="flex gap-4 px-5 py-4">
                    <SessionTime
                      start={session.startTime}
                      end={session.endTime}
                      state={
                        session.id === runningSessionId
                          ? 'now'
                          : session.id === nextSessionId
                            ? 'next'
                            : new Date(session.endTime).getTime() < now
                              ? 'finished'
                              : 'upcoming'
                      }
                      className="sm:w-24"
                    />

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-item">{session.title}</p>
                      {!showingToday && (
                        <p className="mt-0.5 text-meta text-muted-foreground">
                          {formatDayHeading(session.startTime)}
                        </p>
                      )}
                      <dl className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-body text-muted-foreground">
                        {session.speaker && (
                          <div className="flex items-center gap-1.5">
                            <Mic className="size-3.5 shrink-0" aria-hidden="true" />
                            <dt className="sr-only">Speaker</dt>
                            <dd className="truncate">{session.speaker}</dd>
                          </div>
                        )}
                        {session.location && (
                          <div className="flex items-center gap-1.5">
                            <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
                            <dt className="sr-only">Room</dt>
                            <dd className="truncate">{session.location}</dd>
                          </div>
                        )}
                        {session.capacity !== null && (
                          <div className="flex items-center gap-1.5">
                            <dt className="sr-only">Seats</dt>
                            <dd>
                              {session.registeredCount} of {session.capacity} booked
                            </dd>
                          </div>
                        )}
                      </dl>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* waiting on you */}
        <section aria-labelledby="waiting-heading" className="min-w-0">
          <h2 id="waiting-heading" className="text-section">
            Waiting on you
          </h2>

          <div className="mt-3 rounded-xl border border-border bg-card p-5 shadow-xs">
            {pending.isPending || feedback.isPending ? (
              <Skeleton className="h-5 w-2/3" />
            ) : waiting.length === 0 ? (
              <p className="text-body text-muted-foreground">
                Nothing waiting. Applications and feedback will appear here as they arrive.
              </p>
            ) : (
              <ul className="space-y-1">
                {waiting.map((row) => (
                  <li key={row.to}>
                    <Link
                      to={row.to}
                      className={cn(
                        '-mx-2 flex items-baseline gap-2 rounded-lg px-2 py-2 transition-colors',
                        'hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring'
                      )}
                    >
                      <span className="font-mono text-item tabular-nums">{row.count}</span>
                      <span className="text-body text-muted-foreground">{row.label}</span>
                      <ArrowRight
                        className="ml-auto size-4 shrink-0 self-center text-muted-foreground"
                        aria-hidden="true"
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <p className="mt-3 text-meta text-muted-foreground">
            You run {items.length} expo{items.length === 1 ? '' : 's'} ·{' '}
            <Link
              to="/organizer/expos"
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              see all
            </Link>
          </p>
        </section>
      </div>
    </div>
  );
}
