import { useCallback, useEffect, useState } from 'react';
import { AUTH_EXPIRED_EVENT, CLIENT_TOKEN_INVALID_EVENT, publicRequest, userRequest } from '../api/client';
import type { UserDevice } from '../api/types';
import { getDeviceId, getClientToken, setDeviceCredentials, clearDeviceCredentials } from '../auth/device-storage';
import { RELAY_API } from '../utils/constants';

export interface AuthState {
  token: string | null;
  deviceId: string | null;
  clientToken: string | null;
  loading: boolean;
  error: string | null;
  login: (pairingCode: string) => Promise<void>;
  logout: () => void;
  refreshBinding: () => void;
  clearBinding: () => void;
}

export function useAuth(): AuthState {
  var _a = useState<string | null>(null), token = _a[0], setToken = _a[1];
  var _b = useState<string | null>(function() { return getDeviceId(); }), deviceId = _b[0], setDeviceId = _b[1];
  var _c = useState<string | null>(function() { return getClientToken(); }), clientToken = _c[0], setClientToken = _c[1];
  var _d = useState(false), loading = _d[0], setLoading = _d[1];
  var _e = useState<string | null>(null), error = _e[0], setError = _e[1];

  // Login via pairing code: confirm → get clientToken → save locally
  var login = useCallback(async function(pairingCode: string) {
    setLoading(true);
    setError(null);
    try {
      // Step 1: Confirm pairing code → get clientToken + deviceId
      var confirmResult = await publicRequest<{ clientToken: string; deviceId: string; success: boolean }>(
        '/api/v1/devices/confirm',
        {
          method: 'POST',
          body: JSON.stringify({ code: pairingCode, platform: 'pwa', device_name: '手机' }),
        }
      );
      if (!confirmResult.clientToken || !confirmResult.success) {
        throw new Error('配对码无效或已过期');
      }

      // Step 2: Claim device → get user auth
      var claimResult = await publicRequest<{ success: boolean; deviceId: string }>(
        '/api/v1/auth/claim-device',
        {
          method: 'POST',
          body: JSON.stringify({ clientToken: confirmResult.clientToken }),
        }
      );
      if (!claimResult.success) {
        throw new Error('设备绑定失败，请重试');
      }

      // Step 3: Save credentials locally
      setDeviceCredentials(confirmResult.deviceId, confirmResult.clientToken);
      setDeviceId(confirmResult.deviceId);
      setClientToken(confirmResult.clientToken);
      setToken('logged-in'); // marker token
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  var logout = useCallback(function() {
    clearDeviceCredentials();
    setToken(null);
    setDeviceId(null);
    setClientToken(null);
  }, []);

  var refreshBinding = useCallback(function() {
    setDeviceId(getDeviceId());
    setClientToken(getClientToken());
  }, []);

  var clearBinding = useCallback(function() {
    clearDeviceCredentials();
    setDeviceId(null);
    setClientToken(null);
  }, []);

  // Restore session from localStorage on mount
  useEffect(function() {
    var savedDid = getDeviceId();
    var savedCt = getClientToken();
    if (savedDid && savedCt) {
      setDeviceId(savedDid);
      setClientToken(savedCt);
      setToken('logged-in');
    }
    setLoading(false);
  }, []);

  // Cleanup on auth events
  useEffect(function() {
    function handleAuthExpired() {
      clearDeviceCredentials();
      setToken(null);
      setDeviceId(null);
      setClientToken(null);
    }
    window.addEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired);
    return function() { window.removeEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired); };
  }, []);

  return { token, deviceId, clientToken, loading, error, login, logout, refreshBinding, clearBinding };
}
