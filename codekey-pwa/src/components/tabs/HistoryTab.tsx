import type { MockSession } from '../../types/session-event';

const STATUS_LABEL: Record<string, string> = { active: '进行中', paused: '已暂停', finished: '已结束' };

export function HistoryTab({ sessions, onOpen }: { sessions: MockSession[]; onOpen: (id: string) => void }) {
  return (
    <div className="history-tab">
      {sessions.map((s) => (
        <button key={s.id} className="history-item" onClick={() => onOpen(s.id)}>
          <span className="history-title">{s.title}</span>
          <span className={'history-status hs-' + s.status}>{STATUS_LABEL[s.status] || s.status}</span>
        </button>
      ))}
    </div>
  );
}
