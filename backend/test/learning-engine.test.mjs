import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeQuestionFilters, publicLearningQuestion, validateLearningQuestion } from '../src/learning-engine.ts';

test('question filters are bounded and reject unsupported filter values', () => {
  assert.deepEqual(normalizeQuestionFilters({ page: 0, pageSize: 1000, difficulty: 'expert', type: 'python', state: 'private', search: 'x'.repeat(150) }), {
    moduleId: '', topic: '', difficulty: '', type: '', state: 'all', search: 'x'.repeat(100), page: 1, pageSize: 50
  });
});

test('public question responses never expose answers or grading material', () => {
  const visible = publicLearningQuestion({
    _id: 'question-1', title: 'Question', answer_id: 'b', reference_answer: 'secret answer',
    explanation: 'secret explanation', common_mistakes: ['secret mistake'], options: [{ id: 'a', text: 'A' }]
  });
  assert.equal(visible._id, 'question-1');
  assert.equal('answer_id' in visible, false);
  assert.equal('reference_answer' in visible, false);
  assert.equal('explanation' in visible, false);
  assert.equal('common_mistakes' in visible, false);
});

test('reviewed questions require a valid answer, explanation, and unique choices', () => {
  const question = {
    id: 'valid', module_id: 'python-etl', title: 'Question', prompt: 'Prompt?', difficulty: 'beginner', type: 'mcq',
    options: [{ id: 'a', text: 'Choice A' }, { id: 'b', text: 'Choice B' }], answer_id: 'a',
    reference_answer: 'Choice A', explanation: 'Because A is supported.', hints: []
  };
  assert.deepEqual(validateLearningQuestion(question), []);
  assert.match(validateLearningQuestion({ ...question, answer_id: 'missing', options: [{ id: 'a', text: 'A' }, { id: 'a', text: 'Duplicate' }] }).join(' '), /unique|match/);
});

test('public coding challenge data excludes hidden tests and reference code', () => {
  const visible = publicLearningQuestion({
    id: 'python-task', type: 'coding', starter_code: 'pass', test_cases: [{ name: 'hidden' }],
    reference_solution: 'secret code', reference_answer: 'secret answer', explanation: 'private rubric'
  });
  assert.equal(visible.starter_code, 'pass');
  assert.equal('test_cases' in visible, false);
  assert.equal('reference_solution' in visible, false);
  assert.equal('reference_answer' in visible, false);
  assert.equal('explanation' in visible, false);
});