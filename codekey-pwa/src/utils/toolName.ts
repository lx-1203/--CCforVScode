// 复用 extension/webview/index.js 的 _toolNameZh，保证与桌面端一致
const MAP: Record<string, string> = {
  Edit: '编辑', Write: '写入', AskUserQuestion: '提问',
  CronCreate: '创建定时任务', CronDelete: '删除定时任务', CronList: '列出定时任务',
  EnterPlanMode: '进入计划模式', ExitPlanMode: '退出计划模式',
  EnterWorktree: '进入工作树', ExitWorktree: '退出工作树',
  TaskStop: '停止任务', TaskOutput: '任务输出', TaskCreate: '创建任务',
  TaskUpdate: '更新任务', TaskList: '列出任务', TaskGet: '获取任务',
  Read: '读取', ReadCoalesced: '读取', Glob: '查找', Grep: '搜索',
  Bash: '终端', BashOutput: '终端输出', KillShell: '终止终端',
  TodoWrite: '更新待办', WebFetch: '网页抓取', WebSearch: '网络搜索',
  NotebookEdit: '编辑笔记本单元格', Skill: '技能', Agent: '智能体',
  Search: '检索', ToolSearch: '搜索工具', SendMessage: '发送消息',
  ScheduleWakeup: '定时唤醒', Workflow: '工作流', DesignSync: '设计同步',
  ReportFindings: '报告发现', MultiEdit: '多重编辑',
};

export function toolNameZh(name: string): string {
  if (!name) return '';
  if (name.startsWith('mcp__')) return 'MCP工具';
  return MAP[name] || name;
}
