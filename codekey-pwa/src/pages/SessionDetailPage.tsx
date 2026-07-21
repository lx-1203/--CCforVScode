import { useNavigate, useParams } from 'react-router-dom';
import { useState, useEffect, createElement } from 'react';
import { userRequest } from '../api/client';
import type { UserSession, UserEvent } from '../api/types';
import type { AuthState } from '../hooks/useAuth';
import { APP_NAME } from '../utils/constants';
import { formatTimeAgo } from '../utils/format';
import { getSessionDisplayName } from '../utils/session-display';

interface Props { auth: AuthState; }

export function SessionDetailPage({ auth }: Props) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [session, setSession] = useState<UserSession | null>(null);
  const [events, setEvents] = useState<UserEvent[]>([]);
  const [replyText, setReplyText] = useState('');

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const sessions = await userRequest<UserSession[]>('/api/v1/user/sessions');
        const found = sessions.find(function(s) { return s.id === id; });
        if (active && found) setSession(found);
      } catch {}
      try {
        const evts = await userRequest<UserEvent[]>('/api/v1/user/sessions/' + id + '/events');
        if (active) setEvents(evts);
      } catch {}
    }
    load();
    const interval = setInterval(load, 5000);
    return function() { active = false; clearInterval(interval); };
  }, [id]);

  function approveEvent(eventId: string) {
    userRequest('/api/v1/user/events/' + eventId + '/respond', {
      method: 'POST',
      body: JSON.stringify({ decision: 'approve' }),
    }).catch(function() {});
  }

  function denyEvent(eventId: string) {
    userRequest('/api/v1/user/events/' + eventId + '/respond', {
      method: 'POST',
      body: JSON.stringify({ decision: 'deny', message: replyText }),
    }).catch(function() {});
  }

  if (!session) {
    return (
      <main className="detail-shell">
        <header className="detail-topbar">
          <button className="back-btn" onClick={() => navigate('/')}>&#8592;</button>
          <div className="title-wrap"><h1 className="detail-title">加载中...</h1></div>
        </header>
      </main>
    );
  }

  return (
    <main className="detail-shell">
      <header className="detail-topbar">
        <button className="back-btn" onClick={() => navigate('/')}>&#8592;</button>
        <div className="title-wrap">
          <h1 className="detail-title">{getSessionDisplayName(session)}</h1>
          <span className="detail-subtitle">{session.agent_type} · {session.status}</span>
        </div>
        <span className={'ws-indicator' + (session.status === 'active' ? ' online' : '')}>
          <span className="ws-dot" />
        </span>
      </header>

      <div className="timeline">
        {events.length === 0 ? (
          <div className="empty" style={{padding: '60px 20px 0'}}>
            <p className="empty-text">暂无事件</p>
          </div>
        ) : (
          events.map(function(evt) {
            var isPending = evt.pending;
            var decision = evt.decision;
            return (
              <div
                key={evt.id}
                className={'timeline-card' + (isPending ? ' accent-pending' : '')
                  + (decision === 'approve' ? ' accent-approved' : '')
                  + (decision === 'deny' ? ' accent-denied' : '')
                }
                style={{marginBottom: 8}}
              >
                <div className="event-header">
                  <span className={'event-type event-type-' + (evt.type || 'unknown')}>
                    {evt.type || 'event'}
                  </span>
                  {evt.risk_level && (
                    <span className={'risk-' + evt.risk_level}>{evt.risk_level}</span>
                  )}
                  {isPending && <span className="pending-pulse"><span className="pulse-dot" />等待中</span>}
                  {decision && (
                    <span className={'decision-' + decision}>
                      {decision === 'approve' ? '已批准' : decision === 'deny' ? '已拒绝' : decision}
                    </span>
                  )}
                </div>

                {evt.data && typeof evt.data === 'object' && 'summary' in (evt.data as any) ? (
                  createElement('div', { className: 'event-summary' }, String((evt.data as any).summary))
                ) : null}

                {isPending && session.status === 'active' && (
                  <div className="approval-actions">
                    <div className="reply-row">
                      <input
                        className="reply-input"
                        placeholder="回复消息 (可选)..."
                        value={replyText}
                        onChange={function(e) { setReplyText(e.target.value); }}
                      />
                    </div>
                    <div className="decision-buttons">
                      <button
                        className="ghost-button btn-sm decision-btn-approve"
                        onClick={function() { approveEvent(evt.id); }}
                      >
                        批准
                      </button>
                      <button
                        className="ghost-button btn-sm decision-btn-deny"
                        onClick={function() { denyEvent(evt.id); }}
                      >
                        拒绝
                      </button>
                    </div>
                  </div>
                )}

                <div className="event-footer">
                  <span>{formatTimeAgo(evt.created_at)}</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </main>
  );
}
