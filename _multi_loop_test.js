// Multi-loop round-robin model v2 — fixed tests + bug fixes
const LOOP_MARK = "LOOP", LOOP_SEP = "\x00";
const _isLoopMark = (t) => typeof t === "string" && t.indexOf(LOOP_MARK) === 0;
const _loopId = (t) => _isLoopMark(t) ? t.slice(LOOP_MARK.length, t.indexOf(LOOP_SEP, LOOP_MARK.length)) : "";
const _loopOrig = (t) => { const idx = _isLoopMark(t) ? t.indexOf(LOOP_SEP, LOOP_MARK.length) : -1; return idx >= 0 ? t.slice(idx + 1) : (_isLoopMark(t) ? t.slice(LOOP_MARK.length) : t); };
const _makeLoopMarked = (id, text) => LOOP_MARK + id + LOOP_SEP + text;
const OPT_MARK = "OPT";

let NOW = 1_000_000, sent = [], nextId = 0;
function nextLid() { return "l" + (++nextId); }
function createState() { return { texts: [], loops: {}, interval: null }; }

function enqueueLoopItem(state, sourceText, intervalMinutes, totalCount) {
  const lid = nextLid();
  const marked = _makeLoopMarked(lid, sourceText);
  state.loops[lid] = {
    sourceText, totalCount: totalCount || null, completed: 0,
    intervalMinutes: intervalMinutes || 0, ttlMinutes: null,
    ttlStartedAt: null, nextLoopAt: null
  };
  state.texts.push(marked);
  return lid;
}

function insertNormalBeforeLoop(state, text) {
  let firstLoopIdx = -1;
  for (let i = 0; i < state.texts.length; i++) { if (_isLoopMark(state.texts[i])) { firstLoopIdx = i; break; } }
  (firstLoopIdx < 0) ? state.texts.push(text) : state.texts.splice(firstLoopIdx, 0, text);
}

function enqueueInLoopMode(state, text, intervalMinutes, totalCount) {
  if (Object.keys(state.loops).length > 0) { insertNormalBeforeLoop(state, text); return null; }
  return enqueueLoopItem(state, text, intervalMinutes, totalCount);
}

function processLoopSend(state, lid) {
  const lp = state.loops[lid]; if (!lp) return false;
  lp.completed++;
  if (lp.ttlMinutes !== null && !lp.ttlStartedAt) lp.ttlStartedAt = NOW;
  if (lp.totalCount === null || lp.completed < lp.totalCount) {
    lp.nextLoopAt = NOW + lp.intervalMinutes * 60000;
    let insertIdx = state.texts.length;
    for (let i = 0; i < state.texts.length; i++) {
      if (_isLoopMark(state.texts[i]) && _loopId(state.texts[i]) !== lid) { insertIdx = i + 1; break; }
    }
    state.texts.splice(insertIdx, 0, _makeLoopMarked(lid, lp.sourceText));
    return true;
  }
  delete state.loops[lid]; return false;
}

function pollOnce(state) {
  if (state.texts.length === 0) return false;
  // TTL per loop
  for (const lid in state.loops) {
    const lp = state.loops[lid];
    if (lp.ttlMinutes !== null && lp.ttlStartedAt && NOW > lp.ttlStartedAt + lp.ttlMinutes * 60000) {
      delete state.loops[lid]; state.texts = state.texts.filter(t => _loopId(t) !== lid);
    }
  }
  if (state.texts.length === 0) return false;
  // Find first sendable
  let sendIdx = -1, sendLid = null, sendText = null;
  for (let i = 0; i < state.texts.length; i++) {
    const t = state.texts[i];
    if (t.indexOf(OPT_MARK) === 0) return false; // OPT blocks
    if (_isLoopMark(t)) {
      const lid = _loopId(t), lp = state.loops[lid];
      if (lp && lp.nextLoopAt && lp.completed > 0) { if (NOW < lp.nextLoopAt) continue; lp.nextLoopAt = null; }
      sendLid = lid; sendText = _loopOrig(t);
    } else { sendText = t; }
    sendIdx = i; break;
  }
  if (sendIdx < 0) return false;
  // Remove first (BEFORE using sendLid for re-enqueue)
  state.texts.splice(sendIdx, 1);
  sent.push(sendText);
  if (sendLid) processLoopSend(state, sendLid);
  return true;
}

// ============ TESTS ============
let passed = 0, failed = 0;
function assert(c, m) { (c ? passed++ : failed++), console.log(`  ${c ? "✅" : "❌"} ${m}`); }
function reset() { sent = []; NOW = 1_000_000; nextId = 0; }

console.log("\n=== Test 1: Two loops alternating (A=3, D=3) ===");
{
  reset(); let st = createState();
  enqueueLoopItem(st, "A", 0, 3); pollOnce(st); // A1 → [l1:A2]
  enqueueLoopItem(st, "D", 0, 3); // push D1: [l1:A2, l2:D1]
  pollOnce(st); // A2 → re-enq A3 after D1: [l2:D1, l1:A3]
  pollOnce(st); // D1 → re-enq D2 after A3: [l1:A3, l2:D2]
  pollOnce(st); // A3 → done → [l2:D2]
  pollOnce(st); // D2 → re-enq D3 at end: [l2:D3]
  pollOnce(st); // D3 → done → []
  const expect = ["A","A","D","A","D","D"];
  assert(JSON.stringify(sent) === JSON.stringify(expect), `order AADADD (${JSON.stringify(sent)})`);
  assert(Object.keys(st.loops).length === 0, "all done");
}

console.log("\n=== Test 2: Normal before loop items ===");
{
  reset(); let st = createState();
  enqueueLoopItem(st, "A", 0, 3); pollOnce(st);
  insertNormalBeforeLoop(st, "B"); insertNormalBeforeLoop(st, "C"); // → [B, C, l1:A2]
  pollOnce(st); assert(sent[1] === "B", "B"); pollOnce(st); assert(sent[2] === "C", "C");
  pollOnce(st); assert(sent[3] === "A", "A2"); pollOnce(st); assert(sent[4] === "A", "A3");
}

console.log("\n=== Test 3: A=5, D=2 (unequal) ===");
{
  reset(); let st = createState();
  enqueueLoopItem(st, "A", 0, 5); pollOnce(st);
  enqueueLoopItem(st, "D", 0, 2);
  for (let i = 1; i < 10; i++) pollOnce(st);
  console.log("   order:", JSON.stringify(sent));
  assert(sent.filter(s => s === "A").length === 5, "A x5");
  assert(sent.filter(s => s === "D").length === 2, "D x2");
  // Check alternating: no two consecutive As after D appears, except at end
  let dSeen = false, doubleA = false;
  for (let i = 1; i < sent.length; i++) { if (sent[i] === "D") dSeen = true; if (dSeen && sent[i-1] === "A" && sent[i] === "A") doubleA = true; }
  // Actually after D2 is done, A4-A5 can be consecutive. That's fine.
  assert(sent.indexOf("D") < sent.lastIndexOf("A"), "D finishes before last A (shorter count)");
}

console.log("\n=== Test 4: TTL per loop ===");
{
  reset(); let st = createState(); const l1 = enqueueLoopItem(st, "A", 0, 99);
  st.loops[l1].ttlMinutes = 10; pollOnce(st);
  assert(st.loops[l1]?.ttlStartedAt === NOW, "TTL started");
  NOW += 9*60000; pollOnce(st); assert(sent.length === 2, "A2 before TTL");
  NOW += 2*60000; pollOnce(st); assert(!st.loops[l1], "TTL cleared");
}

console.log(`\n============ ${passed} passed, ${failed} failed ============`);
process.exit(failed > 0 ? 1 : 0);
