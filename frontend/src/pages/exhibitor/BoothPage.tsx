import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, LayoutGrid, TriangleAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/EmptyState';
import { PageHeader } from '@/components/shared/PageHeader';
import { FloorPlanViewer } from '@/components/floor-plan/FloorPlanViewer';
import { useFloorPlan, useLiveFloorPlan } from '@/hooks/useBooths';
import { useMyApplications } from '@/hooks/useExhibitors';
import { ApiError } from '@/lib/api';
import { APPROVAL_LABELS, APPROVAL_VARIANTS, isPubliclyVisible } from '@/types';

export default function BoothPage() {
  const applications = useMyApplications();
  const [expoId, setExpoId] = useState('');

  const items = applications.data?.items ?? [];

  const options = items
    .map((item) =>
      item.expoRef && typeof item.expoRef !== 'string'
        ? { ...item.expoRef, approvalStatus: item.approvalStatus }
        : null
    )
    .filter((expo): expo is NonNullable<typeof expo> => expo !== null);

  useEffect(() => {
    if (options.length === 0) return;
    if (!expoId || !options.some((expo) => expo.id === expoId)) setExpoId(options[0].id);
  }, [expoId, options]);

  const activeExpo = options.find((expo) => expo.id === expoId) ?? null;

  const viewable = activeExpo ? isPubliclyVisible(activeExpo.status) : false;
  const planExpoId = viewable ? expoId : undefined;

  const { data, isPending, isError, error, refetch } = useFloorPlan(planExpoId);
  const { connected } = useLiveFloorPlan(planExpoId);

  const activeApplication = items.find((item) =>
    typeof item.expoRef === 'string' ? item.expoRef === expoId : item.expoRef?.id === expoId
  );

  return (
    <div className="mx-auto max-w-full space-y-8">
      <PageHeader
        title="Your booth"
        description="See the live floor plan and reserve a stand. Booths taken by other exhibitors update here as it happens."
      />

      {applications.isPending && <Skeleton className="h-96 w-full rounded-xl" />}

      {!applications.isPending && options.length === 0 && (
        <EmptyState
          icon={Building2}
          title="Apply to an expo first"
          description="Booth reservation opens once you have applied to an expo and an organizer has approved you."
          action={
            <Button asChild>
              <Link to="/exhibitor/profile">Go to your profile</Link>
            </Button>
          }
        />
      )}

      {options.length > 1 && (
        <div className="grid w-full gap-2 sm:w-80">
          <Label htmlFor="booth-expo-picker">Expo</Label>
          <Select value={expoId} onValueChange={setExpoId}>
            <SelectTrigger id="booth-expo-picker">
              <SelectValue placeholder="Choose an expo" />
            </SelectTrigger>
            <SelectContent>
              {options.map((expo) => (
                <SelectItem key={expo.id} value={expo.id}>
                  {expo.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {activeApplication && activeApplication.approvalStatus !== 'approved' && (
        <Card>
          <CardContent className="flex flex-wrap items-center gap-3 p-5">
            <Badge variant={APPROVAL_VARIANTS[activeApplication.approvalStatus]}>
              {APPROVAL_LABELS[activeApplication.approvalStatus]}
            </Badge>
            <p className="text-body text-muted-foreground">
              {activeApplication.approvalStatus === 'pending'
                ? 'You can browse the plan now — reserving opens once an organizer approves your application.'
                : 'Your application for this expo was not approved, so booths cannot be reserved.'}
            </p>
          </CardContent>
        </Card>
      )}

      {planExpoId && isPending && (
        <div className="grid gap-4 lg:grid-cols-[1fr_18rem]">
          <Skeleton className="aspect-[20/14] w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      )}

      {activeExpo && !viewable && (
        <Card>
          <CardContent className="flex flex-col items-start gap-3 p-6">
            <p className="flex items-center gap-2 text-item">
              <LayoutGrid className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              {activeExpo.title} has not been published yet
            </p>
            <p className="max-w-prose text-body text-muted-foreground">
              The organizer is still preparing this expo. Its floor plan opens — and booth reservation with it —
              once they publish it. Your application stays approved in the meantime.
            </p>
          </CardContent>
        </Card>
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

      {isError && data && (
        <p role="status" className="flex items-center gap-2 text-meta text-muted-foreground">
          <TriangleAlert className="size-3.5 shrink-0 text-warning" aria-hidden="true" />
          Showing the last version of this plan — it could not be refreshed just now.
        </p>
      )}

      {planExpoId && data && data.items.length === 0 && (
        <EmptyState
          icon={LayoutGrid}
          title="No floor plan yet"
          description="The organizer has not laid out booths for this expo. Check back once they publish the plan."
        />
      )}

      {planExpoId && data && data.items.length > 0 && (
        <FloorPlanViewer
          expoId={expoId}
          grid={data.expo.floorPlanConfig}
          booths={data.items}
          connected={connected}
          myProfile={data.myProfile}
          canReserve
        />
      )}
    </div>
  );
}
