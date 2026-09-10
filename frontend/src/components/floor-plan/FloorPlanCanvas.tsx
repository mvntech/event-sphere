import { forwardRef, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import type { FloorPlanConfig } from '@/types';

const MIN_CANVAS_PX = 560;

interface Props {
  grid: FloorPlanConfig;
  children: React.ReactNode;
  className?: string;
  onCellSize?: (size: { cellWidth: number; cellHeight: number }) => void;
  onBackgroundClick?: () => void;
}

/**
 * the floor plan surface. booths are positioned as percentages of this box, so
 * the whole plan scales with its container instead of being pinned to pixels.
 *
 * on narrow screens the canvas keeps a minimum width and the wrapper scrolls,
 * which keeps booth labels readable on a phone.
 */
export const FloorPlanCanvas = forwardRef<HTMLDivElement, Props>(function FloorPlanCanvas(
  { grid, children, className, onCellSize, onBackgroundClick },
  ref
) {
  const innerRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const node = innerRef.current;
    if (!node) return;

    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ width, height });
      onCellSize?.({ cellWidth: width / grid.gridWidth, cellHeight: height / grid.gridHeight });
    });

    observer.observe(node);
    return () => observer.disconnect();
  }, [grid.gridWidth, grid.gridHeight, onCellSize]);

  return (
    <div className={cn('w-full overflow-x-auto overscroll-x-contain rounded-xl border border-border bg-card p-3', className)}>
      <div style={{ minWidth: MIN_CANVAS_PX }}>
        <div
          ref={(node) => {
            innerRef.current = node;
            if (typeof ref === 'function') ref(node);
            else if (ref) ref.current = node;
          }}
          role="application"
          aria-label={`Floor plan, ${grid.gridWidth} by ${grid.gridHeight} grid`}
          onPointerDown={(e) => {
            if (e.target === e.currentTarget) onBackgroundClick?.();
          }}
          className="relative w-full rounded-lg bg-muted"
          style={{
            // the grid's own proportions drive the canvas shape at every width.
            aspectRatio: `${grid.gridWidth} / ${grid.gridHeight}`,
            backgroundImage:
              'linear-gradient(to right, var(--color-border) 1px, transparent 1px), linear-gradient(to bottom, var(--color-border) 1px, transparent 1px)',
            backgroundSize: `${100 / grid.gridWidth}% ${100 / grid.gridHeight}%`,
          }}
        >
          {size.width > 0 && children}
        </div>
      </div>
    </div>
  );
});
