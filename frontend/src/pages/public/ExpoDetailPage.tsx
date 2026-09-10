import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Building2, CalendarDays, MapPin, Mic, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { LockedPreview } from '@/components/marketing/LockedPreview';
import { ExpoCover } from '@/components/marketing/ExpoCover';
import { WhenChip } from '@/components/shared/WhenChip';
import { InteractiveGridPattern } from '@/components/ui/interactive-grid-pattern';
import { ApiError, http } from '@/lib/api';
import { formatDateRange, formatDayHeading, formatTime } from '@/lib/format';
import type { Expo, ExhibitorProfile, Session } from '@/types';

interface Paged<T> {
  items: T[];
  pagination?: { total: number };
}

/** GET /expos/:id — the expo plus counts computed server-side. */
interface ExpoDetail {
  expo: Expo;
  stats: { sessionCount: number; exhibitorCount: number };
}

const PREVIEW_ROWS = 3;
const PLAN_CELL = 56;

function PlanGround() {
  return (
    <div aria-hidden="true" className="absolute inset-0 overflow-hidden">
      <InteractiveGridPattern
        width={PLAN_CELL}
        height={PLAN_CELL}
        squares={[40, 12]}
        className="mask-[linear-gradient(to_bottom,var(--color-background)_0%,transparent_85%)]"
        squaresClassName="stroke-border"
      />
    </div>
  );
}

const STRIP_LOGOS = 10;

function ExhibitorStrip({
  exhibitors,
  total,
  loading,
}: {
  exhibitors: ExhibitorProfile[];
  total: number;
  loading: boolean;
}) {
  const shown = exhibitors.slice(0, STRIP_LOGOS);
  const rest = Math.max(0, total - shown.length);

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-section">Exhibiting</h2>
        <p className="text-body text-muted-foreground">
          {loading
            ? 'Loading…'
            : total === 0
              ? 'Applications still open'
              : `${total} compan${total === 1 ? 'y' : 'ies'} confirmed`}
        </p>
      </div>

      {loading ? (
        <ul className="flex flex-wrap gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <li key={i}>
              <Skeleton className="size-16 rounded-xl" />
            </li>
          ))}
        </ul>
      ) : shown.length > 0 ? (
        <>
          <ul className="flex flex-wrap gap-3">
            {shown.map((profile) => (
              <li key={profile.id}>
                <span
                  title={profile.companyName}
                  className="grid size-16 place-items-center overflow-hidden rounded-xl border border-border bg-card p-2 shadow-xs"
                >
                  {profile.logoUrl ? (
                    <img
                      src={profile.logoUrl}
                      alt={profile.companyName}
                      loading="lazy"
                      decoding="async"
                      className="size-full object-contain"
                    />
                  ) : (
                    <>
                      <span aria-hidden="true" className="text-section text-muted-foreground">
                        {profile.companyName.charAt(0)}
                      </span>
                      <span className="sr-only">{profile.companyName}</span>
                    </>
                  )}
                </span>
              </li>
            ))}

            {rest > 0 && (
              <li>
                <span className="grid size-16 place-items-center rounded-xl border border-dashed border-border text-meta text-muted-foreground">
                  +{rest}
                </span>
              </li>
            )}
          </ul>

          <div className="flex flex-col items-start gap-2">
            <Button asChild size="sm">
              <Link to="/register">
                Sign up to browse exhibitors
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </Button>
            <p className="text-meta text-muted-foreground">
              Profiles, products and stand locations open up with an account.
            </p>
          </div>
        </>
      ) : (
        <p className="flex items-center gap-2 text-body text-muted-foreground">
          <Building2 className="size-4 shrink-0" aria-hidden="true" />
          No companies confirmed yet — the organizer is still reviewing applications.
        </p>
      )}
    </section>
  );
}

export default function PublicExpoDetailPage() {
  const { expoId } = useParams<{ expoId: string }>();

  const expo = useQuery({
    queryKey: ['public', 'expo', expoId],
    queryFn: () => http.get<ExpoDetail>(`/expos/${expoId}`),
    enabled: Boolean(expoId),
  });

  const sessions = useQuery({
    queryKey: ['public', 'expo', expoId, 'sessions'],
    queryFn: () => http.get<Paged<Session>>(`/sessions/expo/${expoId}?limit=50`),
    enabled: Boolean(expoId),
  });

  const exhibitors = useQuery({
    queryKey: ['public', 'expo', expoId, 'exhibitors'],
    queryFn: () => http.get<Paged<ExhibitorProfile>>(`/exhibitors?expoRef=${expoId}&limit=50`),
    enabled: Boolean(expoId),
  });

  if (expo.isPending) {
    return (
      <div className="container-page py-12 sm:py-16">
        <Skeleton className="h-48 w-full rounded-xl sm:h-64" />
        <Skeleton className="mt-8 h-10 w-2/3 max-w-lg" />
        <Skeleton className="mt-4 h-5 w-1/2 max-w-sm" />
      </div>
    );
  }

  if (expo.isError || !expo.data) {
    return (
      <div className="container-page py-12 sm:py-16">
        <Card className="border-destructive/40">
          <CardContent className="flex flex-col items-start gap-3 p-6">
            <p className="flex items-center gap-2 text-body font-medium text-destructive">
              <TriangleAlert className="size-4" aria-hidden="true" />
              {expo.error instanceof ApiError ? expo.error.message : 'Could not find that expo'}
            </p>
            <Button asChild variant="outline" size="sm">
              <Link to="/expos">Back to what's on</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { expo: it, stats } = expo.data;
  const allSessions = sessions.data?.items ?? [];
  const allExhibitors = exhibitors.data?.items ?? [];

  // server-side counts beat the length of one page of rows.
  const sessionTotal = stats?.sessionCount ?? sessions.data?.pagination?.total ?? allSessions.length;
  const exhibitorTotal = stats?.exhibitorCount ?? exhibitors.data?.pagination?.total ?? allExhibitors.length;

  const dayCount = new Set(
    allSessions.map((session) => new Date(session.startTime).toDateString())
  ).size;

  return (
    <div>
      <section className="relative">
        <PlanGround />
        <div className="container-page relative py-12 sm:py-16">
          <ExpoCover theme={it.theme} className="h-48 w-full rounded-xl shadow-sm sm:h-64" />

          <header className="mt-10 max-w-3xl">
            <div className="flex flex-wrap items-center gap-3">
              <WhenChip expo={it} />
              {it.theme && <span className="text-meta text-muted-foreground">{it.theme}</span>}
            </div>

            <h1 className="mt-3 text-title text-balance">{it.title}</h1>

            <dl className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-body text-muted-foreground">
              <div className="flex items-center gap-2">
                <CalendarDays className="size-4 shrink-0" aria-hidden="true" />
                <dt className="sr-only">Dates</dt>
                <dd>{formatDateRange(it.startDate, it.endDate)}</dd>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="size-4 shrink-0" aria-hidden="true" />
                <dt className="sr-only">Location</dt>
                <dd>{it.location}</dd>
              </div>
            </dl>

            <p className="mt-5 text-lede text-muted-foreground">{it.description}</p>
          </header>
        </div>
      </section>

      <div className="container-page pb-12 sm:pb-16">
      <div className="border-t border-border pt-10">
        <ExhibitorStrip
          exhibitors={allExhibitors}
          total={exhibitorTotal}
          loading={exhibitors.isPending}
        />
      </div>

      <div className="mt-12 border-t border-border pt-10">
        <LockedPreview
          title="Schedule"
          summary={
            sessions.isPending
              ? 'Loading…'
              : sessionTotal === 0
                ? 'Not published yet'
                : `${sessionTotal} session${sessionTotal === 1 ? '' : 's'}${dayCount > 1 ? ` across ${dayCount} days` : ''}`
          }
          ctaLabel="Sign up to see the full schedule"
        >
          {allSessions.slice(0, PREVIEW_ROWS).map((session) => (
            <div
              key={session.id}
              className="flex flex-col gap-1 rounded-lg border border-border bg-card p-4"
            >
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-item">{session.title}</p>
                <p className="shrink-0 font-mono text-meta text-muted-foreground">
                  {formatTime(session.startTime)}
                </p>
              </div>
              <p className="text-meta text-muted-foreground">
                {formatDayHeading(session.startTime)}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-body text-muted-foreground">
                {session.speaker && (
                  <span className="flex items-center gap-1.5">
                    <Mic className="size-3.5 shrink-0" aria-hidden="true" />
                    {session.speaker}
                  </span>
                )}
                {session.location && (
                  <span className="flex items-center gap-1.5">
                    <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
                    {session.location}
                  </span>
                )}
              </div>
            </div>
          ))}
        </LockedPreview>
      </div>
      </div>
    </div>
  );
}
