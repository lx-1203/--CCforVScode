# 星迹的CC - 设计令牌参考

> 提取自 `xingjiclaudecode` 扩展 v2.1.95 (fork from official Claude Code 2.1.93)
> 提取日期: 2026-07-21

---

## 品牌

- **displayName**: 星迹的CC
- **publisher**: xingji
- **版本**: 2.1.95
- **图标**: `resources/claude-logo.png` / `resources/claude-logo.svg`
- **描述**: 基于 Claude Code 的汉化增强版 (预发送 Pre-Send 功能)

## 品牌色 (Claude 主题色)

| 令牌 | 值 | 用途 |
|------|-----|------|
| `--app-claude-orange` | `#d97757` | 主色调 (链接、强调、spinner) |
| `--app-claude-clay-button-orange` | `#c6613f` | 发送按钮、主要按钮背景 |
| `--app-claude-ivory` | `#faf9f5` | 发送按钮文字色 (浅色) |
| `--app-claude-slate` | `#141413` | 深色文字 |

## VSCode 主题变量 (--vscode-*)

扩展通过 CSS 变量完全适配 VSCode 主题，未硬编码颜色值。以下是所有引用的变量：

### 基础前景/背景
| 变量 | 用途 |
|------|------|
| `--vscode-foreground` | 主文字色 → `--app-primary-foreground` |
| `--vscode-sideBar-background` | 主背景 → `--app-primary-background` |
| `--vscode-editor-background` | 次要背景 → `--app-secondary-background` |
| `--vscode-descriptionForeground` | 次要文字 → `--app-secondary-foreground` |

### 输入框
| 变量 | 用途 |
|------|------|
| `--vscode-input-background` | 输入框背景 |
| `--vscode-input-foreground` | 输入框文字 |
| `--vscode-input-placeholderForeground` | placeholder 文字 |
| `--vscode-inputOption-activeBorder` | 聚焦边框 |
| `--vscode-inputOption-hoverBackground` | 悬停背景 |
| `--vscode-inlineChatInput-border` | 输入框边框 |

### 按钮
| 变量 | 用途 |
|------|------|
| `--vscode-button-background` | 按钮背景 |
| `--vscode-button-foreground` | 按钮文字 |
| `--vscode-button-border` | 按钮边框 |
| `--vscode-button-hoverBackground` | 按钮悬停 |
| `--vscode-button-secondaryBackground` | 次要按钮背景 |
| `--vscode-button-secondaryForeground` | 次要按钮文字 |
| `--vscode-button-secondaryHoverBackground` | 次要按钮悬停 |
| `--vscode-button-separator` | 按钮分隔线 |
| `--vscode-focusBorder` | 聚焦轮廓 |

### 菜单/列表
| 变量 | 用途 |
|------|------|
| `--vscode-menu-background` | 菜单背景 |
| `--vscode-menu-foreground` | 菜单文字 |
| `--vscode-menu-border` | 菜单边框 |
| `--vscode-menu-selectionBackground` | 菜单选中背景 |
| `--vscode-menu-selectionBorder` | 菜单选中边框 |
| `--vscode-menu-selectionForeground` | 菜单选中文字 |
| `--vscode-list-hoverBackground` | 列表悬停 |
| `--vscode-list-activeSelectionBackground` | 列表选中背景 |
| `--vscode-list-activeSelectionForeground` | 列表选中文字 |
| `--vscode-list-highlightForeground` | 列表高亮文字 |
| `--vscode-list-focusHighlightForeground` | 列表聚焦高亮 |

### 徽章
| 变量 | 用途 |
|------|------|
| `--vscode-badge-background` | 徽章背景 |
| `--vscode-badge-foreground` | 徽章文字 |

### 状态/语义色
| 变量 | 用途 |
|------|------|
| `--vscode-errorForeground` | 错误色 |
| `--vscode-charts-green` | 成功/进行中 (busy 状态) |
| `--vscode-charts-blue` | 等待中 (pending 状态) |
| `--vscode-gitDecoration-addedResourceForeground` | 添加/成功 |
| `--vscode-gitDecoration-deletedResourceForeground` | 删除/失败 |
| `--vscode-disabledForeground` | 禁用态 |

### 编辑器相关
| 变量 | 用途 |
|------|------|
| `--vscode-editor-font-family` | 等宽字体族 |
| `--vscode-editor-font-size` | 等宽字体大小 |
| `--vscode-editor-foreground` | 编辑器文字 |
| `--vscode-editor-lineHighlightBackground` | 当前行高亮 |
| `--vscode-editorWidget-background` | 编辑器控件背景 |
| `--vscode-editorWidget-border` | 编辑器控件边框 |
| `--vscode-editorWidget-foreground` | 编辑器控件文字 |
| `--vscode-editorWidget-resizeBorder` | 编辑器控件调整大小边框 |
| `--vscode-editorHoverWidget-background` | 悬停提示背景 |
| `--vscode-editorHoverWidget-border` | 悬停提示边框 |
| `--vscode-editorHoverWidget-foreground` | 悬停提示文字 |
| `--vscode-editorHoverWidget-highlightForeground` | 悬停高亮文字 |
| `--vscode-editorHoverWidget-statusBarBackground` | 悬停状态栏背景 |
| `--vscode-editor-foldBackground` | 折叠区域背景 |
| `--vscode-editor-foldPlaceholderForeground` | 折叠占位文字 |
| `--vscode-editor-placeholder-foreground` | 编辑器占位文字 |
| `--vscode-editorCursor-foreground` | 光标色 |
| `--vscode-editorRuler-foreground` | 标尺色 |
| `--vscode-editorWhitespace-foreground` | 空白字符色 |
| `--vscode-editorGutter-background` | 行号区背景 |
| `--vscode-editorGutter-commentRangeForeground` | 注释范围指示 |
| `--vscode-editorGutter-foldingControlForeground` | 折叠控件 |

### 编辑器选择/高亮
| 变量 | 用途 |
|------|------|
| `--vscode-editor-selectionBackground` | 选择背景 |
| `--vscode-editor-selectionHighlightBackground` | 选择高亮背景 |
| `--vscode-editor-selectionHighlightBorder` | 选择高亮边框 |
| `--vscode-editor-inactiveSelectionBackground` | 非活动选择 |
| `--vscode-editor-findMatchBackground` | 查找匹配背景 |
| `--vscode-editor-findMatchBorder` | 查找匹配边框 |
| `--vscode-editor-findMatchHighlightBackground` | 查找匹配高亮 |
| `--vscode-editor-findRangeHighlightBackground` | 查找范围高亮 |
| `--vscode-editor-rangeHighlightBackground` | 范围高亮背景 |
| `--vscode-editor-rangeHighlightBorder` | 范围高亮边框 |
| `--vscode-editor-wordHighlightBackground` | 单词高亮背景 |
| `--vscode-editor-wordHighlightBorder` | 单词高亮边框 |
| `--vscode-editor-wordHighlightStrongBackground` | 单词强高亮背景 |
| `--vscode-editor-wordHighlightStrongBorder` | 单词强高亮边框 |
| `--vscode-editor-wordHighlightTextBackground` | 单词文本高亮背景 |
| `--vscode-editor-wordHighlightTextBorder` | 单词文本高亮边框 |
| `--vscode-editor-symbolHighlightBackground` | 符号高亮背景 |
| `--vscode-editor-symbolHighlightBorder` | 符号高亮边框 |
| `--vscode-editor-snippetTabstopHighlightBackground` | 代码片段制表位高亮背景 |
| `--vscode-editor-snippetTabstopHighlightBorder` | 代码片段制表位高亮边框 |
| `--vscode-editor-snippetFinalTabstopHighlightBackground` | 代码片段最终制表位背景 |
| `--vscode-editor-snippetFinalTabstopHighlightBorder` | 代码片段最终制表位边框 |
| `--vscode-editor-linkedEditingBackground` | 链接编辑背景 |
| `--vscode-editor-hoverHighlightBackground` | 悬停高亮背景 |

### 编辑器诊断
| 变量 | 用途 |
|------|------|
| `--vscode-editorError-background` | 错误背景 |
| `--vscode-editorError-border` | 错误边框 |
| `--vscode-editorWarning-background` | 警告背景 |
| `--vscode-editorWarning-border` | 警告边框 |
| `--vscode-editorInfo-background` | 信息背景 |
| `--vscode-editorInfo-border` | 信息边框 |
| `--vscode-editorHint-border` | 提示边框 |
| `--vscode-editorUnnecessaryCode-border` | 不必要代码边框 |
| `--vscode-editorUnicodeHighlight-background` | Unicode 高亮背景 |
| `--vscode-editorUnicodeHighlight-border` | Unicode 高亮边框 |

### 编辑器其他
| 变量 | 用途 |
|------|------|
| `--vscode-editorBracketMatch-background` | 括号匹配背景 |
| `--vscode-editorBracketMatch-border` | 括号匹配边框 |
| `--vscode-editorLineNumber-foreground` | 行号文字 |
| `--vscode-editorLineNumber-activeForeground` | 活动行号文字 |
| `--vscode-editorLink-activeForeground` | 活动链接文字 |
| `--vscode-editorLightBulb-foreground` | 代码操作灯泡 |
| `--vscode-editorLightBulbAi-foreground` | AI 代码操作灯泡 |
| `--vscode-editorLightBulbAutoFix-foreground` | 自动修复灯泡 |
| `--vscode-editorGhostText-background` | 幽灵文字背景 |
| `--vscode-editorGhostText-border` | 幽灵文字边框 |
| `--vscode-editorGhostText-foreground` | 幽灵文字前景 |
| `--vscode-editorStickyScroll-background` | 固定滚动背景 |
| `--vscode-editorStickyScroll-border` | 固定滚动边框 |
| `--vscode-editorStickyScroll-shadow` | 固定滚动阴影 |
| `--vscode-editorStickyScrollHover-background` | 固定滚动悬停 |
| `--vscode-editorStickyScroll-foldingOpacityTransition` | 固定滚动折叠透明度过渡 |
| `--vscode-editorStickyScroll-scrollableWidth` | 固定滚动区域宽度 |
| `--vscode-editorCodeLens-fontFamily` | CodeLens 字体族 |
| `--vscode-editorCodeLens-fontFamilyDefault` | CodeLens 默认字体族 |
| `--vscode-editorCodeLens-fontSize` | CodeLens 字体大小 |
| `--vscode-editorCodeLens-fontFeatureSettings` | CodeLens 字体特性 |
| `--vscode-editorCodeLens-foreground` | CodeLens 文字色 |
| `--vscode-editorCodeLens-lineHeight` | CodeLens 行高 |
| `--vscode-editorActionList-background` | 动作列表背景 |
| `--vscode-editorActionList-foreground` | 动作列表文字 |
| `--vscode-editorActionList-focusBackground` | 动作列表聚焦背景 |
| `--vscode-editorActionList-focusForeground` | 动作列表聚焦文字 |
| `--vscode-editorSuggestWidget-background` | 建议控件背景 |
| `--vscode-editorSuggestWidget-border` | 建议控件边框 |
| `--vscode-editorSuggestWidget-foreground` | 建议控件文字 |
| `--vscode-editorSuggestWidget-highlightForeground` | 建议控件高亮 |
| `--vscode-editorSuggestWidget-focusHighlightForeground` | 建议控件聚焦高亮 |
| `--vscode-editorSuggestWidget-selectedForeground` | 建议控件选中 |
| `--vscode-editorSuggestWidget-selectedIconForeground` | 建议控件选中图标 |
| `--vscode-editorSuggestWidgetStatus-foreground` | 建议控件状态 |

### Diff 编辑器
| 变量 | 用途 |
|------|------|
| `--vscode-diffEditor-border` | diff 边框 |
| `--vscode-diffEditor-diagonalFill` | diff 对角线填充 |
| `--vscode-diffEditor-insertedLineBackground` | 插入行背景 |
| `--vscode-diffEditor-insertedTextBackground` | 插入文字背景 |
| `--vscode-diffEditor-insertedTextBorder` | 插入文字边框 |
| `--vscode-diffEditor-removedLineBackground` | 删除行背景 |
| `--vscode-diffEditor-removedTextBackground` | 删除文字背景 |
| `--vscode-diffEditor-removedTextBorder` | 删除文字边框 |
| `--vscode-diffEditor-unchangedCodeBackground` | 未变代码背景 |
| `--vscode-diffEditor-unchangedRegionBackground` | 未变区域背景 |
| `--vscode-diffEditor-unchangedRegionForeground` | 未变区域文字 |
| `--vscode-diffEditor-unchangedRegionShadow` | 未变区域阴影 |
| `--vscode-diffEditor-move-border` | 移动块边框 |
| `--vscode-diffEditor-moveActive-border` | 活动移动块边框 |
| `--vscode-diffEditorGutter-insertedLineBackground` | 行号区插入行 |
| `--vscode-diffEditorGutter-removedLineBackground` | 行号区删除行 |
| `--vscode-multiDiffEditor-background` | 多 diff 背景 |
| `--vscode-multiDiffEditor-border` | 多 diff 边框 |
| `--vscode-multiDiffEditor-headerBackground` | 多 diff 标题背景 |

### Peek View (快速查看)
| 变量 | 用途 |
|------|------|
| `--vscode-peekViewEditor-background` | peek 编辑器背景 |
| `--vscode-peekViewEditor-matchHighlightBackground` | peek 匹配高亮背景 |
| `--vscode-peekViewEditor-matchHighlightBorder` | peek 匹配高亮边框 |
| `--vscode-peekViewEditorGutter-background` | peek 行号区 |
| `--vscode-peekViewEditorStickyScroll-background` | peek 固定滚动 |
| `--vscode-peekViewResult-background` | peek 结果背景 |
| `--vscode-peekViewResult-fileForeground` | peek 结果文件名 |
| `--vscode-peekViewResult-lineForeground` | peek 结果行号 |
| `--vscode-peekViewResult-matchHighlightBackground` | peek 结果匹配高亮 |
| `--vscode-peekViewResult-selectionBackground` | peek 结果选择 |
| `--vscode-peekViewResult-selectionForeground` | peek 结果选择文字 |

### 面板/边栏
| 变量 | 用途 |
|------|------|
| `--vscode-panel-border` | 面板边框 |
| `--vscode-sideBar-background` | 侧边栏背景 |
| `--vscode-sideBarActivityBarTop-border` | 活动栏顶部边框 |
| `--vscode-sideBarSectionHeader-border` | 侧边栏分区标题边框 |

### 通知/横幅
| 变量 | 用途 |
|------|------|
| `--vscode-notifications-background` | 通知背景 |
| `--vscode-banner-background` | 横幅背景 |
| `--vscode-banner-foreground` | 横幅文字 |
| `--vscode-banner-iconForeground` | 横幅图标色 |
| `--vscode-actionBar-toggledBackground` | 操作栏切换背景 |

### 聊天
| 变量 | 用途 |
|------|------|
| `--vscode-chat-font-family` | 聊天字体族 |
| `--vscode-chat-font-size` | 聊天字体大小 (默认 13px) |
| `--vscode-chat-slashCommandBackground` | 斜杠命令背景 |
| `--vscode-chat-slashCommandForeground` | 斜杠命令文字 |

### 滚动条
| 变量 | 用途 |
|------|------|
| `--vscode-scrollbarSlider-background` | 滑块背景 |
| `--vscode-scrollbarSlider-hoverBackground` | 滑块悬停 |
| `--vscode-scrollbarSlider-activeBackground` | 滑块活动 |
| `--vscode-scrollbar-shadow` | 滚动条阴影 |

### 其他控件
| 变量 | 用途 |
|------|------|
| `--vscode-widget-border` | 通用控件边框 |
| `--vscode-widget-shadow` | 通用控件阴影 |
| `--vscode-contrastBorder` | 高对比度边框 |
| `--vscode-contrastActiveBorder` | 高对比度活动边框 |
| `--vscode-progressBar-background` | 进度条背景 |
| `--vscode-toolbar-hoverBackground` | 工具栏悬停 |
| `--vscode-sash-hoverBorder` | 分割条悬停 |
| `--vscode-sash-size` | 分割条大小 (4px) |
| `--vscode-sash-hover-size` | 分割条悬停大小 (4px) |
| `--vscode-keybindingLabel-background` | 快捷键标签背景 |
| `--vscode-keybindingLabel-border` | 快捷键标签边框 |
| `--vscode-keybindingLabel-bottomBorder` | 快捷键标签底部边框 |
| `--vscode-keybindingLabel-foreground` | 快捷键标签文字 |
| `--vscode-parameterHintsWidget-editorFontFamily` | 参数提示字体族 |
| `--vscode-parameterHintsWidget-editorFontFamilyDefault` | 参数提示默认字体族 |
| `--vscode-hover-maxWidth` | 悬停最大宽度 |
| `--vscode-hover-whiteSpace` | 悬停空白处理 |
| `--vscode-hover-sourceWhiteSpace` | 悬停源空白处理 |
| `--vscode-inputValidation-infoBorder` | 输入验证信息边框 |
| `--vscode-minimapSlider-background` | minimap 滑块背景 |
| `--vscode-minimapSlider-hoverBackground` | minimap 滑块悬停 |
| `--vscode-minimapSlider-activeBackground` | minimap 滑块活动 |

### 文本/链接
| 变量 | 用途 |
|------|------|
| `--vscode-textLink-foreground` | 链接文字 |
| `--vscode-textLink-activeForeground` | 活动链接文字 |
| `--vscode-textCodeBlock-background` | 代码块背景 |

### 图标 (40+ 符号图标变量)
| 变量 | 用途 |
|------|------|
| `--vscode-icon-foreground` | 图标前景色 |
| `--vscode-icon-x-font-family` | 图标字体族 (Codicon) |
| `--vscode-icon-x-content` | 图标内容字符 |

### 问题面板图标
| 变量 | 用途 |
|------|------|
| `--vscode-problemsErrorIcon-foreground` | 错误图标色 |
| `--vscode-problemsWarningIcon-foreground` | 警告图标色 |
| `--vscode-problemsInfoIcon-foreground` | 信息图标色 |

### 符号图标 (类型着色)
扩展使用了 40+ 个符号图标颜色变量: `--vscode-symbolIcon-arrayForeground`, `--vscode-symbolIcon-booleanForeground`, `--vscode-symbolIcon-classForeground`, `--vscode-symbolIcon-colorForeground`, `--vscode-symbolIcon-constantForeground`, `--vscode-symbolIcon-constructorForeground`, `--vscode-symbolIcon-enumeratorForeground`, `--vscode-symbolIcon-enumeratorMemberForeground`, `--vscode-symbolIcon-eventForeground`, `--vscode-symbolIcon-fieldForeground`, `--vscode-symbolIcon-fileForeground`, `--vscode-symbolIcon-folderForeground`, `--vscode-symbolIcon-functionForeground`, `--vscode-symbolIcon-interfaceForeground`, `--vscode-symbolIcon-keyForeground`, `--vscode-symbolIcon-keywordForeground`, `--vscode-symbolIcon-methodForeground`, `--vscode-symbolIcon-moduleForeground`, `--vscode-symbolIcon-namespaceForeground`, `--vscode-symbolIcon-nullForeground`, `--vscode-symbolIcon-numberForeground`, `--vscode-symbolIcon-objectForeground`, `--vscode-symbolIcon-operatorForeground`, `--vscode-symbolIcon-packageForeground`, `--vscode-symbolIcon-propertyForeground`, `--vscode-symbolIcon-referenceForeground`, `--vscode-symbolIcon-snippetForeground`, `--vscode-symbolIcon-stringForeground`, `--vscode-symbolIcon-structForeground`, `--vscode-symbolIcon-textForeground`, `--vscode-symbolIcon-typeParameterForeground`, `--vscode-symbolIcon-unitForeground`, `--vscode-symbolIcon-variableForeground`

---

## 应用层设计令牌 (--app-*)

这些是扩展自定义的语义层变量，桥接 VSCode 主题变量:

| 令牌 | 值 | 用途 |
|------|-----|------|
| `--app-primary-foreground` | `var(--vscode-foreground)` | 主文字色 |
| `--app-primary-background` | `var(--vscode-sideBar-background)` | 主背景 |
| `--app-primary-border-color` | `var(--vscode-sideBarActivityBarTop-border)` | 主边框 |
| `--app-secondary-foreground` | `var(--vscode-descriptionForeground)` | 次要文字 |
| `--app-secondary-background` | `var(--vscode-editor-background)` | 次要背景 |
| `--app-input-foreground` | `var(--vscode-input-foreground)` | 输入文字 |
| `--app-input-background` | `var(--vscode-input-background)` | 输入背景 |
| `--app-input-border` | `var(--vscode-inlineChatInput-border)` | 输入边框 |
| `--app-input-active-border` | `var(--vscode-inputOption-activeBorder)` | 聚焦边框 |
| `--app-input-placeholder-foreground` | `var(--vscode-input-placeholderForeground)` | placeholder |
| `--app-input-secondary-foreground` | `var(--vscode-input-foreground)` | 次要输入文字 |
| `--app-input-secondary-background` | `var(--vscode-menu-background)` | 次要输入背景 |
| `--app-tool-background` | `var(--vscode-editor-background)` | 工具区域背景 |
| `--app-list-padding` | `0px` | 列表容器内边距 |
| `--app-list-item-padding` | `4px 8px` | 列表项内边距 |
| `--app-list-border-color` | `transparent` | 列表边框 |
| `--app-list-border-radius` | `4px` | 列表圆角 |
| `--app-list-hover-background` | `var(--vscode-list-hoverBackground)` | 列表悬停 |
| `--app-list-active-background` | `var(--vscode-list-activeSelectionBackground)` | 列表选中背景 |
| `--app-list-active-foreground` | `var(--vscode-list-activeSelectionForeground)` | 列表选中文字 |
| `--app-list-gap` | `2px` | 列表项间距 |
| `--app-menu-background` | `var(--vscode-menu-background)` | 菜单背景 |
| `--app-menu-border` | `var(--vscode-menu-border)` | 菜单边框 |
| `--app-menu-foreground` | `var(--vscode-menu-foreground)` | 菜单文字 |
| `--app-menu-selection-background` | `var(--vscode-menu-selectionBackground)` | 菜单选中背景 |
| `--app-menu-selection-foreground` | `var(--vscode-menu-selectionForeground)` | 菜单选中文字 |
| `--app-warning-foreground` | `var(--vscode-menu-foreground)` | 警告文字 |
| `--app-warning-background` | `var(--vscode-input-background)` | 警告背景 |
| `--app-warning-accent` | `#e5a54b` | 警告强调色 |
| `--app-badge-foreground` | `var(--vscode-badge-foreground)` | 徽章文字 |
| `--app-badge-background` | `var(--vscode-badge-background)` | 徽章背景 |
| `--app-header-background` | `var(--vscode-sideBar-background)` | 页头背景 |
| `--app-splitter-background` | `var(--vscode-inlineChatInput-border)` | 分割条背景 |
| `--app-splitter-hover-background` | `var(--vscode-sash-hoverBorder)` | 分割条悬停 |
| `--app-progressbar-background` | `var(--vscode-progressBar-background)` | 进度条背景 |
| `--app-progressbar-border` | `var(--vscode-widget-border)` | 进度条边框 |
| `--app-widget-border` | `var(--vscode-editorWidget-border)` | 控件边框 |
| `--app-editor-highlight-background` | `var(--vscode-editor-lineHighlightBackground)` | 编辑器高亮 |
| `--app-ghost-button-hover-background` | `var(--vscode-toolbar-hoverBackground)` | 幽灵按钮悬停 |
| `--app-button-foreground` | `var(--vscode-button-foreground)` | 按钮文字 |
| `--app-button-background` | `var(--vscode-button-background)` | 按钮背景 |
| `--app-button-hover-background` | `var(--vscode-button-hoverBackground)` | 按钮悬停 |
| `--app-accent-color` | `var(--vscode-inputOption-activeBorder)` | 强调色 |
| `--app-transparent-inner-border` | `#ffffff1a` (暗) / `#00000012` (亮) | 半透明内边框 |
| `--app-spinner-foreground` | `var(--app-claude-orange)` (暗) / `var(--app-claude-clay-button-orange)` (亮) | 加载动画色 |
| `--app-disabled-foreground` | `var(--vscode-disabledForeground)` | 禁用文字 |
| `--app-error-foreground` | `var(--vscode-errorForeground)` | 错误文字 |
| `--app-success-foreground` | `var(--vscode-gitDecoration-addedResourceForeground)` | 成功文字 |
| `--app-diff-addition-foreground` | `var(--vscode-gitDecoration-addedResourceForeground)` | diff 添加色 |
| `--app-diff-deletion-foreground` | `var(--vscode-gitDecoration-deletedResourceForeground)` | diff 删除色 |
| `--app-banner-tint` | `#4a63af` | 横幅色调 |
| `--app-status-busy` | `var(--vscode-charts-green, #22c55e)` | 忙碌状态 (绿色) |
| `--app-status-pending` | `var(--vscode-charts-blue, #3b82f6)` | 等待状态 (蓝色) |
| `--app-modal-background` | `#000000bf` | 模态遮罩 (75% 黑) |
| `--app-mention-chip-background` | `var(--vscode-chat-slashCommandBackground, ...)` | @提及背景 |
| `--app-mention-chip-foreground` | `var(--vscode-chat-slashCommandForeground, ...)` | @提及文字 |
| `--app-monospace-font-family` | `var(--vscode-editor-font-family, monospace)` | 等宽字体族 |
| `--app-monospace-font-size` | `var(--vscode-editor-font-size, 12px)` | 等宽字号 |
| `--app-monospace-font-size-small` | `calc(var(--vscode-editor-font-size, 12px) - 2px)` | 小号等宽 (10px) |
| `--app-root-background` | `var(--app-primary-background)` / `var(--app-secondary-background)` | 根背景 |

---

## 按钮风格

### 按钮类型总览

| 类型 | 圆角 | 内边距 | 高度 | 字重 | 其他 |
|------|------|--------|------|------|------|
| 发送按钮 (sendButton) | 5px | (图标) | 26px | - | 背景 `--app-claude-clay-button-orange`，文字 `--app-claude-ivory` |
| 页脚按钮 (footerButton) | 2px / 5px | 2px 4px / 0 8px 0 0 | 26px | - | 背景透明，文字 `--app-secondary-foreground`，字号 .85em |
| 图标按钮 (iconButton) | 4px | 4px | - | - | 背景透明，flex 居中，color `--app-secondary-foreground` |
| 菜单按钮 (menuButton) | 50% / 5px | - | 26x26 | - | 背景透明，SVG 图标 26x26 |
| 主要按钮 (primaryButton) | 4px | 6px 8px | - | 700 | `box-shadow: inset 0 0 0 1px var(--app-transparent-inner-border)` |
| 全宽按钮 (fullWidthButton) | 2px | 6px 8px | - | 500 | 100% 宽，hover 时 `filter: brightness(1.1)` |
| 操作按钮 (actionButton) | 4px | 10px 16px | - | - | 全宽，字号 13px，带 input-border |
| Monaco 文本按钮 | 2px | 4px | 25px | 400/700 | line-height 18px，字号 11px |
| 确认按钮 (confirmButton) | 2px | 6px 14px | - | - | 背景 `--app-button-background` |
| 勾选按钮 (checkoutButton) | 4px | 3px 10px | - | 500 | 边框 `.5px solid` 警告色 |
| 帮助按钮 (helpButton) | 4px | 4px 10px | - | 500 | 绿色 (#7fd192 / #4aaf63) |
| 连接按钮 (connectButton) | 4px | 4px 10px | - | 500 | 橙色 (#f5a66a / #f37726) |
| 工作区横幅按钮 | 4px | 3px 12px | - | 500 | 背景 `--app-claude-orange`，字号 12px |
| showMeButton | 3px | 1px 4px 0 | - | 590 | `box-shadow: 0 2px 5px #eda38a1a` |

### 按钮通用行为

- **Hover 效果**: 大多数按钮使用 `brightness` 滤镜或 `background-color` 过渡
  - 全宽按钮: `filter: brightness(1.1)` (暗主题) / `filter: brightness(0.95)` (亮主题)
  - 图标按钮: `background: var(--app-ghost-button-hover-background)`
- **过渡时间**: 0.15s (大多数), 0.2s (少数)
- **过渡属性**: `background-color`, `opacity`, `border-color`, `box-shadow`
- **禁用态**: `opacity: 0.4` / `0.5` / `0.66`，`cursor: default`

### 关闭按钮
- 标准: 圆角 4px, 内边距 4px, 透明背景, `opacity: 0.5~0.7`
- 圆形变体: 圆角 50%, 28x28px, 边框 + 菜单背景, 负定位 (-12px/-10px)

---

## SVG 图标

所有图标使用 Feather Icons 风格 (Lucide): `stroke="currentColor"`, `stroke-width="2"`, `stroke-linecap="round"`, `stroke-linejoin="round"`。ViewBox 统一为 `0 0 24 24`，仅尺寸不同。

### 语音 TTS 按钮图标

#### SVG_SPEAKER_OFF (静音)
```
尺寸: 16x16 | viewBox: 0 0 24 24
样式: fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
路径:
  - <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>  -- 喇叭主体
  - <line x1="23" y1="9" x2="17" y2="15"/>                   -- X 线 \
  - <line x1="17" y1="9" x2="23" y2="15"/>                   -- X 线 /
```

#### SVG_SPEAKER_ON (有声)
```
尺寸: 16x16 | viewBox: 0 0 24 24
样式: fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
路径:
  - <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>  -- 喇叭主体
  - <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>              -- 外声波
  - <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>                 -- 内声波
```

#### SVG_SPEAKER_PLAYING (朗读中，带动画)
```
尺寸: 16x16 | viewBox: 0 0 24 24
样式: 同 SVG_SPEAKER_ON
附加: <animate attributeName="opacity" values="1;0.5;1" dur="1.5s" repeatCount="indefinite"/>
```

### 停止按钮

#### SVG_STOP (方形停止)
```
尺寸: 12x12 | viewBox: 0 0 24 24
样式: fill="currentColor"
路径: <rect x="4" y="4" width="16" height="16" rx="2"/>
```

### 设置按钮

#### SVG_GEAR (齿轮/设置)
```
尺寸: 20x20 | viewBox: 0 0 24 24
样式: fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
路径:
  - <circle cx="12" cy="12" r="3"/>
  - <path d="M19.4 15a1.65..."/>  -- 齿轮外圈
```

### 聊天输入区按钮 (React createElement)

#### 发送按钮 (Send - chevron-up)
```
尺寸: 20x20 | viewBox: 0 0 20 20 | 样式: fill="none"
路径: <path d="M10 3C10.1326 3.00003 ... L9.72268 3.08398C9.8042 3.02967 9.90062 3 10 3Z" fill="currentColor"/>
含义: 向上箭头 (chevron-up)
```

#### 停止按钮 (Stop - square with cut)
```
尺寸: 20x20 | viewBox: 0 0 20 20 | 样式: fill="none"
路径: <path d="M11.1768 5.03125 ... V7.14355Z" fill="currentColor"/>
含义: 方形停止 (底部切角设计)
```

#### 勾选 (Check)
```
尺寸: 12x12 | viewBox: 0 0 24 24
路径: <polyline points="20 6 9 17 4 12"/>
```

### PreSend 预览栏图标

#### 时钟图标 (等待中)
```
尺寸: 12x12 | viewBox: 0 0 24 24
样式: stroke="#e8a040" (琥珀色)
路径:
  - <circle cx="12" cy="12" r="10"/>
  - <polyline points="12 6 12 12 16 14"/>
```

#### 发送图标
```
尺寸: 14x14 | viewBox: 0 0 24 24
路径:
  - <line x1="22" y1="2" x2="11" y2="13"/>
  - <polygon points="22 2 15 22 11 13 2 9 22 2"/>
```

#### 删除图标 (X)
```
尺寸: 14x14 | viewBox: 0 0 24 24
路径:
  - <line x1="18" y1="6" x2="6" y2="18"/>
  - <line x1="6" y1="6" x2="18" y2="18"/>
```

#### 旋转加载
```
尺寸: 12x12 | viewBox: 0 0 24 24
样式: stroke="#4ec9b0" (青绿色), style="animation:spin 1s linear infinite"
路径:
  - <circle cx="12" cy="12" r="10" opacity="0.25"/>
  - <path d="M12 2a10 10 0 0 1 10 10"/>
```

#### 播放图标
```
尺寸: 14x14 | viewBox: 0 0 24 24
样式: fill="currentColor" stroke="none"
路径: <polygon points="5 3 19 12 5 21 5 3"/>
```

#### 暂停图标
```
尺寸: 14x14 | viewBox: 0 0 24 24
样式: fill="currentColor" stroke="none"
路径:
  - <rect x="6" y="4" width="4" height="16"/>
  - <rect x="14" y="4" width="4" height="16"/>
```

#### 展开/折叠箭头
```
尺寸: 12x12 | viewBox: 0 0 24 24
展开: <polyline points="6 9 12 15 18 9"/>   (向下)
折叠: <polyline points="18 15 12 9 6 15"/>  (向上)
```

#### 循环图标
```
尺寸: 12x12 | viewBox: 0 0 24 24
样式: stroke="#4ec9b0" (青绿色)
路径:
  - <polyline points="17 1 21 5 17 9"/>
  - <path d="M3 11V9a4 4 0 0 1 4-4h14"/>
  - <polyline points="7 23 3 19 7 15"/>
  - <path d="M21 13v2a4 4 0 0 1-4 4H3"/>
```

#### 恢复图标
```
尺寸: 12x12 | viewBox: 0 0 24 24
路径: <polygon points="5 3 19 12 5 21 5 3"/>
```

### Monaco 编辑器内嵌 SVG

#### 错误波浪线
```
<svg xmlns="http://www.w3.org/2000/svg" width="6" height="3">
  <polygon points="5.5,0 2.5,3 1.1,3 4.1,0"/>
  <polygon points="4,0 6,2 6,0.6 5.4,0"/>
  <polygon points="0,2 1,3 2.4,3 0,0.6"/>
</svg>
```
以 `data:image/svg+xml` 方式作为 `background` 重复渲染。

#### 空白字符点 (三种点)
```
<svg width="12" height="3">
  <circle cx="1" cy="1" r="1"/>
  <circle cx="5" cy="1" r="1"/>
  <circle cx="9" cy="1" r="1"/>
</svg>
```

#### 建议箭头 (内联编辑)
```
箭头使用动态生成的 SVG path，包含:
- <circle> 圆点
- <path> 贝塞尔曲线连接
- 使用 fill 支持渐变
```

---

## 字体

### 字体族层级

| 层级 | 变量/值 | 默认回退 |
|------|---------|---------|
| 聊天 UI 字体 | `var(--vscode-chat-font-family)` | 系统默认 |
| 等宽字体 (代码) | `var(--vscode-editor-font-family)` | `monospace` |
| Monaco 等宽栈 | `"SF Mono", Monaco, Menlo, Consolas, "Ubuntu Mono", "Liberation Mono", "DejaVu Sans Mono", "Courier New", monospace` | - |
| 继承字体 | `font-family: inherit` | 在按钮、输入框上大量使用 |

### 字号层级

| 层级 | 变量/值 | 使用场景 |
|------|---------|---------|
| 聊天正文 | `var(--vscode-chat-font-size, 13px)` | 对话消息、按钮文字 |
| 等宽大号 | `var(--vscode-editor-font-size, 12px)` | 代码块、diff 预览 |
| 等宽小号 | `calc(var(--vscode-editor-font-size, 12px) - 2px)` | 次级等宽文字 (10px) |
| 微型 | `.85em` / `.9em` / `11px` | 页脚按钮、提示、辅助信息 |
| CodeLens | `var(--vscode-editorCodeLens-fontSize)` | 代码透镜 |
| 参数提示 | `var(--vscode-parameterHintsWidget-editorFontFamily)` | 函数参数提示 |

### 字重层级

| 字重 | 值 | 使用场景 |
|------|-----|---------|
| 常规 | 400 | 正文、次要文字 |
| 中等 | 500 | 按钮、导航标签、pill |
| 半粗 | 590/600 | showMeButton (590)、快速选择分隔符 (600) |
| 粗体 | 700 | 主要按钮、工具名称 |

---

## 间距

### 基础间距系统

| 令牌 | 值 | 用途 |
|------|-----|------|
| `--app-spacing-small` | `4px` | 图标按钮内边距、紧凑间距 |
| `--app-spacing-medium` | `8px` | 组件内间距、gap |
| `--app-spacing-large` | `12px` | 组件间间距 |
| `--app-spacing-xlarge` | `16px` | 大间距 |

### 典型组件间距

| 组件 | 内边距 | 间距 | 说明 |
|------|--------|------|------|
| 输入框 (messageInput) | `10px 36px 10px 14px` | - | 下内边距留出按钮空间 |
| 输入框包装 (inputWrapper) | - | `max-width: 680px` | 居中 |
| 输入页脚 (inputFooter) | `5px` | `gap: 6px` | 水平排列按钮 |
| 输入页脚 V2 | `gap: 2px` | - | 紧凑按钮布局 |
| 按钮容器 (buttonContainer) | - | `gap: 8px` | 垂直方向 |
| Pill (mention chip) | `4px 6px 4px 4px` | `gap: 4px` | 高度 24px, `max-width: 180px` |
| 列表 | `padding: 0px` | `gap: 2px` | 项目间距 `4px 8px` |
| 消息容器 | - | - | 最大高度 200px, 最小 1.5em |
| 导航标签 | `padding: 8px 16px` (估算) | - | - |

### 圆角系统

| 令牌 | 值 | 使用场景 |
|------|-----|---------|
| `--corner-radius-small` | `4px` | 按钮、列表项、标签 |
| `--corner-radius-medium` | `6px` | 卡片、面板 |
| `--corner-radius-large` | `8px` | 输入框、对话框 |
| 圆形 | `50%` | 关闭按钮、菜单按钮、操作按钮 |
| 胶囊形 | `20px` | 信息 pill |
| Monaco | `2px` | 编辑器内按钮 |

### 分割线

- 输入页脚顶部: `border-top: .5px solid var(--app-input-border)`
- 侧边栏分区标题底部: `var(--vscode-sideBarSectionHeader-border)`

---

## PreSend 预览栏颜色

| 元素 | 颜色 | 说明 |
|------|------|------|
| 等待时钟图标 | `#e8a040` | 琥珀色，表示消息在排队 |
| 活跃边框 | `#e8a040` | `box-shadow: 0 0 0 1px #e8a040` |
| 循环模式图标 | `#4ec9b0` | 青绿色，表示循环模式 |
| 循环边框 | `#4ec9b0` | `data-loop-active` 时覆盖 |
| 优化模式类 | `preSendOptimizing` | 带额外样式 |

---

## VSCode 主题适配

扩展对 VSCode 主题完全自适应，无硬编码主题色:

- **亮色主题覆盖**: `.vscode-light` 选择器覆盖 `--app-transparent-inner-border` 和 `--app-spinner-foreground`
- **默认暗色假设**: `--app-transparent-inner-border` 默认 `#ffffff1a` (白色半透明)，适用于暗色主题
- **高对比度**: 通过 `--vscode-contrastBorder` / `--vscode-contrastActiveBorder` 适配
- **所有颜色** 通过 `--vscode-*` 变量桥接，主题切换时自动更新

---

## 关键间距/尺寸常数

| 常数 | 值 | 来源 |
|------|-----|------|
| 输入最大宽度 | 680px | CSS 固定值 |
| 输入最小行高 | 1.5em | CSS 固定值 |
| 输入最大高度 | 200px | CSS 固定值 |
| Pill 高度 | 24px | CSS 固定值 |
| Pill 最大宽度 | 180px | CSS 固定值 |
| 页脚按钮高度 | 26px | `inputFooterV2` |
| 菜单按钮尺寸 | 26x26px | `menuButton` |
| Monaco 按钮高度 | 25px | `monaco-text-button` |
| 模态遮罩 | `rgba(0,0,0,0.75)` | `--app-modal-background` |
| 分割条尺寸 | 4px | `--vscode-sash-size` |
