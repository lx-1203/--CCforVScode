import type { UserSession } from '../api/types';

export function getSessionDisplayName(session: UserSession): string {
  return session.metadata?.title
    || session.metadata?.claudeSessionId
    || (session.agent_type + ' ' + session.id.slice(0, 8));
}

export function getSessionSubtitle(session: UserSession): string {
  const parts: string[] = [];
  if (session.metadata?.cwd) parts.push(session.metadata.cwd);
  parts.push(session.agent_type);
  return parts.join(' · ');
}
