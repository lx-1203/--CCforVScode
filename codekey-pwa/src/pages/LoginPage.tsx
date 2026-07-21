import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { BRAND_NAME } from '../utils/constants';

interface Props { auth: ReturnType<typeof useAuth>; }

export function LoginPage({ auth }: Props) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  async function handleLogin() {
    if (code.length < 6) return;
    setBusy(true);
    try {
      await auth.login(code);
      navigate('/', { replace: true });
    } catch (e) {
      /* error shown via auth.error */
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="shell">
      <section className="login-panel">
        <h1 style={{textAlign:'center'}}>{BRAND_NAME}</h1>
        <p style={{textAlign:'center',marginTop:8}}>手机远程控制 AI 代码代理</p>

        <div style={{marginTop:24}}>
          <label className="field-label" htmlFor="pair-code">输入配对码</label>
          <input
            id="pair-code"
            className="code-input"
            inputMode="text"
            maxLength={8}
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
            placeholder="A1B2C3"
            autoFocus
          />
        </div>

        {auth.error && <p className="error-text" style={{marginTop:12}}>{auth.error}</p>}

        <button
          className="primary-button"
          type="button"
          onClick={() => handleLogin()}
          disabled={busy || code.length < 6}
          style={{width:'100%',marginTop:16}}
        >
          {busy ? '连接中...' : '绑定设备'}
        </button>

        <section className="howto-panel" style={{marginTop:24}}>
          <h2>如何使用</h2>
          <ol>
            <li>安装 <strong>星迹的CC</strong> VS Code 扩展</li>
            <li>在 VS Code 中执行 <strong>CodeKey: 绑定手机</strong> 命令生成配对码</li>
            <li>在此输入配对码完成绑定</li>
            <li>AI 需要审批时，这里会实时弹出通知</li>
          </ol>
        </section>
      </section>
    </main>
  );
}
