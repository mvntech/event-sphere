import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { HeroHeadline } from '@/components/marketing/HeroHeadline';
import { HeroBento } from '@/components/marketing/hero/HeroBento';
import { HeroStats } from '@/components/marketing/hero/HeroStats';
import { HowItWorks } from '@/components/marketing/HowItWorks';
import { RolesSequence } from '@/components/marketing/RolesSequence';
import { FeatureStack } from '@/components/marketing/FeatureStack';
import { ClosingCta } from '@/components/marketing/ClosingCta';
import { PhotoGallery } from '@/components/marketing/PhotoGallery';
import { FeaturedExhibitors } from '@/components/marketing/FeaturedExhibitors';
import { InteractiveGridPattern } from '@/components/ui/interactive-grid-pattern';
import { useAuth } from '@/hooks/useAuth';
import { ROLE_HOME } from '@/types';

const CELL = 56;

function PlanGround() {
  return (
    <div aria-hidden="true" className="absolute inset-0 overflow-hidden">
      <InteractiveGridPattern
        width={CELL}
        height={CELL}
        squares={[40, 14]}
        className="mask-[linear-gradient(to_bottom,var(--color-background)_0%,transparent_82%)]"
        squaresClassName="stroke-border"
      />
    </div>
  );
}


export default function LandingPage() {
  const { isAuthenticated, user } = useAuth();

  return (
    <>
      <section className="relative overflow-hidden">
        <PlanGround />

        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 -top-40 h-[32rem] bg-[radial-gradient(ellipse_at_top,var(--color-accent),transparent_65%)]"
        />

        <div className="container-page relative pb-8 pt-16 sm:pt-24">
          <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-16">
            <div>
              <HeroHeadline text="Run the whole expo from" accent="one place." />

              <p className="mt-6 max-w-xl text-pretty text-lede text-muted-foreground">
                EventSphere brings organizers, exhibitors and attendees onto the same live floor plan, schedule
                and inbox &mdash; so nobody is working from last week&rsquo;s spreadsheet.
              </p>

              <div className="mt-8">
                <Button asChild size="lg">
                  {isAuthenticated && user ? (
                    <Link to={ROLE_HOME[user.role]}>
                      Go to my dashboard <ArrowRight />
                    </Link>
                  ) : (
                    <Link to="/register">
                      Get started free <ArrowRight />
                    </Link>
                  )}
                </Button>
              </div>

              <div className="mt-12 border-t border-border pt-8">
                <HeroStats />
              </div>
            </div>

            <HeroBento />
          </div>
        </div>
      </section>

      <HowItWorks />

      <RolesSequence />

      <FeatureStack />

      <PhotoGallery />

      <FeaturedExhibitors />
      
      <ClosingCta
        title="Your next expo starts here."
        body="Create an account as an organizer, exhibitor or attendee — it takes about a minute."
        action={
          <Button asChild size="lg" variant="rail">
            <Link to={isAuthenticated && user ? ROLE_HOME[user.role] : '/register'}>
              {isAuthenticated && user ? 'Open my dashboard' : 'Create your account'} <ArrowRight />
            </Link>
          </Button>
        }
      />
    </>
  );
}
