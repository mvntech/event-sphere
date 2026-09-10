import { CalendarClock } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ChartFrame } from '@/components/charts/ChartFrame';
import { ChartTooltip } from '@/components/charts/ChartTooltip';
import { axisProps, CHART_COLORS, gridProps, truncateLabel } from '@/components/charts/chartTheme';
import type { SessionPopularityRow } from '@/types';

/** registrations against bookmarks, so intent and commitment sit side by side. */
export function SessionPopularityChart({ data }: { data: SessionPopularityRow[] }) {
  const rows = data.slice(0, 10);
  const height = Math.max(220, rows.length * 34 + 60);

  const hasInterest = rows.some((row) => row.registrations > 0 || row.bookmarks > 0);

  return (
    <ChartFrame
      title="Session popularity"
      description="Registrations and bookmarks per session"
      icon={CalendarClock}
      isEmpty={rows.length === 0 || !hasInterest}
      emptyMessage={
        rows.length === 0
          ? 'No sessions scheduled yet.'
          : 'Sessions are scheduled, but nobody has registered or bookmarked one yet.'
      }
      height={height}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 4 }}>
          <CartesianGrid {...gridProps} horizontal={false} vertical />
          <XAxis type="number" allowDecimals={false} {...axisProps} />
          <YAxis
            type="category"
            dataKey="title"
            width={130}
            tickFormatter={(value: string) => truncateLabel(value, 18)}
            {...axisProps}
          />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--color-muted)' }} />
          <Legend iconType="circle" wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />

          <Bar dataKey="registrations" name="Registrations" fill={CHART_COLORS.primary} radius={[0, 4, 4, 0]} />
          <Bar dataKey="bookmarks" name="Bookmarks" fill={CHART_COLORS.warning} radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}
