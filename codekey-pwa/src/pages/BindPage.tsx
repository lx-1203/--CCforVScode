import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { publicRequest, userRequest } from '../api/client';
import type { AuthState } from '../hooks/useAuth';
import type { ConfirmResult, ClaimResult } from '../api/types';
import { setDeviceCredentials, setContentKey, clearContentKey } from '../auth/device-storage';
import { generateEcdhKeyPair, deriveKeyMaterial } from '../utils/encryption';

interface Props { auth: AuthState; }

export function BindPage({ auth }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const urlParams = new URLSearchParams(location.search);
  const urlCode = urlParams.get('code') || '';
  const urlKeyId = urlParams.get('key_id') || '';
  const urlContentKey = urlParams.get('content_key') || '';
  const hasE2EKey = !!(urlContentKey && urlKeyId);

  const [code, setCode] = useState(urlCode);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bound, setBound] = useState(false);
  const [confirmEcdh, setConfirmEcdh] = useState(false);

  async function bindWithCode(inputCode: string) {
    if (inputCode.length < 6) return;
    setBusy(true);
    setError(null);
    try {
      const ecdhKeyPair = await generateEcdhKeyPair();

      const confirm = await publicRequest<ConfirmResult>('/api/v1/devices/confirm', {
        method: 'POST',
        body: JSON.stringify({
          code: inputCode,
          platform: 'pwa',
          phonePublicKeyHex: ecdhKeyPair.publicKeyHex,
          e2eKeyReceived: hasE2EKey,
        }),
      });

      let ecdhDerived = false;
      let contentKey: string | undefined;
      let keyId: string | undefined;

      if (confirm.e2eAvailable && confirm.desktopPublicKeyHex) {
        const material = await deriveKeyMaterial(ecdhKeyPair.privateKey, confirm.desktopPublicKeyHex);
        contentKey = material.contentKeyHex;
        keyId = material.keyId;
        ecdhDerived = true;
      }

      if (!ecdhDerived && hasE2EKey) {
        contentKey = urlContentKey;
        keyId = urlKeyId;
      }

      await userRequest<ClaimResult>('/api/v1/auth/claim-device', {
        method: 'POST',
        body: JSON.stringify({ clientToken: confirm.clientToken }),
      });

      setDeviceCredentials(confirm.deviceId, confirm.clientToken);
      if (contentKey && keyId) {
        setContentKey(contentKey, keyId);
      } else {
        clearContentKey();
      }

      setConfirmEcdh(ecdhDerived);
      auth.refreshBinding();
      setBound(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Binding failed');
    } finally {
      setBusy(false);
    }
  }

  // Auto-submit URL code
  useEffect(() => {
    if (code && code.length >= 6) {
      const timer = setTimeout(() => { bindWithCode(code); }, 600);
      return () => clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    if (bound) {
      const timer = setTimeout(() => navigate('/', { replace: true }), 800);
      return () => clearTimeout(timer);
    }
  }, [bound]);

  return (
    <main className="shell">
      <header className="page-header">
        <button className="ghost-button" type="button" onClick={() => navigate('/')}>返回</button>
        <h1>绑定设备</h1>
      </header>

      {bound ? (
        <section className="tool-panel">
          <p className="success-text">设备绑定成功！</p>
          {confirmEcdh ? (
            <p className="success-text" style={{marginTop:8,fontSize:13}}>E2E 加密已通过 ECDH 密钥交换建立</p>
          ) : hasE2EKey ? (
            <p className="success-text" style={{marginTop:8,fontSize:13}}>E2E 加密密钥已保存</p>
          ) : (
            <p className="muted" style={{marginTop:8,fontSize:13}}>手动输入配对码无法启用 E2E 加密。请从 VS Code 扫码以启用加密。</p>
          )}
        </section>
      ) : (
        <section className="tool-panel">
          <label className="field-label" htmlFor="pair-code">配对码</label>
          <input
            id="pair-code"
            className="code-input"
            inputMode="text"
            maxLength={8}
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
            placeholder="A1B2C3"
          />
          {error && <p className="error-text">{error}</p>}
          <button
            className="primary-button"
            type="button"
            onClick={() => bindWithCode(code)}
            disabled={busy || code.length < 6}
            style={{width:'100%',marginTop:12}}
          >
            {busy ? '绑定中...' : '确认绑定'}
          </button>
        </section>
      )}
    </main>
  );
}
