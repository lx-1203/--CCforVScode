// 把手机端回传的答案（{ [question]: label }）映射成 CC 期望的
// { behavior:'allow', updatedInput:{ ...input, answers } }。
// 与 extension.js:56355 的返回结构保持一致。
function mapAnswersToInput(input, phoneReplies) {
  const questions = (input && input.questions) || [];
  const answers = {};
  for (const q of questions) {
    const key = q.question || q.header || '问题';
    answers[key] = (phoneReplies && phoneReplies[key]) || '';
  }
  return { behavior: 'allow', updatedInput: Object.assign({}, input, { answers: answers }) };
}

module.exports = { mapAnswersToInput: mapAnswersToInput };
