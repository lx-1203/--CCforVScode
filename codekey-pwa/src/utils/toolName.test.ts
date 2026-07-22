import { describe, it, expect } from 'vitest';
import { toolNameZh } from './toolName';

describe('toolNameZh', () => {
  it('翻译已知工具', () => {
    expect(toolNameZh('Read')).toBe('读取');
    expect(toolNameZh('Bash')).toBe('终端');
    expect(toolNameZh('Edit')).toBe('编辑');
    expect(toolNameZh('TodoWrite')).toBe('更新待办');
  });
  it('MCP 工具走规则引擎', () => {
    expect(toolNameZh('mcp__iconfont__search_icons')).toBe('MCP工具');
  });
  it('未知工具保持原文', () => {
    expect(toolNameZh('SomeUnknownTool')).toBe('SomeUnknownTool');
  });
});
