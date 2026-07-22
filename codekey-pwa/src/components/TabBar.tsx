import { createElement, type ReactElement } from 'react';

export type TabKey = 'conversation' | 'activity' | 'history';

function icon(path: string): ReactElement {
  return createElement('svg',
    { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2,
      strokeLinecap: 'round', strokeLinejoin: 'round', width: 18, height: 18 },
    createElement('path', { d: path }));
}

const TABS: { key: TabKey; label: string; icon: ReactElement }[] = [
  { key: 'conversation', label: '对话', icon: icon('M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8z') },
  { key: 'activity', label: '活动', icon: icon('M22 12h-4l-3 9L9 3l-3 9H2') },
  { key: 'history', label: '历史', icon: icon('M12 8v4l3 2 M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z') },
];

export function TabBar({ active, onChange }: { active: TabKey; onChange: (k: TabKey) => void }) {
  return (
    <div className="tab-bar">
      {TABS.map((t) => (
        <button
          key={t.key}
          className={'tab-item' + (active === t.key ? ' tab-active' : '')}
          onClick={() => onChange(t.key)}
        >
          {t.icon}
          <span>{t.label}</span>
        </button>
      ))}
    </div>
  );
}
