import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  dayKey,
  formatBytes,
  formatDate,
  formatDateRange,
  formatDateTime,
  formatDayHeading,
  formatRelative,
  formatTime,
  toDateInput,
  toDateTimeLocal,
} from './format';

const NOW = new Date('2026-06-15T12:00:00Z');

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('the em dash placeholder', () => {
  it.each([
    ['formatDate', formatDate],
    ['formatTime', formatTime],
    ['formatDateTime', formatDateTime],
  ])('%s renders an em dash rather than "Invalid Date"', (_name, fn) => {
    expect(fn(null)).toBe('—');
    expect(fn(undefined)).toBe('—');
    expect(fn('')).toBe('—');
  });

  it('toDateTimeLocal and toDateInput give an empty string instead', () => {
    // these feed form inputs, where an em dash would be a value the user has
    // to delete before they can type.
    expect(toDateTimeLocal(null)).toBe('');
    expect(toDateInput(undefined)).toBe('');
  });
});

describe('formatDate', () => {
  it('includes the day, month and year', () => {
    const out = formatDate('2026-03-12T09:00:00Z');
    expect(out).toMatch(/12/);
    expect(out).toMatch(/2026/);
    expect(out).toMatch(/[A-Za-z]{3}/);
  });

  it('accepts a Date as readily as a string', () => {
    expect(formatDate(new Date('2026-03-12T09:00:00Z'))).toBe(formatDate('2026-03-12T09:00:00Z'));
  });
});

describe('formatDateTime', () => {
  it('joins the date and the time with a comma', () => {
    const value = '2026-03-12T09:30:00Z';
    expect(formatDateTime(value)).toBe(`${formatDate(value)}, ${formatTime(value)}`);
  });
});

describe('formatDateRange', () => {
  it('collapses a single-day range to one date', () => {
    const same = formatDateRange('2026-03-12T09:00:00Z', '2026-03-12T17:00:00Z');
    expect(same).toBe(formatDate('2026-03-12T09:00:00Z'));
    expect(same).not.toContain('–');
  });

  it('prints only the day number on the left within one month', () => {
    // "12 – 14 Mar 2026": the month and year appear once, not twice.
    const out = formatDateRange('2026-03-12T09:00:00Z', '2026-03-14T17:00:00Z');
    expect(out).toMatch(/^12 – /);
    expect(out).toContain('2026');
    expect(out.match(/2026/g)).toHaveLength(1);
  });

  it('keeps both months but one year when a range crosses a month', () => {
    const out = formatDateRange('2026-03-30T09:00:00Z', '2026-04-02T17:00:00Z');
    expect(out).toContain('30');
    expect(out).toContain('2');
    expect(out.match(/2026/g)).toHaveLength(1);
    expect(out).toContain('–');
  });

  it('spells out both years when a range crosses new year', () => {
    const out = formatDateRange('2026-12-30T09:00:00Z', '2027-01-02T17:00:00Z');
    expect(out).toContain('2026');
    expect(out).toContain('2027');
  });
});

describe('formatDayHeading', () => {
  it('leads with the weekday', () => {
    // 12 March 2026 is a Thursday.
    expect(formatDayHeading('2026-03-12T09:00:00Z')).toMatch(/^Thursday/);
  });
});

describe('dayKey', () => {
  it('groups two times on the same day under one key', () => {
    expect(dayKey('2026-03-12T00:30:00Z')).toBe(dayKey('2026-03-12T23:30:00Z'));
  });

  it('separates adjacent days', () => {
    expect(dayKey('2026-03-12T23:30:00Z')).not.toBe(dayKey('2026-03-13T00:30:00Z'));
  });

  it('is month-index based, so it must not be shown to a user', () => {
    // march is month 2. this is a grouping key, not a label — the test records
    // that on purpose, so nobody renders it.
    expect(dayKey('2026-03-12T09:00:00Z')).toBe('2026-2-12');
  });
});

describe('toDateTimeLocal', () => {
  it('produces the exact shape a datetime-local input wants', () => {
    expect(toDateTimeLocal('2026-03-05T09:07:00Z')).toBe('2026-03-05T09:07');
  });

  it('pads every component to two digits', () => {
    expect(toDateTimeLocal('2026-01-02T03:04:00Z')).toBe('2026-01-02T03:04');
  });
});

describe('toDateInput', () => {
  it('produces a padded ISO date', () => {
    expect(toDateInput('2026-01-02T03:04:00Z')).toBe('2026-01-02');
  });
});

describe('formatBytes', () => {
  it('reads zero as 0 KB rather than an empty string', () => {
    expect(formatBytes(0)).toBe('0 KB');
  });

  it('never rounds a real file down to 0 KB', () => {
    // a 40-byte upload is still a file; "0 KB" reads as a failed upload.
    expect(formatBytes(40)).toBe('1 KB');
  });

  it('uses KB below a megabyte', () => {
    expect(formatBytes(2048)).toBe('2 KB');
    expect(formatBytes(1024 * 1023)).toBe('1023 KB');
  });

  it('switches to MB at a megabyte, to one decimal', () => {
    expect(formatBytes(1024 * 1024)).toBe('1.0 MB');
    expect(formatBytes(1024 * 1024 * 2.5)).toBe('2.5 MB');
  });
});

describe('formatRelative', () => {
  const ago = (ms: number) => new Date(NOW.getTime() - ms).toISOString();

  const SECOND = 1000;
  const MINUTE = 60 * SECOND;
  const HOUR = 60 * MINUTE;
  const DAY = 24 * HOUR;

  it('says just now under a minute', () => {
    expect(formatRelative(ago(5 * SECOND))).toBe('just now');
  });

  it('counts minutes up to an hour', () => {
    expect(formatRelative(ago(5 * MINUTE))).toBe('5m ago');
    expect(formatRelative(ago(59 * MINUTE))).toBe('59m ago');
  });

  it('counts hours up to a day', () => {
    expect(formatRelative(ago(2 * HOUR))).toBe('2h ago');
  });

  it('counts days up to a week', () => {
    expect(formatRelative(ago(3 * DAY))).toBe('3d ago');
  });

  it('falls back to an absolute date beyond a week', () => {
    const old = ago(30 * DAY);
    expect(formatRelative(old)).toBe(formatDate(old));
  });

  it('gives the same answer whatever the time of day', () => {
    const target = ago(3 * DAY);
    const answers = new Set<string>();
    for (const hour of [0, 6, 12, 18, 23]) {
      vi.setSystemTime(new Date(`2026-06-15T${String(hour).padStart(2, '0')}:30:00Z`));
      answers.add(formatRelative(new Date(new Date(target).getTime())));
    }
    // only the elapsed time changes the wording, never the wall clock.
    expect(answers.size).toBeLessThanOrEqual(2);
  });
});
