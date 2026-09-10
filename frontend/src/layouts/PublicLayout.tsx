import { Suspense, useEffect, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  isNavItemActive,
  Navbar,
  NavLinks,
  NavShell,
  type NavItem,
} from '@/components/ui/resizable-navbar';
import { InteractiveGridPattern } from '@/components/ui/interactive-grid-pattern';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { PageSpinner } from '@/components/shared/PageLoader';
import { Logo } from '@/components/shared/Logo';
import { UserMenu } from '@/components/shared/UserMenu';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { ROLE_HOME } from '@/types';

const PLAN_CELL = 56;

const NAV: NavItem[] = [
  { to: '/', label: 'Home', end: true },
  { to: '/expos', label: "What's on" },
  { to: '/about', label: 'About' },
  { to: '/contact', label: 'Contact' },
];

const FOOTER_COLUMNS: {
  heading: string;
  links: { to: string; label: string }[];
}[] = [
  {
    heading: 'Product',
    links: [
      { to: '/product/floor-plans', label: 'Floor plans' },
      { to: '/product/schedule', label: 'Schedule builder' },
      { to: '/product/exhibitor-directory', label: 'Exhibitor directory' },
      { to: '/product/messaging', label: 'Messaging' },
      { to: '/product/ai', label: 'AI assistant' },
    ],
  },
  {
    heading: 'Explore',
    links: [
      { to: '/expos', label: "What's on" },
      { to: '/about', label: 'About' },
      { to: '/contact', label: 'Contact' },
    ],
  },
  {
    heading: 'Account',
    links: [
      { to: '/register', label: 'Create an account' },
      { to: '/login', label: 'Sign in' },
      { to: '/forgot-password', label: 'Reset password' },
    ],
  },
  {
    heading: 'Legal',
    links: [
      { to: '/terms', label: 'Terms of Service' },
      { to: '/privacy-policy', label: 'Privacy Policy' },
      { to: '/cookies', label: 'Cookie Policy' },
      { to: '/accessibility', label: 'Accessibility' },
    ],
  },
];

function FooterPlanGround() {
  return (
    <div aria-hidden="true" className="absolute inset-x-0 top-0 z-10 h-28 overflow-hidden">
      <InteractiveGridPattern
        width={PLAN_CELL}
        height={PLAN_CELL}
        squares={[40, 2]}
        className="mask-[linear-gradient(to_bottom,transparent_0%,var(--color-background)_45%,transparent_100%)]"
        squaresClassName="stroke-sidebar-border"
        hoverFillClassName="fill-sidebar-primary/20"
      />
    </div>
  );
}

function FooterWordmark() {
  return (
    <div aria-hidden="true" className="container-page pointer-events-none select-none">
      <span
        className="block whitespace-nowrap font-bold tracking-tighter text-sidebar-foreground opacity-10 mask-[linear-gradient(to_bottom,var(--color-background)_0%,transparent_82%)]"
        style={{ fontSize: 'clamp(3.5rem, 15.5vw, 12.5rem)', lineHeight: 0.82, marginBottom: '-0.2em' }}
      >
        EventSphere
      </span>
    </div>
  );
}

export function PublicLayout() {
  const { isAuthenticated, user, status } = useAuth();
  const sessionKnown = status !== 'idle' && status !== 'loading';
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => setMenuOpen(false), [location.pathname]);

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <a href="#main" className="skip-link">
        Skip to content
      </a>

      <Navbar>
        <NavShell>
          <Logo wordmark="sm-up" className="shrink-0 ps-1" />

          <NavLinks items={NAV} className="ms-3" />
          <div className="ms-auto flex items-center gap-2">
            {!sessionKnown ? (
              <div aria-hidden="true" className="h-8 w-[8.5rem]" />
            ) : isAuthenticated && user ? (
              <>
                <Button asChild variant="outline" size="sm" className="hidden rounded-full sm:inline-flex">
                  <Link to={ROLE_HOME[user.role]}>Dashboard</Link>
                </Button>
                <UserMenu />
              </>
            ) : (
              <>
                <Button asChild variant="ghost" size="sm" className="hidden rounded-full sm:inline-flex">
                  <Link to="/login">Sign in</Link>
                </Button>
                <Button asChild size="sm" className="rounded-full">
                  <Link to="/register">Get started</Link>
                </Button>
              </>
            )}

            <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full md:hidden" aria-label="Open menu">
                  <Menu />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="gap-0">
                <SheetTitle className="px-2 pb-4 pt-1 text-item text-sidebar-foreground">Menu</SheetTitle>
                <SheetDescription className="sr-only">Site navigation and account actions.</SheetDescription>
                <nav aria-label="Main" className="flex flex-col">
                  {NAV.map((item) => {
                    const active = isNavItemActive(item, location.pathname);

                    return (
                      <SheetClose asChild key={item.to}>
                        <Link
                          to={item.to}
                          aria-current={active ? 'page' : undefined}
                          className={cn(
                            'rounded-md px-2 py-3 text-item transition-colors',
                            active
                              ? 'bg-sidebar-active text-sidebar-active-foreground'
                              : 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                          )}
                        >
                          {item.label}
                        </Link>
                      </SheetClose>
                    );
                  })}
                </nav>

                {sessionKnown && !isAuthenticated && (
                  <div className="mt-auto flex flex-col gap-2 border-t border-sidebar-border pt-4">
                    <SheetClose asChild>
                      <Button asChild variant="outline" className="w-full">
                        <Link to="/login">Sign in</Link>
                      </Button>
                    </SheetClose>
                    <SheetClose asChild>
                      <Button asChild className="w-full">
                        <Link to="/register">Get started</Link>
                      </Button>
                    </SheetClose>
                  </div>
                )}
              </SheetContent>
            </Sheet>
          </div>
        </NavShell>
      </Navbar>

      <main id="main" tabIndex={-1} className="flex-1">
        <ErrorBoundary resetKey={location.pathname}>
          <Suspense fallback={<PageSpinner />}>
            <Outlet />
          </Suspense>
        </ErrorBoundary>
      </main>

      <footer className="relative overflow-hidden bg-sidebar">
        <FooterPlanGround />

        <div className="container-page relative pb-12 pt-32">
          <div className="grid gap-x-8 gap-y-10 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-[1.4fr_1fr_1fr_1fr_1fr]">
            <div className="md:col-span-4 lg:col-span-1">
              <Logo tone="rail" />
              <p className="mt-4 max-w-xs text-body text-sidebar-foreground/80">
                One live floor plan, one schedule, one inbox &mdash; shared by organizers, exhibitors and attendees.
              </p>
            </div>

            {FOOTER_COLUMNS.map((column) => (
              <div key={column.heading}>
                <h2 className="text-meta font-semibold text-sidebar-foreground">{column.heading}</h2>
                <ul className="mt-4 flex flex-col gap-3">
                  {column.links.map((link) => (
                    <li key={link.to}>
                      <Link
                        to={link.to}
                        className="rounded-sm text-body text-sidebar-foreground/80 transition-colors hover:text-sidebar-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sidebar-ring"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="mt-10 flex flex-col gap-2 border-t border-sidebar-border pt-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-meta text-sidebar-foreground/80">
              &copy; {new Date().getFullYear()} EventSphere Management.
            </p>
            <p className="text-meta text-sidebar-foreground/80">
              Built for expos, trade shows and everything in between.
            </p>
          </div>
        </div>

        <FooterWordmark />
      </footer>
    </div>
  );
}
