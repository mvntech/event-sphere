import { Activity } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ChartFrame } from '@/components/charts/ChartFrame';
import { ChartTooltip } from '@/components/charts/ChartTooltip';
import { axisProps, formatAxisDate, gridProps, SERIES_COLORS } from '@/components/charts/chartTheme';
import { EVENT_TYPE_LABELS, type AnalyticsEventType, type EngagementPoint } from '@/types';

const SERIES: AnalyticsEventType[] = ['boothView', 'profileView', 'sessionBookmark', 'search'];

/** stacked engagement over time, split by the kind of interaction. */
export function EngagementChart({ data, days }: { data: EngagementPoint[]; days: number }) {
  const hasActivity = data.some((point) => point.total > 0);

  // with a long window, thin the ticks so labels do not collide.
  const tickInterval = data.length > 30 ? 6 : data.length > 14 ? 2 : 0;

  return (
    <ChartFrame
      title="Engagement over time"
      description={`Interactions per day across the last ${days} days`}
      icon={Activity}
      isEmpty={!hasActivity}
      emptyMessage="Nothing yet. Once attendees browse booths, bookmark sessions or search, their activity charts here."
      height={280}
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
          <defs>
            {SERIES.map((key) => (
              <linearGradient key={key} id={`fill-${key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={SERIES_COLORS[key]} stopOpacity={0.5} />
                <stop offset="100%" stopColor={SERIES_COLORS[key]} stopOpacity={0.05} />
              </linearGradient>
            ))}
          </defs>

          <CartesianGrid {...gridProps} />
          <XAxis dataKey="date" tickFormatter={formatAxisDate} interval={tickInterval} {...axisProps} />
          <YAxis allowDecimals={false} width={44} {...axisProps} />
          <Tooltip content={<ChartTooltip dateLabel />} cursor={{ stroke: 'var(--color-border)' }} />
          <Legend iconType="circle" wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />

          {SERIES.map((key) => (
            <Area
              key={key}
              type="monotone"
              dataKey={key}
              name={EVENT_TYPE_LABELS[key]}
              stackId="engagement"
              stroke={SERIES_COLORS[key]}
              fill={`url(#fill-${key})`}
              strokeWidth={2}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}
