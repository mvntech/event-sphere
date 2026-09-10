import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CalendarDays, LayoutGrid, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/EmptyState';
import { PageHeader } from '@/components/shared/PageHeader';
import { FloorPlanViewer } from '@/components/floor-plan/FloorPlanViewer';
import { useFloorPlan, useLiveFloorPlan } from '@/hooks/useBooths';
import { useExpos } from '@/hooks/useExpos';
import { ApiError } from '@/lib/api';
import { formatDateRange } from '@/lib/format';

/** read-only floor plan for attendees — who is exhibiting, and where. */
export default function AttendeeFloorPlanPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const focusBoothId = searchParams.get('booth');

  const expos = useExpos({ limit: 50 });
  const [expoId, setExpoId] = useState(searchParams.get('expo') ?? '');

  const options = expos.data?.items ?? [];

  useEffect(() => {
    if (options.length === 0) return;

    const known = options.some((expo) => expo.id === expoId);
    if (expoId && known) return;

    setExpoId(options[0].id);

    if (expoId && !known) {
      const params = new URLSearchParams(searchParams);
      params.set('expo', options[0].id);
      params.delete('booth');
      setSearchParams(params, { replace: true });
    }
  }, [expoId, options, searchParams, setSearchParams]);

  // switching expo by hand abandons the booth we were sent to find.
  const chooseExpo = (next: string) => {
    setExpoId(next);
    const params = new URLSearchParams(searchParams);
    params.set('expo', next);
    params.delete('booth');
    setSearchParams(params, { replace: true });
  };

  const { data, isPending, isError, error, refetch } = useFloorPlan(expoId || undefined);
  const { connected } = useLiveFloorPlan(expoId || undefined);

  return (
    <div className="mx-auto max-w-full space-y-8">
      <PageHeader
        title="Floor plan"
        description="See the layout of the hall and which company is on each stand. Updates appear as exhibitors take their booths."
      />

      {expos.isPending && <Skeleton className="h-11 w-full sm:w-80" />}

      {!expos.isPending && options.length === 0 && (
        <EmptyState
          icon={CalendarDays}
          title="No expos published yet"
          description="Once an organizer publishes an expo, its floor plan will be browsable here."
        />
      )}

      {options.length > 0 && (
        <div className="grid w-full gap-2 sm:w-80">
          <Label htmlFor="attendee-expo-picker">Expo</Label>
          <Select value={expoId} onValueChange={chooseExpo}>
            <SelectTrigger id="attendee-expo-picker">
              <SelectValue placeholder="Choose an expo" />
            </SelectTrigger>
            <SelectContent>
              {options.map((expo) => (
                <SelectItem key={expo.id} value={expo.id}>
                  {expo.title} · {formatDateRange(expo.startDate, expo.endDate)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {expoId && isPending && (
        <div className="grid gap-4 lg:grid-cols-[1fr_18rem]">
          <Skeleton className="aspect-[20/14] w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      )}

      {isError && !data && (
        <Card className="border-destructive/40">
          <CardContent className="flex flex-col items-start gap-3 p-6">
            <p className="flex items-center gap-2 text-body font-medium text-destructive">
              <TriangleAlert className="size-4" aria-hidden="true" />
              {error instanceof ApiError ? error.message : 'Could not load the floor plan'}
            </p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Try again
            </Button>
          </CardContent>
        </Card>
      )}

      {expoId && data && data.items.length === 0 && (
        <EmptyState
          icon={LayoutGrid}
          title="No floor plan yet"
          description="The organizer has not published a layout for this expo."
        />
      )}

      {expoId && data && data.items.length > 0 && (
        <FloorPlanViewer
          expoId={expoId}
          grid={data.expo.floorPlanConfig}
          booths={data.items}
          connected={connected}
          focusBoothId={focusBoothId}
        />
      )}
    </div>
  );
}
