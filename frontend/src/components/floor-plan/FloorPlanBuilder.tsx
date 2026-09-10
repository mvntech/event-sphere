import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { toast } from 'sonner';
import { LayoutGrid, Plus, RotateCcw, Save, Trash2, TriangleAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { BoothLegend, DraggableBoothTile } from '@/components/floor-plan/BoothTile';
import { FloorPlanCanvas } from '@/components/floor-plan/FloorPlanCanvas';
import { useSaveLayout } from '@/hooks/useBooths';
import { ApiError } from '@/lib/api';
import {
  clampToGrid,
  findCollision,
  findFreeSlot,
  nextLabel,
  validateLayout,
} from '@/lib/floorPlan';
import { BOOTH_STATUS_LABELS, BOOTH_STATUS_VARIANTS, type Booth, type DraftBooth, type FloorPlanConfig } from '@/types';

const DEFAULT_SIZE = { width: 2, height: 2 };

/** server booths become drafts with a stable key for React and dnd-kit. */
const toDraft = (booth: Booth): DraftBooth => ({
  id: booth.id,
  key: booth.id,
  x: booth.x,
  y: booth.y,
  width: booth.width,
  height: booth.height,
  label: booth.label,
  status: booth.status,
  exhibitorRef: booth.exhibitorRef,
});

interface Props {
  expoId: string;
  grid: FloorPlanConfig;
  booths: Booth[];
}

export function FloorPlanBuilder({ expoId, grid, booths }: Props) {
  const saveLayout = useSaveLayout(expoId);

  const [drafts, setDrafts] = useState<DraftBooth[]>(() => booths.map(toDraft));
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [conflictKey, setConflictKey] = useState<string | null>(null);
  const [cell, setCell] = useState({ cellWidth: 0, cellHeight: 0 });

  const cellRef = useRef(cell);
  cellRef.current = cell;

  // adopt server state on load, and after a save — but never mid-edit, or a
  // background refetch would discard the organizer's unsaved work.
  useEffect(() => {
    if (!dirty) setDrafts(booths.map(toDraft));
  }, [booths, dirty]);

  const selected = drafts.find((b) => b.key === selectedKey) ?? null;

  const sensors = useSensors(
    // a small activation distance keeps taps distinct from drags on touch.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 6 } })
  );

  const onCellSize = useCallback((next: { cellWidth: number; cellHeight: number }) => setCell(next), []);

  const handleDragStart = (event: DragStartEvent) => {
    setSelectedKey(String(event.active.id));
    setConflictKey(null);
  };

  /**
   * converts the pixel drag delta into whole grid cells, then refuses the drop
   * if it would overlap.
   */
  const handleDragEnd = (event: DragEndEvent) => {
    const key = String(event.active.id);
    const booth = drafts.find((b) => b.key === key);
    const { cellWidth, cellHeight } = cellRef.current;
    if (!booth || !cellWidth || !cellHeight) return;

    const dx = Math.round(event.delta.x / cellWidth);
    const dy = Math.round(event.delta.y / cellHeight);
    if (dx === 0 && dy === 0) return;

    const moved = clampToGrid({ ...booth, x: booth.x + dx, y: booth.y + dy }, grid);

    const clash = findCollision(moved, drafts, key);
    if (clash) {
      setConflictKey(clash.key);
      toast.error(`Booth "${booth.label}" would overlap "${clash.label}"`, {
        description: 'Booths cannot share space. Drop it somewhere clear.',
      });
      // flash the blocker, then clear the highlight.
      window.setTimeout(() => setConflictKey(null), 1600);
      return;
    }

    setDrafts((current) => current.map((b) => (b.key === key ? { ...b, ...moved } : b)));
    setDirty(true);
  };

  /** pointer-driven resize from the corner handle, snapped to whole cells. */
  const startResize = (event: React.PointerEvent, booth: DraftBooth) => {
    event.preventDefault();
    event.stopPropagation();

    const { cellWidth, cellHeight } = cellRef.current;
    if (!cellWidth || !cellHeight) return;

    const originX = event.clientX;
    const originY = event.clientY;
    const startWidth = booth.width;
    const startHeight = booth.height;

    const onMove = (move: PointerEvent) => {
      const width = Math.max(1, Math.min(20, startWidth + Math.round((move.clientX - originX) / cellWidth)));
      const height = Math.max(1, Math.min(20, startHeight + Math.round((move.clientY - originY) / cellHeight)));

      setDrafts((current) => {
        const target = current.find((b) => b.key === booth.key);
        if (!target || (target.width === width && target.height === height)) return current;

        const resized = { ...target, width, height };
        // refuse a size that would run off the grid or into a neighbour.
        if (resized.x + width > grid.gridWidth || resized.y + height > grid.gridHeight) return current;
        if (findCollision(resized, current, booth.key)) return current;

        return current.map((b) => (b.key === booth.key ? resized : b));
      });
      setDirty(true);
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const addBooth = () => {
    const slot = findFreeSlot(drafts, grid, DEFAULT_SIZE);
    if (!slot) {
      toast.error('No room left on the floor plan', {
        description: 'Move or resize some booths to make space.',
      });
      return;
    }

    const key = `new-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const booth: DraftBooth = { key, ...slot, label: nextLabel(drafts), status: 'available', exhibitorRef: null };

    setDrafts((current) => [...current, booth]);
    setSelectedKey(key);
    setDirty(true);
  };

  const updateSelected = (patch: Partial<DraftBooth>) => {
    if (!selected) return;

    setDrafts((current) =>
      current.map((b) => {
        if (b.key !== selected.key) return b;

        const next = { ...b, ...patch };
        // geometry changes still have to respect the grid and its neighbours.
        if ('x' in patch || 'y' in patch || 'width' in patch || 'height' in patch) {
          const clamped = clampToGrid(next, grid);
          if (findCollision(clamped, current, b.key)) return b;
          return { ...next, ...clamped };
        }
        return next;
      })
    );
    setDirty(true);
  };

  const removeSelected = () => {
    if (!selected) return;

    if (selected.status !== 'available') {
      toast.error(`Booth "${selected.label}" is ${selected.status}`, {
        description: 'Release it before removing it from the plan.',
      });
      return;
    }

    setDrafts((current) => current.filter((b) => b.key !== selected.key));
    setSelectedKey(null);
    setDirty(true);
  };

  const reset = () => {
    setDrafts(booths.map(toDraft));
    setSelectedKey(null);
    setConflictKey(null);
    setDirty(false);
  };

  const layoutError = useMemo(() => validateLayout(drafts, grid), [drafts, grid]);

  const save = async () => {
    if (layoutError) {
      toast.error('Fix the layout before saving', { description: layoutError });
      return;
    }

    try {
      await saveLayout.mutateAsync(
        drafts.map((b) => ({
          ...(b.id ? { id: b.id } : {}),
          x: b.x,
          y: b.y,
          width: b.width,
          height: b.height,
          label: b.label.trim(),
        }))
      );
      setDirty(false);
      toast.success(`Floor plan saved — ${drafts.length} booth${drafts.length === 1 ? '' : 's'}`);
    } catch (error) {
      // a 409 here is the server's own overlap check, naming the clash.
      toast.error(error instanceof ApiError ? error.message : 'Could not save the floor plan');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={addBooth} size="sm">
          <Plus className="size-4" aria-hidden="true" />
          Add booth
        </Button>
        <Button onClick={save} size="sm" variant={dirty ? 'default' : 'outline'} loading={saveLayout.isPending} disabled={!dirty}>
          <Save className="size-4" aria-hidden="true" />
          Save layout
        </Button>
        <Button onClick={reset} size="sm" variant="ghost" disabled={!dirty}>
          <RotateCcw className="size-4" aria-hidden="true" />
          Discard changes
        </Button>

        <div className="ml-auto flex items-center gap-2">
          {dirty && <Badge variant="warning">Unsaved changes</Badge>}
          <Badge variant="muted">
            {drafts.length} booth{drafts.length === 1 ? '' : 's'}
          </Badge>
        </div>
      </div>

      {layoutError && (
        <p role="alert" className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-body font-medium text-destructive">
          <TriangleAlert className="size-4 shrink-0" aria-hidden="true" />
          {layoutError}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_18rem]">
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <FloorPlanCanvas grid={grid} onCellSize={onCellSize} onBackgroundClick={() => setSelectedKey(null)}>
            {drafts.map((booth) => (
              <DraggableBoothTile
                key={booth.key}
                booth={booth}
                grid={grid}
                selected={booth.key === selectedKey}
                invalid={booth.key === conflictKey}
                onSelect={() => setSelectedKey(booth.key)}
                onResizeStart={(e) => startResize(e, booth)}
              />
            ))}
          </FloorPlanCanvas>
        </DndContext>

        <Card className="h-fit">
          <CardContent className="space-y-4 p-5">
            {selected ? (
              <>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-semibold">Booth {selected.label}</h3>
                  <Badge variant={BOOTH_STATUS_VARIANTS[selected.status]}>
                    {BOOTH_STATUS_LABELS[selected.status]}
                  </Badge>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="booth-label">Label</Label>
                  <Input
                    id="booth-label"
                    value={selected.label}
                    maxLength={20}
                    onChange={(e) => updateSelected({ label: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-2">
                    <Label htmlFor="booth-width">Width</Label>
                    <Input
                      id="booth-width"
                      type="number"
                      min={1}
                      max={20}
                      value={selected.width}
                      onChange={(e) => updateSelected({ width: Math.max(1, Number(e.target.value) || 1) })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="booth-height">Height</Label>
                    <Input
                      id="booth-height"
                      type="number"
                      min={1}
                      max={20}
                      value={selected.height}
                      onChange={(e) => updateSelected({ height: Math.max(1, Number(e.target.value) || 1) })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-2">
                    <Label htmlFor="booth-x">Column</Label>
                    <Input
                      id="booth-x"
                      type="number"
                      min={0}
                      max={grid.gridWidth - 1}
                      value={selected.x}
                      onChange={(e) => updateSelected({ x: Math.max(0, Number(e.target.value) || 0) })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="booth-y">Row</Label>
                    <Input
                      id="booth-y"
                      type="number"
                      min={0}
                      max={grid.gridHeight - 1}
                      value={selected.y}
                      onChange={(e) => updateSelected({ y: Math.max(0, Number(e.target.value) || 0) })}
                    />
                  </div>
                </div>

                {typeof selected.exhibitorRef === 'object' && selected.exhibitorRef && (
                  <p className="rounded-lg bg-muted px-3 py-2.5 text-body">
                    Held by <span className="font-medium">{selected.exhibitorRef.companyName}</span>
                  </p>
                )}

                <Separator />

                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-destructive hover:bg-destructive/10"
                  onClick={removeSelected}
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                  Remove booth
                </Button>
              </>
            ) : (
              <div className="py-4 text-center">
                <LayoutGrid className="mx-auto size-6 text-muted-foreground" aria-hidden="true" />
                <p className="mt-2 text-body font-medium">No booth selected</p>
                <p className="mt-1 text-meta text-muted-foreground">
                  Tap a booth to rename or resize it, or drag one to move it. Changes are saved when you press
                  “Save layout”.
                </p>
              </div>
            )}

            <Separator />
            <BoothLegend />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
