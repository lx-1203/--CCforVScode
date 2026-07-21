import { useEffect, useState } from 'react';
import { userRequest } from '../api/client';
import type { UserDevice } from '../api/types';

export function useDevices() {
  const [devices, setDevices] = useState<UserDevice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(function() {
    var active = true;
    async function load() {
      try {
        var data = await userRequest<UserDevice[]>('/api/v1/user/devices');
        if (active) setDevices(data);
      } catch (e) { /* ignore */ }
      if (active) setLoading(false);
    }
    load();
    return function() { active = false; };
  }, []);

  return { devices, loading, refresh: function() { setLoading(true); } };
}
