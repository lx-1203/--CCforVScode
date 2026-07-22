import type { SessionEvent } from '../types/session-event';
import { toolNameZh } from '../utils/toolName';
import { toolIcon } from '../utils/toolIcon';

const RISK_LABEL: Record<string, string> = { low: '低', medium: '中', high: '高' };
const STATUS_LABEL: Record<string, string> = { done: '完成', pending: '待审批', denied: '已拒绝' };

// variant='inline' 用于对话流内联；variant='list' 用于活动 tab。
export function ToolCard({ evt, variant = 'inline' }: { evt: SessionEvent; variant?: 'inline' | 'list' }) {
  const risk = evt.riskLevel || 'low';
  const argText = evt.args
    ? String((evt.args as any).file || (evt.args as any).command || (evt.args as any).pattern || '')
    : '';
  return (
    <div className={'tool-card tool-risk-' + risk + ' tool-' + variant}>
      <span className="tool-icon">{toolIcon(evt.toolName)}</span>
      <b className="tool-name">{toolNameZh(evt.toolName || '')}</b>
      {argText && <span className="tool-arg">{argText}</span>}
      {variant === 'list' && evt.status && (
        <span className={'tool-status status-' + evt.status}>{STATUS_LABEL[evt.status] || evt.status}</span>
      )}
      {variant === 'inline' && (
        <span className={'tool-risk-tag risk-' + risk}>{RISK_LABEL[risk]}</span>
      )}
    </div>
  );
}
