import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeQuestionFilters, publicLearningQuestion, publicLearningQuestionReview, validateLearningQuestion } from '../src/learning-engine.ts';
import { foundationalSparkQuestions } from '../src/pyspark-questions.ts';
import { cloudTrackQuestions, databricksTrackQuestions, pythonTrackQuestions } from '../src/track-question-seeds.ts';

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

test('public coding challenge data excludes hidden tests, evaluator function, and reference code', () => {
  const visible = publicLearningQuestion({
    id: 'python-task', type: 'coding', starter_code: 'pass', function_name: 'internal_evaluator', test_cases: [{ name: 'hidden', expected: 'secret' }],
    reference_solution: 'secret code', reference_answer: 'secret answer', explanation: 'private rubric'
  });
  assert.equal(visible.starter_code, 'pass');
  assert.equal('test_cases' in visible, false);
  assert.equal('function_name' in visible, false);
  assert.equal('reference_solution' in visible, false);
  assert.equal('reference_answer' in visible, false);
  assert.equal('explanation' in visible, false);
});

test('published question reviews expose reference answers without grading data', () => {
  const review = publicLearningQuestionReview({
    reference_answer: 'Use a deterministic merge.', reference_solution: 'def merge(): pass',
    explanation: 'Keep the operation idempotent.', common_mistakes: ['Skipping retries'],
    answer_id: 'hidden-choice', test_cases: [{ expected: 'secret' }], function_name: 'private_checker'
  });
  assert.equal(review.referenceAnswer, 'Use a deterministic merge.');
  assert.equal(review.referenceSolution, 'def merge(): pass');
  assert.equal(review.explanation, 'Keep the operation idempotent.');
  assert.deepEqual(review.commonMistakes, ['Skipping retries']);
  assert.equal('answer_id' in review, false);
  assert.equal('test_cases' in review, false);
  assert.equal('function_name' in review, false);
});

test('PySpark curriculum has 15 validated, schema-documented exercises at each A-R level', () => {
  assert.equal(foundationalSparkQuestions.length, 270);
  for (const level of 'ABCDEFGHIJKLMNOPQR') {
    const questions = foundationalSparkQuestions.filter((question) => question.learning_level === level);
    assert.equal(questions.length, 15, `Level ${level} should have 15 exercises`);
    assert.ok(questions.every((question) => validateLearningQuestion(question).length === 0));
    assert.equal(new Set(questions.map((question) => question.id)).size, 15);
    assert.equal(new Set(questions.map((question) => question.function_name)).size, 15);
    assert.ok(questions.every((question) => question.starter_code.includes(`def ${question.function_name}(`)));
    assert.ok(questions.every((question) => question.test_cases.length >= 2 && question.public_examples.length === 1));
    assert.ok(questions.every((question) => question.input_schema.length > 0 && question.reference_solution.length > 0));
    assert.ok(questions.every((question) => !('test_cases' in publicLearningQuestion(question)) && !('function_name' in publicLearningQuestion(question))));
  }
});

test('Python, cloud, and ETL tracks have 15 questions per level with private grading data', () => {
  const modules = [
    ['Python', pythonTrackQuestions],
    ['Azure', cloudTrackQuestions.filter((question) => question.module_id === 'azure-data-factory')],
    ['ETL', cloudTrackQuestions.filter((question) => question.module_id === 'etl-data-quality')],
    ['Databricks', databricksTrackQuestions]
  ];
  for (const [name, questions] of modules) {
    assert.equal(questions.length, 270, `${name} should have 270 questions`);
    assert.equal(new Set(questions.map((question) => question.id)).size, 270, `${name} IDs should be unique`);
    for (const level of 'ABCDEFGHIJKLMNOPQR') {
      const atLevel = questions.filter((question) => question.learning_level === level);
      assert.equal(atLevel.length, 15, `${name} level ${level} should have 15 questions`);
      assert.equal(atLevel.filter((question) => validateLearningQuestion(question).length === 0).length, 15);
      assert.ok(atLevel.every((question) => !('test_cases' in publicLearningQuestion(question)) && !('reference_solution' in publicLearningQuestion(question))));
    }
  }
});