import { useEffect, useState } from 'react';
import { userRequest } from '../api/client';
import type { UserSession } from '../api/types';

export function useSessions() {
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(function() {
    var active = true;
    async function load() {
      try {
        var data = await userRequest<UserSession[]>('/api/v1/user/sessions');
        if (active) setSessions(data);
      } catch (e) { /* ignore */ }
      if (active) setLoading(false);
    }
    load();
    var interval = setInterval(load, 5000);
    return function() { active = false; clearInterval(interval); };
  }, []);

  return { sessions, loading };
}
