import { LayoutGrid } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ChartFrame } from '@/components/charts/ChartFrame';
import { ChartTooltip } from '@/components/charts/ChartTooltip';
import { axisProps, CHART_COLORS, gridProps } from '@/components/charts/chartTheme';
import type { BoothTrafficRow } from '@/types';

export function BoothTrafficChart({ data }: { data: BoothTrafficRow[] }) {
  const rows = data.slice(0, 10);
  // each bar needs vertical room, so the plot grows with the number of booths.
  const height = Math.max(220, rows.length * 34 + 60);

  return (
    <ChartFrame
      title="Booth traffic"
      description="Views per booth, busiest first"
      icon={LayoutGrid}
      isEmpty={rows.length === 0}
      emptyMessage="No booth views yet. They are recorded when someone opens a booth on the floor plan."
      height={height}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 4 }}>
          <CartesianGrid {...gridProps} horizontal={false} vertical />
          <XAxis type="number" allowDecimals={false} {...axisProps} />
          <YAxis type="category" dataKey="label" width={56} {...axisProps} />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--color-muted)' }} />
          <Legend iconType="circle" wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />

          <Bar dataKey="views" name="Views" fill={CHART_COLORS.primary} radius={[0, 4, 4, 0]} />
          {/* distinct people, so a booth refreshed ten times by one person is obvious. */}
          <Bar dataKey="visitors" name="Distinct visitors" fill={CHART_COLORS.secondary} radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}
