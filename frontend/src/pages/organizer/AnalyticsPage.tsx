import { useState } from 'react';
import { motion } from 'motion/react';
import { Building2, CalendarPlus, RefreshCw, Search, TriangleAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/EmptyState';
import { PageHeader } from '@/components/shared/PageHeader';
import { ExpoPicker } from '@/components/organizer/ExpoPicker';
import { AiSummaryPanel } from '@/components/ai/AiSummaryPanel';
import { BoothOccupancyChart } from '@/components/charts/BoothOccupancyChart';
import { BoothTrafficChart } from '@/components/charts/BoothTrafficChart';
import { EngagementChart } from '@/components/charts/EngagementChart';
import { SessionPopularityChart } from '@/components/charts/SessionPopularityChart';
import { StatTiles } from '@/components/charts/StatTiles';
import { useAnalyticsSummary } from '@/hooks/useAnalytics';
import { useExpos } from '@/hooks/useExpos';
import { ApiError } from '@/lib/api';
import { formatRelative } from '@/lib/format';
import { DURATION, EASE } from '@/lib/motion';

const WINDOWS = [
  { value: '7', label: 'Last 7 days' },
  { value: '14', label: 'Last 14 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
];

export default function AnalyticsPage() {
  const [expoId, setExpoId] = useState('');
  const [days, setDays] = useState('14');

  const expos = useExpos({ mine: true, limit: 50 });
  const summary = useAnalyticsSummary(expoId || undefined, Number(days));

  const hasExpos = (expos.data?.items.length ?? 0) > 0;
  const data = summary.data;

  return (
    <div className="mx-auto max-w-full space-y-8">
      <PageHeader
        title="Analytics"
        description="Engagement across your expo — what attendees looked at, booked and searched for."
        actions={
          data ? (
            <div className="flex items-center gap-2">
              <span className="hidden text-meta text-muted-foreground sm:inline">
                Updated {formatRelative(data.generatedAt)}
              </span>
              <Button variant="outline" size="sm" onClick={() => summary.refetch()} loading={summary.isFetching}>
                <RefreshCw className="size-4" aria-hidden="true" />
                Refresh
              </Button>
            </div>
          ) : undefined
        }
      />

      {!expos.isPending && !hasExpos && (
        <EmptyState
          icon={CalendarPlus}
          title="Create an expo first"
          description="Once you are running an event there will be engagement here to read."
        />
      )}

      {hasExpos && (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <ExpoPicker value={expoId} onChange={setExpoId} />

          <div className="grid w-full gap-2 sm:w-48">
            <Label htmlFor="analytics-window">Period</Label>
            <Select value={days} onValueChange={setDays}>
              <SelectTrigger id="analytics-window">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WINDOWS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {expoId && summary.isPending && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-80 w-full rounded-xl" />
          <div className="grid gap-4 lg:grid-cols-2">
            <Skeleton className="h-72 w-full rounded-xl" />
            <Skeleton className="h-72 w-full rounded-xl" />
          </div>
        </div>
      )}

      {summary.isError && (
        <Card className="border-destructive/40">
          <CardContent className="flex flex-col items-start gap-3 p-6">
            <p className="flex items-center gap-2 font-medium text-destructive">
              <TriangleAlert className="size-4" aria-hidden="true" />
              {summary.error instanceof ApiError ? summary.error.message : 'Could not load analytics'}
            </p>
            <Button variant="outline" size="sm" onClick={() => summary.refetch()}>
              Try again
            </Button>
          </CardContent>
        </Card>
      )}

      {data && !summary.isPending && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: DURATION.panel, ease: EASE }}
          className="space-y-6"
        >
          <StatTiles data={data} />

          <EngagementChart data={data.engagement} days={data.windowDays} />

          <div className="grid gap-4 lg:grid-cols-2">
            <BoothTrafficChart data={data.boothTraffic} />
            <SessionPopularityChart data={data.sessionPopularity} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <BoothOccupancyChart booths={data.booths} />

            <Card className="flex flex-col">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-item">
                  <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  What people searched for
                </CardTitle>
                <CardDescription className="mt-1">The terms attendees actually typed</CardDescription>
              </CardHeader>

              <CardContent className="flex-1 pt-0">
                {data.topSearches.length === 0 ? (
                  <div className="flex h-55 items-center justify-center rounded-lg border border-dashed border-border text-center">
                    <p className="max-w-xs px-6 text-body text-muted-foreground">
                      No searches yet. They are recorded when an attendee searches the exhibitor directory.
                    </p>
                  </div>
                ) : (
                  <ol className="space-y-2">
                    {data.topSearches.map((row, index) => (
                      <li
                        key={row.query}
                        className="flex items-center gap-3 rounded-lg border border-border px-3.5 py-2.5"
                      >
                        <span className="font-mono text-meta text-muted-foreground">{index + 1}</span>
                        <span className="min-w-0 flex-1 truncate text-body">{row.query}</span>
                        <Badge variant="muted" className="shrink-0 font-mono">
                          {row.count}
                        </Badge>
                      </li>
                    ))}
                  </ol>
                )}
              </CardContent>
            </Card>
          </div>

          {data.exhibitorViews.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-item">
                  <Building2 className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  Most viewed exhibitors
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <ol className="grid gap-2 sm:grid-cols-2">
                  {data.exhibitorViews.map((row, index) => (
                    <li key={row.id} className="flex items-center gap-3 rounded-lg border border-border px-3.5 py-2.5">
                      <span className="font-mono text-meta text-muted-foreground">{index + 1}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-body font-medium">{row.companyName}</span>
                        <span className="block truncate text-meta text-muted-foreground">{row.category}</span>
                      </span>
                      <Badge variant="muted" className="shrink-0 font-mono">
                        {row.views}
                      </Badge>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          )}

          <AiSummaryPanel key={expoId} expoId={expoId} />
        </motion.div>
      )}
    </div>
  );
}
