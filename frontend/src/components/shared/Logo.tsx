import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

export function Logo({
  className,
  to = '/',
  tone = 'default',
  wordmark = 'always',
}: {
  className?: string;
  to?: string;
  tone?: 'default' | 'rail';
  wordmark?: 'always' | 'sm-up';
}) {
  const rail = tone === 'rail';

  return (
    <Link
      to={to}
      className={cn(
        'inline-flex items-center gap-2.5 rounded-md font-bold tracking-tight',
        rail && 'text-sidebar-foreground',
        className
      )}
      aria-label="EventSphere home"
    >
      {rail ? (
        <img
          src="/logo/icon-white-192.png"
          alt=""
          width={32}
          height={32}
          className="size-8 shrink-0 rounded-lg"
        />
      ) : (
        <>
          <img
            src="/logo/icon-blue-192.png"
            alt=""
            width={32}
            height={32}
            className="size-8 shrink-0 rounded-lg dark:hidden"
          />
          <img
            src="/logo/icon-white-192.png"
            alt=""
            width={32}
            height={32}
            className="hidden size-8 shrink-0 rounded-lg dark:block"
          />
        </>
      )}
      <span className={cn('text-section', wordmark === 'sm-up' && 'hidden sm:inline')}>
        Event<span className={rail ? 'text-sidebar-primary' : 'text-primary'}>Sphere</span>
      </span>
    </Link>
  );
}
