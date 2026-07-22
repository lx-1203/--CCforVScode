import type { SessionEvent } from '../types/session-event';

export function MessageBubble({ evt }: { evt: SessionEvent }) {
  const isUser = evt.role === 'user';
  return (
    <div className={isUser ? 'msg-bubble msg-user' : 'msg-bubble msg-assistant'}>
      <div className="msg-role">{isUser ? '你' : 'Claude'}</div>
      <div className="msg-text">{evt.text || ''}</div>
    </div>
  );
}
