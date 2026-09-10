import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const BLUR_STEPS = [1.5, 4, 7.5];

export function LockedPreview({
  title,
  summary,
  ctaLabel,
  children,
  className,
}: {
  title: string;
  summary: string;
  ctaLabel: string;
  children: React.ReactNode;
  className?: string;
}) {
  const rows = Array.isArray(children) ? children : [children];

  return (
    <section className={cn('flex flex-col gap-4', className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-section">{title}</h2>
        <p className="text-body text-muted-foreground">{summary}</p>
      </div>

      <div className="relative">
        <div
          aria-hidden="true"
          className="flex flex-col gap-2 pb-8 select-none [mask-image:linear-gradient(to_bottom,#000_0%,#000_28%,transparent_92%)]"
        >
          {rows.map((row, i) => (
            <div
              key={i}
              style={{ filter: `blur(${BLUR_STEPS[Math.min(i, BLUR_STEPS.length - 1)]}px)` }}
            >
              {row}
            </div>
          ))}
        </div>

        <div className="flex flex-col items-start gap-2">
          <Button asChild size="sm">
            <Link to="/register">
              {ctaLabel}
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </Button>
          <p className="text-meta text-muted-foreground">
            Already have an account?{' '}
            <Link to="/login" className="text-foreground underline underline-offset-2">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </section>
  );
}
