import test from "node:test";
import assert from "node:assert/strict";
import { sqlLearningModules } from "../src/sql-learning-curriculum.ts";
import {
  hideSqlLearningQuestionSolution,
  getSqlLearningTopicScope,
  hasSqlLearningDifficultyDistribution,
  hasSqlLearningTestDifficultyDistribution,
  isRetryableSqlLearningQueryError,
  generateValidatedSqlLearningQuestions,
  summarizeSqlLearningTopicTests,
  sqlLearningResultsMatch,
  summarizeSqlLearningTestAttempts,
  summarizeSqlLearningActivity,
  validateSqlLearningCurriculum
} from "../src/sql-learning.ts";

test("SQL Learning seeds all 24 modules and all listed topics with stable unique IDs", () => {
  assert.equal(sqlLearningModules.length, 24);
  assert.equal(sqlLearningModules.reduce((count, module) => count + module.topics.length, 0), 708);

  const moduleIds = sqlLearningModules.map((module) => module.id);
  const topicIds = sqlLearningModules.flatMap((module) => module.topics.map((topic) => topic.id));
  assert.equal(new Set(moduleIds).size, moduleIds.length);
  assert.equal(new Set(topicIds).size, topicIds.length);
  assert.deepEqual(validateSqlLearningCurriculum(sqlLearningModules).errors, []);
  assert.ok(sqlLearningModules.every((module) => module.topics.length > 0));
  assert.ok(sqlLearningModules.every((module) => module.topics.every((topic, index) => topic.order === index + 1 && topic.title.trim())));
  assert.equal(sqlLearningModules[2].topics.find((topic) => topic.title === "TRIM().")?.id, "sql-03-trim");
});

test("SQL Learning topic tests receive only topics in curriculum order as prerequisites", () => {
  const curriculum = [
    { id: "module-a", title: "Module A", order: 1, topics: [{ id: "topic-a", title: "SELECT", order: 1 }, { id: "topic-b", title: "WHERE", order: 2 }] },
    { id: "module-b", title: "Module B", order: 2, topics: [{ id: "topic-c", title: "JOIN", order: 1 }] }
  ];

  assert.deepEqual(getSqlLearningTopicScope("topic-c", curriculum), {
    targetTopic: "JOIN",
    prerequisiteTopics: ["SELECT", "WHERE"]
  });
  assert.deepEqual(getSqlLearningTopicScope("topic-a", curriculum), {
    targetTopic: "SELECT",
    prerequisiteTopics: []
  });
  assert.equal(getSqlLearningTopicScope("missing", curriculum), null);
});

test("SQL Learning topic summaries use projected counts and tolerate incomplete stored records", () => {
  const summaries = summarizeSqlLearningTopicTests("sql-01-intro", [
    { id: "saved-test-1", test_number: 1, questionCount: 15, status: "ready" },
    { id: "legacy-test-2", test_number: 2, status: "ready" },
    { id: "invalid-count-test-3", test_number: 3, questionCount: Number.NaN, status: "ready" }
  ]);

  assert.equal(summaries.length, 5);
  assert.deepEqual(summaries[0], {
    id: "saved-test-1", testNumber: 1, questionCount: 15, status: "ready",
    result: { totalQuestions: 15, answeredQuestions: 0, correctAnswers: 0, incorrectAnswers: 0, skippedQuestions: 15, score: 0, accuracy: 0, completed: false }
  });
  assert.deepEqual(summaries[1], {
    id: "legacy-test-2", testNumber: 2, questionCount: 0, status: "ready",
    result: { totalQuestions: 0, answeredQuestions: 0, correctAnswers: 0, incorrectAnswers: 0, skippedQuestions: 0, score: 0, accuracy: 0, completed: true }
  });
  assert.deepEqual(summaries[2], {
    id: "invalid-count-test-3", testNumber: 3, questionCount: 0, status: "ready",
    result: { totalQuestions: 0, answeredQuestions: 0, correctAnswers: 0, incorrectAnswers: 0, skippedQuestions: 0, score: 0, accuracy: 0, completed: true }
  });
  assert.deepEqual(summaries[3], {
    id: "sql-01-intro-test-4", testNumber: 4, questionCount: 0, status: "not_generated",
    result: { totalQuestions: 0, answeredQuestions: 0, correctAnswers: 0, incorrectAnswers: 0, skippedQuestions: 0, score: 0, accuracy: 0, completed: true }
  });
  assert.deepEqual(summaries[4], {
    id: "sql-01-intro-test-5", testNumber: 5, questionCount: 0, status: "not_generated",
    result: { totalQuestions: 0, answeredQuestions: 0, correctAnswers: 0, incorrectAnswers: 0, skippedQuestions: 0, score: 0, accuracy: 0, completed: true }
  });
});

test("SQL Learning topic test cards summarize each question's latest submission", () => {
  const summaries = summarizeSqlLearningTopicTests("topic-a", [
    { id: "test-a", test_number: 1, questionCount: 3, status: "ready" }
  ], [
    { test_id: "test-a", question_id: "q1", correct: true },
    { test_id: "test-a", question_id: "q1", correct: false },
    { test_id: "test-a", question_id: "q2", correct: false }
  ]);

  assert.deepEqual(summaries[0].result, {
    totalQuestions: 3,
    answeredQuestions: 2,
    correctAnswers: 1,
    incorrectAnswers: 1,
    skippedQuestions: 1,
    score: 33,
    accuracy: 50,
    completed: false
  });
});

test("self-reported known SQL Learning answers count as correct question completions", () => {
  const result = summarizeSqlLearningTestAttempts([
    { question_id: "known-question", correct: true, self_reported: true },
    { question_id: "executed-question", correct: true }
  ], 2);

  assert.deepEqual(result, {
    totalQuestions: 2,
    answeredQuestions: 2,
    correctAnswers: 2,
    incorrectAnswers: 0,
    skippedQuestions: 0,
    score: 100,
    accuracy: 100,
    completed: true
  });
});

test("SQL Learning retries PostgreSQL query and type validation errors only", () => {
  assert.equal(isRetryableSqlLearningQueryError({ code: "42883", message: "function avg(text) does not exist" }), true);
  assert.equal(isRetryableSqlLearningQueryError({ code: "42601", message: "syntax error" }), true);
  assert.equal(isRetryableSqlLearningQueryError({ code: "22P02", message: 'invalid input syntax for type numeric: "$92368 "' }), true);
  assert.equal(isRetryableSqlLearningQueryError({ code: "08006", message: "connection failure" }), false);
  assert.equal(isRetryableSqlLearningQueryError(new Error("Database unavailable")), false);
});

test("SQL Learning regenerates a complete test batch after a PostgreSQL cast failure", async () => {
  const validationFeedback = [];
  let generationCount = 0;
  const result = await generateValidatedSqlLearningQuestions(
    async (feedback) => {
      validationFeedback.push([...feedback]);
      generationCount += 1;
      return [{ reference_sql: generationCount === 1 ? "SELECT amount::numeric" : "SELECT amount" }];
    },
    (questions) => assert.equal(questions.length, 1),
    async (sql) => {
      if (sql === "SELECT amount::numeric") {
        const error = new Error('invalid input syntax for type numeric: "$92368 "');
        error.code = "22P02";
        throw error;
      }
      return { rows: [{ amount: "$92368 " }] };
    },
    "practice-test"
  );

  assert.equal(generationCount, 2);
  assert.equal(validationFeedback[0].length, 0);
  assert.equal(validationFeedback[1].length, 1);
  assert.match(validationFeedback[1][0], /invalid input syntax for type numeric; query attempted to cast unvalidated text/);
  assert.doesNotMatch(validationFeedback[1][0], /\$92368/);
  assert.equal(result.questions[0].reference_sql, "SELECT amount");
  assert.deepEqual(result.expected[0].rows, [{ amount: "$92368 " }]);
});

test("SQL Learning regenerates an incomplete 15-question batch before rejecting it", async () => {
  const validationFeedback = [];
  let generationCount = 0;
  const questions = Array.from({ length: 15 }, (_, index) => ({ reference_sql: `SELECT ${index + 1}` }));
  const result = await generateValidatedSqlLearningQuestions(
    async (feedback) => {
      validationFeedback.push([...feedback]);
      generationCount += 1;
      return generationCount === 1 ? questions.slice(0, 12) : questions;
    },
    (batch) => {
      if (batch.length !== 15) throw new Error("The test generator must return exactly 15 questions.");
    },
    async (sql) => ({ sql }),
    "practice-test"
  );

  assert.equal(generationCount, 2);
  assert.equal(validationFeedback[0].length, 0);
  assert.match(validationFeedback[1][0], /exactly 15 questions/);
  assert.equal(result.questions.length, 15);
  assert.equal(result.expected.length, 15);
});

test("SQL Learning does not regenerate for database connectivity errors", async () => {
  let generationCount = 0;
  await assert.rejects(
    generateValidatedSqlLearningQuestions(
      async () => {
        generationCount += 1;
        return [{ reference_sql: "SELECT 1" }];
      },
      () => {},
      async () => {
        const error = new Error("Connection terminated");
        error.code = "08006";
        throw error;
      },
      "practice-test"
    ),
    /Connection terminated/
  );
  assert.equal(generationCount, 1);
});

test("SQL Learning answer comparison ignores row order and column-name casing", () => {
  const expected = { columns: ["employee_id", "employee_name"], rows: [{ employee_id: 7, employee_name: "Ada" }, { employee_id: 8, employee_name: "Grace" }] };
  const same = { columns: ["EMPLOYEE_ID", "EMPLOYEE_NAME"], rows: [{ EMPLOYEE_ID: 8, EMPLOYEE_NAME: "Grace" }, { EMPLOYEE_ID: 7, EMPLOYEE_NAME: "Ada" }] };
  const different = { columns: ["employee_id", "employee_name"], rows: [{ employee_id: 8, employee_name: "Grace" }] };

  assert.equal(sqlLearningResultsMatch(same, expected), true);
  assert.equal(sqlLearningResultsMatch(different, expected), false);
  assert.equal(sqlLearningResultsMatch({ columns: ["employee_name", "employee_id"], rows: [{ employee_name: "Ada", employee_id: 7 }] }, expected), false);
});

test("SQL Learning requires a balanced 15-question difficulty distribution", () => {
  const balanced = [...Array(5).fill("beginner"), ...Array(5).fill("intermediate"), ...Array(5).fill("advanced")].map((difficulty) => ({ difficulty }));
  assert.equal(hasSqlLearningTestDifficultyDistribution(balanced), true);
  assert.equal(hasSqlLearningTestDifficultyDistribution(balanced.slice(1)), false);
  assert.equal(hasSqlLearningTestDifficultyDistribution(balanced.map((question) => ({ ...question, difficulty: "beginner" }))), false);
});

test("SQL Learning module assessments require 30 questions split evenly across difficulty levels", () => {
  const balanced = [...Array(10).fill("beginner"), ...Array(10).fill("intermediate"), ...Array(10).fill("advanced")].map((difficulty) => ({ difficulty }));
  assert.equal(hasSqlLearningDifficultyDistribution(balanced, 30), true);
  assert.equal(hasSqlLearningDifficultyDistribution(balanced.slice(1), 30), false);
  assert.equal(hasSqlLearningDifficultyDistribution(balanced.map((question) => ({ ...question, difficulty: "beginner" })), 30), false);
});

test("SQL Learning hides validated answers until the solution endpoint is requested", () => {
  const visible = hideSqlLearningQuestionSolution({
    id: "q1",
    title: "Question",
    difficulty: "beginner",
    context: "Context",
    task: "Task",
    required_output: "Output",
    hint: "Hint",
    explanation: "Explanation",
    reference_sql: "SELECT 1",
    expected: { columns: ["?column?"], rows: [{ "?column?": 1 }], rowCount: 1 }
  });

  assert.equal("reference_sql" in visible, false);
  assert.equal("expected" in visible, false);
  assert.equal(visible.hint, "Hint");
});

test("SQL Learning summarizes the latest answer per question without losing skipped questions", () => {
  const result = summarizeSqlLearningTestAttempts([
    { question_id: "q1", correct: true },
    { question_id: "q1", correct: false },
    { question_id: "q2", correct: false }
  ], 3);

  assert.deepEqual(result, {
    totalQuestions: 3,
    answeredQuestions: 2,
    correctAnswers: 1,
    incorrectAnswers: 1,
    skippedQuestions: 1,
    score: 33,
    accuracy: 50,
    completed: false
  });

});

test("SQL Learning streak counts distinct consecutive UTC days and accepts a missed current day", () => {
  const today = new Date("2026-11-01T10:00:00.000Z");
  assert.deepEqual(summarizeSqlLearningActivity(["2026-10-30", "2026-10-31", "2026-11-01", "2026-11-01"], today), {
    currentStreak: 3,
    longestStreak: 3,
    activeDays: 3
  });
  assert.equal(summarizeSqlLearningActivity(["2026-10-31"], today).currentStreak, 1);
  assert.equal(summarizeSqlLearningActivity(["2026-10-29"], today).currentStreak, 0);
});

test("SQL Learning curriculum validation rejects duplicate ids, orders, and malformed topics", () => {
  const valid = [
    { id: "module-a", title: "Module A", order: 1, topics: [{ id: "topic-a", title: "Topic A", order: 1, difficulty: "beginner" }] },
    { id: "module-b", title: "Module B", order: 2, topics: [{ id: "topic-b", title: "Topic B", order: 1 }] }
  ];
  assert.deepEqual(validateSqlLearningCurriculum(valid).errors, []);
  assert.equal(validateSqlLearningCurriculum(valid).modules.length, 2);
  const invalid = structuredClone(valid);
  invalid[1].topics[0].id = "topic-a";
  invalid[1].order = 1;
  const result = validateSqlLearningCurriculum(invalid);
  assert.equal(result.modules, null);
  assert.ok(result.errors.some((error) => /unique valid id/.test(error)));
  assert.ok(result.errors.some((error) => /unique positive order/.test(error)));
  assert.equal(validateSqlLearningCurriculum([]).modules, null);
});
