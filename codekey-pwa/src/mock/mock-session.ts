import type { MockSession } from '../types/session-event';

export const MOCK_SESSION: MockSession = {
  id: 'sess_mock_001',
  title: '重构登录模块',
  agentType: 'claude_code',
  status: 'active',
  lastActiveAt: Date.now(),
  events: [
    { id: 'e1', role: 'user', type: 'message', text: '帮我把登录改成 JWT', ts: Date.now() - 60000 },
    { id: 'e2', role: 'assistant', type: 'message', text: '好的，我先看现有的 session 实现。', ts: Date.now() - 58000 },
    { id: 'e3', role: 'assistant', type: 'tool', toolName: 'Read', args: { file: 'auth.js' }, result: '已读取 120 行', riskLevel: 'medium', status: 'done', ts: Date.now() - 56000 },
    { id: 'e4', role: 'assistant', type: 'tool', toolName: 'Edit', args: { file: 'auth.js' }, result: '修改 3 处', riskLevel: 'low', status: 'done', ts: Date.now() - 54000 },
    { id: 'e5', role: 'assistant', type: 'tool', toolName: 'Bash', args: { command: 'npm test' }, riskLevel: 'high', status: 'pending', ts: Date.now() - 52000 },
    { id: 'e6', role: 'assistant', type: 'message', text: '等你在手机上批准后我就跑测试。', ts: Date.now() - 50000 },
    { id: 'e7', role: 'assistant', type: 'tool', toolName: 'Write', args: { file: 'jwt.js' }, result: '新建文件', riskLevel: 'low', status: 'done', ts: Date.now() - 48000 },
    { id: 'e8', role: 'assistant', type: 'tool', toolName: 'TodoWrite', result: '更新 4 项', riskLevel: 'low', status: 'done', ts: Date.now() - 46000 },
  ],
};

// 历史会话列表（HistoryTab 用）
export const MOCK_HISTORY: MockSession[] = [
  MOCK_SESSION,
  { id: 'sess_mock_002', title: '修复支付回调 bug', agentType: 'claude_code', status: 'finished', lastActiveAt: Date.now() - 3600_000, events: [] },
  { id: 'sess_mock_003', title: '写单元测试', agentType: 'claude_code', status: 'finished', lastActiveAt: Date.now() - 86400_000, events: [] },
];
