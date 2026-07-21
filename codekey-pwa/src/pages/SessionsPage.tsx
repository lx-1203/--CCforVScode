import { useNavigate } from 'react-router-dom';
import { useSessions } from '../hooks/useSessions';
import { useDevices } from '../hooks/useDevices';
import type { AuthState } from '../hooks/useAuth';
import { BRAND_NAME } from '../utils/constants';
import { formatTimeAgo } from '../utils/format';

interface Props { auth: AuthState; }

export function SessionsPage({ auth }: Props) {
  const navigate = useNavigate();
  const { sessions, loading } = useSessions();
  const { devices } = useDevices();
  const connected = devices.length > 0;

  return (
    <main className="shell">
      <div className="sessions-topbar">
        <div className="topbar-left">
          <h1 className="brand">{BRAND_NAME}</h1>
          <p className="brand-sub">手机远程控制 AI 代码代理</p>
        </div>
        <div className="top-actions">
          <div className={'conn-pill' + (connected ? ' online' : '')}>
            <span className="conn-dot" />
            {connected ? '已连接' : '未连接'}
          </div>
          <button className="icon-btn-wrap" onClick={() => navigate('/settings')} title="设置">
            &#9881;
          </button>
        </div>
      </div>

      {!connected && (
        <div className="pending-alert">
          还没有绑定设备，请先点击设置 → 绑定 PC
        </div>
      )}

      {loading ? (
        <div className="empty">
          <p className="empty-text">加载中...</p>
        </div>
      ) : sessions.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">&#128172;</div>
          <h2 className="empty-title">暂无活跃会话</h2>
          <p className="empty-text">在 PC 上启动 Claude Code 后，会话会自动出现在这里</p>
        </div>
      ) : (
        <div className="session-list">
          {sessions.map((s) => (
            <div
              key={s.id}
              className={'session-card' + (s.status === 'active' ? ' connected' : '')}
              onClick={() => navigate('/sessions/' + s.id)}
            >
              <div className={'conn-bar agent-' + s.agent_type} />
              <div className="card-body">
                <div className="card-top">
                  <div className="card-title-row">
                    <h2 className="session-title">
                      {s.metadata?.title || s.metadata?.claudeSessionId || (s.agent_type + ' 会话')}
                    </h2>
                  </div>
                </div>
                <div className="card-footer">
                  <span className="session-time">{formatTimeAgo(s.last_active_at)}</span>
                  {s.pending_count > 0 && (
                    <span className="pending-count">{s.pending_count}</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <footer style={{padding:'24px 0',textAlign:'center',color:'var(--muted)',fontSize:'11px'}}>
        {BRAND_NAME} PWA v1.0
      </footer>
    </main>
  );
}
