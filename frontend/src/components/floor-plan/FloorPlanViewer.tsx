import { useRef, useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Building2, CheckCircle2, LayoutGrid, Radio, Undo2 } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { BoothLegend, ViewerBoothTile } from '@/components/floor-plan/BoothTile';
import { FloorPlanCanvas } from '@/components/floor-plan/FloorPlanCanvas';
import { useReleaseBooth, useReserveBooth } from '@/hooks/useBooths';
import { useRecordEvent } from '@/hooks/useAnalytics';
import { ApiError } from '@/lib/api';
import { DURATION, EASE } from '@/lib/motion';
import { cn } from '@/lib/utils';
import {
  BOOTH_STATUS_LABELS,
  BOOTH_STATUS_VARIANTS,
  type ApprovalStatus,
  type Booth,
  type DraftBooth,
  type FloorPlanConfig,
} from '@/types';

const toDraft = (booth: Booth): DraftBooth => ({ ...booth, key: booth.id });

const occupantOf = (booth: Booth) =>
  typeof booth.exhibitorRef === 'object' && booth.exhibitorRef ? booth.exhibitorRef : null;

interface Props {
  expoId: string;
  grid: FloorPlanConfig;
  booths: Booth[];
  connected?: boolean;
  myProfile?: { id: string; approvalStatus: ApprovalStatus } | null;
  canReserve?: boolean;
  focusBoothId?: string | null;
}

/**
 * read-only floor plan for exhibitors and attendees. when `canReserve` is set
 * and the viewer's application is approved, an available booth can be claimed
 * straight from the plan.
 */
export function FloorPlanViewer({
  expoId,
  grid,
  booths,
  connected,
  myProfile,
  canReserve = false,
  focusBoothId = null,
}: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [arriving, setArriving] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const reserve = useReserveBooth(expoId);
  const release = useReleaseBooth(expoId);
  const recordEvent = useRecordEvent();
  const reported = useRef(new Set<string>());

  const selectBooth = (boothId: string) => {
    setSelectedId(boothId);

    if (!reported.current.has(boothId)) {
      reported.current.add(boothId);
      recordEvent.mutate({ expoRef: expoId, type: 'boothView', targetRef: boothId });
    }
  };

  useEffect(() => {
    if (!focusBoothId || !booths.some((b) => b.id === focusBoothId)) return;

    setSelectedId(focusBoothId);
    setArriving(true);

    // wait a frame so the tile exists before scrolling to it.
    const raf = requestAnimationFrame(() => {
      canvasRef.current
        ?.querySelector(`[data-booth-id="${focusBoothId}"]`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
    });

    const done = window.setTimeout(() => setArriving(false), 1800);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(done);
    };
  }, [focusBoothId, booths]);

  const resolved = booths.find((b) => b.id === selectedId) ?? null;
  const lastResolved = useRef<Booth | null>(null);
  if (resolved) lastResolved.current = resolved;
  else if (!selectedId) lastResolved.current = null;

  const selected = resolved ?? (selectedId ? lastResolved.current : null);

  const selectionMessage = selected
    ? `Booth ${selected.label} selected. ${BOOTH_STATUS_LABELS[selected.status]}. ${
        occupantOf(selected)?.companyName ?? 'No exhibitor yet'
      }.`
    : '';
  const myBooth = myProfile ? booths.find((b) => occupantOf(b)?.id === myProfile.id) ?? null : null;

  const approved = myProfile?.approvalStatus === 'approved';
  const reservationOpen = canReserve && approved;

  const claim = async (boothId: string, label: string) => {
    try {
      await reserve.mutateAsync(boothId);
      toast.success(`Booth ${label} is yours`, { description: 'Organizers have been notified.' });
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Could not reserve that booth');
    }
  };

  const giveUp = async (boothId: string, label: string) => {
    try {
      await release.mutateAsync(boothId);
      toast.success(`Booth ${label} released`);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Could not release that booth');
    }
  };

  const counts = booths.reduce(
    (acc, booth) => ({ ...acc, [booth.status]: (acc[booth.status] ?? 0) + 1 }),
    {} as Record<string, number>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="success">{counts.available ?? 0} available</Badge>
        <Badge variant="warning">{counts.reserved ?? 0} reserved</Badge>
        <Badge variant="default">{counts.assigned ?? 0} assigned</Badge>

        <span
          className={cn(
            'ml-auto flex items-center gap-1.5 text-meta',
            connected ? 'text-muted-foreground' : 'text-warning'
          )}
          role="status"
        >
          <Radio className={cn('size-3.5', connected && 'text-primary')} aria-hidden="true" />
          {connected ? 'Live — updates appear automatically' : 'Reconnecting…'}
        </span>
      </div>

      <p aria-live="polite" className="sr-only">
        {selectionMessage}
      </p>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div ref={canvasRef} className="min-w-0">
          <FloorPlanCanvas grid={grid} onBackgroundClick={() => setSelectedId(null)}>
            {booths.map((booth) => (
              <div
                key={booth.id}
                data-booth-id={booth.id}
                className={cn(
                  'contents',
                  arriving && booth.id === focusBoothId && '[&>*]:animate-[pulse_0.6s_ease-in-out_2]'
                )}
              >
                <ViewerBoothTile
                  booth={toDraft(booth)}
                  grid={grid}
                  selected={booth.id === selectedId}
                  mine={Boolean(myProfile && occupantOf(booth)?.id === myProfile.id)}
                  onSelect={() => selectBooth(booth.id)}
                />
              </div>
            ))}
          </FloorPlanCanvas>
        </div>

        <Card className="h-fit">
          <CardContent className="space-y-4 p-5">
            {selected ? (
              <>
              <motion.div
                key={selected.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: DURATION.micro, ease: EASE }}
                className="space-y-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded-lg bg-primary px-4 py-2.5 font-mono text-section text-primary-foreground">
                    {selected.label}
                  </span>
                  <Badge variant={BOOTH_STATUS_VARIANTS[selected.status]}>
                    {BOOTH_STATUS_LABELS[selected.status]}
                  </Badge>
                </div>

                <p className="text-body text-muted-foreground">
                  {selected.width} × {selected.height} cells
                </p>

                {occupantOf(selected) ? (
                  <div className="rounded-lg bg-muted px-3.5 py-3">
                    <p className="flex items-center gap-2 text-body font-medium">
                      <Building2 className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                      {occupantOf(selected)!.companyName}
                    </p>
                    <p className="mt-1 text-meta text-muted-foreground">{occupantOf(selected)!.category}</p>
                  </div>
                ) : (
                  <p className="text-body text-muted-foreground">This booth is not taken yet.</p>
                )}

              </motion.div>
              {reservationOpen && selected.status === 'available' && (
                <Button
                  className="w-full"
                  loading={reserve.isPending}
                  onClick={() => claim(selected.id, selected.label)}
                >
                  <CheckCircle2 className="size-4" aria-hidden="true" />
                  Reserve this booth
                </Button>
              )}

              {reservationOpen && myBooth?.id === selected.id && (
                <Button
                  variant="outline"
                  className="w-full"
                  loading={release.isPending}
                  onClick={() => giveUp(selected.id, selected.label)}
                >
                  <Undo2 className="size-4" aria-hidden="true" />
                  Release this booth
                </Button>
              )}
              </>
            ) : (
              <div className="py-4 text-center">
                <LayoutGrid className="mx-auto size-6 text-muted-foreground" aria-hidden="true" />
                <p className="mt-2 text-item">Select a booth</p>
                <p className="mt-1 text-body text-muted-foreground">
                  Tap any booth to see who is exhibiting there
                  {reservationOpen ? ', or reserve one that is still free.' : '.'}
                </p>
              </div>
            )}

            {canReserve && !approved && (
              <p className="rounded-lg border border-warning/40 bg-warning/10 px-3.5 py-3 text-meta">
                {myProfile
                  ? 'Booth reservation opens once an organizer approves your application.'
                  : 'Apply to exhibit at this expo to reserve a booth.'}
              </p>
            )}

            {myBooth && (
              <p className="rounded-lg bg-accent px-3.5 py-3 text-body text-accent-foreground">
                You hold booth <span className="font-semibold">{myBooth.label}</span>.
              </p>
            )}

            <Separator />
            <BoothLegend />
          </CardContent>
        </Card>
      </div>

      <details className="rounded-xl border border-border bg-card p-4">
        <summary className="cursor-pointer text-body font-medium">Booth list ({booths.length})</summary>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {booths.map((booth) => (
            <li key={booth.id}>
              <button
                type="button"
                onClick={() => selectBooth(booth.id)}
                className="flex w-full items-center gap-2 rounded-lg border border-border px-3 py-2 text-left text-body transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <span className="font-mono font-semibold">{booth.label}</span>
                <span className="min-w-0 flex-1 truncate text-muted-foreground">
                  {occupantOf(booth)?.companyName ??
                    (booth.status === 'available' ? 'Not taken yet' : 'Exhibitor to be confirmed')}
                </span>
                <Badge variant={BOOTH_STATUS_VARIANTS[booth.status]} className="shrink-0">
                  {BOOTH_STATUS_LABELS[booth.status]}
                </Badge>
              </button>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
