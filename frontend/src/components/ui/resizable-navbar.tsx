import { createContext, useContext, useState, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { motion, useMotionValueEvent, useReducedMotion, useScroll } from 'motion/react';
import { cn } from '@/lib/utils';
import { DURATION, EASE_CSS, transition } from '@/lib/motion';

const CondensedContext = createContext(false);

export function useNavCondensed() {
  return useContext(CondensedContext);
}

export function Navbar({ children, className }: { children: ReactNode; className?: string }) {
  const { scrollY } = useScroll();
  const [condensed, setCondensed] = useState(false);

  useMotionValueEvent(scrollY, 'change', (y) => {
    setCondensed((was) => (was ? y > 24 : y > 64));
  });

  return (
    <CondensedContext.Provider value={condensed}>
      <div className={cn('sticky inset-x-0 top-0 z-40 w-full pt-3', className)}>{children}</div>
    </CondensedContext.Provider>
  );
}

export function NavShell({ children, className }: { children: ReactNode; className?: string }) {
  const condensed = useNavCondensed();
  const reduceMotion = useReducedMotion();

  return (
    <div className="px-5">
      <motion.div
        animate={{ maxWidth: condensed ? '52rem' : '80rem' }}
        transition={reduceMotion ? { duration: 0 } : transition.panel}
        style={{
          transitionDuration: reduceMotion ? '0ms' : `${DURATION.panel * 1000}ms`,
          transitionTimingFunction: EASE_CSS,
        }}
        className={cn(
          'mx-auto flex h-14 w-full items-center gap-2 rounded-full border px-3 bg-background',
          'transition-[background-color,border-color,box-shadow]',
          condensed
            ? 'border-border shadow-lg'
            : 'border-border/50 shadow-xs',
          className
        )}
      >
        {children}
      </motion.div>
    </div>
  );
}

export type NavItem = { to: string; label: string; end?: boolean };

export function isNavItemActive(item: NavItem, pathname: string) {
  return item.end ? pathname === item.to : pathname.startsWith(item.to);
}

export function NavLinks({ items, className }: { items: NavItem[]; className?: string }) {
  const { pathname } = useLocation();
  const [hovered, setHovered] = useState<string | null>(null);
  const reduceMotion = useReducedMotion();

  const activeTo = items.find((item) => isNavItemActive(item, pathname))?.to ?? null;
  const highlighted = hovered ?? activeTo;

  return (
    <nav
      aria-label="Main"
      onMouseLeave={() => setHovered(null)}
      className={cn('hidden items-center md:flex', className)}
    >
      {items.map((item) => {
        const lit = highlighted === item.to;

        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onMouseEnter={() => setHovered(item.to)}
            onFocus={() => setHovered(item.to)}
            onBlur={() => setHovered(null)}
            className={cn(
              'relative rounded-full px-4 py-2 text-body font-medium transition-colors',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
              lit ? 'text-primary-foreground' : 'text-muted-foreground'
            )}
            style={{
              transitionDuration: reduceMotion ? '0ms' : `${DURATION.micro * 1000}ms`,
              transitionTimingFunction: EASE_CSS,
            }}
          >
            {lit && (
              <motion.span
                aria-hidden="true"
                layoutId="public-nav-indicator"
                className="absolute inset-0 rounded-full bg-primary"
                transition={reduceMotion ? { duration: 0 } : transition.micro}
              />
            )}
            <span className="relative z-10">{item.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}
