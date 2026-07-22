// 手机镜像界面统一事件模型。第二期真实数据只要产出此结构，UI 无需改动。
export interface SessionEvent {
  id: string;
  role: 'user' | 'assistant';
  type: 'message' | 'tool';
  text?: string;                              // type=message
  toolName?: string;                          // type=tool，英文原名（渲染时中文化）
  args?: Record<string, unknown>;             // 工具参数
  result?: string;                            // 工具结果摘要
  riskLevel?: 'low' | 'medium' | 'high';
  status?: 'done' | 'pending' | 'denied';
  ts: number;                                 // 毫秒时间戳
}

export interface MockSession {
  id: string;
  title: string;
  agentType: string;
  status: 'active' | 'paused' | 'finished';
  lastActiveAt: number;
  events: SessionEvent[];
}
