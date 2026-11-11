import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getLearningQuestion,
  listLearningQuestions,
  learningRunnerStatus,
  seedLearningQuestions,
  setLearningBookmark,
  markLearningQuestionKnown,
  submitLearningCode,
  submitLearningAnswer
} from '../src/learning-engine.ts';
import { closeMongo, connectMongo, mongoCollection } from '../src/mongo.ts';
import { seedCurriculum } from '../src/curriculum.ts';
import { answerLearningInterview, finishLearningInterview, getLearningInterview, listLearningInterviews, startLearningInterview } from '../src/learning-interviews.ts';
import { getSqlLearningPracticeTest, getSqlLearningRevisionCenter, markSqlLearningQuestionKnown, seedSqlLearningCurriculum, setSqlLearningQuestionRevision } from '../src/sql-learning.ts';

test('Mongo learning attempts, bookmarks, answer secrecy, and learner isolation', {
  skip: process.env.RUN_MONGO_INTEGRATION !== '1'
}, async () => {
  await connectMongo();
  const userOne = 'integration-learner-one';
  const userTwo = 'integration-learner-two';
  const questionId = 'python-batch-validation';

  try {
    await seedLearningQuestions();
    await seedCurriculum();
    await seedSqlLearningCurriculum();
    const curriculum = await mongoCollection('learning_modules').findOne({ _id: 'python-etl' });
    assert.ok(curriculum.lessons.length >= 5);
    const runnerStatus = await learningRunnerStatus();
    assert.equal(runnerStatus.python.configured, false);
    const codingQuestion = await getLearningQuestion('python-dedupe-events', userOne);
    assert.equal('test_cases' in codingQuestion, false);
    assert.equal('reference_solution' in codingQuestion, false);
    const noRunner = await submitLearningCode(userOne, 'python-dedupe-events', 'print("hello")');
    assert.equal(noRunner.status, 'unavailable');
    const question = await getLearningQuestion(questionId, userOne);
    assert.ok(question);
    assert.equal('answer_id' in question, false);
    assert.equal('reference_answer' in question, false);

    const wrong = await submitLearningAnswer(userOne, questionId, 'b');
    assert.equal(wrong.status, 'ok');
    assert.equal(wrong.correct, false);
    assert.ok(wrong.referenceAnswer);

    const retryList = await listLearningQuestions(userOne, { moduleId: 'python-etl', state: 'incorrect' });
    assert.ok(retryList.items.some((item) => item.id === questionId));
    const otherRetryList = await listLearningQuestions(userTwo, { moduleId: 'python-etl', state: 'incorrect' });
    assert.equal(otherRetryList.items.some((item) => item.id === questionId), false);

    assert.equal(await setLearningBookmark(userOne, questionId, true), true);
    const bookmarked = await listLearningQuestions(userOne, { moduleId: 'python-etl', state: 'bookmarked' });
    assert.ok(bookmarked.items.some((item) => item.id === questionId));
    const otherBookmarks = await mongoCollection('learning_bookmarks').countDocuments({ user_id: userTwo, question_id: questionId });
    assert.equal(otherBookmarks, 0);

    const selfReported = await markLearningQuestionKnown(userTwo, questionId);
    assert.equal(selfReported.status, 'ok');
    const selfReportedAgain = await markLearningQuestionKnown(userTwo, questionId);
    assert.equal(selfReportedAgain.status, 'ok');
    const knownAttempts = await mongoCollection('learning_attempts').find({ user_id: userTwo, question_id: questionId, self_reported: true }).toArray();
    assert.equal(knownAttempts.length, 1);
    assert.equal(knownAttempts[0].correct, true);
    const knownQuestions = await listLearningQuestions(userTwo, { moduleId: 'python-etl', state: 'completed' });
    assert.ok(knownQuestions.items.some((item) => item.id === questionId));

    const sqlTopic = 'sql-01-introduction-to-sql';
    const sqlTestId = 'integration-known-sql-test';
    await mongoCollection('sql_learning_tests').insertOne({
      _id: sqlTestId,
      id: sqlTestId,
      user_id: userTwo,
      topic_id: sqlTopic,
      module_id: 'sql-module-01',
      test_number: 1,
      database_id: 'integration-workspace',
      status: 'ready',
      questions: [{
        id: 'known-sql-question',
        title: 'Known SQL question',
        difficulty: 'beginner',
        context: 'Integration test',
        task: 'Select all rows.',
        required_output: 'All rows',
        reference_sql: 'SELECT 1',
        hint: 'Use SELECT.',
        explanation: 'A select statement returns rows.',
        expected: { columns: ['?column?'], rows: [{ '?column?': 1 }], rowCount: 1 }
      }],
      created_at: new Date()
    });
    const sqlKnown = await markSqlLearningQuestionKnown(userTwo, sqlTestId, 'known-sql-question');
    assert.equal(sqlKnown.status, 'ok');
    const sqlTest = await getSqlLearningPracticeTest(userTwo, sqlTestId);
    assert.equal(sqlTest.result.completed, true);
    assert.equal(sqlTest.result.score, 100);
    assert.equal(sqlTest.attempts[0].self_reported, true);
    const revisionMark = await setSqlLearningQuestionRevision(userTwo, sqlTestId, 'known-sql-question', true);
    assert.deepEqual(revisionMark, { status: 'ok', marked: true });
    assert.deepEqual((await getSqlLearningPracticeTest(userTwo, sqlTestId)).revisionQuestionIds, ['known-sql-question']);
    const revisionCenter = await getSqlLearningRevisionCenter(userTwo);
    assert.equal(revisionCenter.questionRevisions.length, 1);
    assert.equal(revisionCenter.questionRevisions[0].questionTitle, 'Known SQL question');
    assert.deepEqual(await setSqlLearningQuestionRevision(userTwo, sqlTestId, 'known-sql-question', false), { status: 'ok', marked: false });
    assert.equal((await getSqlLearningRevisionCenter(userTwo)).questionRevisions.length, 0);
    assert.deepEqual((await getSqlLearningPracticeTest(userTwo, sqlTestId)).revisionQuestionIds, []);
    assert.deepEqual(await setSqlLearningQuestionRevision(userOne, sqlTestId, 'known-sql-question', true), { status: 'not_found' });
    await mongoCollection('sql_learning_tests').insertOne({
      _id: 'integration-known-interview',
      id: 'integration-known-interview',
      user_id: userTwo,
      topic_id: sqlTopic,
      module_id: 'sql-module-01',
      test_number: 0,
      assessment_kind: 'interview',
      database_id: 'integration-workspace',
      status: 'ready',
      questions: [{ id: 'interview-question' }],
      created_at: new Date()
    });
    const interviewKnown = await markSqlLearningQuestionKnown(userTwo, 'integration-known-interview', 'interview-question');
    assert.equal(interviewKnown.status, 'not_found');
    const interviewRevision = await setSqlLearningQuestionRevision(userTwo, 'integration-known-interview', 'interview-question', true);
    assert.equal(interviewRevision.status, 'not_found');

    const correct = await submitLearningAnswer(userOne, questionId, 'a');
    assert.equal(correct.status, 'ok');
    assert.equal(correct.correct, true);
    const completed = await listLearningQuestions(userOne, { moduleId: 'python-etl', state: 'completed' });
    assert.ok(completed.items.some((item) => item.id === questionId));

    const interview = await startLearningInterview({ userId: userOne, moduleId: 'python-etl', difficulty: 'mixed', count: 1, durationSeconds: 600 });
    const interviewQuestion = interview.questions[0];
    assert.ok(await getLearningInterview(interview.id, userOne));
    assert.equal(await getLearningInterview(interview.id, userTwo), null);
    const answer = await answerLearningInterview({
      sessionId: interview.id,
      userId: userOne,
      questionId: interviewQuestion.id,
      answer: 'I validate the batch and make retries deterministic.',
      evaluate: async () => ({ correctness: 4, completeness: 4, reasoning: 4, tradeoffs: 4, strengths: ['Explains validation.'], gaps: ['Mention output reconciliation.'], referenceAnswer: 'Validate and reconcile a deterministic batch.', followUpQuestion: 'How would you handle late events?' })
    });
    assert.equal(answer.status, 'ok');
    const history = await listLearningInterviews(userOne);
    assert.ok(history.some((item) => item.id === interview.id));
    const report = await finishLearningInterview(interview.id, userOne);
    assert.equal(report.status, 'ok');
    assert.equal(report.session.score, 80);
    assert.ok(report.session.revision_recommendations.includes('Mention output reconciliation.'));

    const outageInterview = await startLearningInterview({ userId: userOne, moduleId: 'python-etl', difficulty: 'mixed', count: 1, durationSeconds: 600 });
    const outageResponse = await answerLearningInterview({
      sessionId: outageInterview.id,
      userId: userOne,
      questionId: outageInterview.questions[0].id,
      answer: 'Saved even when feedback is unavailable.',
      evaluate: async () => { throw new Error('test provider outage'); }
    });
    assert.equal(outageResponse.status, 'feedback_unavailable');
    const resumed = await getLearningInterview(outageInterview.id, userOne);
    assert.equal(resumed.responses[0].answer, 'Saved even when feedback is unavailable.');
  } finally {
    await Promise.all([
      mongoCollection('learning_attempts').deleteMany({ user_id: { $in: [userOne, userTwo] } }),
      mongoCollection('learning_bookmarks').deleteMany({ user_id: { $in: [userOne, userTwo] } }),
      mongoCollection('learning_question_progress').deleteMany({ user_id: { $in: [userOne, userTwo] } }),
      mongoCollection('sql_learning_tests').deleteMany({ user_id: { $in: [userOne, userTwo] } }),
      mongoCollection('sql_learning_test_attempts').deleteMany({ user_id: { $in: [userOne, userTwo] } }),
      mongoCollection('interview_sessions').deleteMany({ user_id: { $in: [userOne, userTwo] } }),
      mongoCollection('learning_attempts').deleteMany({ user_id: { $in: [userOne, userTwo] }, language: { $exists: true } })
    ]);
    await closeMongo();
  }
});