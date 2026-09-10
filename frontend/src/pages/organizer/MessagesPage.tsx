import { MessagesScreen } from '@/components/messaging/MessagesScreen';

export default function OrganizerMessagesPage() {
  return (
    <MessagesScreen
      description="Support requests from exhibitors on your expos. Replies go straight back to their inbox."
      canStartConversation={false}
    />
  );
}
