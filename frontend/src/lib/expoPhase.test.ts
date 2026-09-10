import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { daysUntil, isRunningNow, opensIn, phaseOf } from './expoPhase';

const NOON = new Date('2026-06-15T12:00:00Z');

/** days from the pinned "today", as an ISO string. */
const day = (offset: number, time = '10:00:00') => {
  const d = new Date(NOON);
  d.setUTCDate(d.getUTCDate() + offset);
  return `${d.toISOString().slice(0, 10)}T${time}Z`;
};

const expo = (start: number, end: number, status = 'published') =>
  ({ startDate: day(start), endDate: day(end), status }) as Parameters<typeof phaseOf>[0];

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOON);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('phaseOf', () => {
  it('is live on the first day', () => {
    expect(phaseOf(expo(0, 3))).toBe('live');
  });

  it('is live in the middle of the run', () => {
    expect(phaseOf(expo(-2, 2))).toBe('live');
  });

  it('is still live on the last day', () => {
    // the end date is clamped to 23:59:59, so an expo does not go "past"
    // at breakfast on the day it is still running.
    expect(phaseOf(expo(-3, 0))).toBe('live');
  });

  it('is past once the end date is behind us', () => {
    expect(phaseOf(expo(-5, -1))).toBe('past');
  });

  it('is upcoming the day before it opens', () => {
    expect(phaseOf(expo(1, 4))).toBe('upcoming');
  });

  describe('status overrides', () => {
    it('honours cancelled even during the run', () => {
      expect(phaseOf(expo(-1, 1, 'cancelled'))).toBe('cancelled');
    });

    it('honours cancelled for an expo that has not started', () => {
      expect(phaseOf(expo(10, 12, 'cancelled'))).toBe('cancelled');
    });

    it('honours an explicit ongoing even when the dates have passed', () => {
      expect(phaseOf(expo(-9, -5, 'ongoing'))).toBe('live');
    });

    it('reads a published expo inside its dates as live', () => {
      // the reason this module ignores `status` for the common case: nothing
      // flips an expo to `ongoing` automatically, so a published expo that is
      // physically open today must still read as live.
      expect(phaseOf(expo(-1, 1, 'published'))).toBe('live');
    });

    it('reads a draft inside its dates as live too', () => {
      expect(phaseOf(expo(-1, 1, 'draft'))).toBe('live');
    });
  });

  it('does not depend on the time of day', () => {
    const e = expo(0, 0);
    const atEachHour = new Set<string>();
    for (const hour of [0, 6, 12, 18, 23]) {
      vi.setSystemTime(new Date(`2026-06-15T${String(hour).padStart(2, '0')}:30:00Z`));
      atEachHour.add(phaseOf(e));
    }
    expect([...atEachHour]).toEqual(['live']);
  });
});

describe('isRunningNow', () => {
  it('is true only for live', () => {
    expect(isRunningNow(expo(-1, 1))).toBe(true);
    expect(isRunningNow(expo(1, 2))).toBe(false);
    expect(isRunningNow(expo(-4, -2))).toBe(false);
    expect(isRunningNow(expo(-1, 1, 'cancelled'))).toBe(false);
  });
});

describe('daysUntil', () => {
  it('is 0 for today, whatever the time on the date', () => {
    expect(daysUntil(day(0, '00:30:00'))).toBe(0);
    expect(daysUntil(day(0, '23:30:00'))).toBe(0);
  });

  it('is 1 for tomorrow and negative once past', () => {
    expect(daysUntil(day(1))).toBe(1);
    expect(daysUntil(day(-3))).toBe(-3);
  });

  it('gives the same answer at either end of the day', () => {
    const target = day(5);
    vi.setSystemTime(new Date('2026-06-15T00:01:00Z'));
    const early = daysUntil(target);
    vi.setSystemTime(new Date('2026-06-15T23:59:00Z'));
    expect(daysUntil(target)).toBe(early);
  });
});

describe('opensIn', () => {
  it('says open now for today and anything past', () => {
    expect(opensIn(day(0))).toBe('Open now');
    expect(opensIn(day(-4))).toBe('Open now');
  });

  it('singles out tomorrow', () => {
    expect(opensIn(day(1))).toBe('Opens tomorrow');
  });

  it('counts days below the two-week mark', () => {
    expect(opensIn(day(2))).toBe('Opens in 2 days');
    // 13 is the last day counted in days — the boundary the wording turns on.
    expect(opensIn(day(13))).toBe('Opens in 13 days');
  });

  it('switches to weeks at fourteen days', () => {
    expect(opensIn(day(14))).toBe('Opens in 2 weeks');
    expect(opensIn(day(21))).toBe('Opens in 3 weeks');
  });
});
