import { useCallback, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { http } from '@/lib/api';
import { useSocket } from '@/hooks/useSocket';
import type { ChatMessage, Contact, MessageNewEvent, MessageThread } from '@/types';

export const messageKeys = {
  threads: ['messages', 'threads'] as const,
  thread: (id: string) => ['messages', 'thread', id] as const,
  contacts: (expoId: string) => ['messages', 'contacts', expoId] as const,
};

interface ThreadsResponse {
  items: MessageThread[];
  totalUnread: number;
}

interface ThreadResponse {
  thread: MessageThread;
  messages: ChatMessage[];
}

export function useThreads() {
  return useQuery({
    queryKey: messageKeys.threads,
    queryFn: () => http.get<ThreadsResponse>('/messages/threads'),
  });
}

/** opening a thread marks it read server-side, so the badge clears on load. */
export function useThread(threadId: string | undefined) {
  return useQuery({
    queryKey: messageKeys.thread(threadId ?? ''),
    queryFn: () => http.get<ThreadResponse>(`/messages/thread/${threadId}`),
    enabled: Boolean(threadId),
  });
}

export function useContacts(expoId: string | undefined) {
  return useQuery({
    queryKey: messageKeys.contacts(expoId ?? ''),
    queryFn: () => http.get<{ items: Contact[] }>(`/messages/contacts?expoRef=${expoId}`),
    enabled: Boolean(expoId),
  });
}

export interface SendMessageInput {
  threadRef?: string;
  recipientRef?: string;
  expoRef?: string;
  subject?: string;
  body: string;
}

export function useSendMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SendMessageInput) =>
      http.post<{ message: ChatMessage; threadId: string }>('/messages', input),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: messageKeys.threads });
      queryClient.invalidateQueries({ queryKey: messageKeys.thread(data.threadId) });
    },
  });
}

/**
 * keeps the inbox and any open conversation live.
 */
export function useLiveMessages(openThreadId?: string) {
  const queryClient = useQueryClient();
  const { socket, connected } = useSocket();

  const handler = useCallback(
    (event: MessageNewEvent) => {
      queryClient.setQueryData<ThreadResponse>(messageKeys.thread(event.threadId), (current) => {
        if (!current) return current;
        // guard against the echo of a message this tab already rendered.
        if (current.messages.some((m) => m.id === event.message.id)) return current;
        return { ...current, messages: [...current.messages, event.message] };
      });

      queryClient.invalidateQueries({ queryKey: messageKeys.threads });
    },
    [queryClient]
  );

  useEffect(() => {
    if (!socket) return;

    socket.on('message:new', handler);
    // the sender's other tabs get the same treatment.
    socket.on('message:sent', handler);

    return () => {
      socket.off('message:new', handler);
      socket.off('message:sent', handler);
    };
  }, [socket, handler, openThreadId]);

  return { connected };
}
