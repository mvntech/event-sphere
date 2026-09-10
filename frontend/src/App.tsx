import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, useLocation } from 'react-router-dom';
import { Toaster } from 'sonner';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { PageSpinner } from '@/components/shared/PageLoader';
import { ThemeProvider, useTheme } from '@/hooks/useTheme';
import { useSessionBootstrap } from '@/hooks/useAuth';
import { useAuthStore } from '@/store/authStore';
import { ApiError } from '@/lib/api';
import { AppRoutes } from '@/routes';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) =>
        error instanceof ApiError && [401, 403, 404].includes(error.status) ? false : failureCount < 2,
    },
  },
});

function ThemedToaster() {
  const { resolvedTheme } = useTheme();
  return (
    <Toaster
      theme={resolvedTheme}
      position="bottom-right"
      closeButton
      toastOptions={{ style: { borderRadius: 'var(--radius-md)', fontFamily: 'var(--font-sans)' } }}
    />
  );
}

const SESSION_DEPENDENT = ['/organizer', '/exhibitor', '/attendee', '/settings'];

function SessionGate() {
  useSessionBootstrap();
  const status = useAuthStore((s) => s.status);
  const { pathname } = useLocation();

  const needsSession = SESSION_DEPENDENT.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );

  if (needsSession && (status === 'idle' || status === 'loading')) {
    return (
      <div className="grid min-h-dvh place-items-center bg-background">
        <PageSpinner label="Starting EventSphere" className="min-h-0" />
      </div>
    );
  }

  return <AppRoutes />;
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <SessionGate />
          </BrowserRouter>
          <ThemedToaster />
        </QueryClientProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
