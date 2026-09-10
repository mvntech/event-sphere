import { useCallback, useState } from 'react';
import { CalendarPlus, Radio, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/EmptyState';
import { PageHeader } from '@/components/shared/PageHeader';
import { ExpoPicker } from '@/components/organizer/ExpoPicker';
import { FloorPlanBuilder } from '@/components/floor-plan/FloorPlanBuilder';
import { useFloorPlan, useLiveFloorPlan } from '@/hooks/useBooths';
import { useExpos } from '@/hooks/useExpos';
import { ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { BoothUpdatedEvent } from '@/types';

export default function FloorPlanPage() {
  const [expoId, setExpoId] = useState('');

  const { data: expoList, isPending: exposPending } = useExpos({ mine: true, limit: 50 });
  const { data, isPending, isError, error, refetch } = useFloorPlan(expoId || undefined);

  // an exhibitor reserving a booth elsewhere shows up here without a refresh.
  const onBoothEvent = useCallback((event: BoothUpdatedEvent) => {
    if (event.action === 'reserved' && event.booth) {
      const occupant =
        typeof event.booth.exhibitorRef === 'object' && event.booth.exhibitorRef
          ? event.booth.exhibitorRef.companyName
          : 'An exhibitor';
      toast.info(`${occupant} just reserved booth ${event.booth.label}`);
    }
  }, []);

  const { connected } = useLiveFloorPlan(expoId || undefined, onBoothEvent);

  const hasExpos = (expoList?.items.length ?? 0) > 0;

  return (
    <div className="mx-auto max-w-full space-y-8">
      <PageHeader
        title="Floor plan builder"
        description="Drag booths onto the grid, resize them from the corner handle, and save the layout. Overlapping booths are refused."
        actions={
          expoId ? (
            <span
              className={cn(
                'flex items-center gap-1.5 text-meta font-medium',
                connected ? 'text-muted-foreground' : 'text-warning'
              )}
              role="status"
            >
              <Radio className={cn('size-3.5', connected && 'text-primary')} aria-hidden="true" />
              {connected ? 'Live' : 'Reconnecting…'}
            </span>
          ) : undefined
        }
      />

      {!exposPending && !hasExpos && (
        <EmptyState
          icon={CalendarPlus}
          title="Create an expo first"
          description="A floor plan belongs to an expo. Create one and its booths can be laid out here."
        />
      )}

      {hasExpos && <ExpoPicker value={expoId} onChange={setExpoId} />}

      {expoId && isPending && (
        <div className="grid gap-4 lg:grid-cols-[1fr_18rem]">
          <Skeleton className="aspect-[20/14] w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      )}

      {isError && !data && (
        <Card className="border-destructive/40">
          <CardContent className="flex flex-col items-start gap-3 p-6">
            <p className="flex items-center gap-2 font-medium text-destructive">
              <TriangleAlert className="size-4" aria-hidden="true" />
              {error instanceof ApiError ? error.message : 'Could not load the floor plan'}
            </p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Try again
            </Button>
          </CardContent>
        </Card>
      )}

      {expoId && data && (
        <FloorPlanBuilder
          key={expoId}
          expoId={expoId}
          grid={data.expo.floorPlanConfig}
          booths={data.items}
        />
      )}
    </div>
  );
}
