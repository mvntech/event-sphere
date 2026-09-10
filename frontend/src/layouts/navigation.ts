import {
  BarChart3,
  Bookmark,
  Building2,
  CalendarDays,
  CalendarPlus,
  ClipboardList,
  LayoutDashboard,
  LayoutGrid,
  MessageSquare,
  PanelsTopLeft,
  Search,
  Sparkles,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { Role } from '@/types';

export interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  ready?: boolean;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export interface QuickAction {
  label: string;
  to: string;
  icon: LucideIcon;
}

export interface RoleNav {
  root: NavItem;
  quickAction: QuickAction;
  groups: NavGroup[];
}

export const NAV_BY_ROLE: Record<Role, RoleNav> = {
  organizer: {
    root: { label: 'Overview', to: '/organizer', icon: LayoutDashboard, ready: true },
    quickAction: { label: 'New expo', to: '/organizer/expos', icon: CalendarPlus },
    groups: [
      {
        label: 'Plan',
        items: [
          { label: 'Expos', to: '/organizer/expos', icon: CalendarDays, ready: true },
          { label: 'Floor plan', to: '/organizer/floor-plan', icon: LayoutGrid, ready: true },
          { label: 'Schedule', to: '/organizer/schedule', icon: ClipboardList, ready: true },
        ],
      },
      {
        label: 'People',
        items: [
          { label: 'Exhibitors', to: '/organizer/exhibitors', icon: Building2, ready: true },
          { label: 'Accounts', to: '/organizer/users', icon: Users, ready: true },
          { label: 'Messages', to: '/organizer/messages', icon: MessageSquare, ready: true },
        ],
      },
      {
        label: 'Listen',
        items: [
          { label: 'Analytics', to: '/organizer/analytics', icon: BarChart3, ready: true },
          { label: 'Feedback', to: '/organizer/feedback', icon: MessageSquare, ready: true },
        ],
      },
    ],
  },

  exhibitor: {
    root: { label: 'Overview', to: '/exhibitor', icon: LayoutDashboard, ready: true },
    quickAction: { label: 'Reserve a booth', to: '/exhibitor/booth', icon: LayoutGrid },
    groups: [
      {
        label: 'Your stand',
        items: [
          { label: 'Company profile', to: '/exhibitor/profile', icon: Building2, ready: true },
          { label: 'Booth', to: '/exhibitor/booth', icon: PanelsTopLeft, ready: true },
        ],
      },
      {
        label: 'Talk',
        items: [
          { label: 'Messages', to: '/exhibitor/messages', icon: MessageSquare, ready: true },
          { label: 'AI copywriter', to: '/exhibitor/ai', icon: Sparkles, ready: true },
        ],
      },
    ],
  },

  attendee: {
    root: { label: 'Overview', to: '/attendee', icon: LayoutDashboard, ready: true },
    quickAction: { label: 'Plan my day', to: '/attendee/ai', icon: Sparkles },
    groups: [
      {
        label: 'Explore',
        items: [
          { label: 'Browse expos', to: '/attendee/expos', icon: CalendarDays, ready: true },
          { label: 'Exhibitors', to: '/attendee/exhibitors', icon: Search, ready: true },
          { label: 'Floor plan', to: '/attendee/floor-plan', icon: LayoutGrid, ready: true },
        ],
      },
      {
        label: 'Yours',
        items: [
          { label: 'My schedule', to: '/attendee/schedule', icon: Bookmark, ready: true },
          { label: 'Messages', to: '/attendee/messages', icon: MessageSquare, ready: true },
        ],
      },
    ],
  },
};

export const flatNav = (role: Role): NavItem[] => [
  NAV_BY_ROLE[role].root,
  ...NAV_BY_ROLE[role].groups.flatMap((group) => group.items),
];
