import { formatAxisDate } from '@/components/charts/chartTheme';

/** one series' entry in the hovered point. */
interface TooltipEntry {
  dataKey?: string | number;
  name?: string | number;
  value?: number | string;
  color?: string;
}

interface Props {
  /** recharts injects these; they are optional because it renders us unmounted too. */
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string | number;
  /** treat the label as an ISO date and format it. */
  dateLabel?: boolean;
  /** word appended to each value, e.g. "views". */
  unit?: string;
}

/**
 * tooltip skinned to the design tokens — recharts' default is a white box that
 * disappears in dark mode.
 *
 * props are declared here rather than pulled from `TooltipProps`, whose generic
 * shape changed in recharts 3 and no longer describes what is injected.
 */
export function ChartTooltip({ active, payload, label, dateLabel, unit }: Props) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-popover-foreground shadow-lg">
      <p className="text-meta font-medium">{dateLabel ? formatAxisDate(String(label)) : label}</p>

      <ul className="mt-1.5 space-y-0.5">
        {payload.map((entry) => (
          <li key={String(entry.dataKey ?? entry.name)} className="flex items-center gap-2 text-meta">
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: entry.color }}
              aria-hidden="true"
            />
            <span className="text-muted-foreground">{entry.name}</span>
            <span className="ml-auto font-mono font-medium">
              {entry.value}
              {unit ? ` ${unit}` : ''}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
