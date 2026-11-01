import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  hasSqlLearningDifficultyDistribution,
  summarizeSqlLearningActivity,
  validateSqlLearningCurriculum
} from "../src/sql-learning.ts";

const server = fs.readFileSync(new URL("../src/server.ts", import.meta.url), "utf8");
const implementation = fs.readFileSync(new URL("../src/sql-learning.ts", import.meta.url), "utf8");
const guard = fs.readFileSync(new URL("../src/sql-guard.ts", import.meta.url), "utf8");

test("admin curriculum and SQL question validation routes require the admin role", () => {
  for (const route of [
    "app.get('/api/admin/sql-learning/curriculum',requireRole('admin')",
    "app.post('/api/admin/sql-learning/curriculum/validate',requireRole('admin')",
    "app.put('/api/admin/sql-learning/curriculum',requireRole('admin')",
    "app.post('/api/admin/sql-learning/validate-questions',requireRole('admin')"
  ]) assert.ok(server.includes(route), `missing admin-only route: ${route}`);
});

test("planner persistence scopes reads and writes to the authenticated user", () => {
  assert.match(implementation, /findOne\(\{ _id: userId \}.*sql_learning_planners/s);
  assert.match(implementation, /updateOne\(\s*\{ _id: userId \}[\s\S]{0,500}user_id: userId/);
  assert.match(implementation, /Unknown SQL Learning topic/);
});

test("question validation executes through owned workspaces and the read-only SQL guard", () => {
  assert.match(implementation, /validateSqlLearningQuestionBatch[\s\S]{0,2000}runSqlLearningQuery\(userId, databaseId, question\.reference_sql\)/);
  assert.match(implementation, /runSqlLearningQuery\(userId: string, databaseId: string, sql: string\)[\s\S]{0,300}getWorkspaceByOwnedId\(userId, databaseId\)/);
  assert.match(guard, /Practice execution only permits one SELECT\/WITH query/);
  assert.match(guard, /blockedFunctions\.has\(child\.name\.toLowerCase\(\)\)/);
});

test("admin curriculum validation enforces unique ids and orders before persistence", () => {
  const curriculum = [
    { id: "module-a", title: "Module A", order: 1, topics: [{ id: "topic-a", title: "Topic A", order: 1 }] },
    { id: "module-b", title: "Module B", order: 2, topics: [{ id: "topic-b", title: "Topic B", order: 1 }] }
  ];
  assert.equal(validateSqlLearningCurriculum(curriculum).modules.length, 2);
  assert.equal(validateSqlLearningCurriculum([{ ...curriculum[0], order: 1 }, { ...curriculum[1], order: 1 }]).modules, null);
});

test("analytics streak calculations use unique sequential UTC calendar dates", () => {
  const result = summarizeSqlLearningActivity(["2026-10-30", "2026-10-31", "2026-11-01", "2026-11-01"], new Date("2026-11-01T00:10:00Z"));
  assert.equal(result.currentStreak, 3);
  assert.equal(result.longestStreak, 3);
  assert.equal(result.activeDays, 3);
  assert.equal(hasSqlLearningDifficultyDistribution([
    ...Array(5).fill({ difficulty: "beginner" }),
    ...Array(5).fill({ difficulty: "intermediate" }),
    ...Array(5).fill({ difficulty: "advanced" })
  ], 15), true);
});
