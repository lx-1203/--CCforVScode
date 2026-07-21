import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDevices } from '../hooks/useDevices';
import type { AuthState } from '../hooks/useAuth';
import { publicRequest, userRequest } from '../api/client';
import { clearDeviceCredentials } from '../auth/device-storage';
import { BRAND_NAME } from '../utils/constants';
import { formatDate } from '../utils/format';

interface Props { auth: AuthState; }

export function SettingsPage({ auth }: Props) {
  const navigate = useNavigate();
  const { devices, loading } = useDevices();
  const [pairingCode, setPairingCode] = useState('');
  const [pairBusy, setPairBusy] = useState(false);
  const [pairError, setPairError] = useState<string | null>(null);

  async function handlePair() {
    setPairBusy(true);
    setPairError(null);
    try {
      const result = await userRequest<{ code: string }>('/api/v1/devices/pair', { method: 'POST' });
      setPairingCode(result.code);
    } catch (err) {
      setPairError(err instanceof Error ? err.message : '生成配对码失败');
    } finally {
      setPairBusy(false);
    }
  }

  async function handleUnbind(deviceId: string) {
    try {
      await userRequest('/api/v1/user/devices/' + deviceId, { method: 'DELETE' });
      clearDeviceCredentials();
      auth.logout();
      navigate('/login', { replace: true });
    } catch {}
  }

  function disconnect() {
    clearDeviceCredentials();
    auth.logout();
    navigate('/login', { replace: true });
  }

  return (
    <main className="shell">
      <header className="page-header">
        <button className="ghost-button" type="button" onClick={() => navigate('/')}>返回</button>
        <h1>设置</h1>
      </header>

      {/* Pairing section */}
      <section className="tool-panel" style={{marginBottom: 16}}>
        <h2 style={{margin:'0 0 12px',fontSize:16}}>绑定 PC 设备</h2>
        <p className="muted" style={{fontSize:12,marginBottom:12}}>
          在 VS Code 中执行 <strong>CodeKey: 绑定手机</strong> 命令获取配对码，然后在此输入。
        </p>

        {pairingCode ? (
          <div style={{textAlign:'center'}}>
            <div style={{
              fontSize: 16, fontWeight: 800, color: 'var(--xj-primary)',
              padding: '12px 0', background: 'var(--xj-primary-light)',
              borderRadius: 'var(--xj-radius-lg)', marginBottom: 8
            }}>
              请在 PC 端 CodeKey 中输入:
            </div>
            <div className="code-input" style={{pointerEvents:'none'}}>{pairingCode}</div>
          </div>
        ) : (
          <>
            <button
              className="primary-button"
              type="button"
              onClick={handlePair}
              disabled={pairBusy}
              style={{width:'100%'}}
            >
              {pairBusy ? '生成中...' : '生成配对码'}
            </button>
            {pairError && <p className="error-text" style={{marginTop:8}}>{pairError}</p>}
          </>
        )}
      </section>

      {/* Device list */}
      <section className="tool-panel" style={{marginBottom: 16}}>
        <div className="summary-header">
          <h2>已绑定设备 ({devices.length})</h2>
        </div>
        {loading ? (
          <p className="muted">加载中...</p>
        ) : devices.length === 0 ? (
          <div className="empty" style={{padding:40}}>
            <p className="empty-text">暂无已绑定设备</p>
          </div>
        ) : (
          <div className="device-manage-list">
            {devices.map(function(d) {
              return (
                <div key={d.id} className="device-manage-item">
                  <div className="device-manage-info">
                    <strong>{d.device_name}</strong>
                    <span className="muted" style={{fontSize:11}}>绑定于 {formatDate(d.bound_at)}</span>
                  </div>
                  <button
                    className="ghost-button danger-button"
                    style={{fontSize:12}}
                    onClick={function() { handleUnbind(d.id); }}
                  >
                    解绑
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* E2E section */}
      <section className="tool-panel" style={{marginBottom:16}}>
        <div className="e2e-section">
          <span className="e2e-section-title">端到端加密</span>
          <p className="muted" style={{fontSize:12}}>
            {auth.deviceId ? (
              <span className="e2e-ok">已启用 — 消息使用 AES-256-GCM 加密</span>
            ) : (
              <span className="e2e-stale">未绑定设备</span>
            )}
          </p>
        </div>
      </section>

      {/* Disconnect */}
      <button
        className="ghost-button danger-confirm"
        type="button"
        onClick={disconnect}
        style={{width:'100%',marginBottom:40}}
      >
        断开所有连接
      </button>

      <footer style={{padding:'24px 0',textAlign:'center',color:'var(--muted)',fontSize:11}}>
        {BRAND_NAME} PWA v1.0
      </footer>
    </main>
  );
}
