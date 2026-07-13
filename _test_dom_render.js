// 循环模式 - 预发送框 DOM 渲染测试（jsdom）
// 忠实镜像 extension/webview/index.js 中 _createPreview 的 header + item 渲染逻辑
const { JSDOM } = require("jsdom");
const dom = new JSDOM('<!DOCTYPE html><body><div id="root"><div id="inputWrap"><div id="input"></div></div></div></body>');
global.document = dom.window.document;
global.window = dom.window;

const LOOP_MARK = "LOOP", OPT_MARK = "OPT";
const _isLoopMark = (t) => typeof t === "string" && t.indexOf(LOOP_MARK) === 0;
const _loopOrig = (t) => (_isLoopMark(t) ? t.slice(LOOP_MARK.length) : t);
const _isOptMark = (t) => typeof t === "string" && t.indexOf(OPT_MARK) === 0;
const _optOrig = (t) => (_isOptMark(t) ? t.slice(OPT_MARK.length) : t);

const inputEl = document.getElementById("input");
const b1 = { current: inputEl };
window.__preSendState = new Map();
const SID = "sess1";

// 镜像 _createPreview（只保留 header + item 渲染的核心，去掉 setTimeout 事件绑定）
function _createPreview(texts, isGuided) {
  var _c = b1.current?.parentElement;
  if (!_c) return;
  _c.setAttribute("data-pre-send-active", "1");
  var _existing = document.getElementById("preSendPreview");
  if (_existing && !document.contains(_existing)) _existing = null;
  if (!_existing) {
    _existing = document.createElement("div");
    _existing.id = "preSendPreview";
    _existing.className = "preSendPreview" + (isGuided ? " preSendGuided" : "");
    _c.parentElement.insertBefore(_existing, _c);
  }
  var count = texts.length;
  var _esc = (s) => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  var _icon = '<svg class="clockIcon"></svg>';
  var _sendIcon = '<svg class="sendSvg"></svg>';
  var _delIcon = '<svg class="delSvg"></svg>';
  var _spinIcon = '<svg class="spinSvg"></svg>';
  var _hasOpt = texts.some(_isOptMark);
  if (_hasOpt) _existing.classList.add("preSendOptimizing"); else _existing.classList.remove("preSendOptimizing");
  var _loopIcon = '<svg class="loopSvg"></svg>';
  var _key = SID;
  var _psLoopState = window.__preSendState?.get(_key)?.loop || null;
  if (_psLoopState && _psLoopState.enabled) _existing.setAttribute("data-loop-active", "1");
  else _existing.removeAttribute("data-loop-active");

  var _header = _existing.querySelector('.preSendPreviewHeader');
  if (!_header) { _header = document.createElement("div"); _header.className = "preSendPreviewHeader"; _existing.insertBefore(_header, _existing.firstChild); }
  if (_hasOpt) {
    _header.setAttribute('data-header-type', 'opt');
    _header.innerHTML = '<span>' + _spinIcon + ' 优化中...</span><span>Esc 取消</span>';
  } else if (_psLoopState && _psLoopState.enabled) {
    var _countDisp = _psLoopState.totalCount === null ? '∞' : _psLoopState.completed + '/' + _psLoopState.totalCount;
    var _cdHtml = '';
    if (_psLoopState.nextLoopAt) {
      var _remain = Math.max(0, _psLoopState.nextLoopAt - Date.now());
      var _min = Math.floor(_remain / 60000), _sec = Math.floor((_remain % 60000) / 1000);
      var _cdText = _min > 0 ? _min + ':' + (_sec < 10 ? '0' : '') + _sec : _sec + 's';
      _cdHtml = ' <span class="loopCountdown" style="font-variant-numeric:tabular-nums;opacity:0.7;font-size:11px">⏱ ' + _cdText + '</span>';
    }
    var _labelHtml = _loopIcon + ' 循环中 ' + _countDisp + _cdHtml + (count > 1 ? ' <span class="preSendPreviewCount">' + count + ' 条</span>' : '');
    if (_header.getAttribute('data-header-type') === 'loop' && _header.querySelector('.loopHeaderLabel')) {
      _header.querySelector('.loopHeaderLabel').innerHTML = _labelHtml;
    } else {
      _header.setAttribute('data-header-type', 'loop');
      var _countVal = _psLoopState.totalCount === null ? '' : _psLoopState.totalCount;
      _header.innerHTML = '<span class="loopHeaderLabel">' + _labelHtml + '</span>'
        + '<span class="preSendPreviewLoopControls">'
        + '<input type="number" class="preSendPreviewLoopInput" id="preSendLoopCount" min="0" placeholder="∞" value="' + _countVal + '" title="循环次数（空=无限）" />'
        + '<input type="number" class="preSendPreviewLoopInput" id="preSendLoopInterval" min="1" value="' + _psLoopState.intervalMinutes + '" title="间隔（分钟）" />分'
        + '</span><span>Esc 取消</span>';
    }
  } else {
    _header.setAttribute('data-header-type', 'normal');
    _header.innerHTML = '<span>' + _icon + ' 排队中' + (count > 1 ? ' <span class="preSendPreviewCount">' + count + ' 条</span>' : '') + '</span><span>Esc 取消</span>';
  }

  var _items = _existing.querySelector('.preSendPreviewItems');
  if (!_items) { _items = document.createElement("div"); _items.className = "preSendPreviewItems"; _existing.appendChild(_items); }
  var _existingItems = _items.children;
  var _existingCount = _existingItems.length;
  while (_existingCount > count) { _items.removeChild(_items.lastChild); _existingCount--; }
  for (var i = 0; i < count; i++) {
    var _item;
    var _isOpt = _isOptMark(texts[i]);
    var _isLoop = !_isOpt && _isLoopMark(texts[i]);
    var _disp = _isOpt ? _optOrig(texts[i]) : (_isLoop ? _loopOrig(texts[i]) : texts[i]);
    var _loopCountStr = '';
    if (_isLoop && _psLoopState) {
      var _remaining = (_psLoopState.totalCount === null ? '∞' : Math.max(0, _psLoopState.totalCount - _psLoopState.completed));
      _loopCountStr = ' <span class="loopRemain">(剩余 ' + _remaining + ' 次)</span>';
    }
    var _itemHtml = _isOpt
      ? '<div class="preSendPreviewOptLabel">' + _spinIcon + ' 正在优化提示词...</div><div class="preSendPreviewItemText">' + _esc(_disp) + '</div>'
      : _isLoop
      ? '<div class="preSendPreviewItemText">' + _loopIcon + ' ' + _esc(_disp) + _loopCountStr + '</div><div class="preSendPreviewItemActions"><button class="preSendPreviewBtn preSendPreviewBtnDelete" data-action="delete" data-index="' + i + '">' + _delIcon + '</button></div>'
      : '<div class="preSendPreviewItemText">' + _esc(_disp) + '</div><div class="preSendPreviewItemActions"><button class="preSendPreviewBtn preSendPreviewBtnSend" data-action="send" data-index="' + i + '">' + _sendIcon + '</button><button class="preSendPreviewBtn preSendPreviewBtnDelete" data-action="delete" data-index="' + i + '">' + _delIcon + '</button></div>';
    if (i < _existingCount) {
      _item = _existingItems[i];
      var _itemType = _isOpt ? "opt" : (_isLoop ? "loop" : "normal");
      var _prevType = _item.getAttribute("data-item-type") || "normal";
      if (_prevType !== _itemType) {
        _item.className = "preSendPreviewItem" + (_isOpt ? " preSendPreviewItemOptimizing" : (_isLoop ? " preSendPreviewItemLoop" : ""));
        _item.setAttribute("data-item-type", _itemType);
        _item.innerHTML = _itemHtml; _item.setAttribute("data-index", i);
      } else { _item.setAttribute("data-index", i); }
    } else {
      _item = document.createElement("div");
      var _newType = _isOpt ? "opt" : (_isLoop ? "loop" : "normal");
      _item.className = "preSendPreviewItem" + (_isOpt ? " preSendPreviewItemOptimizing" : (_isLoop ? " preSendPreviewItemLoop" : ""));
      _item.setAttribute("data-index", i); _item.setAttribute("data-item-type", _newType);
      _item.innerHTML = _itemHtml; _items.appendChild(_item);
    }
  }
}

let passed = 0, failed = 0;
function assert(c, m) { if (c) { passed++; console.log("  ✅ " + m); } else { failed++; console.log("  ❌ " + m); } }

console.log("\n=== DOM 测试 1: 无限循环 header 渲染 ===");
{
  window.__preSendState.set(SID, { texts: [LOOP_MARK + "你好"], loop: { enabled: true, sourceText: "你好", totalCount: null, completed: 0, intervalMinutes: 10, nextLoopAt: null } });
  _createPreview([LOOP_MARK + "你好"]);
  const pv = document.getElementById("preSendPreview");
  assert(pv.getAttribute("data-loop-active") === "1", "容器有 data-loop-active 标记");
  assert(pv.querySelector(".preSendPreviewHeader").textContent.includes("循环中 ∞"), "header 显示「循环中 ∞」");
  const cnt = document.getElementById("preSendLoopCount");
  const itv = document.getElementById("preSendLoopInterval");
  assert(cnt && cnt.value === "", "次数输入框存在且为空（无限）");
  assert(cnt.getAttribute("placeholder") === "∞", "次数输入框 placeholder 为 ∞");
  assert(itv && itv.value === "10", "间隔输入框值为 10");
  const item = pv.querySelector(".preSendPreviewItem");
  assert(item.getAttribute("data-item-type") === "loop", "队列项类型为 loop");
  assert(item.querySelector(".loopRemain").textContent.includes("剩余 ∞"), "循环项显示「剩余 ∞ 次」");
  assert(item.querySelector(".preSendPreviewBtnSend") === null, "循环项无「提前发送」按钮");
  assert(item.querySelector(".preSendPreviewBtnDelete") !== null, "循环项有「删除」按钮");
}

console.log("\n=== DOM 测试 2: 有限次循环 header 显示进度 ===");
{
  window.__preSendState.set(SID, { texts: [LOOP_MARK + "你好"], loop: { enabled: true, sourceText: "你好", totalCount: 5, completed: 2, intervalMinutes: 3, nextLoopAt: null } });
  document.getElementById("preSendPreview")?.remove();
  _createPreview([LOOP_MARK + "你好"]);
  const pv = document.getElementById("preSendPreview");
  assert(pv.querySelector(".preSendPreviewHeader").textContent.includes("循环中 2/5"), "header 显示「循环中 2/5」");
  assert(document.getElementById("preSendLoopCount").value === "5", "次数输入框值为 5");
  assert(document.getElementById("preSendLoopInterval").value === "3", "间隔输入框值为 3");
  assert(pv.querySelector(".loopRemain").textContent.includes("剩余 3"), "循环项显示「剩余 3 次」(5-2)");
}

console.log("\n=== DOM 测试 3: 混合队列渲染（普通项 + 循环项）===");
{
  window.__preSendState.set(SID, { texts: ["早上好", LOOP_MARK + "你好"], loop: { enabled: true, sourceText: "你好", totalCount: null, completed: 0, intervalMinutes: 10, nextLoopAt: null } });
  document.getElementById("preSendPreview")?.remove();
  _createPreview(["早上好", LOOP_MARK + "你好"]);
  const items = document.querySelectorAll(".preSendPreviewItem");
  assert(items.length === 2, "渲染 2 个队列项");
  assert(items[0].getAttribute("data-item-type") === "normal", "第 1 项是普通消息（早上好）");
  assert(items[0].querySelector(".preSendPreviewBtnSend") !== null, "普通项有「提前发送」按钮");
  assert(items[1].getAttribute("data-item-type") === "loop", "第 2 项是循环项（你好）");
  assert(items[0].querySelector(".preSendPreviewItemText").textContent === "早上好", "普通项文本为「早上好」");
  const hdr = document.querySelector(".preSendPreviewHeader");
  assert(hdr.textContent.includes("2 条"), "header 显示「2 条」");
}

console.log("\n=== DOM 测试 4: 非循环模式不显示循环控件 ===");
{
  window.__preSendState.set(SID, { texts: ["普通消息"], loop: null });
  document.getElementById("preSendPreview")?.remove();
  _createPreview(["普通消息"]);
  const pv = document.getElementById("preSendPreview");
  assert(!pv.hasAttribute("data-loop-active"), "无 data-loop-active 标记");
  assert(document.getElementById("preSendLoopCount") === null, "无循环次数输入框");
  assert(pv.querySelector(".preSendPreviewHeader").textContent.includes("排队中"), "header 显示「排队中」");
}

console.log("\n=== DOM 测试 5: 倒计时显示 ===");
{
  // 场景：循环已完成 1 次，下次发送在 9分32秒 后
  window.__preSendState.set(SID, { texts: [LOOP_MARK + "你好"], loop: { enabled: true, sourceText: "你好", totalCount: 5, completed: 1, intervalMinutes: 10, nextLoopAt: Date.now() + 9*60000 + 32000 } });
  document.getElementById("preSendPreview")?.remove();
  _createPreview([LOOP_MARK + "你好"]);
  const label = document.querySelector(".loopHeaderLabel");
  assert(label !== null, "进度 label 存在");
  const countdown = document.querySelector(".loopCountdown");
  assert(countdown !== null, "倒计时元素存在");
  assert(countdown.textContent.includes("⏱"), "倒计时含 ⏱ 符号");
  const cdText = countdown.textContent.replace("⏱ ","").trim();
  assert(/^\d+:\d+$/.test(cdText), "倒计时格式为 M:SS（实际「" + cdText + "」）");
  assert(parseInt(cdText.split(":")[0]) === 9, "分钟数为 9");
  assert(parseInt(cdText.split(":")[1]) >= 30, "秒数 >= 30");
  assert(label.textContent.includes("循环中 1/5"), "进度显示 1/5");
  assert(label.textContent.includes("条") === false, "单条时无「条」计数");
}

console.log("\n=== DOM 测试 6: 倒计时 - 不到1分钟显示秒数 ===");
{
  window.__preSendState.set(SID, { texts: [LOOP_MARK + "你好"], loop: { enabled: true, sourceText: "你好", totalCount: null, completed: 0, intervalMinutes: 10, nextLoopAt: Date.now() + 42000 } });
  document.getElementById("preSendPreview")?.remove();
  _createPreview([LOOP_MARK + "你好"]);
  const cd = document.querySelector(".loopCountdown");
  assert(cd !== null, "倒计时元素存在");
  const cdText = cd.textContent.replace("⏱ ","").trim();
  assert(/^\d+s$/.test(cdText), "不到1分钟显示 Xs 格式（实际「" + cdText + "」）");
}

console.log("\n=== DOM 测试 7: 倒计时 - 无等待时不显示倒计时 ===");
{
  window.__preSendState.set(SID, { texts: [LOOP_MARK + "你好"], loop: { enabled: true, sourceText: "你好", totalCount: null, completed: 0, intervalMinutes: 10, nextLoopAt: null } });
  document.getElementById("preSendPreview")?.remove();
  _createPreview([LOOP_MARK + "你好"]);
  const cd = document.querySelector(".loopCountdown");
  assert(cd === null, "无 nextLoopAt 时不显示倒计时元素");
}

console.log("\n=== DOM 测试 8: 增量更新稳定性（输入框不被重建、用户输入不丢失）===");
{
  window.__preSendState.set(SID, { texts: [LOOP_MARK + "你好"], loop: { enabled: true, sourceText: "你好", totalCount: null, completed: 0, intervalMinutes: 10, nextLoopAt: null } });
  document.getElementById("preSendPreview")?.remove();
  _createPreview([LOOP_MARK + "你好"]);
  const cnt1 = document.getElementById("preSendLoopCount");
  const itv1 = document.getElementById("preSendLoopInterval");
  // 模拟用户输入次数框（未同步回 state 前）
  cnt1.value = "7";
  // 模拟轮询/发送导致的重复 _createPreview（completed 递增）
  window.__preSendState.get(SID).loop.completed = 1;
  _createPreview([LOOP_MARK + "你好"]);
  const cnt2 = document.getElementById("preSendLoopCount");
  const itv2 = document.getElementById("preSendLoopInterval");
  assert(cnt2 === cnt1, "次数输入框是同一个 DOM 节点（未被重建）");
  assert(itv2 === itv1, "间隔输入框是同一个 DOM 节点（未被重建）");
  assert(cnt2.value === "7", "用户输入的次数「7」在重渲染后保留");
  const label = document.querySelector(".loopHeaderLabel");
  assert(label && label.textContent.includes("循环中"), "进度 label 仍存在");
  // 多次重渲染仍稳定
  for (let k = 0; k < 5; k++) _createPreview([LOOP_MARK + "你好"]);
  assert(document.getElementById("preSendLoopCount") === cnt1, "多次重渲染后输入框仍是同一节点");
  assert(document.getElementById("preSendLoopCount").value === "7", "多次重渲染后输入值仍保留");
}

console.log(`\n========================================`);
console.log(`DOM 渲染结果: ${passed} 通过, ${failed} 失败`);
console.log(`========================================`);
process.exit(failed > 0 ? 1 : 0);
