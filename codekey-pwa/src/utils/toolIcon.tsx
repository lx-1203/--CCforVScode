import { createElement, type ReactElement } from 'react';

// 按工具类型返回线性 SVG（currentColor 描边），不用 emoji。
// 未匹配的工具用通用「扳手」图标兜底。
function svg(path: ReactElement): ReactElement {
  return createElement(
    'svg',
    { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
      strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round',
      width: 14, height: 14 },
    path,
  );
}

const P = (d: string) => createElement('path', { d });

const ICONS: Record<string, ReactElement> = {
  Read: svg(P('M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6')),
  Write: svg(P('M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M12 18v-6 M9 15h6')),
  Edit: svg(P('M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7 M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4z')),
  Bash: svg(P('M4 17l6-6-6-6 M12 19h8')),
  Grep: svg(P('M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z M21 21l-4.35-4.35')),
  Glob: svg(P('M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z M21 21l-4.35-4.35')),
  TodoWrite: svg(P('M9 11l3 3L22 4 M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11')),
};

const FALLBACK = svg(P('M14.7 6.3a4 4 0 0 0 5 5l-8 8a2.8 2.8 0 0 1-4-4l8-8z'));

export function toolIcon(name?: string): ReactElement {
  if (name && ICONS[name]) return ICONS[name];
  if (name && name.startsWith('mcp__')) return FALLBACK;
  return FALLBACK;
}
