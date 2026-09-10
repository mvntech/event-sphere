import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'motion/react';
import { ArrowRight, Bookmark, CalendarRange, MapPin, Mic } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { NumberTicker } from '@/components/ui/number-ticker';
import { ChartFrame } from '@/components/charts/ChartFrame';
import { ChartTooltip } from '@/components/charts/ChartTooltip';
import { axisProps, CHART_COLORS, gridProps } from '@/components/charts/chartTheme';
import { useAuth } from '@/hooks/useAuth';
import { useCountdown } from '@/hooks/useCountdown';
import { useMyRegistrations } from '@/hooks/useRegistrations';
import { useThreads } from '@/hooks/useMessages';
import { useExpos } from '@/hooks/useExpos';
import { formatDayHeading, formatTime } from '@/lib/format';
import { DURATION, EASE } from '@/lib/motion';
import { cn } from '@/lib/utils';
import type { Registration, Session } from '@/types';

const sessionOf = (registration: Registration): Session | null =>
  typeof registration.sessionRef === 'object' && registration.sessionRef ? registration.sessionRef : null;

const expoTitleOf = (registration: Registration) =>
  typeof registration.expoRef === 'object' && registration.expoRef ? registration.expoRef.title : null;

const pad = (n: number) => String(n).padStart(2, '0');

const dayKey = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

function NextUpCountdown({ startTime }: { startTime: string }) {
  const countdown = useCountdown(startTime);
  if (!countdown) return null;

  const minutesAway = countdown.hours * 60 + countdown.minutes;
  const urgent = countdown.imminent && minutesAway <= 15;

  return (
    <div
      className={cn(
        'flex shrink-0 flex-col items-start gap-1 rounded-xl px-5 py-4 transition-colors duration-300 sm:items-center',
        urgent
          ? 'bg-primary text-primary-foreground'
          : countdown.imminent
            ? 'bg-live text-live-foreground'
            : 'bg-muted text-foreground'
      )}
    >
      <span className="text-stat leading-none">
        {countdown.hours > 0
          ? `${countdown.hours}:${pad(countdown.minutes)}`
          : `${pad(countdown.minutes)}:${pad(countdown.seconds)}`}
      </span>
      <span className="text-meta">
        {countdown.hours > 0 ? 'hours to go' : urgent ? 'starting now' : 'minutes to go'}
      </span>
    </div>
  );
}

export default function AttendeeDashboardPage() {
  const { user } = useAuth();
  const reduceMotion = useReducedMotion();

  const registrations = useMyRegistrations();
  const threads = useThreads();
  const expos = useExpos({ limit: 50 });

  const items = registrations.data?.items ?? [];
  const loading = registrations.isPending;

  const withSession = items
    .map((registration) => ({ registration, session: sessionOf(registration) }))
    .filter((row): row is { registration: Registration; session: Session } => Boolean(row.session));

  const upcoming = withSession
    .filter((row) => new Date(row.session.startTime).getTime() > Date.now())
    .sort((a, b) => new Date(a.session.startTime).getTime() - new Date(b.session.startTime).getTime());

  const next = upcoming[0] ?? null;

  const nextKey = next ? dayKey(next.session.startTime) : null;
  const byDay = new Map<string, number>();
  for (const row of upcoming) {
    const key = dayKey(row.session.startTime);
    byDay.set(key, (byDay.get(key) ?? 0) + 1);
  }
  const week = [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(0, 7)
    .map(([key, sessions]) => ({
      key,
      sessions,
      label: new Date(`${key}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' }),
    }));

  const metrics = [
    { label: 'Sessions ahead', value: upcoming.length, to: '/attendee/schedule' },
    { label: 'Bookmarked', value: items.filter((r) => r.bookmarked).length, to: '/attendee/schedule' },
    { label: 'Expos to explore', value: expos.data?.items.length ?? 0, to: '/attendee/expos' },
    { label: 'Unread messages', value: threads.data?.totalUnread ?? 0, to: '/attendee/messages' },
  ];

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
        aria-labelledby="next-up"
      >
        <Card className="rounded-2xl border-border p-5 shadow-lg">
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-7 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ) : next ? (
            <div className="flex flex-col gap-5 sm:flex-row sm:flex-wrap sm:items-center">
              <NextUpCountdown startTime={next.session.startTime} />

              <div className="min-w-[14rem] flex-1">
                <p id="next-up" className="text-meta text-muted-foreground">
                  Next up
                </p>
                <h2 className="mt-1 line-clamp-2 text-section">{next.session.title}</h2>

                <dl className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-2 text-body text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <dt className="sr-only">Starts</dt>
                    <dd className="font-mono">
                      {formatDayHeading(next.session.startTime)}, {formatTime(next.session.startTime)}
                    </dd>
                  </div>
                  {next.session.location && (
                    <div className="flex items-center gap-2">
                      <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
                      <dt className="sr-only">Location</dt>
                      <dd>{next.session.location}</dd>
                    </div>
                  )}
                  {next.session.speaker && (
                    <div className="flex items-center gap-2">
                      <Mic className="size-3.5 shrink-0" aria-hidden="true" />
                      <dt className="sr-only">Speaker</dt>
                      <dd>{next.session.speaker}</dd>
                    </div>
                  )}
                </dl>

                {expoTitleOf(next.registration) && (
                  <p className="mt-2 text-meta text-muted-foreground">{expoTitleOf(next.registration)}</p>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-2">
                {next.registration.bookmarked && (
                  <Badge variant="muted" className="gap-1">
                    <Bookmark className="size-3" aria-hidden="true" />
                    Saved
                  </Badge>
                )}
                <Button asChild variant="outline" size="sm">
                  <Link to="/attendee/schedule">My schedule</Link>
                </Button>
              </div>
            </div>
          ) : (
            <div>
              <p id="next-up" className="text-meta text-muted-foreground">
                Nothing booked yet
              </p>
              <h2 className="mt-1 text-section">Your schedule is empty</h2>
              <p className="mt-2 max-w-lg text-body text-muted-foreground">
                Browse what is on and bookmark the sessions worth your time — the next one will show up here.
              </p>
              <Button asChild size="sm" className="mt-4">
                <Link to="/attendee/expos">
                  Browse expos
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              </Button>
            </div>
          )}
        </Card>
      </motion.section>

      <section aria-label="At a glance" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {metrics.map((metric) => (
          <Link
            key={metric.label}
            to={metric.to}
            className={cn(
              'rounded-xl border border-border bg-card px-4 py-3 shadow-xs transition-colors',
              'hover:border-primary/40 hover:bg-accent',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring'
            )}
          >
            <div
              className={cn(
                'font-mono text-stat leading-none',
                !loading && metric.value === 0 && 'text-muted-foreground/45'
              )}
            >
              {loading ? (
                <Skeleton className="h-9 w-12" />
              ) : reduceMotion ? (
                metric.value
              ) : (
                <NumberTicker value={metric.value} />
              )}
            </div>
            <p className="mt-2 text-body text-muted-foreground">{metric.label}</p>
          </Link>
        ))}
      </section>

      <ChartFrame
        title="Your week ahead"
        description="Sessions you are registered for, by day"
        icon={CalendarRange}
        isEmpty={!loading && week.length === 0}
        emptyMessage="Once you register for sessions, the shape of your week shows up here."
        height={220}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={week} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="label" {...axisProps} />
            <YAxis allowDecimals={false} {...axisProps} />
            <Tooltip content={<ChartTooltip unit="sessions" />} cursor={{ fill: 'var(--color-muted)' }} />
            <Bar dataKey="sessions" name="Sessions" radius={[4, 4, 0, 0]} maxBarSize={56}>
              {week.map((day) => (
                <Cell
                  key={day.key}
                  fill={day.key === nextKey ? CHART_COLORS.live : CHART_COLORS.primary}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartFrame>
    </div>
  );
}
