import { useEffect, useRef } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { PageSpinner } from '@/components/shared/PageLoader';
import { useAuth } from '@/hooks/useAuth';
import type { Role } from '@/types';

interface ProtectedRouteProps {
  roles?: Role[];
}

/**
 * redirects exactly once, no matter how many times the component re-renders.
 */
function useRedirectOnce(to: string, state?: Record<string, unknown>) {
  const navigate = useNavigate();
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;
    navigate(to, { replace: true, state });
    // `state` is intentionally excluded: it is rebuilt each render and the ref
    // guard already ensures this runs once.
  }, [navigate, to]);
}

export function ProtectedRoute({ roles }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  const signedOut = !isLoading && (!isAuthenticated || !user);
  const wrongRole = !isLoading && Boolean(user) && Boolean(roles) && !roles!.includes(user!.role);

  return (
    <RouteGuard
      loading={isLoading}
      redirectTo={signedOut ? '/login' : wrongRole ? '/unauthorized' : null}
      state={{ from: location.pathname + location.search }}
    />
  );
}

/** keeps signed-in users off the login/register screens. */
export function GuestOnlyRoute() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  const from = (location.state as { from?: string } | null)?.from;
  const shouldLeave = !isLoading && isAuthenticated && Boolean(user);

  return <RouteGuard loading={isLoading} redirectTo={shouldLeave ? from ?? `/${user!.role}` : null} />;
}

/**
 * shared body for both guards: show a loader while the session resolves,
 * redirect once when required, otherwise render the route.
 */
function RouteGuard({
  loading,
  redirectTo,
  state,
}: {
  loading: boolean;
  redirectTo: string | null;
  state?: Record<string, unknown>;
}) {
  if (loading) return <PageSpinner />;
  if (redirectTo) return <Redirect to={redirectTo} state={state} />;
  return <Outlet />;
}

function Redirect({ to, state }: { to: string; state?: Record<string, unknown> }) {
  useRedirectOnce(to, state);
  // nothing to show: the navigation is already in flight.
  return null;
}
