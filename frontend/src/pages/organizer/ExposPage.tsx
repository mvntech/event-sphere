import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { CalendarDays, CalendarPlus, MapPin, Pencil, Plus, Tag, Trash2, TriangleAlert } from 'lucide-react';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/EmptyState';
import { PageHeader } from '@/components/shared/PageHeader';
import { ExpoFormDialog } from '@/components/organizer/ExpoFormDialog';
import { useDeleteExpo, useExpos } from '@/hooks/useExpos';
import { ApiError } from '@/lib/api';
import { formatDateRange } from '@/lib/format';
import { DURATION, EASE } from '@/lib/motion';
import { EXPO_STATUS_LABELS, EXPO_STATUS_VARIANTS, type Expo } from '@/types';

function ExpoCard({ expo, onEdit, onDelete }: { expo: Expo; onEdit: () => void; onDelete: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: DURATION.panel, ease: EASE }}
    >
      <Card className="flex h-full flex-col transition-shadow hover:shadow-md">
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between gap-3">
            <CardTitle className="text-balance">{expo.title}</CardTitle>
            <Badge variant={EXPO_STATUS_VARIANTS[expo.status]} className="shrink-0">
              {EXPO_STATUS_LABELS[expo.status]}
            </Badge>
          </div>
          <p className="line-clamp-2 text-body text-muted-foreground">{expo.description}</p>
        </CardHeader>

        <CardContent className="mt-auto space-y-4 pt-0">
          <dl className="space-y-2 text-body">
            <div className="flex items-center gap-2.5">
              <CalendarDays className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <dt className="sr-only">Dates</dt>
              <dd>{formatDateRange(expo.startDate, expo.endDate)}</dd>
            </div>
            <div className="flex items-center gap-2.5">
              <MapPin className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <dt className="sr-only">Location</dt>
              <dd className="truncate">{expo.location}</dd>
            </div>
            {expo.theme && (
              <div className="flex items-center gap-2.5">
                <Tag className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <dt className="sr-only">Theme</dt>
                <dd className="truncate">{expo.theme}</dd>
              </div>
            )}
          </dl>

          <div className="flex flex-wrap gap-2 border-t border-border pt-4">
            <Button asChild variant="outline" size="sm">
              <Link to={`/organizer/schedule?expo=${expo.id}`}>Schedule</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to={`/organizer/exhibitors?expo=${expo.id}`}>Exhibitors</Link>
            </Button>
            <div className="ml-auto flex gap-1">
              <Button variant="ghost" size="icon" onClick={onEdit} aria-label={`Edit ${expo.title}`}>
                <Pencil className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={onDelete}
                aria-label={`Delete ${expo.title}`}
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default function ExposPage() {
  const { data, isPending, isError, error, refetch } = useExpos({ mine: true, limit: 50 });
  const deleteExpo = useDeleteExpo();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Expo | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Expo | null>(null);

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (expo: Expo) => {
    setEditing(expo);
    setFormOpen(true);
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    try {
      await deleteExpo.mutateAsync(pendingDelete.id);
      toast.success(`"${pendingDelete.title}" deleted`);
      setPendingDelete(null);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not delete the expo');
      setPendingDelete(null);
    }
  };

  const expos = data?.items ?? [];

  return (
    <div className="mx-auto max-w-full space-y-8">
      <PageHeader
        title="Your expos"
        description="Create and manage the events you run. Publish one to open it to exhibitor applications and attendee registration."
        actions={
          <Button onClick={openCreate}>
            <Plus className="size-4" aria-hidden="true" />
            New expo
          </Button>
        }
      />

      {isPending && (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="gap-3">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </CardHeader>
              <CardContent className="space-y-2">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-9 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {isError && !data && (
        <Card className="border-destructive/40">
          <CardContent className="flex flex-col items-start gap-3 p-6">
            <p className="flex items-center gap-2 font-medium text-destructive">
              <TriangleAlert className="size-4" aria-hidden="true" />
              {error instanceof ApiError ? error.message : 'Could not load your expos'}
            </p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Try again
            </Button>
          </CardContent>
        </Card>
      )}

      {!isPending && !isError && expos.length === 0 && (
        <EmptyState
          icon={CalendarPlus}
          title="No expos yet"
          description="Create your first expo to start building its schedule, floor plan and exhibitor list."
          action={
            <Button onClick={openCreate}>
              <Plus className="size-4" aria-hidden="true" />
              Create an expo
            </Button>
          }
        />
      )}

      {expos.length > 0 && (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {expos.map((expo) => (
            <ExpoCard
              key={expo.id}
              expo={expo}
              onEdit={() => openEdit(expo)}
              onDelete={() => setPendingDelete(expo)}
            />
          ))}
        </div>
      )}

      <ExpoFormDialog open={formOpen} onOpenChange={setFormOpen} expo={editing} />

      <AlertDialog open={Boolean(pendingDelete)} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogTitle>Delete “{pendingDelete?.title}”?</AlertDialogTitle>
          <AlertDialogDescription>
            This removes the expo along with its sessions and any pending exhibitor applications. Expos that already
            have registrations or approved exhibitors cannot be deleted — cancel those instead. This cannot be undone.
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={confirmDelete}>
              Delete expo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
