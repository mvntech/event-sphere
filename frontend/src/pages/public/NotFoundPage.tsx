import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowLeft, Compass } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { ROLE_HOME } from '@/types';

export default function NotFoundPage() {
  const { user, isAuthenticated } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <div className="container-page grid min-h-[70vh] place-items-center py-16">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="max-w-lg text-center"
      >
        <span className="mx-auto grid size-14 place-items-center rounded-xl bg-accent text-accent-foreground">
          <Compass className="size-6" aria-hidden="true" />
        </span>

        <p className="mt-6 font-mono text-body font-semibold tracking-[0.2em] text-muted-foreground">404</p>
        <h1 className="mt-2 text-title">Nothing on this stand</h1>
        <p className="mt-3 text-body text-muted-foreground">
          The page you're looking for has moved, closed up, or never existed. Let's get you back to the main hall.
        </p>

        <Badge variant="muted" className="mt-4 max-w-full truncate font-mono">
          {location.pathname}
        </Badge>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button size="lg" onClick={() => navigate(-1)}>
            <ArrowLeft /> Go back
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link to={isAuthenticated && user ? ROLE_HOME[user.role] : '/'}>
              {isAuthenticated && user ? 'My dashboard' : 'Go to homepage'}
            </Link>
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
