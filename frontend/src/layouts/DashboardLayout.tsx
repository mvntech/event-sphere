import { Suspense } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { PageSpinner } from '@/components/shared/PageLoader';
import { Logo } from '@/components/shared/Logo';
import { NotificationBell } from '@/components/shared/NotificationBell';
import { ThemeToggle } from '@/components/shared/ThemeToggle';
import { UserMenu } from '@/components/shared/UserMenu';
import { NAV_BY_ROLE, type NavItem } from '@/layouts/navigation';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { ROLE_LABELS, type Role } from '@/types';

/**
 * Dashboard shell — shared by all three portals.
 */

function NavRow({ item, isRoot }: { item: NavItem; isRoot?: boolean }) {
  const Icon = item.icon;

  if (!item.ready) {
    return (
      <SidebarMenuItem>
        <SidebarMenuButton
          aria-disabled="true"
          title={`${item.label} is not available yet`}
          className="cursor-not-allowed text-sidebar-foreground/40 hover:bg-transparent hover:text-sidebar-foreground/40"
        >
          <Icon aria-hidden="true" />
          <span className="text-body">{item.label}</span>
          <span className="sr-only">— not available yet</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  }

  return (
    <SidebarMenuItem>
      <NavLink to={item.to} end={isRoot}>
        {({ isActive }) => (
          <SidebarMenuButton
            asChild
            isActive={isActive}
            tooltip={item.label}
            className={cn(
              'text-sidebar-foreground',
              'hover:bg-sidebar-active hover:text-sidebar-active-foreground',
              'data-[active=true]:bg-sidebar-active data-[active=true]:text-sidebar-active-foreground'
            )}
          >
            <span>
              <Icon aria-hidden="true" />
              <span className="text-body">{item.label}</span>
            </span>
          </SidebarMenuButton>
        )}
      </NavLink>
    </SidebarMenuItem>
  );
}

function Rail({ role }: { role: Role }) {
  const nav = NAV_BY_ROLE[role];

  return (
    <Sidebar collapsible="icon" className="border-sidebar-border">
      <SidebarHeader className="h-16 justify-center border-b border-sidebar-border px-2">
        <div className="flex h-8 items-center px-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
          <Logo
            to={`/${role}`}
            tone="rail"
            className="group-data-[collapsible=icon]:[&>span:last-child]:hidden"
          />
        </div>
      </SidebarHeader>

      <SidebarContent className="pb-2">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <NavRow item={{ ...nav.quickAction, ready: true }} />

              <NavRow item={nav.root} isRoot />
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {nav.groups.map((group) => (
          <SidebarGroup key={group.label} className="group-data-[collapsible=icon]:pt-0">
            <SidebarGroupLabel className="text-meta text-sidebar-foreground/50">
              {group.label}
            </SidebarGroupLabel>
            <div
              aria-hidden="true"
              className="mx-2 hidden h-px bg-sidebar-border group-data-[collapsible=icon]:mb-2 group-data-[collapsible=icon]:block"
            />
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <NavRow key={item.to} item={item} />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
    </Sidebar>
  );
}

export function DashboardLayout() {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) return null;

  return (
    <SidebarProvider>
      <a href="#dashboard-main" className="skip-link">
        Skip to content
      </a>

      <Rail role={user.role} />

      <SidebarInset className="min-w-0">
        <header className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur-md sm:px-6 lg:px-8">
          <SidebarTrigger className="-ml-1" />

          <div className="ml-auto flex items-center gap-1.5">
            <Badge variant="muted" className="hidden sm:inline-flex">
              {ROLE_LABELS[user.role]}
            </Badge>
            <NotificationBell />
            <ThemeToggle />
            <UserMenu />
          </div>
        </header>

        <main id="dashboard-main" tabIndex={-1} className="flex-1 px-4 py-8 sm:px-6 lg:px-8">
          <ErrorBoundary resetKey={location.pathname}>
            <Suspense fallback={<PageSpinner />}>
              <Outlet />
            </Suspense>
          </ErrorBoundary>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
