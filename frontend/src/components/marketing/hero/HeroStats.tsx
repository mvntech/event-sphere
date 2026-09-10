import { usePublicStats } from '@/hooks/useStats';

const formatCount = (n: number) => new Intl.NumberFormat('en-US').format(n);

const STATS = [
  { key: 'expos', label: 'Expos published' },
  { key: 'exhibitors', label: 'Companies exhibiting' },
  { key: 'attendees', label: 'Attendees registered' },
] as const;

export function HeroStats() {
  const { data } = usePublicStats();

  return (
    <dl className="flex flex-wrap gap-x-8 gap-y-4">
      {STATS.map((stat) => (
        <div key={stat.key}>
          <dd className="text-stat leading-none tabular-nums">
            {data ? (
              formatCount(data[stat.key])
            ) : (
              <span aria-hidden="true" className="text-muted-foreground">
                &mdash;
              </span>
            )}
          </dd>
          <dt className="mt-1.5 text-body text-muted-foreground">{stat.label}</dt>
        </div>
      ))}
    </dl>
  );
}
