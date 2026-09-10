import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Users } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { useContacts, useSendMessage } from '@/hooks/useMessages';
import { useExpos } from '@/hooks/useExpos';
import { ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { Contact } from '@/types';

const initials = (name: string) =>
  name
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

interface Props {
  trigger: React.ReactNode;
  onStarted: (threadId: string) => void;
  presetRecipient?: { userId: string; name: string; expoId: string };
}

export function NewConversationDialog({ trigger, onStarted, presetRecipient }: Props) {
  const [open, setOpen] = useState(false);
  const [expoId, setExpoId] = useState(presetRecipient?.expoId ?? '');
  const [recipientId, setRecipientId] = useState(presetRecipient?.userId ?? '');
  const [body, setBody] = useState('');

  const { data: expos } = useExpos({ limit: 50 });
  const contacts = useContacts(expoId || undefined);
  const sendMessage = useSendMessage();

  const expoOptions = expos?.items ?? [];

  useEffect(() => {
    if (open && !expoId && expoOptions.length > 0) setExpoId(expoOptions[0].id);
  }, [open, expoId, expoOptions]);

  // Switching expo invalidates a recipient who is not on the new one.
  useEffect(() => {
    if (presetRecipient) return;
    setRecipientId('');
  }, [expoId, presetRecipient]);

  const items = contacts.data?.items ?? [];

  // Contacts arrive tagged by group, so exhibitors see "Organizer" separately
  // from "Neighboring exhibitors".
  const grouped = items.reduce<Record<string, Contact[]>>((acc, contact) => {
    acc[contact.group] = [...(acc[contact.group] ?? []), contact];
    return acc;
  }, {});

  const send = async () => {
    const text = body.trim();
    if (!recipientId || !text) return;

    try {
      const result = await sendMessage.mutateAsync({
        recipientRef: recipientId,
        expoRef: expoId || undefined,
        body: text,
      });

      toast.success('Message sent');
      setBody('');
      setOpen(false);
      onStarted(result.threadId);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Could not send that message');
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>New message</DialogTitle>
          <DialogDescription>
            {presetRecipient
              ? `Start a conversation with ${presetRecipient.name}.`
              : 'Pick who you would like to reach and write your first message.'}
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-5">
          {!presetRecipient && expoOptions.length > 0 && (
            <div className="grid gap-2">
              <Label htmlFor="new-message-expo">Expo</Label>
              <Select value={expoId} onValueChange={setExpoId}>
                <SelectTrigger id="new-message-expo">
                  <SelectValue placeholder="Choose an expo" />
                </SelectTrigger>
                <SelectContent>
                  {expoOptions.map((expo) => (
                    <SelectItem key={expo.id} value={expo.id}>
                      {expo.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {!presetRecipient && (
            <div className="grid gap-2">
              <p className="text-body font-medium">Who are you messaging?</p>

              {contacts.isPending && expoId && <Skeleton className="h-32 w-full rounded-lg" />}

              {!contacts.isPending && items.length === 0 && (
                <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center">
                  <Users className="mx-auto size-5 text-muted-foreground" aria-hidden="true" />
                  <p className="mt-2 text-body font-medium">Nobody to message yet</p>
                  <p className="mt-1 text-meta text-muted-foreground">
                    Exhibitors become reachable once an organizer approves them.
                  </p>
                </div>
              )}

              {Object.entries(grouped).map(([group, contactList]) => (
                <div key={group} className="space-y-1.5">
                  <p className="text-body font-semibold text-foreground">{group}</p>
                  <ul className="space-y-1">
                    {contactList.map((contact) => (
                      <li key={contact.userId}>
                        <button
                          type="button"
                          onClick={() => setRecipientId(contact.userId)}
                          aria-pressed={recipientId === contact.userId}
                          className={cn(
                            'flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors',
                            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                            recipientId === contact.userId
                              ? 'border-primary bg-accent text-accent-foreground'
                              : 'border-border hover:bg-accent hover:text-accent-foreground'
                          )}
                        >
                          <Avatar className="size-8 shrink-0">
                            {contact.avatarUrl && <AvatarImage src={contact.avatarUrl} alt="" />}
                            <AvatarFallback>{initials(contact.name)}</AvatarFallback>
                          </Avatar>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-body font-medium">{contact.name}</span>
                            <span className="block truncate text-meta text-muted-foreground">{contact.subtitle}</span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}

          <div className="grid gap-2">
            <Label htmlFor="new-message-body">Message</Label>
            <Textarea
              id="new-message-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              placeholder="Do you have a demo running on the stand?"
            />
          </div>
        </DialogBody>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={send}
            loading={sendMessage.isPending}
            disabled={!recipientId || !body.trim()}
          >
            Send message
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
