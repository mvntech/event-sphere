import { NavLink, Outlet } from 'react-router-dom';
import { PageHeader } from '@/components/shared/PageHeader';
import { cn } from '@/lib/utils';

export interface SettingsSection {
  to: string;
  label: string;
  hint: string;
}

export const SETTINGS_SECTIONS: SettingsSection[] = [
  {
    to: '/settings/privacy',
    label: 'Privacy and your data',
    hint: 'What we store, email preferences, export, deletion',
  },
];

export function SettingsLayout() {
  const single = SETTINGS_SECTIONS.length === 1;

  return (
    <div className="mx-auto max-w-full space-y-8">
      <PageHeader
        title="Settings"
        description="Your account and how EventSphere handles your data."
      />

      <div className={cn('grid gap-8', !single && 'lg:grid-cols-[14rem_minmax(0,1fr)] lg:items-start')}>
        {!single && (
          <nav aria-label="Settings sections" className="flex flex-col gap-1">
            {SETTINGS_SECTIONS.map((section) => (
              <NavLink
                key={section.to}
                to={section.to}
                className={({ isActive }) =>
                  cn(
                    'rounded-lg px-3 py-2 text-body transition-colors',
                    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                    isActive
                      ? 'bg-accent font-medium text-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                  )
                }
              >
                {section.label}
              </NavLink>
            ))}
          </nav>
        )}

        <div className="min-w-0">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
