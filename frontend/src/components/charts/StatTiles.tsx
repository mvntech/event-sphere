import type { AnalyticsDashboard } from '@/types';

interface Tile {
  label: string;
  value: string | number;
  hint?: string;
}

/**
 * headline figures above the charts — the numbers the DoD says must move.
 */
export function StatTiles({ data }: { data: AnalyticsDashboard }) {
  const tiles: Tile[] = [
    {
      label: 'Total interactions',
      value: data.totals.allEvents,
      hint: `across ${data.windowDays} days`,
    },
    { label: 'Unique visitors', value: data.totals.uniqueVisitors, hint: 'signed-in people' },
    {
      label: 'Booth views',
      value: data.totals.boothView,
      hint: `${data.booths.occupancy}% of booths taken`,
    },
    {
      label: 'Registrations',
      value: data.totals.registrations,
      hint: `${data.sessions.full} session${data.sessions.full === 1 ? '' : 's'} full`,
    },
    {
      label: 'Searches',
      value: data.totals.search,
      hint: data.topSearches[0] ? `top: “${data.topSearches[0].query}”` : 'none yet',
    },
    {
      label: 'Average rating',
      value: data.feedback.averageRating ?? '—',
      hint: `${data.feedback.total} feedback item${data.feedback.total === 1 ? '' : 's'}`,
    },
  ];

  return (
    <ul className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border shadow-sm sm:grid-cols-3 lg:grid-cols-6">
      {tiles.map((tile) => (
        <li key={tile.label} className="bg-card p-4">
          <p className="text-meta text-muted-foreground">{tile.label}</p>
          <p className="mt-1 font-mono text-stat leading-none">{tile.value}</p>
          {tile.hint && <p className="mt-1.5 truncate text-meta text-muted-foreground">{tile.hint}</p>}
        </li>
      ))}
    </ul>
  );
}
