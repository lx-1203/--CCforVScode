import { useState } from 'react';
import type { SessionEvent } from '../../types/session-event';
import { ToolCard } from '../ToolCard';

export function ActivityTab({ events }: { events: SessionEvent[] }) {
  const [filter, setFilter] = useState<'all' | 'pending'>('all');
  const tools = events.filter((e) => e.type === 'tool');
  const shown = filter === 'pending' ? tools.filter((t) => t.status === 'pending') : tools;
  return (
    <div className="activity-tab">
      <div className="activity-filter">
        <button className={filter === 'all' ? 'on' : ''} onClick={() => setFilter('all')}>全部</button>
        <button className={filter === 'pending' ? 'on' : ''} onClick={() => setFilter('pending')}>待审批</button>
      </div>
      {shown.length === 0
        ? <div className="empty-text" style={{ padding: '40px 0' }}>暂无工具调用</div>
        : shown.map((evt) => <ToolCard key={evt.id} evt={evt} variant="list" />)}
    </div>
  );
}
