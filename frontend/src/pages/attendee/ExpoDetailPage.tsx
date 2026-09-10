import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Bookmark,
  BookmarkCheck,
  CalendarDays,
  Clock,
  LayoutGrid,
  MapPin,
  Mic,
  Search,
  Tag,
  TriangleAlert,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/EmptyState';
import { PageHeader } from '@/components/shared/PageHeader';
import { FeedbackDialog } from '@/components/shared/FeedbackDialog';
import { useExpo } from '@/hooks/useExpos';
import { useLiveSchedule, useSessions } from '@/hooks/useSessions';
import { useCancelRegistration, useMyRegistrations, useRegister } from '@/hooks/useRegistrations';
import { ApiError } from '@/lib/api';
import { dayKey, formatDateRange, formatDayHeading, formatTime } from '@/lib/format';
import type { Registration, Session } from '@/types';

/** maps sessionId -> the attendee's registration for it. */
function registrationIndex(registrations: Registration[]) {
  const map = new Map<string, Registration>();
  registrations.forEach((registration) => {
    const sessionId =
      typeof registration.sessionRef === 'string' ? registration.sessionRef : registration.sessionRef?.id;
    if (sessionId) map.set(sessionId, registration);
  });
  return map;
}

function SessionRow({
  session,
  registration,
  onBookmark,
  onRemove,
  busy,
}: {
  session: Session;
  registration?: Registration;
  onBookmark: () => void;
  onRemove: () => void;
  busy: boolean;
}) {
  const isBookmarked = Boolean(registration);
  // a full session can still be un-bookmarked, so only block the add path.
  const blocked = !isBookmarked && session.isFull;

  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
        <div className="flex shrink-0 flex-col rounded-lg bg-accent px-3.5 py-2.5 text-accent-foreground sm:w-32">
          <span className="font-mono text-body font-semibold">{formatTime(session.startTime)}</span>
          <span className="font-mono text-meta text-muted-foreground">to {formatTime(session.endTime)}</span>
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="font-semibold leading-tight">{session.title}</h3>
          <dl className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-body text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Mic className="size-3.5 shrink-0" aria-hidden="true" />
              <dt className="sr-only">Speaker</dt>
              <dd>{session.speaker}</dd>
            </div>
            <div className="flex items-center gap-1.5">
              <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
              <dt className="sr-only">Location</dt>
              <dd>{session.location}</dd>
            </div>
            <div className="flex items-center gap-1.5">
              <Users className="size-3.5 shrink-0" aria-hidden="true" />
              <dt className="sr-only">Seats</dt>
              <dd>
                {session.capacity == null
                  ? 'Unlimited seats'
                  : `${session.seatsRemaining} of ${session.capacity} seats left`}
              </dd>
            </div>
          </dl>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {session.isFull && !isBookmarked && <Badge variant="destructive">Full</Badge>}
          <Button
            variant={isBookmarked ? 'default' : 'outline'}
            size="sm"
            loading={busy}
            disabled={blocked}
            onClick={isBookmarked ? onRemove : onBookmark}
          >
            {isBookmarked ? (
              <>
                <BookmarkCheck className="size-4" aria-hidden="true" />
                Bookmarked
              </>
            ) : (
              <>
                <Bookmark className="size-4" aria-hidden="true" />
                Bookmark
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ExpoDetailPage() {
  const { expoId } = useParams<{ expoId: string }>();

  const expo = useExpo(expoId);
  const schedule = useSessions(expoId);
  useLiveSchedule(expoId);
  const registrations = useMyRegistrations({ expoRef: expoId });

  const register = useRegister();
  const cancel = useCancelRegistration();

  const sessions = schedule.data?.items ?? [];
  const mine = useMemo(() => registrationIndex(registrations.data?.items ?? []), [registrations.data]);

  const days = useMemo(() => {
    const map = new Map<string, Session[]>();
    sessions.forEach((session) => {
      const key = dayKey(session.startTime);
      map.set(key, [...(map.get(key) ?? []), session]);
    });
    return [...map.values()].sort(
      (a, b) => new Date(a[0].startTime).getTime() - new Date(b[0].startTime).getTime()
    );
  }, [sessions]);

  const bookmark = async (session: Session) => {
    try {
      await register.mutateAsync({ expoRef: expoId!, sessionRef: session.id, bookmarked: true });
      toast.success(`"${session.title}" bookmarked`, { description: 'It is now in your schedule.' });
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Could not bookmark that session');
    }
  };

  const remove = async (session: Session, registration: Registration) => {
    try {
      await cancel.mutateAsync(registration.id);
      toast.success(`"${session.title}" removed from your schedule`);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Could not remove that session');
    }
  };

  if (expo.isPending) {
    return (
      <div className="mx-auto max-w-full space-y-8">
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (expo.isError || !expo.data) {
    return (
      <div className="mx-auto max-w-full">
        <Card className="border-destructive/40">
          <CardContent className="flex flex-col items-start gap-3 p-6">
            <p className="flex items-center gap-2 font-medium text-destructive">
              <TriangleAlert className="size-4" aria-hidden="true" />
              {expo.error instanceof ApiError ? expo.error.message : 'Could not load that expo'}
            </p>
            <Button asChild variant="outline" size="sm">
              <Link to="/attendee/expos">Back to expos</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const details = expo.data.expo;
  const busy = register.isPending || cancel.isPending;

  return (
    <div className="mx-auto max-w-full space-y-8">
      <PageHeader
        title={details.title}
        description={details.description}
        actions={<FeedbackDialog />}
      />

      <Card>
        <CardContent className="flex flex-wrap items-center gap-x-6 gap-y-3 p-5 text-body">
          <span className="flex items-center gap-2">
            <CalendarDays className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            {formatDateRange(details.startDate, details.endDate)}
          </span>
          <span className="flex items-center gap-2">
            <MapPin className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            {details.location}
          </span>
          {details.theme && (
            <span className="flex items-center gap-2">
              <Tag className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              {details.theme}
            </span>
          )}

          <div className="ml-auto flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to={`/attendee/exhibitors?expo=${details.id}`}>
                <Search className="size-4" aria-hidden="true" />
                Exhibitors
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to={`/attendee/floor-plan?expo=${details.id}`}>
                <LayoutGrid className="size-4" aria-hidden="true" />
                Floor plan
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <section className="space-y-4">
        <h2 className="text-section">Schedule</h2>

        {schedule.isPending && (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-xl" />
            ))}
          </div>
        )}

        {!schedule.isPending && sessions.length === 0 && (
          <EmptyState
            icon={Clock}
            title="No sessions published yet"
            description="The organizer has not added talks or workshops to this expo."
          />
        )}

        {days.map((daySessions) => (
          <div key={dayKey(daySessions[0].startTime)} className="space-y-3">
            <div className="flex items-baseline justify-between gap-4">
              <h3 className="text-item">
                {formatDayHeading(daySessions[0].startTime)}
              </h3>
              <span className="text-body text-muted-foreground">
                {daySessions.length} session{daySessions.length === 1 ? '' : 's'}
              </span>
            </div>

            <ul className="space-y-3">
              {daySessions.map((session) => {
                const registration = mine.get(session.id);

                return (
                  <li key={session.id}>
                    <SessionRow
                      session={session}
                      registration={registration}
                      busy={busy}
                      onBookmark={() => bookmark(session)}
                      onRemove={() => registration && remove(session, registration)}
                    />
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </section>
    </div>
  );
}
