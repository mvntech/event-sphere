import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { InteractiveGridPattern } from '@/components/ui/interactive-grid-pattern';
import { ClosingCta } from '@/components/marketing/ClosingCta';
import { Duotone } from '@/components/marketing/Duotone';
import { usePublicStats } from '@/hooks/useStats';

const PHOTOS = {
  plan: '/about/plan.svg',
  live: '/about/live.svg',
  roles: '/about/roles.svg',
} as const;

type Row = {
  photo: string;
  title: string;
  body?: string;
  Body?: () => React.JSX.Element;
};

const ROWS: Row[] = [
  {
    photo: PHOTOS.plan,
    title: 'The plan is the product',
    body: "Every expo starts as a grid of stands. Who is on B4, whether A3 is still free, how far the catering is from the keynote room. Most software treats that as a PDF attachment. Here it is the thing itself — organizers draw it, exhibitors reserve off it, attendees navigate by it, and it is the same plan in all three hands.",
  },
  {
    photo: PHOTOS.live,
    title: 'One copy, not three',
    body: "The usual failure is not a missing feature. It is a stand that was reassigned on Tuesday, a session that moved rooms on Wednesday, and three spreadsheets that each know one of those facts. Booth status, schedule changes and messages move over the same live connection, so nobody is working from last week's version.",
  },
  {
    photo: PHOTOS.roles,
    title: 'Three jobs, one floor',
    Body: RolesBody,
  },
];

const BODY_CLASS = 'mt-3 text-body text-muted-foreground';

function RolesBody() {
  const { data } = usePublicStats();

  const n = (value: number) => (
    <strong className="font-medium text-foreground">{value.toLocaleString('en-US')}</strong>
  );

  return (
    <p className={BODY_CLASS}>
      {data ? <>Across the {n(data.expos)} expos hosted here, organizers</> : <>Organizers</>} lay out the
      hall, review applications and watch what people actually engage with.{' '}
      {data ? (
        <>The {n(data.exhibitors)} companies confirmed on them claim a stand</>
      ) : (
        <>Exhibitors claim a stand</>
      )}
      , publish what they are showing and answer enquiries.{' '}
      {data ? (
        <>The {n(data.attendees)} people attending find the right stands</>
      ) : (
        <>Attendees find the right stands</>
      )}
      , book the right sessions and get reminded before each one starts.
    </p>
  );
}

const CELL = 56;

function PlanGround() {
  return (
    <div aria-hidden="true" className="absolute inset-0 overflow-hidden">
      <InteractiveGridPattern
        width={CELL}
        height={CELL}
        squares={[40, 12]}
        className="mask-[linear-gradient(to_bottom,var(--color-background)_0%,transparent_85%)]"
        squaresClassName="stroke-border"
      />
    </div>
  );
}

export default function AboutPage() {
  return (
    <div>
      <section className="relative">
        <PlanGround />
        <div className="container-page relative py-16 sm:py-24">
          <div className="max-w-2xl">
            <h1 className="text-title text-balance">
              An expo is a floor plan, a timetable and a lot of conversations.
            </h1>
            <p className="mt-4 text-lede text-muted-foreground">
              EventSphere is those three things in one place, updating live, for everyone at once.
            </p>
          </div>
        </div>
      </section>

      <div className="container-page border-t border-border pt-16 pb-16 sm:pb-24">
        <div className="flex flex-col gap-16 sm:gap-24">
          {ROWS.map((row, i) => {
            const imageRight = i % 2 === 1;
            return (
              <section
                key={row.title}
                className="grid items-center gap-8 lg:grid-cols-2 lg:gap-16"
              >
                <Duotone
                  src={row.photo}
                  className={cn(
                    'aspect-3/2 w-full rounded-xl shadow-sm',
                    imageRight && 'lg:order-last'
                  )}
                />
                <div className="max-w-prose">
                  <h2 className="text-section">{row.title}</h2>
                  {row.Body ? <row.Body /> : <p className={BODY_CLASS}>{row.body}</p>}
                </div>
              </section>
            );
          })}
        </div>
      </div>

      <ClosingCta
        title="See it on a real floor."
        body="Every expo on EventSphere is browsable without an account — the plan, the schedule and who is exhibiting."
        action={
          <Button asChild size="lg" variant="rail">
            <Link to="/expos">
              See what's on
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </Button>
        }
      />
    </div>
  );
}
