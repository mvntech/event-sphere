import { motion } from 'motion/react';
import { AlertTriangle, CheckCircle2, Lightbulb, Minus, RefreshCw, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { AiSourceNotice } from '@/components/ai/AiSourceNotice';
import { useAiSummary } from '@/hooks/useAi';
import { ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';

/** icon and tint per sentiment, resolved through the design tokens. */
const SENTIMENT = {
  positive: { icon: CheckCircle2, className: 'text-primary' },
  concerning: { icon: AlertTriangle, className: 'text-destructive' },
  negative: { icon: AlertTriangle, className: 'text-destructive' },
  neutral: { icon: Minus, className: 'text-muted-foreground' },
} as const;

const styleFor = (sentiment: string) =>
  SENTIMENT[sentiment?.toLowerCase() as keyof typeof SENTIMENT] ?? SENTIMENT.neutral;

/**
 * plain-english analytics summary for organizers.
 */
export function AiSummaryPanel({ expoId }: { expoId: string }) {
  const summary = useAiSummary();

  const run = () =>
    summary.mutate(
      { expoRef: expoId },
      { onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Could not generate a summary') }
    );

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="size-4 text-primary" aria-hidden="true" />
              What the numbers say
            </CardTitle>
            <CardDescription>A plain-English read of this expo, written from your own figures.</CardDescription>
          </div>

          <Button size="sm" variant={summary.data ? 'outline' : 'default'} onClick={run} loading={summary.isPending}>
            <RefreshCw className="size-4" aria-hidden="true" />
            {summary.data ? 'Regenerate' : 'Generate summary'}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {summary.isPending && (
          <div className="space-y-3">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        )}

        {!summary.data && !summary.isPending && (
          <p className="text-body text-muted-foreground">
            Generate a summary to see the headline findings and what to do about them.
          </p>
        )}

        {summary.data && !summary.isPending && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
            <AiSourceNotice
              source={summary.data.source}
              reason={summary.data.reason}
              fallbackMethod="a plain restatement of your figures"
            />

            {summary.data.headline && (
              <p className="text-balance text-section">{summary.data.headline}</p>
            )}

            {summary.data.insights.length > 0 && (
              <ul className="space-y-3">
                {summary.data.insights.map((insight, index) => {
                  const { icon: Icon, className } = styleFor(insight.sentiment);

                  return (
                    <motion.li
                      key={`${insight.title}-${index}`}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: Math.min(index * 0.06, 0.3) }}
                      className="flex gap-3 rounded-lg border border-border p-4"
                    >
                      <Icon className={cn('mt-0.5 size-4 shrink-0', className)} aria-hidden="true" />
                      <div className="min-w-0">
                        <p className="text-body font-medium">{insight.title}</p>
                        <p className="mt-1 text-body text-muted-foreground">{insight.detail}</p>
                      </div>
                    </motion.li>
                  );
                })}
              </ul>
            )}

            {summary.data.recommendations.length > 0 && (
              <div className="rounded-lg bg-accent p-4 text-accent-foreground">
                <h3 className="flex items-center gap-2 text-body font-semibold">
                  <Lightbulb className="size-4" aria-hidden="true" />
                  Suggested next steps
                </h3>
                <ul className="mt-2.5 space-y-1.5">
                  {summary.data.recommendations.map((recommendation, index) => (
                    <li key={index} className="flex gap-2 text-body">
                      <span aria-hidden="true">·</span>
                      <span>{recommendation}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
}
