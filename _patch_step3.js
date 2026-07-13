const fs = require("fs");
let c = fs.readFileSync("extension/extension.js", "utf8");

let oldBlockStart = c.indexOf("// 构建高质量优化提示词");
let oldBlockEnd = c.indexOf("let N = await this.spawnClaude(T0");
let spawnLineEnd = c.indexOf("
", oldBlockEnd);
spawnLineEnd += 1;

console.log("Replacing block from", oldBlockStart, "to", spawnLineEnd);

let optPrinciples = [
  "优化原则（按优先级排序）:",
  "1. 具体化：将模糊描述替换为具体、可操作的要求",
  "2. 结构化：复杂任务用编号列表或分段组织，确保逻辑清晰",
  "3. 上下文完整：确保提示词自包含——包含文件路径、函数名、期望行为",
  "4. 指定输出格式：明确说明期望的输出形式",
  "5. 约束明确：指明不应修改的部分、需要保持的风格",
  "6. 保持原语言：输出语言与输入一致，不翻译",
  "7. 保留技术术语：保留所有代码相关的精确术语",
].join("
");

let systemPrompt = "你是世界顶级的提示词工程师。

" + optPrinciples + "

" +
  "## 项目上下文
" + (c.includes("G0") ? "" : "无特定项目上下文") + "

" +
  "## 信息不足时
使用 AskUserQuestion 工具提问。

" +
  "## 输出要求
只输出优化后的提示词文本。

" +
  "## 待优化文本：
";
