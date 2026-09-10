import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowLeft, MessageSquare, Radio, Send, SquarePen, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { EmptyState } from '@/components/shared/EmptyState';
import { PageHeader } from '@/components/shared/PageHeader';
import { NewConversationDialog } from '@/components/messaging/NewConversationDialog';
import { useLiveMessages, useSendMessage, useThread, useThreads } from '@/hooks/useMessages';
import { useAuthStore } from '@/store/authStore';
import { ApiError } from '@/lib/api';
import { DURATION, EASE } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { formatRelative, formatTime } from '@/lib/format';

const initials = (name: string) =>
  name
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

interface Props {
  description: string;
  canStartConversation?: boolean;
}

export function MessagesScreen({ description, canStartConversation = true }: Props) {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeId = searchParams.get('thread') ?? '';

  const currentUserId = useAuthStore((s) => s.user?.id);
  const [draft, setDraft] = useState('');
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const threads = useThreads();
  const thread = useThread(activeId || undefined);
  const sendMessage = useSendMessage();

  // incoming messages append to the open conversation with no refetch.
  const { connected } = useLiveMessages(activeId || undefined);

  const items = threads.data?.items ?? [];
  const messages = useMemo(() => thread.data?.messages ?? [], [thread.data]);

  // keep the newest message in view as the conversation grows.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length]);

  const openThread = (id: string) => {
    const params = new URLSearchParams(searchParams);
    params.set('thread', id);
    setSearchParams(params, { replace: true });
    setDraft('');
  };

  const closeThread = () => {
    const params = new URLSearchParams(searchParams);
    params.delete('thread');
    setSearchParams(params, { replace: true });
  };

  const send = async (event: React.FormEvent) => {
    event.preventDefault();
    const body = draft.trim();
    if (!body || !activeId) return;

    setDraft('');
    try {
      await sendMessage.mutateAsync({ threadRef: activeId, body });
    } catch (error) {
      setDraft(body);
      toast.error(error instanceof ApiError ? error.message : 'Could not send that message');
    }
  };

  const counterpartName = thread.data?.thread.counterpart?.name ?? 'Conversation';

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Messages"
        description={description}
        actions={
          <div className="flex items-center gap-3">
            <span
              className={cn(
                'hidden items-center gap-1.5 text-meta font-medium sm:flex',
                connected ? 'text-muted-foreground' : 'text-warning'
              )}
              role="status"
            >
              <Radio className={cn('size-3.5', connected && 'text-primary')} aria-hidden="true" />
              {connected ? 'Live' : 'Reconnecting…'}
            </span>
            {canStartConversation && (
              <NewConversationDialog
                onStarted={openThread}
                trigger={
                  <Button size="sm">
                    <SquarePen className="size-4" aria-hidden="true" />
                    New message
                  </Button>
                }
              />
            )}
          </div>
        }
      />

      {threads.isError && (
        <Card className="border-destructive/40">
          <CardContent className="flex flex-col items-start gap-3 p-6">
            <p className="flex items-center gap-2 font-medium text-destructive">
              <TriangleAlert className="size-4" aria-hidden="true" />
              {threads.error instanceof ApiError ? threads.error.message : 'Could not load your messages'}
            </p>
            <Button variant="outline" size="sm" onClick={() => threads.refetch()}>
              Try again
            </Button>
          </CardContent>
        </Card>
      )}

      {threads.isPending && <Skeleton className="h-[32rem] w-full rounded-xl" />}

      {!threads.isPending && !threads.isError && items.length === 0 && (
        <EmptyState
          icon={MessageSquare}
          title="No conversations yet"
          description={
            canStartConversation
              ? "Start one from an exhibitor's profile, or with the button above."
              : 'Exhibitors on your expos can reach you here for support. Their first message opens the conversation.'
          }
          action={
            canStartConversation ? (
              <NewConversationDialog
                onStarted={openThread}
                trigger={
                  <Button>
                    <SquarePen className="size-4" aria-hidden="true" />
                    New message
                  </Button>
                }
              />
            ) : undefined
          }
        />
      )}

      {items.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-[20rem_1fr]">
          <Card className={cn('h-fit overflow-hidden lg:max-h-[36rem]', activeId && 'hidden lg:block')}>
            <ul className="max-h-[36rem] divide-y divide-border overflow-y-auto">
              {items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => openThread(item.id)}
                    aria-current={item.id === activeId}
                    className={cn(
                      'flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors',
                      'relative hover:bg-accent focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring',
                      item.id === activeId &&
                        'bg-accent before:absolute before:inset-y-0 before:left-0 before:w-0.5 before:bg-primary'
                    )}
                  >
                    <Avatar className="size-9 shrink-0">
                      {item.counterpart?.avatarUrl && <AvatarImage src={item.counterpart.avatarUrl} alt="" />}
                      <AvatarFallback>{initials(item.counterpart?.name ?? '?')}</AvatarFallback>
                    </Avatar>

                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate text-body font-medium">{item.counterpart?.name}</span>
                        <span className="shrink-0 text-meta text-muted-foreground">
                          {formatRelative(item.lastMessageAt)}
                        </span>
                      </span>
                      <span className="mt-0.5 flex items-center gap-2">
                        <span className="line-clamp-1 flex-1 text-meta text-muted-foreground">
                          {item.lastMessagePreview}
                        </span>
                        {item.unreadCount > 0 && (
                          <Badge className="shrink-0 px-1.5 text-meta">{item.unreadCount}</Badge>
                        )}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </Card>

          <Card className={cn('flex h-[36rem] flex-col', !activeId && 'hidden lg:flex')}>
            {!activeId && (
              <div className="grid flex-1 place-items-center p-8 text-center">
                <div>
                  <MessageSquare className="mx-auto size-6 text-muted-foreground" aria-hidden="true" />
                  <p className="mt-2 text-item">Select a conversation</p>
                  <p className="mt-1 text-meta text-muted-foreground">Pick someone from the list to read and reply.</p>
                </div>
              </div>
            )}

            {activeId && (
              <>
                <header className="flex items-center gap-3 border-b border-border px-4 py-3">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="lg:hidden"
                    onClick={closeThread}
                    aria-label="Back to conversations"
                  >
                    <ArrowLeft className="size-4" />
                  </Button>
                  <Avatar className="size-8 shrink-0">
                    <AvatarFallback>{initials(counterpartName)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate text-item">{counterpartName}</p>
                    {thread.data?.thread.expoRef && typeof thread.data.thread.expoRef === 'object' && (
                      <p className="truncate text-meta text-muted-foreground">{thread.data.thread.expoRef.title}</p>
                    )}
                  </div>
                </header>

                <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
                  {thread.isPending &&
                    Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-2/3 rounded-xl" />)}

                  {messages.map((message) => {
                    const mine = String(message.senderRef?.id ?? message.senderRef?._id) === String(currentUserId);

                    return (
                      <motion.div
                        key={message.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: DURATION.micro, ease: EASE }}
                        className={cn('flex', mine ? 'justify-end' : 'justify-start')}
                      >
                        <div
                          className={cn(
                            'max-w-[80%] rounded-xl px-3.5 py-2.5',
                            mine
                              ? 'rounded-br-sm bg-primary text-primary-foreground'
                              : 'rounded-bl-sm bg-muted text-foreground'
                          )}
                        >
                          <p className="whitespace-pre-wrap break-words text-body">{message.body}</p>
                          <p className={cn('mt-1 text-meta', mine ? 'opacity-70' : 'text-muted-foreground')}>
                            {formatTime(message.createdAt)}
                          </p>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>

                <form onSubmit={send} className="flex items-end gap-2 border-t border-border p-3">
                  <label htmlFor="message-draft" className="sr-only">
                    Write a message
                  </label>
                  <Textarea
                    id="message-draft"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        send(e);
                      }
                    }}
                    rows={1}
                    placeholder="Write a message…"
                    className="max-h-32 min-h-11 flex-1 resize-none"
                  />
                  <Button type="submit" size="icon" disabled={!draft.trim()} aria-label="Send message">
                    <Send className="size-4" />
                  </Button>
                </form>
              </>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
