import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Building2, CalendarClock, Clock, MapPin, Mic, Search, Sparkles, Wand2 } from 'lucide-react';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { EmptyState } from '@/components/shared/EmptyState';
import { PageHeader } from '@/components/shared/PageHeader';
import { AiSourceNotice } from '@/components/ai/AiSourceNotice';
import { useAiMatch, useAiSchedule, useAiSearch } from '@/hooks/useAi';
import { useExpos } from '@/hooks/useExpos';
import { ApiError } from '@/lib/api';
import { formatDayHeading, formatTime } from '@/lib/format';

const initials = (name: string) =>
  name
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

export default function AiAssistantPage() {
  const [expoId, setExpoId] = useState('');
  const [interests, setInterests] = useState('');
  const [query, setQuery] = useState('');

  const expos = useExpos({ limit: 50 });
  const options = expos.data?.items ?? [];

  useEffect(() => {
    if (!expoId && options.length > 0) setExpoId(options[0].id);
  }, [expoId, options]);

  const schedule = useAiSchedule();
  const match = useAiMatch();
  const search = useAiSearch();

  const fail = (error: unknown, fallback: string) =>
    toast.error(error instanceof ApiError ? error.message : fallback);

  const buildItinerary = () => {
    if (!expoId || interests.trim().length < 3) return;
    schedule.mutate({ expoRef: expoId, interests: interests.trim() }, { onError: (e) => fail(e, 'Could not build an itinerary') });
  };

  const recommend = () => {
    if (!expoId || interests.trim().length < 3) return;
    match.mutate({ expoRef: expoId, interests: interests.trim() }, { onError: (e) => fail(e, 'Could not fetch recommendations') });
  };

  const runSearch = (event: React.FormEvent) => {
    event.preventDefault();
    if (!expoId || query.trim().length < 3) return;
    search.mutate({ expoRef: expoId, query: query.trim() }, { onError: (e) => fail(e, 'Could not run that search') });
  };

  return (
    <div className="mx-auto max-w-full space-y-8">
      <PageHeader
        title="AI assistant"
        description="Describe what you care about and it will plan your day, suggest exhibitors, or find stands from a plain-English question."
      />

      {options.length > 0 && (
        <div className="grid w-full gap-2 sm:w-80">
          <Label htmlFor="ai-expo">Expo</Label>
          <Select value={expoId} onValueChange={setExpoId}>
            <SelectTrigger id="ai-expo">
              <SelectValue placeholder="Choose an expo" />
            </SelectTrigger>
            <SelectContent>
              {options.map((expo) => (
                <SelectItem key={expo.id} value={expo.id}>
                  {expo.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {!expos.isPending && options.length === 0 && (
        <EmptyState
          icon={CalendarClock}
          title="No expos published yet"
          description="Once an organizer publishes an event, the assistant can plan your day around it."
        />
      )}

      {expoId && (
        <Tabs defaultValue="plan">
          <TabsList>
            <TabsTrigger value="plan">
              <CalendarClock className="size-4" aria-hidden="true" />
              Plan my day
            </TabsTrigger>
            <TabsTrigger value="recommend">
              <Sparkles className="size-4" aria-hidden="true" />
              Who to visit
            </TabsTrigger>
            <TabsTrigger value="search">
              <Search className="size-4" aria-hidden="true" />
              Smart search
            </TabsTrigger>
          </TabsList>

          {/* itinerary */}
          <TabsContent value="plan" className="space-y-5">
            <Card>
              <CardHeader>
                <CardTitle>Build me an itinerary</CardTitle>
                <CardDescription>
                  Tell it what you are interested in. It picks sessions that fit and never double-books you.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="ai-interests">Your interests</Label>
                  <Textarea
                    id="ai-interests"
                    value={interests}
                    onChange={(e) => setInterests(e.target.value)}
                    rows={3}
                    maxLength={500}
                    placeholder="Warehouse robotics, sustainable packaging, and anything on accessible design."
                  />
                </div>
                <Button onClick={buildItinerary} loading={schedule.isPending} disabled={interests.trim().length < 3}>
                  <Wand2 className="size-4" aria-hidden="true" />
                  Plan my day
                </Button>
              </CardContent>
            </Card>

            {schedule.isPending && (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-24 w-full rounded-xl" />
                ))}
              </div>
            )}

            <AnimatePresence>
              {schedule.data && !schedule.isPending && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-4"
                >
                  <AiSourceNotice
                    source={schedule.data.source}
                    reason={schedule.data.reason}
                    fallbackMethod="keyword matching against the schedule"
                  />

                  {schedule.data.summary && (
                    <p className="rounded-lg bg-accent px-4 py-3 text-body text-accent-foreground">
                      {schedule.data.summary}
                    </p>
                  )}

                  {schedule.data.itinerary.length === 0 ? (
                    <EmptyState
                      icon={Clock}
                      title="Nothing matched those interests"
                      description="Try describing what you are after a little differently."
                    />
                  ) : (
                    <ol className="space-y-3">
                      {schedule.data.itinerary.map((item, index) => (
                        <motion.li
                          key={item.sessionId}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: Math.min(index * 0.06, 0.3) }}
                        >
                          <Card>
                            <CardContent className="flex flex-col gap-4 p-5 sm:flex-row">
                              <div className="flex shrink-0 flex-col rounded-lg bg-accent px-3.5 py-2.5 text-accent-foreground sm:w-36">
                                <span className="text-meta font-medium text-muted-foreground">
                                  {formatDayHeading(item.session.startTime)}
                                </span>
                                <span className="font-mono text-body font-semibold">
                                  {formatTime(item.session.startTime)}
                                </span>
                                <span className="font-mono text-meta text-muted-foreground">
                                  to {formatTime(item.session.endTime)}
                                </span>
                              </div>

                              <div className="min-w-0 flex-1">
                                <h3 className="font-semibold leading-tight">{item.session.title}</h3>
                                <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5 text-body text-muted-foreground">
                                  <div className="flex items-center gap-1.5">
                                    <Mic className="size-3.5 shrink-0" aria-hidden="true" />
                                    <dt className="sr-only">Speaker</dt>
                                    <dd>{item.session.speaker}</dd>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
                                    <dt className="sr-only">Location</dt>
                                    <dd>{item.session.location}</dd>
                                  </div>
                                </dl>
                                <p className="mt-2.5 border-l-2 border-border pl-3 text-body italic text-muted-foreground">
                                  {item.reason}
                                </p>
                              </div>
                            </CardContent>
                          </Card>
                        </motion.li>
                      ))}
                    </ol>
                  )}

                  <Button asChild variant="outline" size="sm">
                    <Link to={`/attendee/expos/${expoId}`}>Bookmark these on the schedule</Link>
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </TabsContent>

          {/* recommendations */}
          <TabsContent value="recommend" className="space-y-5">
            <Card>
              <CardHeader>
                <CardTitle>Who should I visit?</CardTitle>
                <CardDescription>Ranked exhibitors based on what you are interested in.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="ai-match-interests">Your interests</Label>
                  <Textarea
                    id="ai-match-interests"
                    value={interests}
                    onChange={(e) => setInterests(e.target.value)}
                    rows={3}
                    maxLength={500}
                    placeholder="I run a mid-size warehouse and want to cut picking time."
                  />
                </div>
                <Button onClick={recommend} loading={match.isPending} disabled={interests.trim().length < 3}>
                  <Sparkles className="size-4" aria-hidden="true" />
                  Recommend exhibitors
                </Button>
              </CardContent>
            </Card>

            {match.isPending && (
              <div className="grid gap-4 sm:grid-cols-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-40 w-full rounded-xl" />
                ))}
              </div>
            )}

            {match.data && !match.isPending && (
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                <AiSourceNotice
                  source={match.data.source}
                  reason={match.data.reason}
                  fallbackMethod="keyword matching across exhibitor profiles"
                />

                {match.data.matches.length === 0 ? (
                  <EmptyState
                    icon={Building2}
                    title="No strong matches"
                    description="Nothing in this directory lines up with that. Try describing your interests differently."
                  />
                ) : (
                  <ul className="grid gap-4 sm:grid-cols-2">
                    {match.data.matches.map((m, index) => (
                      <motion.li
                        key={m.exhibitorId}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: Math.min(index * 0.05, 0.3) }}
                      >
                        <Card className="flex h-full flex-col">
                          <CardContent className="flex flex-1 flex-col gap-3 p-5">
                            <div className="flex items-start gap-3">
                              <Avatar className="size-10 shrink-0 rounded-lg">
                                {m.exhibitor.logoUrl && <AvatarImage src={m.exhibitor.logoUrl} alt="" />}
                                <AvatarFallback className="rounded-lg">
                                  {initials(m.exhibitor.companyName)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0 flex-1">
                                <h3 className="truncate font-semibold leading-tight">{m.exhibitor.companyName}</h3>
                                <Badge variant="outline" className="mt-1">
                                  {m.exhibitor.category}
                                </Badge>
                              </div>
                              <Badge variant="muted" className="shrink-0 font-mono">
                                {Math.round(m.score)}
                              </Badge>
                            </div>

                            <p className="border-l-2 border-border pl-3 text-body italic text-muted-foreground">
                              {m.reason}
                            </p>

                            <Button asChild variant="outline" size="sm" className="mt-auto w-full">
                              <Link to={`/attendee/exhibitors/${m.exhibitor.id}`}>View profile</Link>
                            </Button>
                          </CardContent>
                        </Card>
                      </motion.li>
                    ))}
                  </ul>
                )}
              </motion.div>
            )}
          </TabsContent>

          {/* semantic search */}
          <TabsContent value="search" className="space-y-5">
            <Card>
              <CardHeader>
                <CardTitle>Ask in your own words</CardTitle>
                <CardDescription>
                  Try “someone who can automate my warehouse” — it matches meaning, not just wording.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={runSearch} className="flex flex-col gap-3 sm:flex-row">
                  <div className="relative flex-1">
                    <Search
                      className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <Input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Someone who can help me cut packaging waste"
                      aria-label="Describe what you are looking for"
                      maxLength={300}
                      className="pl-10"
                    />
                  </div>
                  <Button type="submit" loading={search.isPending} disabled={query.trim().length < 3}>
                    Search
                  </Button>
                </form>
              </CardContent>
            </Card>

            {search.isPending && (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-24 w-full rounded-xl" />
                ))}
              </div>
            )}

            {search.data && !search.isPending && (
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                <AiSourceNotice
                  source={search.data.source}
                  reason={search.data.reason}
                  fallbackMethod="the ordinary keyword search"
                />

                {search.data.interpretation && (
                  <p className="text-body text-muted-foreground">
                    <span className="font-medium">Understood as:</span> {search.data.interpretation}
                  </p>
                )}

                {search.data.results.length === 0 ? (
                  <EmptyState
                    icon={Search}
                    title="Nothing matched"
                    description="No exhibitor at this expo fits that description. Try asking a different way."
                  />
                ) : (
                  <ul className="space-y-3">
                    {search.data.results.map((result, index) => (
                      <motion.li
                        key={result.exhibitorId}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: Math.min(index * 0.05, 0.3) }}
                      >
                        <Card>
                          <CardContent className="flex items-start gap-4 p-5">
                            <Avatar className="size-10 shrink-0 rounded-lg">
                              {result.exhibitor.logoUrl && <AvatarImage src={result.exhibitor.logoUrl} alt="" />}
                              <AvatarFallback className="rounded-lg">
                                {initials(result.exhibitor.companyName)}
                              </AvatarFallback>
                            </Avatar>

                            <div className="min-w-0 flex-1">
                              <h3 className="font-semibold leading-tight">{result.exhibitor.companyName}</h3>
                              <Badge variant="outline" className="mt-1">
                                {result.exhibitor.category}
                              </Badge>
                              <p className="mt-2.5 border-l-2 border-border pl-3 text-body italic text-muted-foreground">
                                {result.reason}
                              </p>
                            </div>

                            <Button asChild variant="outline" size="sm" className="shrink-0">
                              <Link to={`/attendee/exhibitors/${result.exhibitor.id}`}>View</Link>
                            </Button>
                          </CardContent>
                        </Card>
                      </motion.li>
                    ))}
                  </ul>
                )}
              </motion.div>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
