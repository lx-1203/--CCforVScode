import { useEffect, useRef } from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { ThemeProvider } from './components/ThemeProvider';
import { useAuth } from './hooks/useAuth';
import { WsClient } from './services/ws-client';
import { BindPage } from './pages/BindPage';
import { LoginPage } from './pages/LoginPage';
import { SessionDetailPage } from './pages/SessionDetailPage';
import { SessionsPage } from './pages/SessionsPage';
import { SettingsPage } from './pages/SettingsPage';
import { RELAY_WS } from './utils/constants';

function AppRoutes({ auth }: { auth: ReturnType<typeof useAuth> }) {
  const navigate = useNavigate();

  if (auth.loading) return null;

  return (
    <Routes>
      <Route path="/login" element={<LoginPage auth={auth} />} />
      <Route path="/bind" element={<BindPage auth={auth} />} />
      <Route
        path="/settings"
        element={
          auth.deviceId ? <SettingsPage auth={auth} /> : <Navigate to="/login" replace />
        }
      />
      <Route
        path="/sessions/:id"
        element={
          auth.deviceId ? <SessionDetailPage auth={auth} /> : <Navigate to="/login" replace />
        }
      />
      <Route
        path="/"
        element={
          auth.deviceId ? <SessionsPage auth={auth} /> : <Navigate to="/login" replace />
        }
      />
    </Routes>
  );
}

export default function App() {
  const auth = useAuth();
  const wsRef = useRef<WsClient | null>(null);

  useEffect(() => {
    if (!auth.deviceId || !auth.clientToken) {
      wsRef.current?.disconnect();
      wsRef.current = null;
      return;
    }

    const ws = new WsClient(RELAY_WS, auth.deviceId, auth.clientToken);
    ws.on('auth_failed', () => {
      auth.clearBinding();
    });
    ws.connect();
    wsRef.current = ws;

    return () => {
      ws.disconnect();
    };
  }, [auth.deviceId, auth.clientToken, auth.clearBinding]);

  return (
    <ThemeProvider>
      <AppRoutes auth={auth} />
    </ThemeProvider>
  );
}
