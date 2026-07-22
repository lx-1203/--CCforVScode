import { useNavigate, useParams } from 'react-router-dom';
import { useState } from 'react';
import type { AuthState } from '../hooks/useAuth';
import { useMockSession, useMockHistory } from '../hooks/useMockSession';
import { TabBar, type TabKey } from '../components/TabBar';
import { ConversationTab } from '../components/tabs/ConversationTab';
import { ActivityTab } from '../components/tabs/ActivityTab';
import { HistoryTab } from '../components/tabs/HistoryTab';
import { CommandInput } from '../components/CommandInput';

interface Props { auth: AuthState; }

export function SessionDetailPage(_props: Props) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const session = useMockSession(id);
  const history = useMockHistory();
  const [tab, setTab] = useState<TabKey>('conversation');

  return (
    <main className="detail-shell">
      <header className="detail-topbar">
        <button className="back-btn" onClick={() => navigate('/')}>&#8592;</button>
        <div className="title-wrap">
          <h1 className="detail-title">{session.title}</h1>
          <span className="detail-subtitle">{session.agentType} · {session.status}</span>
        </div>
        <span className={'ws-indicator' + (session.status === 'active' ? ' online' : '')}>
          <span className="ws-dot" />
        </span>
      </header>

      <div className="tab-body">
        {tab === 'conversation' && <ConversationTab events={session.events} />}
        {tab === 'activity' && <ActivityTab events={session.events} />}
        {tab === 'history' && <HistoryTab sessions={history} onOpen={(sid) => { setTab('conversation'); navigate('/sessions/' + sid); }} />}
      </div>

      {tab === 'conversation' && (
        <CommandInput onSend={(t) => console.log('[mock] 发送指令:', t)} />
      )}

      <TabBar active={tab} onChange={setTab} />
    </main>
  );
}
