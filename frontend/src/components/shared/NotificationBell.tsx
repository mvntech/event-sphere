import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as Popover from '@radix-ui/react-popover';
import { AnimatePresence, motion } from 'motion/react';
import { Bell, CheckCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatRelative } from '@/lib/format';
import {
  useLiveNotifications,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from '@/hooks/useNotifications';
import type { AppNotification } from '@/types';

const TIME_CRITICAL = new Set(['session-reminder', 'schedule-changed']);

const isToday = (iso: string) => new Date(iso).toDateString() === new Date().toDateString();

/** in-app notification centre — the bell in the dashboard header. */
export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const { data, isPending } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  // aRriving notifications land in the cache immediately.
  useLiveNotifications();

  const items = data?.items ?? [];
  const unread = data?.unreadCount ?? 0;

  // two groups, not an undifferentiated stream: "did this happen while I was
  // in the hall today" is the question a notification list actually answers.
  const groups = [
    { label: 'Today', rows: items.filter((n) => isToday(n.createdAt)) },
    { label: 'Earlier', rows: items.filter((n) => !isToday(n.createdAt)) },
  ].filter((group) => group.rows.length > 0);

  const openNotification = (notification: AppNotification) => {
    if (!notification.read) markRead.mutate(notification.id);
    setOpen(false);
    if (notification.link) navigate(notification.link);
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
          className="relative grid size-9 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <Bell className="size-4" aria-hidden="true" />
          <AnimatePresence>
            {unread > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                className="absolute -right-0.5 -top-0.5 grid min-w-4 place-items-center rounded-full bg-primary px-1 text-meta font-bold leading-4 text-primary-foreground"
              >
                {unread > 9 ? '9+' : unread}
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={8}
          className="z-50 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-lg data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
        >
          <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
            <h2 className="text-item">Notifications</h2>
            {unread > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-auto px-2 py-1 text-meta"
                onClick={() => markAllRead.mutate()}
                loading={markAllRead.isPending}
              >
                <CheckCheck className="size-3.5" aria-hidden="true" />
                Mark all read
              </Button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {isPending && <p className="px-4 py-8 text-center text-body text-muted-foreground">Loading…</p>}

            {!isPending && items.length === 0 && (
              <div className="px-4 py-10 text-center">
                <Bell className="mx-auto size-5 text-muted-foreground" aria-hidden="true" />
                <p className="mt-2 text-item">Nothing yet</p>
                <p className="mt-1 text-body text-muted-foreground">
                  Approvals, booth changes and new messages will show up here.
                </p>
              </div>
            )}

            {groups.map((group) => (
              <section key={group.label}>
                <h3 className="sticky top-0 z-10 bg-popover/95 px-4 py-1.5 text-meta text-muted-foreground backdrop-blur-sm">
                  {group.label}
                </h3>
                <ul>
                  {group.rows.map((notification) => {
                    const timeCritical = TIME_CRITICAL.has(notification.type) && !notification.read;

                    return (
                      <li key={notification.id}>
                        <button
                          type="button"
                          onClick={() => openNotification(notification)}
                          className={cn(
                            'flex w-full flex-col items-start gap-1 border-b border-border px-4 py-3 text-left transition-colors last:border-b-0',
                            'hover:bg-accent focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring',
                            !notification.read && 'bg-accent'
                          )}
                        >
                          <span className="flex w-full items-start gap-2">
                            {!notification.read && (
                              <span
                                aria-hidden="true"
                                className={cn(
                                  'mt-1.5 size-1.5 shrink-0 rounded-full',
                                  timeCritical ? 'bg-live' : 'bg-primary'
                                )}
                              />
                            )}
                            <span className={cn('flex-1 text-body', !notification.read && 'font-medium')}>
                              {notification.message}
                            </span>
                          </span>
                          <span
                            className={cn(
                              'pl-3.5 text-meta',
                              timeCritical ? 'text-live' : 'text-muted-foreground'
                            )}
                          >
                            {formatRelative(notification.createdAt)}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
