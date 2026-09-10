import { describe, expect, it } from 'vitest';
import type { DraftBooth, FloorPlanConfig } from '@/types';
import {
  clampToGrid,
  findCollision,
  findFreeSlot,
  fitsInGrid,
  nextLabel,
  rectsOverlap,
  toPercent,
  validateLayout,
} from './floorPlan';

const GRID: FloorPlanConfig = { gridWidth: 10, gridHeight: 8 };

const booth = (over: Partial<DraftBooth> & Pick<DraftBooth, 'key' | 'x' | 'y'>): DraftBooth => ({
  width: 2,
  height: 2,
  label: over.key.toUpperCase(),
  status: 'available',
  exhibitorRef: null,
  ...over,
});

describe('rectsOverlap', () => {
  const base = { x: 2, y: 2, width: 3, height: 3 };

  it('is false for booths that merely touch along an edge', () => {
    // the common case on a real floor plan — a whole row of adjacent stands.
    // a `<=` here instead of `<` would reject every sensible layout.
    expect(rectsOverlap(base, { x: 5, y: 2, width: 2, height: 3 })).toBe(false);
    expect(rectsOverlap(base, { x: 2, y: 5, width: 3, height: 2 })).toBe(false);
  });

  it('is false for booths that touch at a corner only', () => {
    expect(rectsOverlap(base, { x: 5, y: 5, width: 2, height: 2 })).toBe(false);
  });

  it('is true for a one-cell bite', () => {
    expect(rectsOverlap(base, { x: 4, y: 4, width: 2, height: 2 })).toBe(true);
  });

  it('is true when one contains the other', () => {
    expect(rectsOverlap(base, { x: 3, y: 3, width: 1, height: 1 })).toBe(true);
    expect(rectsOverlap({ x: 3, y: 3, width: 1, height: 1 }, base)).toBe(true);
  });

  it('is true for identical rectangles', () => {
    expect(rectsOverlap(base, { ...base })).toBe(true);
  });

  it('is false for rectangles that are nowhere near each other', () => {
    expect(rectsOverlap(base, { x: 8, y: 0, width: 2, height: 1 })).toBe(false);
  });
});

describe('findCollision', () => {
  const booths = [booth({ key: 'a', x: 0, y: 0 }), booth({ key: 'b', x: 4, y: 0 })];

  it('names the booth in the way', () => {
    expect(findCollision({ x: 1, y: 1, width: 2, height: 2 }, booths)?.key).toBe('a');
  });

  it('returns nothing when the space is free', () => {
    expect(findCollision({ x: 7, y: 5, width: 2, height: 2 }, booths)).toBeUndefined();
  });

  it('ignores the booth being moved, so it cannot collide with itself', () => {
    // dragging booth "a" one cell right must not report "a" as the obstacle.
    expect(findCollision({ x: 1, y: 0, width: 2, height: 2 }, booths, 'a')).toBeUndefined();
  });

  it('still finds a different booth while one is ignored', () => {
    expect(findCollision({ x: 3, y: 0, width: 2, height: 2 }, booths, 'a')?.key).toBe('b');
  });
});

describe('fitsInGrid', () => {
  it('accepts a booth flush against the far edge', () => {
    expect(fitsInGrid({ x: 8, y: 6, width: 2, height: 2 }, GRID)).toBe(true);
  });

  it('rejects a booth one cell past the edge', () => {
    expect(fitsInGrid({ x: 9, y: 6, width: 2, height: 2 }, GRID)).toBe(false);
    expect(fitsInGrid({ x: 8, y: 7, width: 2, height: 2 }, GRID)).toBe(false);
  });

  it('rejects negative origins', () => {
    expect(fitsInGrid({ x: -1, y: 0, width: 2, height: 2 }, GRID)).toBe(false);
    expect(fitsInGrid({ x: 0, y: -1, width: 2, height: 2 }, GRID)).toBe(false);
  });
});

describe('clampToGrid', () => {
  it('pulls a booth back inside, accounting for its size', () => {
    expect(clampToGrid({ x: 20, y: 20, width: 3, height: 2 }, GRID)).toEqual({
      x: 7,
      y: 6,
      width: 3,
      height: 2,
    });
  });

  it('clamps a negative origin to zero', () => {
    expect(clampToGrid({ x: -5, y: -5, width: 2, height: 2 }, GRID)).toEqual({
      x: 0,
      y: 0,
      width: 2,
      height: 2,
    });
  });

  it('leaves a booth already inside untouched', () => {
    const rect = { x: 3, y: 3, width: 2, height: 2 };
    expect(clampToGrid(rect, GRID)).toEqual(rect);
  });
});

describe('nextLabel', () => {
  it('starts at A1 on an empty plan', () => {
    expect(nextLabel([])).toBe('A1');
  });

  it('skips labels already in use', () => {
    expect(nextLabel([booth({ key: 'a', x: 0, y: 0, label: 'A1' })])).toBe('A2');
  });

  it('fills a gap rather than always appending', () => {
    const used = ['A1', 'A2', 'A4'].map((label, i) => booth({ key: String(i), x: 0, y: 0, label }));
    expect(nextLabel(used)).toBe('A3');
  });

  it('ignores case and surrounding whitespace when deciding what is taken', () => {
    expect(nextLabel([booth({ key: 'a', x: 0, y: 0, label: '  a1 ' })])).toBe('A2');
  });
});

describe('findFreeSlot', () => {
  it('returns the top-left corner of an empty grid', () => {
    expect(findFreeSlot([], GRID, { width: 2, height: 2 })).toEqual({ x: 0, y: 0, width: 2, height: 2 });
  });

  it('scans left to right before moving down a row', () => {
    const occupied = [booth({ key: 'a', x: 0, y: 0 })];
    expect(findFreeSlot(occupied, GRID, { width: 2, height: 2 })).toEqual({
      x: 2,
      y: 0,
      width: 2,
      height: 2,
    });
  });

  it('returns null when nothing fits', () => {
    const full = booth({ key: 'a', x: 0, y: 0, width: 10, height: 8 });
    expect(findFreeSlot([full], GRID, { width: 2, height: 2 })).toBeNull();
  });

  it('returns null when the booth is larger than the grid', () => {
    expect(findFreeSlot([], GRID, { width: 11, height: 2 })).toBeNull();
  });
});

describe('toPercent', () => {
  it('expresses a booth as percentages of the canvas', () => {
    expect(toPercent({ x: 5, y: 2, width: 2, height: 4 }, GRID)).toEqual({
      left: '50%',
      top: '25%',
      width: '20%',
      height: '50%',
    });
  });
});

describe('validateLayout', () => {
  it('passes a clean layout', () => {
    expect(
      validateLayout([booth({ key: 'a', x: 0, y: 0 }), booth({ key: 'b', x: 4, y: 0 })], GRID)
    ).toBeNull();
  });

  it('rejects a blank label', () => {
    expect(validateLayout([booth({ key: 'a', x: 0, y: 0, label: '  ' })], GRID)).toBe(
      'Every booth needs a label.'
    );
  });

  it('rejects duplicate labels regardless of case', () => {
    const message = validateLayout(
      [booth({ key: 'a', x: 0, y: 0, label: 'A1' }), booth({ key: 'b', x: 4, y: 0, label: 'a1' })],
      GRID
    );
    expect(message).toContain('a1');
    expect(message).toContain('unique');
  });

  it('rejects a booth outside the grid and names it', () => {
    const message = validateLayout([booth({ key: 'a', x: 9, y: 0, label: 'C7' })], GRID);
    expect(message).toContain('C7');
    expect(message).toContain('10×8');
  });

  it('names both booths in an overlap, so the editor can point at them', () => {
    const message = validateLayout(
      [booth({ key: 'a', x: 0, y: 0, label: 'A1' }), booth({ key: 'b', x: 1, y: 1, label: 'B2' })],
      GRID
    );
    expect(message).toContain('A1');
    expect(message).toContain('B2');
  });

  it('reports the label problem before the overlap', () => {
    // order matters: a blank label is the more actionable fix, and reporting
    // an overlap for a booth the organizer cannot yet name reads as noise.
    const message = validateLayout(
      [booth({ key: 'a', x: 0, y: 0, label: '' }), booth({ key: 'b', x: 1, y: 1, label: 'B2' })],
      GRID
    );
    expect(message).toBe('Every booth needs a label.');
  });
});
