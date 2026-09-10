import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'motion/react';
import { CalendarDays, MapPin, Search, Tag, TriangleAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/EmptyState';
import { PageHeader } from '@/components/shared/PageHeader';
import { useExpos } from '@/hooks/useExpos';
import { DURATION, EASE } from '@/lib/motion';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { ApiError } from '@/lib/api';
import { formatDateRange } from '@/lib/format';
import { EXPO_STATUS_LABELS, EXPO_STATUS_VARIANTS } from '@/types';

export default function AttendeeExposPage() {
  const [search, setSearch] = useState('');
  const reduceMotion = useReducedMotion();
  const debounced = useDebouncedValue(search, 300);

  const { data, isPending, isError, error, refetch } = useExpos({
    limit: 50,
    ...(debounced ? { search: debounced } : {}),
  });

  const expos = data?.items ?? [];

  return (
    <div className="mx-auto max-w-full space-y-8">
      <PageHeader
        title="Browse expos"
        description="Find an event, then explore its schedule, exhibitors and floor plan."
      />

      <div className="relative max-w-md">
        <Search
          className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search expos by name, theme or location"
          aria-label="Search expos"
          className="pl-10"
        />
      </div>

      {isPending && (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-56 w-full rounded-xl" />
          ))}
        </div>
      )}

      {isError && !data && (
        <Card className="border-destructive/40">
          <CardContent className="flex flex-col items-start gap-3 p-6">
            <p className="flex items-center gap-2 font-medium text-destructive">
              <TriangleAlert className="size-4" aria-hidden="true" />
              {error instanceof ApiError ? error.message : 'Could not load expos'}
            </p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Try again
            </Button>
          </CardContent>
        </Card>
      )}

      {!isPending && !isError && expos.length === 0 && (
        <EmptyState
          icon={CalendarDays}
          title={debounced ? `No expos match “${debounced}”` : 'No expos published yet'}
          description={
            debounced
              ? 'Try a different word, or clear the search to see everything.'
              : 'Once an organizer publishes an event, it will show up here.'
          }
          action={
            debounced ? (
              <Button variant="outline" onClick={() => setSearch('')}>
                Clear search
              </Button>
            ) : undefined
          }
        />
      )}

      {expos.length > 0 && (
        <motion.div
          key={debounced}
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: DURATION.panel, ease: EASE }}
          className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
        >
          {expos.map((expo) => (
            <div key={expo.id}>
              <Card className="flex h-full flex-col shadow-xs transition-colors hover:border-primary/40 hover:bg-accent">
                <CardHeader className="pb-4">
                  <div className="flex items-start justify-between gap-3">
                    <CardTitle className="text-balance">{expo.title}</CardTitle>
                    <Badge variant={EXPO_STATUS_VARIANTS[expo.status]} className="shrink-0">
                      {EXPO_STATUS_LABELS[expo.status]}
                    </Badge>
                  </div>
                  <p className="line-clamp-3 text-body text-muted-foreground">{expo.description}</p>
                </CardHeader>

                <CardContent className="mt-auto space-y-4 pt-0">
                  <dl className="space-y-2 text-body">
                    <div className="flex items-center gap-2.5">
                      <CalendarDays className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                      <dt className="sr-only">Dates</dt>
                      <dd>{formatDateRange(expo.startDate, expo.endDate)}</dd>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <MapPin className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                      <dt className="sr-only">Location</dt>
                      <dd className="truncate">{expo.location}</dd>
                    </div>
                    {expo.theme && (
                      <div className="flex items-center gap-2.5">
                        <Tag className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                        <dt className="sr-only">Theme</dt>
                        <dd className="truncate">{expo.theme}</dd>
                      </div>
                    )}
                  </dl>

                  <Button asChild className="w-full">
                    <Link to={`/attendee/expos/${expo.id}`}>View expo</Link>
                  </Button>
                </CardContent>
              </Card>
            </div>
          ))}
        </motion.div>
      )}
    </div>
  );
}
