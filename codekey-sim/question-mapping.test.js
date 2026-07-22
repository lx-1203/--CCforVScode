const assert = require('assert');
const { mapAnswersToInput } = require('./question-mapping.js');

// 单问，手机回选中 label
(function testSingle() {
  const input = { questions: [{ question: '用哪个数据库?', header: 'DB', options: [{ label: 'Postgres' }, { label: 'MySQL' }] }] };
  const phoneReplies = { '用哪个数据库?': 'Postgres' };
  const out = mapAnswersToInput(input, phoneReplies);
  assert.strictEqual(out.behavior, 'allow');
  assert.deepStrictEqual(out.updatedInput.answers, { '用哪个数据库?': 'Postgres' });
  assert.deepStrictEqual(out.updatedInput.questions, input.questions, '应保留原 questions');
  console.log('  ✓ testSingle');
})();

// 多问
(function testMulti() {
  const input = { questions: [
    { question: 'Q1', options: [{ label: 'A' }] },
    { question: 'Q2', options: [{ label: 'B' }] },
  ] };
  const out = mapAnswersToInput(input, { 'Q1': 'A', 'Q2': 'B' });
  assert.deepStrictEqual(out.updatedInput.answers, { 'Q1': 'A', 'Q2': 'B' });
  console.log('  ✓ testMulti');
})();

// 缺答案 → 该问答案为空串，不崩溃
(function testMissing() {
  const input = { questions: [{ question: 'Q1', options: [{ label: 'A' }] }] };
  const out = mapAnswersToInput(input, {});
  assert.strictEqual(out.updatedInput.answers['Q1'], '');
  console.log('  ✓ testMissing');
})();

console.log('question-mapping: 全部通过');
