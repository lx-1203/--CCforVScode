import type { SessionEvent } from '../../types/session-event';
import { MessageBubble } from '../MessageBubble';
import { ToolCard } from '../ToolCard';

export function ConversationTab({ events }: { events: SessionEvent[] }) {
  if (events.length === 0) return <div className="empty-text" style={{ padding: '40px 0' }}>暂无对话</div>;
  return (
    <div className="conversation-tab">
      {events.map((evt) =>
        evt.type === 'message'
          ? <MessageBubble key={evt.id} evt={evt} />
          : <ToolCard key={evt.id} evt={evt} variant="inline" />
      )}
    </div>
  );
}
