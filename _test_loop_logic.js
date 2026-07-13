// 循环模式 core logic test (v2 - countdown-as-TTL)
const LOOP_MARK = "LOOP", OPT_MARK = "OPT";
const _isLoopMark = (t) => t.indexOf(LOOP_MARK) === 0;
const _loopOrig = (t) => _isLoopMark(t) ? t.slice(LOOP_MARK.length) : t;
const _isOptMark = (t) => t.indexOf(OPT_MARK) === 0;
let NOW = 1_000_000;
const nowFn = () => NOW;
let sent = [];

function enqueueLoopItem(state, sourceText, intervalMinutes = 10) {
  const loopMeta = { enabled: true, sourceText, totalCount: null, completed: 0, intervalMinutes, nextLoopAt: null };
  const marked = LOOP_MARK + sourceText;
  if (state) { state.texts.push(marked); if (!state.loop) state.loop = loopMeta; return state; }
  return { texts: [marked], loop: loopMeta };
}
function enqueueNormal(state, text) {
  if (state) { state.texts.push(text); return state; }
  return { texts: [text], loop: null };
}
function insertNormalBeforeLoop(state, text) {
  if (!state) return enqueueLoopItem(null, text);
  let lastLoopIdx = -1;
  for (let i = state.texts.length - 1; i >= 0; i--) { if (_isLoopMark(state.texts[i])) { lastLoopIdx = i; break; } }
  (lastLoopIdx < 0) ? state.texts.push(text) : state.texts.splice(lastLoopIdx, 0, text);
  return state;
}
function enqueueInLoopMode(state, text, intervalMinutes = 10) {
  if (state && state.loop && state.loop.enabled) return insertNormalBeforeLoop(state, text);
  return enqueueLoopItem(state, text, intervalMinutes);
}

function pollOnce(state) {
  if (!state || state.texts.length === 0) return false;
  if (_isOptMark(state.texts[0])) return false;
  let loop = state.loop || null;
  // TTL termination
  if (loop && loop.startedAt && nowFn() > loop.startedAt + loop.intervalMinutes * 60000) {
    state.loop = null; state.texts = state.texts.filter((t) => !_isLoopMark(t)); return false;
  }
  let sendIdx = -1;
  for (let i = 0; i < state.texts.length; i++) {
    const t = state.texts[i];
    if (_isOptMark(t)) break;
    if (_isLoopMark(t)) {
      if (loop && loop.nextLoopAt && loop.startedAt) {
        if (nowFn() < loop.nextLoopAt) continue;
        loop.nextLoopAt = null;
      }
    }
    sendIdx = i; break;
  }
  if (sendIdx < 0) return false;
  let next = state.texts.splice(sendIdx, 1)[0];
  const isLoop = _isLoopMark(next);
  if (isLoop) next = _loopOrig(next);
  if (isLoop && loop) {
    loop.completed++;
    if (!loop.startedAt) loop.startedAt = nowFn();
    if (loop.totalCount === null || loop.completed < loop.totalCount) {
      loop.nextLoopAt = nowFn() + loop.intervalMinutes * 60000;
      state.texts.push(LOOP_MARK + loop.sourceText);
    } else { state.loop = null; }
  }
  sent.push(next); return true;
}
function pressEscape(state) {
  if (!state) return null;
  if (state.loop && state.loop.enabled) {
    state.loop = null; state.texts = state.texts.filter((t) => !_isLoopMark(t));
    return state.texts.length === 0 ? null : state;
  }
  return null;
}

let passed = 0, failed = 0;
function assert(c, m) { (c ? passed++ : failed++), console.log(`  ${c ? "✅" : "❌"} ${m}`); }
function reset() { sent = []; NOW = 1_000_000; }

// ============ TESTS ============
console.log("\n=== Test 1: count exhaustion (3 sends, huge interval) ===");
{
  reset();
  let st = enqueueLoopItem(null, "hello", 99999);
  st.loop.totalCount = 3;
  for (let i = 0; i < 10; i++) { NOW += 1; pollOnce(st); } // nextLoopAt=startedAt+0=now, TTL far away
  assert(sent.filter(m => m === "hello").length === 3, "exactly 3 hello");
  assert(st.loop === null, "loop cleared on exhaustion");
}

console.log("\n=== Test 2: infinite loop (null count, huge interval) ===");
{
  reset();
  let st = enqueueLoopItem(null, "go", 99999);
  pollOnce(st);
  for (let i = 0; i < 10; i++) { NOW += 1; pollOnce(st); }
  assert(sent.length === 11, `11 sends (${sent.length})`);
  assert(st.loop && st.loop.enabled, "loop still active");
}

console.log("\n=== Test 3: TTL terminates after interval ===");
{
  reset();
  let st = enqueueLoopItem(null, "task", 10); st.loop.totalCount = 5;
  pollOnce(st); // #1 immediate, startedAt = NOW = 1000000
  assert(st.loop.startedAt === 1000000, "startedAt set on first send");
  // nextLoopAt = 1000000 + 600000 = 1600000. Advance to that exact time
  NOW = 1600000; pollOnce(st); // #2 (nextLoopAt reached, TTL not yet: NOW = startedAt+10min)
  assert(sent.length === 2, `2nd send OK (TTL uses >)`);
  // TTL expires: NOW > startedAt + 10min → 1600001 > 1000000+600000(=1600000)
  NOW = 1600001; pollOnce(st);
  assert(st.loop === null, "TTL expired → loop terminated");
}

console.log("\n=== Test 3b: interval=0 → terminates immediately after first ===");
{
  reset();
  let st = enqueueLoopItem(null, "one", 0); st.loop.totalCount = 99;
  pollOnce(st); NOW += 1; pollOnce(st);
  assert(sent.length === 1, "only 1 send, TTL expired instantly");
  assert(st.loop === null, "loop terminated");
}

console.log("\n=== Test 4: mixed queue (normal insert between loop items) ===");
{
  reset();
  let st = enqueueInLoopMode(null, "hello", 99999); st.loop.totalCount = 5;
  pollOnce(st); NOW += 1; pollOnce(st); NOW += 1; pollOnce(st); // 3 sends
  assert(sent.filter(m => m === "hello").length === 3, "3 hello sent");
  st = enqueueInLoopMode(st, "morning"); // one-shot insert
  assert(st.texts[0] === "morning" && _isLoopMark(st.texts[1]), "morning before loop item");
  NOW += 1; pollOnce(st); // morning first
  assert(sent[3] === "morning", "morning between 3rd and 4th");
  NOW += 1; pollOnce(st); // 4th hello
  assert(sent[4] === "hello", "4th hello after morning");
  assert(sent.filter(m => m === "morning").length === 1, "morning only once (not looping)");
  // Finish remaining
  for (let i = 0; i < 5; i++) { NOW += 1; pollOnce(st); }
  assert(sent.filter(m => m === "hello").length === 5, "5 hello total");
  assert(st.loop === null, "loop ended on count");
  console.log("   order:", JSON.stringify(sent));
}

console.log("\n=== Test 5: Escape cancels loop, keeps normal ===");
{
  reset();
  let st = enqueueLoopItem(null, "hello", 5); st.loop.totalCount = null;
  enqueueNormal(st, "msgA"); enqueueNormal(st, "msgB");
  st = pressEscape(st);
  assert(st !== null, "queue preserved");
  assert(st.loop === null, "loop cancelled");
  assert(st.texts.length === 2, `2 normal items (${st.texts.length})`);
  assert(!st.texts.some(_isLoopMark), "no loop items");
}

console.log("\n=== Test 6: Escape ALL loop → clear ===");
{
  reset();
  let st = enqueueLoopItem(null, "hello", 5);
  assert(pressEscape(st) === null, "pure-loop queue cleared");
}

console.log("\n=== Test 7: re-enqueue preserves content ===");
{
  reset();
  let st = enqueueLoopItem(null, "complex text with params", 99999);
  pollOnce(st);
  assert(st.texts.length === 1 && _isLoopMark(st.texts[0]), "re-enqueued as loop-marked");
  assert(_loopOrig(st.texts[0]) === "complex text with params", "content identical");
}

console.log("\n=== Test 8: opt blocks FIFO ===");
{
  reset();
  let st = { texts: [OPT_MARK + "optimizing", "normal"], loop: null };
  assert(pollOnce(st) === false, "optimizing blocks send");
}

console.log(`\n============ ${passed} passed, ${failed} failed ============`);
process.exit(failed > 0 ? 1 : 0);
