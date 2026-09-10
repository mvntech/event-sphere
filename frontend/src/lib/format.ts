/** Date, time and file-size formatting shared across the dashboards. */

const DATE: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };
const TIME: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' };

export function formatDate(value: string | Date | null | undefined) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString(undefined, DATE);
}

export function formatTime(value: string | Date | null | undefined) {
  if (!value) return '—';
  return new Date(value).toLocaleTimeString(undefined, TIME);
}

export function formatDateTime(value: string | Date | null | undefined) {
  if (!value) return '—';
  return `${formatDate(value)}, ${formatTime(value)}`;
}

/** "12 – 14 Mar 2026", collapsing the repeated month and year where possible. */
export function formatDateRange(start: string | Date, end: string | Date) {
  const from = new Date(start);
  const to = new Date(end);

  const sameDay = from.toDateString() === to.toDateString();
  if (sameDay) return formatDate(from);

  const sameYear = from.getFullYear() === to.getFullYear();
  const sameMonth = sameYear && from.getMonth() === to.getMonth();

  if (sameMonth) {
    return `${from.getDate()} – ${to.toLocaleDateString(undefined, DATE)}`;
  }
  if (sameYear) {
    return `${from.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} – ${to.toLocaleDateString(undefined, DATE)}`;
  }
  return `${formatDate(from)} – ${formatDate(to)}`;
}

/** day heading used to group a schedule, e.g. "Monday, 12 Mar". */
export function formatDayHeading(value: string | Date) {
  return new Date(value).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' });
}

/** stable key for grouping sessions by calendar day in local time. */
export function dayKey(value: string | Date) {
  const d = new Date(value);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/** converts an ISO timestamp to the value a `datetime-local` input expects. */
export function toDateTimeLocal(value: string | Date | null | undefined) {
  if (!value) return '';
  const d = new Date(value);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** same, for a plain `date` input. */
export function toDateInput(value: string | Date | null | undefined) {
  if (!value) return '';
  const d = new Date(value);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function formatBytes(bytes: number) {
  if (!bytes) return '0 KB';
  if (bytes < 1024 * 1024) return `${Math.max(Math.round(bytes / 1024), 1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** relative wording for recent activity, falling back to an absolute date. */
export function formatRelative(value: string | Date) {
  const diffMs = Date.now() - new Date(value).getTime();
  const minutes = Math.round(diffMs / 60000);

  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;

  return formatDate(value);
}
