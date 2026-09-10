import { useDraggable } from '@dnd-kit/core';
import { cn } from '@/lib/utils';
import { toPercent } from '@/lib/floorPlan';
import type { BoothStatus, DraftBooth, FloorPlanConfig } from '@/types';

const STATUS_STYLES: Record<BoothStatus, string> = {
  available: 'bg-primary/20 border-primary text-foreground',
  reserved: 'bg-warning/25 border-warning text-foreground',
  assigned: 'bg-secondary border-secondary text-secondary-foreground',
};

interface BaseProps {
  booth: DraftBooth;
  grid: FloorPlanConfig;
  selected?: boolean;
  invalid?: boolean;
  className?: string;
}

/** shared visual shell — used by both the editable and read-only tiles. */
function TileBody({ booth, selected, invalid }: { booth: DraftBooth; selected?: boolean; invalid?: boolean }) {
  const occupant = typeof booth.exhibitorRef === 'object' && booth.exhibitorRef ? booth.exhibitorRef : null;

  return (
    <>
      <span className="font-mono text-meta font-bold leading-none sm:text-body">{booth.label}</span>
      {occupant && (
        <span className="mt-0.5 line-clamp-2 max-w-full break-words text-meta leading-tight opacity-90 @max-[5rem]:hidden">
          {occupant.companyName}
        </span>
      )}
      {invalid && (
        <span className="absolute inset-0 rounded-md border-2 border-destructive bg-destructive/20" aria-hidden="true" />
      )}
      {selected && (
        <span className="absolute -inset-0.5 rounded-md border-2 border-ring" aria-hidden="true" />
      )}
    </>
  );
}

interface DraggableProps extends BaseProps {
  onSelect: () => void;
  onResizeStart: (event: React.PointerEvent) => void;
}

/** the organizer's editable booth: drag to move, corner handle to resize. */
export function DraggableBoothTile({
  booth,
  grid,
  selected,
  invalid,
  onSelect,
  onResizeStart,
}: DraggableProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: booth.key });

  const position = toPercent(booth, grid);

  return (
    <div
      ref={setNodeRef}
      style={{
        ...position,
        // live drag offset in pixels, applied on top of the percentage position.
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
        zIndex: isDragging ? 30 : selected ? 20 : 10,
      }}
      className={cn(
        'absolute touch-none select-none p-0.5',
        isDragging && 'opacity-90'
      )}
    >
      <button
        type="button"
        {...listeners}
        {...attributes}
        onClick={onSelect}
        aria-label={`Booth ${booth.label}, ${booth.status}, ${booth.width} by ${booth.height} cells`}
        aria-pressed={selected}
        className={cn(
          '@container relative flex size-full cursor-grab flex-col items-center justify-center overflow-hidden rounded-md border-2 px-1 text-center shadow-2xs transition-shadow',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
          'active:cursor-grabbing hover:shadow-md',
          STATUS_STYLES[booth.status]
        )}
      >
        <TileBody booth={booth} selected={selected} invalid={invalid} />
      </button>

      {/* resize handle. Only on the selected booth, to keep the canvas calm. */}
      {selected && (
        <span
          aria-hidden="true"
          onPointerDown={onResizeStart}
          className="absolute -bottom-1 -right-1 z-40 size-4 cursor-nwse-resize touch-none rounded-full border-2 border-background bg-ring shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        />
      )}
    </div>
  );
}

interface ViewerProps extends BaseProps {
  onSelect?: () => void;
  /** highlights the booth held by the signed-in exhibitor. */
  mine?: boolean;
  interactive?: boolean;
}

/** read-only booth for the exhibitor and attendee viewers. */
export function ViewerBoothTile({ booth, grid, selected, mine, onSelect, interactive = true }: ViewerProps) {
  const position = toPercent(booth, grid);
  const Tag = interactive ? 'button' : 'div';

  return (
    <div style={{ ...position, zIndex: selected ? 20 : 10 }} className="absolute p-0.5">
      <Tag
        {...(interactive ? { type: 'button' as const, onClick: onSelect } : {})}
        aria-label={`Booth ${booth.label}, ${booth.status}`}
        aria-pressed={interactive ? selected : undefined}
        className={cn(
          '@container relative flex size-full flex-col items-center justify-center overflow-hidden rounded-md border-2 px-1 text-center transition-shadow',
          interactive && 'cursor-pointer hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
          STATUS_STYLES[booth.status],
          mine && 'ring-2 ring-ring ring-offset-1 ring-offset-muted'
        )}
      >
        <TileBody booth={booth} selected={selected} />
      </Tag>
    </div>
  );
}

/** shared legend so both the builder and the viewers explain the colours. */
export function BoothLegend({ className }: { className?: string }) {
  const entries: { status: BoothStatus; label: string }[] = [
    { status: 'available', label: 'Available' },
    { status: 'reserved', label: 'Reserved' },
    { status: 'assigned', label: 'Assigned' },
  ];

  return (
    <ul className={cn('flex flex-wrap items-center gap-x-4 gap-y-2 text-meta', className)}>
      {entries.map((entry) => (
        <li key={entry.status} className="flex items-center gap-1.5">
          <span className={cn('size-3 rounded-sm border-2', STATUS_STYLES[entry.status])} aria-hidden="true" />
          <span className="text-muted-foreground">{entry.label}</span>
        </li>
      ))}
    </ul>
  );
}
