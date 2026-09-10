import type { AnalyticsEventType } from '@/types';

/**
 * chart colours resolve through the design tokens, never hard-coded hex, so
 * the charts follow the light/dark toggle like everything else.
 */
export const CHART_COLORS = {
  primary: 'var(--color-primary)',
  secondary: 'var(--color-secondary)',
  muted: 'var(--color-muted-foreground)',
  // --accent is a quiet hover surface, not a plottable colour; charts that
  // want a second emphasis use `live` below.
  accent: 'var(--color-accent-foreground)',
  /** "happening now" — the only colour allowed to outrank primary in a chart. */
  live: 'var(--color-live)',
  destructive: 'var(--color-destructive)',
  warning: 'var(--color-warning)',
  border: 'var(--color-border)',
} as const;

/** one colour per event type, used consistently across every chart. */
export const SERIES_COLORS: Record<AnalyticsEventType, string> = {
  boothView: 'var(--color-primary)',
  sessionBookmark: 'var(--color-secondary)',
  profileView: 'var(--color-warning)',
  search: 'var(--color-muted-foreground)',
};

/** shared axis styling so every chart reads as one system. */
export const axisProps = {
  stroke: 'var(--color-muted-foreground)',
  fontSize: 11,
  tickLine: false,
  axisLine: false,
} as const;

export const gridProps = {
  stroke: 'var(--color-border)',
  strokeDasharray: '3 3',
  vertical: false,
} as const;

/** short axis label — "3 Sep" rather than the full ISO date. */
export const formatAxisDate = (iso: string) => {
  const date = new Date(`${iso}T00:00:00Z`);
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', timeZone: 'UTC' });
};

/** truncates a long label so bar charts stay readable. */
export const truncateLabel = (label: string, max = 18) =>
  label.length > max ? `${label.slice(0, max - 1)}…` : label;
