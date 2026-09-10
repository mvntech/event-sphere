import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion, useReducedMotion } from 'motion/react';
import { Building2, Search, TriangleAlert, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/EmptyState';
import { PageHeader } from '@/components/shared/PageHeader';
import { useExhibitors } from '@/hooks/useExhibitors';
import { useExpos } from '@/hooks/useExpos';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { ApiError } from '@/lib/api';
import { DURATION, EASE } from '@/lib/motion';
import { cn } from '@/lib/utils';

const initials = (name: string) =>
  name
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

export default function ExhibitorDirectoryPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const reduceMotion = useReducedMotion();
  const [expoId, setExpoId] = useState(searchParams.get('expo') ?? '');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');

  const debounced = useDebouncedValue(search, 300);

  const expos = useExpos({ limit: 50 });
  const expoOptions = expos.data?.items ?? [];

  useEffect(() => {
    if (expoOptions.length === 0) return;

    const known = expoOptions.some((expo) => expo.id === expoId);
    if (expoId && known) return;

    setExpoId(expoOptions[0].id);

    if (expoId && !known) {
      const params = new URLSearchParams(searchParams);
      params.set('expo', expoOptions[0].id);
      setSearchParams(params, { replace: true });
    }
  }, [expoId, expoOptions, searchParams, setSearchParams]);

  const { data, isPending, isError, error, refetch } = useExhibitors({
    ...(expoId ? { expoRef: expoId } : {}),
    ...(debounced ? { search: debounced } : {}),
    ...(category ? { category } : {}),
    limit: 50,
  });

  const exhibitors = data?.items ?? [];
  const total = data?.pagination?.total ?? exhibitors.length;
  const truncated = total > exhibitors.length;

  const categories = useMemo(() => {
    const set = new Set(exhibitors.map((e) => e.category).filter(Boolean));
    return [...set].sort();
  }, [exhibitors]);

  const chooseExpo = (next: string) => {
    setExpoId(next);
    setCategory('');
    const params = new URLSearchParams(searchParams);
    params.set('expo', next);
    setSearchParams(params, { replace: true });
  };

  const hasFilters = Boolean(debounced || category);

  return (
    <div className="mx-auto max-w-full space-y-8">
      <PageHeader
        title="Exhibitor directory"
        description="Search by company, category or the products they are showing."
      />

      <div className="flex flex-col gap-4">
        {expoOptions.length > 0 && (
          <div className="grid w-full gap-2 sm:w-80">
            <Label htmlFor="directory-expo">Expo</Label>
            <Select value={expoId} onValueChange={chooseExpo}>
              <SelectTrigger id="directory-expo">
                <SelectValue placeholder="Choose an expo" />
              </SelectTrigger>
              <SelectContent>
                {expoOptions.map((expo) => (
                  <SelectItem key={expo.id} value={expo.id}>
                    {expo.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="relative max-w-md">
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Try a company, a category, or a product"
            aria-label="Search exhibitors"
            className="pl-10"
          />
        </div>

        {categories.length > 1 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-meta text-muted-foreground">Category:</span>
            {categories.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setCategory(category === value ? '' : value)}
                aria-pressed={category === value}
                className={cn(
                  'rounded-full border px-3 py-1 text-meta transition-colors',
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                  category === value
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                )}
              >
                {value}
              </button>
            ))}
          </div>
        )}

        {(hasFilters || truncated) && (
          <div className="flex items-center gap-2 text-body text-muted-foreground">
            <span>
              {hasFilters ? (
                <>
                  {exhibitors.length} result{exhibitors.length === 1 ? '' : 's'}
                  {debounced && ` for “${debounced}”`}
                </>
              ) : (
                <>
                  Showing {exhibitors.length} of {total} exhibitors
                </>
              )}
              {truncated && hasFilters && ` of ${total}`}
              {truncated && ' — search or pick a category to narrow it down'}
            </span>

            {hasFilters && (
              <Button
                variant="ghost"
                size="sm"
                className="h-auto px-2 py-1 text-meta"
                onClick={() => {
                  setSearch('');
                  setCategory('');
                }}
              >
                <X className="size-3.5" aria-hidden="true" />
                Clear
              </Button>
            )}
          </div>
        )}
      </div>

      {isPending && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-44 w-full rounded-xl" />
          ))}
        </div>
      )}

      {isError && !data && (
        <Card className="border-destructive/40">
          <CardContent className="flex flex-col items-start gap-3 p-6">
            <p className="flex items-center gap-2 text-body font-medium text-destructive">
              <TriangleAlert className="size-4" aria-hidden="true" />
              {error instanceof ApiError ? error.message : 'Could not load the directory'}
            </p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Try again
            </Button>
          </CardContent>
        </Card>
      )}

      {!isPending && !isError && exhibitors.length === 0 && (
        <EmptyState
          icon={Building2}
          title={hasFilters ? 'Nothing matches those filters' : 'No exhibitors yet'}
          description={
            hasFilters
              ? 'Try a different word, or clear the filters to see everyone.'
              : 'Exhibitors appear here once an organizer approves their application.'
          }
          action={
            hasFilters ? (
              <Button
                variant="outline"
                onClick={() => {
                  setSearch('');
                  setCategory('');
                }}
              >
                Clear filters
              </Button>
            ) : undefined
          }
        />
      )}

      {exhibitors.length > 0 && (
        <motion.ul
          key={`${expoId}|${debounced}|${category}`}
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: DURATION.panel, ease: EASE }}
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {exhibitors.map((profile) => (
            <li key={profile.id} className="flex">
              <Link
                to={`/attendee/exhibitors/${profile.id}`}
                className={cn(
                  'group flex w-full flex-col gap-3 rounded-xl border border-border bg-card p-5 shadow-xs',
                  'transition-colors hover:border-primary/40 hover:bg-accent',
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring'
                )}
              >
                <div className="flex items-start gap-3">
                  {profile.logoUrl ? (
                    <img
                      src={profile.logoUrl}
                      alt=""
                      className="size-11 shrink-0 rounded-lg border border-border object-contain"
                    />
                  ) : (
                    <span
                      aria-hidden="true"
                      className="grid size-11 shrink-0 place-items-center rounded-lg border border-border font-mono text-meta text-muted-foreground"
                    >
                      {initials(profile.companyName)}
                    </span>
                  )}

                  <div className="min-w-0">
                    <h3 className="truncate text-item">{profile.companyName}</h3>
                    {profile.category && (
                      <p className="mt-0.5 text-meta text-muted-foreground">{profile.category}</p>
                    )}
                  </div>
                </div>

                <p className="line-clamp-3 text-body text-muted-foreground">{profile.description}</p>

                {profile.products.length > 0 && (
                  <p className="mt-auto line-clamp-1 text-meta text-muted-foreground">
                    Showing {profile.products.map((product) => product.name).join(', ')}
                  </p>
                )}
              </Link>
            </li>
          ))}
        </motion.ul>
      )}

    </div>
  );
}
