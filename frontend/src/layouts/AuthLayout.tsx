import { Outlet, useLocation } from 'react-router-dom';
import { motion, useReducedMotion } from 'motion/react';
import { BorderBeam } from '@/components/ui/border-beam';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { InteractiveGridPattern } from '@/components/ui/interactive-grid-pattern';
import { Logo } from '@/components/shared/Logo';
import { DURATION, EASE } from '@/lib/motion';

const CELL = 56;
const BEAM_CIRCUITS = 2;
const BEAM_DURATION = 2.4;

export function AuthLayout() {
  const location = useLocation();
  const reduceMotion = useReducedMotion();

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-background">
      <div aria-hidden="true" className="absolute inset-0">
        <InteractiveGridPattern
          width={CELL}
          height={CELL}
          squares={[40, 28]}
          className="mask-[linear-gradient(to_bottom,var(--color-background)_0%,var(--color-background)_55%,transparent_95%)]"
          squaresClassName="stroke-border"
        />
      </div>

      <header className="relative z-10 flex items-center px-5 py-6 sm:px-10">
        <Logo />
      </header>

        <main id="main" tabIndex={-1} className="relative z-10 flex flex-1 items-center justify-center px-5 pb-16 sm:px-8">
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: DURATION.reveal, ease: EASE }}
          className="w-full max-w-md"
        >
          <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-7 shadow-lg sm:p-8">
            {!reduceMotion && (
              <motion.div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 rounded-2xl"
                initial={{ opacity: 1 }}
                animate={{ opacity: 0 }}
                transition={{
                  duration: DURATION.panel,
                  ease: EASE,
                  delay: BEAM_CIRCUITS * BEAM_DURATION,
                }}
              >
                <BorderBeam
                  size={180}
                  borderWidth={2}
                  initialOffset={12}
                  colorFrom="var(--color-primary)"
                  colorTo="var(--color-sidebar-primary)"
                  transition={{ repeat: BEAM_CIRCUITS - 1, ease: 'linear', duration: BEAM_DURATION }}
                  className="rounded-2xl"
                />
              </motion.div>
            )}

            <ErrorBoundary resetKey={location.pathname}>
              <Outlet />
            </ErrorBoundary>
          </div>
        </motion.div>
      </main>

      <footer className="relative z-10 px-5 pb-6 text-center sm:px-10">
        <p className="text-meta text-muted-foreground">
          Organizers, exhibitors and attendees on one live floor plan.
        </p>
      </footer>
    </div>
  );
}
