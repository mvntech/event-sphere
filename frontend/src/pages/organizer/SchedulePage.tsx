import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { CalendarPlus, Clock, MapPin, Mic, Pencil, Plus, Trash2, TriangleAlert, Users } from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/EmptyState';
import { PageHeader } from '@/components/shared/PageHeader';
import { ExpoPicker } from '@/components/organizer/ExpoPicker';
import { SessionFormDialog } from '@/components/organizer/SessionFormDialog';
import { useDeleteSession, useLiveSchedule, useSessions } from '@/hooks/useSessions';
import { useExpos } from '@/hooks/useExpos';
import { ApiError } from '@/lib/api';
import { dayKey, formatDayHeading, formatTime, toDateTimeLocal } from '@/lib/format';
import { DURATION, EASE } from '@/lib/motion';
import type { Session } from '@/types';

function SeatBadge({ session }: { session: Session }) {
  if (session.capacity == null) {
    return <Badge variant="muted">Unlimited seats</Badge>;
  }
  if (session.isFull) {
    return <Badge variant="destructive">Full · {session.registeredCount}/{session.capacity}</Badge>;
  }
  return (
    <Badge variant={session.seatsRemaining! <= 5 ? 'warning' : 'muted'}>
      {session.registeredCount}/{session.capacity} registered
    </Badge>
  );
}

function SessionRow({ session, onEdit, onDelete }: { session: Session; onEdit: () => void; onDelete: () => void }) {
  return (
    <motion.li
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: DURATION.panel, ease: EASE }}
    >
      <Card className="shadow-sm transition-colors hover:border-primary/40">
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
          <div className="flex shrink-0 flex-col rounded-lg border border-border px-3.5 py-2.5 sm:w-32">
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
                <dt className="sr-only">Topic</dt>
                <dd>{session.topic}</dd>
              </div>
            </dl>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <SeatBadge session={session} />
            <Button variant="ghost" size="icon" onClick={onEdit} aria-label={`Edit ${session.title}`}>
              <Pencil className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onDelete}
              aria-label={`Delete ${session.title}`}
              className="text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.li>
  );
}

export default function SchedulePage() {
  const [expoId, setExpoId] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Session | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Session | null>(null);

  const { data: expoList, isPending: exposPending } = useExpos({ mine: true, limit: 50 });
  const { data, isPending, isError, error, refetch } = useSessions(expoId || undefined);
  // keeps a second organizer's edits visible in this one's builder.
  useLiveSchedule(expoId || undefined);
  const deleteSession = useDeleteSession(expoId);

  const sessions = data?.items ?? [];
  const expo = data?.expo;

  /** group sessions into days so the schedule reads like a real programme. */
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

  // new sessions default to 9am on the expo's opening day.
  const defaultStart = expo ? toDateTimeLocal(new Date(new Date(expo.startDate).setHours(9, 0, 0, 0))) : undefined;

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    try {
      await deleteSession.mutateAsync(pendingDelete.id);
      toast.success(`"${pendingDelete.title}" removed from the schedule`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not delete the session');
    } finally {
      setPendingDelete(null);
    }
  };

  const hasExpos = (expoList?.items.length ?? 0) > 0;

  return (
    <div className="mx-auto max-w-full space-y-8">
      <PageHeader
        title="Schedule builder"
        description="Build the programme for an expo — talks, workshops and their speakers, rooms and seat limits."
        actions={
          hasExpos ? (
            <Button onClick={openCreate} disabled={!expoId}>
              <Plus className="size-4" aria-hidden="true" />
              Add session
            </Button>
          ) : undefined
        }
      />

      {!exposPending && !hasExpos && (
        <EmptyState
          icon={CalendarPlus}
          title="Create an expo first"
          description="A schedule belongs to an expo. Create one and its programme can be built here."
        />
      )}

      {hasExpos && <ExpoPicker value={expoId} onChange={setExpoId} />}

      {expoId && isPending && (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      )}
      
      {isError && !data && (
        <Card className="border-destructive/40">
          <CardContent className="flex flex-col items-start gap-3 p-6">
            <p className="flex items-center gap-2 font-medium text-destructive">
              <TriangleAlert className="size-4" aria-hidden="true" />
              {error instanceof ApiError ? error.message : 'Could not load the schedule'}
            </p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Try again
            </Button>
          </CardContent>
        </Card>
      )}

      {expoId && !isPending && !isError && sessions.length === 0 && (
        <EmptyState
          icon={Clock}
          title="No sessions scheduled"
          description="Add the first talk or workshop and it will appear here, grouped by day."
          action={
            <Button onClick={openCreate}>
              <Plus className="size-4" aria-hidden="true" />
              Add session
            </Button>
          }
        />
      )}

      {days.map((daySessions) => (
        <section key={dayKey(daySessions[0].startTime)} className="space-y-3">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="text-item tracking-tight">{formatDayHeading(daySessions[0].startTime)}</h2>
            <span className="text-body text-muted-foreground">
              {daySessions.length} session{daySessions.length === 1 ? '' : 's'}
            </span>
          </div>
          <ul className="space-y-3">
            {daySessions.map((session) => (
              <SessionRow
                key={session.id}
                session={session}
                onEdit={() => {
                  setEditing(session);
                  setFormOpen(true);
                }}
                onDelete={() => setPendingDelete(session)}
              />
            ))}
          </ul>
        </section>
      ))}

      {expoId && (
        <SessionFormDialog
          open={formOpen}
          onOpenChange={setFormOpen}
          expoId={expoId}
          defaultStart={defaultStart}
          session={editing}
        />
      )}

      <AlertDialog open={Boolean(pendingDelete)} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogTitle>Remove “{pendingDelete?.title}”?</AlertDialogTitle>
          <AlertDialogDescription>
            The session and everyone's registrations for it will be removed. This cannot be undone.
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={confirmDelete}>
              Remove session
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
