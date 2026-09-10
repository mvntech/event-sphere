import type { DraftBooth, FloorPlanConfig } from '@/types';

/**
 * client-side mirror of backend/src/services/boothService.js.
 */

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** half-open intervals, so flush-adjacent booths do not count as overlapping. */
export function rectsOverlap(a: Rect, b: Rect) {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

/** the first booth `candidate` would collide with, ignoring itself. */
export function findCollision(candidate: Rect, booths: DraftBooth[], ignoreKey?: string) {
  return booths.find((booth) => booth.key !== ignoreKey && rectsOverlap(candidate, booth));
}

export function fitsInGrid(rect: Rect, grid: FloorPlanConfig) {
  return rect.x >= 0 && rect.y >= 0 && rect.x + rect.width <= grid.gridWidth && rect.y + rect.height <= grid.gridHeight;
}

/** keeps a booth's origin inside the grid given its size. */
export function clampToGrid(rect: Rect, grid: FloorPlanConfig): Rect {
  return {
    ...rect,
    x: Math.max(0, Math.min(rect.x, grid.gridWidth - rect.width)),
    y: Math.max(0, Math.min(rect.y, grid.gridHeight - rect.height)),
  };
}

/** next free label in the A1, A2… sequence, skipping any already in use. */
export function nextLabel(booths: DraftBooth[]) {
  const used = new Set(booths.map((b) => b.label.trim().toUpperCase()));
  for (let n = 1; n <= 999; n += 1) {
    const candidate = `A${n}`;
    if (!used.has(candidate)) return candidate;
  }
  return `A${booths.length + 1}`;
}

/**
 * finds the first empty slot for a new booth, scanning left-to-right then
 * top-to-bottom, so "Add booth" always lands somewhere sensible.
 */
export function findFreeSlot(
  booths: DraftBooth[],
  grid: FloorPlanConfig,
  size: { width: number; height: number }
): Rect | null {
  for (let y = 0; y + size.height <= grid.gridHeight; y += 1) {
    for (let x = 0; x + size.width <= grid.gridWidth; x += 1) {
      const candidate = { x, y, ...size };
      if (!findCollision(candidate, booths)) return candidate;
    }
  }
  return null;
}

/** booths as percentages of the canvas, which is what makes the plan responsive. */
export function toPercent(rect: Rect, grid: FloorPlanConfig) {
  return {
    left: `${(rect.x / grid.gridWidth) * 100}%`,
    top: `${(rect.y / grid.gridHeight) * 100}%`,
    width: `${(rect.width / grid.gridWidth) * 100}%`,
    height: `${(rect.height / grid.gridHeight) * 100}%`,
  };
}

/** whole layout check, matching the server's bulk-save validation. */
export function validateLayout(booths: DraftBooth[], grid: FloorPlanConfig): string | null {
  const labels = new Set<string>();

  for (const booth of booths) {
    const label = booth.label.trim();
    if (!label) return 'Every booth needs a label.';

    const key = label.toUpperCase();
    if (labels.has(key)) return `Two booths are both labelled "${label}". Labels must be unique.`;
    labels.add(key);

    if (!fitsInGrid(booth, grid)) {
      return `Booth "${label}" falls outside the ${grid.gridWidth}×${grid.gridHeight} floor plan.`;
    }
  }

  for (let i = 0; i < booths.length; i += 1) {
    for (let j = i + 1; j < booths.length; j += 1) {
      if (rectsOverlap(booths[i], booths[j])) {
        return `Booth "${booths[i].label}" overlaps booth "${booths[j].label}".`;
      }
    }
  }

  return null;
}
