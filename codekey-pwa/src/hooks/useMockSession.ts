import { MOCK_SESSION, MOCK_HISTORY } from '../mock/mock-session';
import type { MockSession } from '../types/session-event';

// 第一期用 mock 驱动；第二期换成真实数据源，接口保持不变。
export function useMockSession(id?: string): MockSession {
  const found = MOCK_HISTORY.find((s) => s.id === id);
  return found || MOCK_SESSION;
}

export function useMockHistory(): MockSession[] {
  return MOCK_HISTORY;
}
