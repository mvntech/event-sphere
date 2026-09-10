import { Link, useLocation } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowLeft, LockKeyhole } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { ROLE_HOME, ROLE_LABELS } from '@/types';

export default function UnauthorizedPage() {
  const { user, isAuthenticated } = useAuth();
  const location = useLocation();
  const attempted = (location.state as { from?: string } | null)?.from;

  return (
    <div className="container-page grid min-h-[70vh] place-items-center py-16">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="max-w-lg text-center"
      >
        <span className="mx-auto grid size-14 place-items-center rounded-xl bg-warning/15 text-warning">
          <LockKeyhole className="size-6" aria-hidden="true" />
        </span>

        <p className="mt-6 font-mono text-body font-semibold tracking-[0.2em] text-muted-foreground">403</p>
        <h1 className="mt-2 text-title">This area isn't yours</h1>
        <p className="mt-3 text-body text-muted-foreground">
          {isAuthenticated && user ? (
            <>
              You're signed in as an <span className="font-semibold text-foreground">{ROLE_LABELS[user.role]}</span>, and
              this page belongs to a different role. Nothing is broken — you just took a wrong turn.
            </>
          ) : (
            <>You need to sign in with an account that has access to this area.</>
          )}
        </p>

        {attempted && (
          <Badge variant="muted" className="mt-4 font-mono">
            {attempted}
          </Badge>
        )}

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {isAuthenticated && user ? (
            <Button asChild size="lg">
              <Link to={ROLE_HOME[user.role]}>
                <ArrowLeft /> Back to my dashboard
              </Link>
            </Button>
          ) : (
            <Button asChild size="lg">
              <Link to="/login">Sign in</Link>
            </Button>
          )}
          <Button asChild variant="outline" size="lg">
            <Link to="/">Go to homepage</Link>
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
