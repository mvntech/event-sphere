import { PieChart as PieIcon } from 'lucide-react';
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { ChartFrame } from '@/components/charts/ChartFrame';
import { ChartTooltip } from '@/components/charts/ChartTooltip';
import { CHART_COLORS } from '@/components/charts/chartTheme';
import type { AnalyticsDashboard } from '@/types';

/** booth allocation at a glance — how much of the hall is actually taken. */
export function BoothOccupancyChart({ booths }: { booths: AnalyticsDashboard['booths'] }) {
  const slices = [
    { name: 'Available', value: booths.available, color: CHART_COLORS.primary },
    { name: 'Reserved', value: booths.reserved, color: CHART_COLORS.warning },
    { name: 'Assigned', value: booths.assigned, color: CHART_COLORS.secondary },
  ].filter((slice) => slice.value > 0);

  return (
    <ChartFrame
      title="Booth allocation"
      description={`${booths.occupancy}% of ${booths.total} booths taken`}
      icon={PieIcon}
      isEmpty={booths.total === 0}
      emptyMessage="No booths on the floor plan yet. Lay some out in the floor plan builder."
      height={260}
    >
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={slices}
            dataKey="value"
            nameKey="name"
            innerRadius="55%"
            outerRadius="80%"
            paddingAngle={2}
            strokeWidth={0}
          >
            {slices.map((slice) => (
              <Cell key={slice.name} fill={slice.color} />
            ))}
          </Pie>
          <Tooltip content={<ChartTooltip unit="booths" />} />
          <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
        </PieChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}
