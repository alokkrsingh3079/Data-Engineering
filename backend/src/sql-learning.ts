import crypto from "node:crypto";
import type { Document } from "mongodb";
import { mongoCollection } from "./mongo.js";
import { sqlLearningModules } from "./sql-learning-curriculum.js";
import { executeReadOnly, listTables, quoteIdent, schemaSnapshot } from "./db.js";
import { listWorkspaces } from "./workspaces.js";
import { generateSqlLearningLesson, generateSqlLearningTest } from "./ai.js";

export type SqlLearningStatus = "not_started" | "in_progress" | "completed";
export const sqlLearningChecklistKeys = [
  "theoryRead", "theoryUnderstood", "examplesBasic", "examplesIntermediate", "examplesAdvanced",
  "examplesDataEngineering", "examplesInterview", "practiceTest1", "practiceTest2", "practiceTest3",
  "practiceTest4", "practiceTest5", "moduleAssessment", "revisionCompleted", "mastered"
] as const;
export type SqlLearningChecklistKey = typeof sqlLearningChecklistKeys[number];
export type SqlLearningChecklist = Record<SqlLearningChecklistKey, boolean>;

export function isRetryableSqlLearningQueryError(error: unknown): boolean {
  const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
  return typeof code === "string" && /^(?:22|42)[0-9A-Z]{3}$/.test(code);
}

export function summarizeSqlLearningTopicTests(
  topicId: string,
  tests: { id?: string; test_number?: number; questionCount?: number; status?: string }[]
) {
  return Array.from({ length: 5 }, (_, index) => {
    const testNumber = index + 1;
    const saved = tests.find((test) => test.test_number === testNumber);
    const savedQuestionCount = saved?.questionCount;
    const questionCount = Number.isSafeInteger(savedQuestionCount) && (savedQuestionCount ?? 0) >= 0
      ? savedQuestionCount!
      : 0;
    return saved ? {
      id: saved.id || `${topicId}-test-${testNumber}`,
      testNumber,
      questionCount,
      status: saved.status || "not_generated"
    } : {
      id: `${topicId}-test-${testNumber}`,
      testNumber,
      questionCount: 0,
      status: "not_generated"
    };
  });
}

export async function generateValidatedSqlLearningQuestions<T extends { reference_sql: string }, TResult>(
  generate: (validationFeedback: string[]) => Promise<T[]>,
  validateBatch: (questions: T[]) => void,
  execute: (sql: string) => Promise<TResult>,
  label: string
): Promise<{ questions: T[]; expected: TResult[] }> {
  const validationFeedback: string[] = [];
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const questions = await generate(validationFeedback);
    try {
      validateBatch(questions);
    } catch (error) {
      if (!(error instanceof Error) || attempt === 3) throw error;
      validationFeedback.push(`The generated batch failed validation: ${error.message}. Return a complete corrected batch that meets every requested count, difficulty balance, field, and uniqueness requirement.`);
      console.warn(`[SQL Learning] A generated ${label} batch failed structural validation; regenerating the batch.`, {
        attempt,
        issue: error.message
      });
      continue;
    }
    const expected: TResult[] = [];
    let regenerate = false;
    for (const question of questions) {
      try {
        expected.push(await execute(question.reference_sql));
      } catch (error) {
        const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
        if (!isRetryableSqlLearningQueryError(error) || typeof code !== "string" || attempt === 3) throw error;
        const diagnostic = code === "22P02"
          ? "invalid input syntax for type numeric; query attempted to cast unvalidated text"
          : error instanceof Error ? error.message : String(error);
        validationFeedback.push(`SQL: ${question.reference_sql.slice(0, 4000)}. PostgreSQL error (${code}): ${diagnostic.slice(0, 1000)}`);
        console.warn(`[SQL Learning] A generated ${label} query failed PostgreSQL validation; regenerating the batch.`, {
          attempt,
          sqlState: code
        });
        regenerate = true;
        break;
      }
    }
    if (!regenerate) return { questions, expected };
  }
  throw new Error(`Generated ${label} queries could not be validated after retrying. Please generate again.`);
}

const emptyChecklist = (): SqlLearningChecklist => Object.fromEntries(
  sqlLearningChecklistKeys.map((key) => [key, false])
) as SqlLearningChecklist;

interface SqlLearningTopic {
  id: string;
  title: string;
  order: number;
  description?: string;
  difficulty?: "beginner" | "intermediate" | "advanced";
  archived?: boolean;
}

interface SqlLearningModule extends Document {
  _id: string;
  id: string;
  order: number;
  title: string;
  topics: SqlLearningTopic[];
  description?: string;
  difficulty?: "beginner" | "intermediate" | "advanced";
  archived?: boolean;
}

type CurriculumModule = {
  id: string;
  order: number;
  title: string;
  topics: SqlLearningTopic[];
  description?: string;
  difficulty?: "beginner" | "intermediate" | "advanced";
  archived?: boolean;
};

interface SqlLearningTopicProgress extends Document {
  user_id: string;
  topic_id: string;
  module_id: string;
  status: SqlLearningStatus;
  checklist?: Partial<SqlLearningChecklist>;
  first_studied_at?: Date;
  first_completed_at?: Date;
  last_studied_at?: Date;
  updated_at: Date;
}

interface PracticeWorkspace {
  id: string;
  name?: string;
  schema_name: string;
}

interface SqlLearningContent extends Document {
  user_id: string;
  topic_id: string;
  module_id: string;
  database_id: string;
  overview: string;
  theory: string;
  syntax: string;
  parameters: string[];
  returnType: string;
  rules: string[];
  commonMistakes: string[];
  useCases: string[];
  interviewRelevance: string;
  dialectNotes: string;
  generated_at: Date;
  examples: SqlLearningExample[];
}

interface SqlLearningExample {
  title: string;
  level: string;
  problem: string;
  sql: string;
  explanation: string;
  observations: string[];
  expected: { columns: string[]; rows: Record<string, unknown>[]; rowCount: number };
}

interface SqlLearningPracticeQuestion {
  id: string;
  title: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  context: string;
  task: string;
  required_output: string;
  reference_sql: string;
  hint: string;
  explanation: string;
  expected: { columns: string[]; rows: Record<string, unknown>[]; rowCount: number };
}

interface SqlLearningTest extends Document {
  _id: string;
  id: string;
  user_id: string;
  topic_id: string;
  module_id: string;
  test_number: number;
  assessment_kind?: "topic" | "module" | "interview";
  interview_started_at?: Date;
  database_id: string;
  questions: SqlLearningPracticeQuestion[];
  status: "ready";
  created_at: Date;
}

interface RevisionItem extends Document {
  user_id: string;
  topic_id: string;
  module_id: string;
  status: "pending" | "in_progress" | "completed";
  priority: "high" | "medium" | "low";
  reason: string;
  notes?: string;
  next_revision_at?: Date;
  created_at: Date;
  updated_at: Date;
}

function findCurriculumTopic(topicId: string, curriculum: CurriculumModule[] = sqlLearningModules.map((module) => ({
  ...module,
  topics: module.topics.map((topic) => ({ ...topic }))
}))) {
  for (const module of curriculum) {
    const topic = module.topics.find((item) => item.id === topicId);
    if (topic) return { module, topic };
  }
  return null;
}

async function getFirstPracticeWorkspace(userId: string): Promise<PracticeWorkspace | null> {
  const [workspace] = await listWorkspaces(userId, false);
  if (!workspace) return null;
  if (typeof workspace.id !== "string" || typeof workspace.schema_name !== "string") {
    throw new Error("SQL Lab workspace metadata is invalid.");
  }
  return {
    id: workspace.id,
    name: typeof workspace.name === "string" ? workspace.name : undefined,
    schema_name: workspace.schema_name
  };
}

async function getPracticeWorkspace(userId: string): Promise<PracticeWorkspace> {
  const workspace = await getFirstPracticeWorkspace(userId);
  if (!workspace) throw new Error("Create a SQL Lab workspace before generating or running SQL Learning content.");
  return workspace;
}

async function getPracticeSchema(workspace: { schema_name: string }) {
  return schemaSnapshot(workspace.schema_name);
}

export function sqlLearningResultsMatch(
  actual: { columns: string[]; rows: Record<string, unknown>[] },
  expected: { columns: string[]; rows: Record<string, unknown>[] }
) {
  if (actual.columns.length !== expected.columns.length) return false;
  const actualColumns = actual.columns.map((column) => column.toLowerCase());
  const expectedColumns = expected.columns.map((column) => column.toLowerCase());
  if (JSON.stringify(actualColumns) !== JSON.stringify(expectedColumns)) return false;

  const rowValues = (result: { columns: string[]; rows: Record<string, unknown>[] }) =>
    result.rows.map((row) => JSON.stringify(result.columns.map((column) => row[column] ?? null))).sort();
  return JSON.stringify(rowValues(actual)) === JSON.stringify(rowValues(expected));
}

export function summarizeSqlLearningTestAttempts(
  attempts: { question_id: string; correct: boolean }[],
  totalQuestions: number
) {
  const latestByQuestion = new Map<string, boolean>();
  for (const attempt of attempts) {
    if (!latestByQuestion.has(attempt.question_id)) latestByQuestion.set(attempt.question_id, attempt.correct);
  }
  const answeredQuestions = Math.min(latestByQuestion.size, totalQuestions);
  const correctAnswers = [...latestByQuestion.values()].filter(Boolean).length;
  return {
    totalQuestions,
    answeredQuestions,
    correctAnswers,
    incorrectAnswers: answeredQuestions - correctAnswers,
    skippedQuestions: totalQuestions - answeredQuestions,
    score: totalQuestions ? Math.round(correctAnswers / totalQuestions * 100) : 0,
    accuracy: answeredQuestions ? Math.round(correctAnswers / answeredQuestions * 100) : 0,
    completed: answeredQuestions >= totalQuestions
  };
}

export function hasSqlLearningTestDifficultyDistribution(
  questions: { difficulty: "beginner" | "intermediate" | "advanced" }[]
) {
  return hasSqlLearningDifficultyDistribution(questions, 15);
}

export function hasSqlLearningDifficultyDistribution(
  questions: { difficulty: "beginner" | "intermediate" | "advanced" }[],
  questionCount: 15 | 30
) {
  const counts = questions.reduce((result, question) => {
    result[question.difficulty] += 1;
    return result;
  }, { beginner: 0, intermediate: 0, advanced: 0 });
  return questions.length === questionCount && Object.values(counts).every((count) => count === questionCount / 3);
}

export function hideSqlLearningQuestionSolution(question: SqlLearningPracticeQuestion) {
  const { reference_sql: _referenceSql, expected: _expected, ...publicQuestion } = question;
  return publicQuestion;
}

export async function seedSqlLearningCurriculum(): Promise<void> {
  const modules = mongoCollection<SqlLearningModule>("sql_learning_modules");
  await modules.bulkWrite(sqlLearningModules.map((module) => ({
    updateOne: {
      filter: { _id: module.id },
      update: {
        $setOnInsert: {
          _id: module.id,
          id: module.id,
          order: module.order,
          title: module.title,
          topics: module.topics.map((topic) => ({ ...topic }))
        }
      },
      upsert: true
    }
  })), { ordered: true });
}

async function getUserCurriculum(userId: string, includeCustom = true): Promise<CurriculumModule[]> {
  if (!includeCustom) return sqlLearningModules.map((module) => ({ ...module, topics: module.topics.map((topic) => ({ ...topic })) }));
  const personal = await mongoCollection("sql_learning_custom_curricula").findOne({ _id: userId });
  const modules = personal && Array.isArray(personal.modules)
    ? personal.modules as CurriculumModule[]
    : sqlLearningModules.map((module) => ({ ...module, topics: module.topics.map((topic) => ({ ...topic })) }));
  return modules
    .map((module) => ({ ...module, topics: [...module.topics].sort((left, right) => left.order - right.order) }))
    .sort((left, right) => left.order - right.order);
}

function checklistSummary(checklist: Partial<SqlLearningChecklist> = {}) {
  const current = { ...emptyChecklist(), ...checklist };
  const theoryPercent = Math.round(([current.theoryRead, current.theoryUnderstood].filter(Boolean).length / 2) * 100);
  const examplesPercent = Math.round(([current.examplesBasic, current.examplesIntermediate, current.examplesAdvanced, current.examplesDataEngineering, current.examplesInterview].filter(Boolean).length / 5) * 100);
  const practicePercent = Math.round(([current.practiceTest1, current.practiceTest2, current.practiceTest3, current.practiceTest4, current.practiceTest5].filter(Boolean).length / 5) * 100);
  const done = sqlLearningChecklistKeys.filter((key) => current[key]).length;
  return { checklist: current, theoryPercent, examplesPercent, practicePercent, overallPercent: Math.round(done / sqlLearningChecklistKeys.length * 100) };
}

async function saveChecklist(userId: string, topicId: string, key: SqlLearningChecklistKey, checked: boolean) {
  const module = (await getUserCurriculum(userId)).find((candidate) => candidate.topics.some((topic) => topic.id === topicId));
  if (!module) return false;
  const now = new Date();
  const progress = mongoCollection<SqlLearningTopicProgress>("sql_learning_topic_progress");
  await progress.updateOne(
    { user_id: userId, topic_id: topicId },
    {
      $set: { [`checklist.${key}`]: checked, updated_at: now, ...(checked ? { last_studied_at: now } : {}) },
      $setOnInsert: { user_id: userId, topic_id: topicId, module_id: module.id, created_at: now, ...(checked ? { first_studied_at: now } : {}) }
    },
    { upsert: true }
  );
  const saved = await progress.findOne({ user_id: userId, topic_id: topicId });
  const summary = checklistSummary(saved?.checklist);
  const status: SqlLearningStatus = summary.overallPercent === 100 ? "completed" : summary.overallPercent > 0 ? "in_progress" : "not_started";
  await progress.updateOne(
    { user_id: userId, topic_id: topicId },
    {
      $set: {
        status,
        ...(status === "completed" && !saved?.first_completed_at ? { first_completed_at: now } : {}),
        ...(status !== "not_started" ? { last_studied_at: now } : {})
      }
    }
  );
  return true;
}

export async function getSqlLearningDashboard(userId: string, useCustom = false) {
  const [progress, workspaces, modules] = await Promise.all([
    mongoCollection<SqlLearningTopicProgress>("sql_learning_topic_progress").find({ user_id: userId }).toArray(),
    listWorkspaces(userId, false),
    getUserCurriculum(userId, useCustom)
  ]);
  const progressByTopic = new Map(progress.map((item) => [item.topic_id, item.status]));
  const dashboardModules = modules.map((module) => {
    const completedTopics = module.topics.filter((topic) => progressByTopic.get(topic.id) === "completed").length;
    const inProgressTopics = module.topics.filter((topic) => progressByTopic.get(topic.id) === "in_progress").length;
    const topicCount = module.topics.length;
    return {
      id: module.id,
      order: module.order,
      title: module.title,
      archived: module.archived || false,
      topicCount,
      completedTopics,
      inProgressTopics,
      remainingTopics: topicCount - completedTopics,
      completionPercent: topicCount ? Math.round(completedTopics / topicCount * 100) : 0
    };
  });
  const totalTopics = dashboardModules.reduce((count, module) => count + module.topicCount, 0);
  const completedTopics = dashboardModules.reduce((count, module) => count + module.completedTopics, 0);
  const inProgressTopics = dashboardModules.reduce((count, module) => count + module.inProgressTopics, 0);

  return {
    totalModules: dashboardModules.length,
    totalTopics,
    completedTopics,
    inProgressTopics,
    remainingTopics: totalTopics - completedTopics,
    completionPercent: totalTopics ? Math.round(completedTopics / totalTopics * 100) : 0,
    practiceDatabaseId: workspaces[0]?.id || null,
    modules: dashboardModules
  };
}

export async function getSqlLearningModule(userId: string, moduleId: string, useCustom = false) {
  const module = (await getUserCurriculum(userId, useCustom)).find((item) => item.id === moduleId);
  if (!module) return null;

  const topicIds = module.topics.map((topic) => topic.id);
  const [progress, revisions, notes] = await Promise.all([
    mongoCollection<SqlLearningTopicProgress>("sql_learning_topic_progress").find({ user_id: userId, topic_id: { $in: topicIds } }).toArray(),
    mongoCollection<RevisionItem>("sql_learning_revision_items").find({ user_id: userId, topic_id: { $in: topicIds } }).toArray(),
    mongoCollection("sql_learning_topic_notes").find({ user_id: userId, topic_id: { $in: topicIds } }, { projection: { topic_id: 1, bookmarked: 1 } }).toArray()
  ]);
  const progressByTopic = new Map(progress.map((item) => [item.topic_id, item]));
  const revisionByTopic = new Map(revisions.map((item) => [item.topic_id, item]));
  const bookmarks = new Set(notes.filter((item) => item.bookmarked).map((item) => item.topic_id));

  return {
    id: module.id,
    order: module.order,
    title: module.title,
    description: module.description || "",
    difficulty: module.difficulty || "beginner",
    archived: module.archived || false,
    topics: module.topics.map((topic) => {
      const saved = progressByTopic.get(topic.id);
      return {
        ...topic,
        revisionStatus: revisionByTopic.get(topic.id)?.status || null,
        bookmarked: bookmarks.has(topic.id),
        progress: {
          status: saved?.status || "not_started",
          checklist: checklistSummary(saved?.checklist).checklist,
          completionPercent: checklistSummary(saved?.checklist).overallPercent,
          firstStudiedAt: saved?.first_studied_at || null,
          firstCompletedAt: saved?.first_completed_at || null,
          lastStudiedAt: saved?.last_studied_at || null
        }
      };
    })
  };
}

export async function setSqlLearningTopicStatus(
  userId: string,
  topicId: string,
  status: SqlLearningStatus
): Promise<boolean> {
  const module = (await getUserCurriculum(userId)).find((candidate) => candidate.topics.some((topic) => topic.id === topicId));
  if (!module) return false;

  const progress = mongoCollection<SqlLearningTopicProgress>("sql_learning_topic_progress");
  const existing = await progress.findOne({ user_id: userId, topic_id: topicId });
  const now = new Date();
  const fields: Partial<SqlLearningTopicProgress> = { status, updated_at: now };
  if (status !== "not_started") {
    fields.last_studied_at = now;
    if (!existing?.first_studied_at) fields.first_studied_at = now;
  }
  if (status === "completed" && !existing?.first_completed_at) fields.first_completed_at = now;

  await progress.updateOne(
    { user_id: userId, topic_id: topicId },
    {
      $set: fields,
      $setOnInsert: {
        user_id: userId,
        topic_id: topicId,
        module_id: module.id,
        created_at: now,
        ...(status !== "not_started" ? { first_studied_at: now } : {})
      }
    },
    { upsert: true }
  );
  return true;
}

export async function setSqlLearningChecklistItem(userId: string, topicId: string, key: SqlLearningChecklistKey, checked: boolean) {
  return saveChecklist(userId, topicId, key, checked);
}

export async function getSqlLearningTopic(userId: string, topicId: string, useCustom = false) {
  const found = findCurriculumTopic(topicId, await getUserCurriculum(userId, useCustom));
  if (!found) return null;
  const workspace = await getFirstPracticeWorkspace(userId);
  const [content, tests, progress, revision, note, contentOverride] = await Promise.all([
    workspace
      ? mongoCollection<SqlLearningContent>("sql_learning_topic_content").findOne({ user_id: userId, topic_id: topicId, database_id: workspace.id })
      : Promise.resolve(null),
    workspace
      ? mongoCollection<SqlLearningTest>("sql_learning_tests").aggregate<{
          id?: string;
          test_number?: number;
          questionCount: number;
          status?: string;
        }>([
          { $match: { user_id: userId, topic_id: topicId, database_id: workspace.id } },
          { $project: { id: 1, test_number: 1, status: 1, questionCount: { $size: { $ifNull: ["$questions", []] } } } },
          { $sort: { test_number: 1 } }
        ]).toArray()
      : Promise.resolve([]),
    mongoCollection<SqlLearningTopicProgress>("sql_learning_topic_progress").findOne({ user_id: userId, topic_id: topicId }),
    mongoCollection<RevisionItem>("sql_learning_revision_items").findOne({ user_id: userId, topic_id: topicId }),
    mongoCollection("sql_learning_topic_notes").findOne({ user_id: userId, topic_id: topicId }, { projection: { _id: 0, note: 1, bookmarked: 1 } }),
    workspace
      ? mongoCollection("sql_learning_user_content_overrides").findOne({ user_id: userId, topic_id: topicId, database_id: workspace.id }, { projection: { _id: 0, theory: 1, syntax: 1, examples: 1 } })
      : Promise.resolve(null)
  ]);
  const schema = workspace ? await getPracticeSchema(workspace) : null;
  const tables = workspace ? await listTables(workspace.schema_name) : [];
  const samples = workspace ? await Promise.all(tables.map(async (table) => ({
    name: table.name,
    schemaColumns: table.columns,
    preview: await executeReadOnly(workspace.schema_name, `SELECT * FROM ${quoteIdent(table.name)} LIMIT 5`)
  }))) : [];
  return {
    module: { id: found.module.id, title: found.module.title, order: found.module.order },
    topic: found.topic,
    progress: {
      ...checklistSummary(progress?.checklist),
      status: progress?.status || "not_started",
      firstStudiedAt: progress?.first_studied_at || null,
      firstCompletedAt: progress?.first_completed_at || null,
      lastStudiedAt: progress?.last_studied_at || null
    },
    revision: revision ? {
      status: revision.status,
      priority: revision.priority,
      reason: revision.reason,
      notes: revision.notes || "",
      nextRevisionAt: revision.next_revision_at || null,
      revisionCount: await mongoCollection("sql_learning_revision_sessions").countDocuments({ user_id: userId, topic_id: topicId, status: "completed" })
    } : null,
    personalNote: note?.note || "",
    bookmarked: Boolean(note?.bookmarked),
    practiceDatabaseId: workspace?.id || null,
    practiceDatabaseName: workspace?.name || workspace?.schema_name || null,
    schema,
    samples,
    content: content ? {
      overview: content.overview,
      theory: contentOverride?.theory || content.theory,
      syntax: contentOverride?.syntax || content.syntax,
      parameters: content.parameters,
      returnType: content.returnType,
      rules: content.rules,
      commonMistakes: content.commonMistakes,
      useCases: content.useCases,
      interviewRelevance: content.interviewRelevance,
      dialectNotes: content.dialectNotes,
      examples: contentOverride?.examples || content.examples,
      generatedAt: content.generated_at
    } : null,
    tests: summarizeSqlLearningTopicTests(topicId, tests)
  };
}

export async function generateSqlLearningTopicContent(userId: string, topicId: string, useCustom = false) {
  const found = findCurriculumTopic(topicId, await getUserCurriculum(userId, useCustom));
  if (!found) return { status: "not_found" as const };
  const workspace = await getPracticeWorkspace(userId);
  const contentCollection = mongoCollection<SqlLearningContent>("sql_learning_topic_content");
  const existing = await contentCollection.findOne({ user_id: userId, topic_id: topicId, database_id: String(workspace.id) });
  if (existing) return { status: "ok" as const, content: existing };

  const schema = await getPracticeSchema(workspace);
  const validationFeedback: string[] = [];
  let generated: Awaited<ReturnType<typeof generateSqlLearningLesson>> | undefined;
  let examples: SqlLearningExample[] = [];
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    generated = await generateSqlLearningLesson({
      topic: found.topic.title,
      module: found.module.title,
      schema: JSON.stringify(schema),
      validationFeedback
    });
    const requiredText = [generated.overview, generated.theory, generated.syntax, generated.returnType, generated.interviewRelevance, generated.dialectNotes];
    if (requiredText.some((value) => typeof value !== "string" || value.trim().length < 20) ||
        generated.theory.trim().split(/\s+/).length < 200 ||
        generated.rules.filter((rule) => rule.trim()).length < 3 ||
        generated.commonMistakes.filter((mistake) => mistake.trim()).length < 3 ||
        generated.useCases.filter((useCase) => useCase.trim()).length < 3) {
      throw new Error("The generated lesson is incomplete. Retry to generate detailed theory, rules, mistakes, and use cases.");
    }
    if (generated.examples.length !== 5) throw new Error("The generated lesson must contain five examples.");
    const levels = new Set<string>(generated.examples.map((example) => example.level));
    if (["basic", "intermediate", "advanced", "data_engineering", "interview"].some((level) => !levels.has(level))) {
      throw new Error("The generated lesson is missing a required example level.");
    }

    examples = [];
    const exampleSignatures = new Set<string>();
    let retryGeneration = false;
    for (const example of generated.examples) {
      const signature = example.sql.toLowerCase().replace(/\s+/g, " ").trim();
      if ([example.title, example.problem, example.explanation].some((value) => !value?.trim()) || example.observations.filter((item) => item.trim()).length < 2) {
        throw new Error("The generated lesson has an incomplete worked example.");
      }
      if (exampleSignatures.has(signature)) throw new Error("The generated lesson contains duplicate SQL examples.");
      exampleSignatures.add(signature);
      if (!example.sql.trim() || example.sql.length > 100_000) throw new Error(`Example "${example.title}" has invalid SQL.`);
      try {
        const expected = await executeReadOnly(workspace.schema_name, example.sql);
        examples.push({ ...example, expected });
      } catch (error) {
        const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
        if (!isRetryableSqlLearningQueryError(error) || typeof code !== "string" || attempt === 3) throw error;
        const diagnostic = error instanceof Error ? error.message : String(error);
        validationFeedback.push(`Example "${example.title}" (${example.level}) failed. SQL: ${example.sql.slice(0, 4000)}. PostgreSQL error: ${diagnostic.slice(0, 1000)}`);
        console.warn("[SQL Learning] A generated example failed PostgreSQL validation; regenerating the lesson.", {
          topicId,
          attempt,
          sqlState: code
        });
        retryGeneration = true;
        break;
      }
    }
    if (!retryGeneration) break;
  }
  if (!generated || examples.length !== 5) {
    throw new Error("The generated lesson could not be validated after retrying. Please generate it again.");
  }

  const now = new Date();
  const document = {
    _id: `${userId}:${topicId}:${workspace.id}`,
    user_id: userId,
    topic_id: topicId,
    module_id: found.module.id,
    database_id: String(workspace.id),
    ...generated,
    examples,
    status: "ready",
    generated_at: now,
    updated_at: now
  };
  await contentCollection.updateOne(
    { user_id: userId, topic_id: topicId, database_id: String(workspace.id) },
    { $setOnInsert: document },
    { upsert: true }
  );
  return { status: "ok" as const, content: await contentCollection.findOne({ user_id: userId, topic_id: topicId, database_id: String(workspace.id) }) };
}

export async function generateSqlLearningPracticeTest(userId: string, topicId: string, testNumber: number, useCustom = false) {
  const found = findCurriculumTopic(topicId, await getUserCurriculum(userId, useCustom));
  if (!found) return { status: "not_found" as const };
  const workspace = await getPracticeWorkspace(userId);
  const tests = mongoCollection<SqlLearningTest>("sql_learning_tests");
  const testId = `${userId}:${topicId}:${testNumber}:${workspace.id}`;
  const existing = await tests.findOne({ _id: testId, database_id: String(workspace.id) });
  if (existing) return { status: "ok" as const, test: existing };

  const schema = await getPracticeSchema(workspace);
  const validated = await generateValidatedSqlLearningQuestions(
    async (validationFeedback) => (await generateSqlLearningTest({
      topic: found.topic.title,
      module: found.module.title,
      schema: JSON.stringify(schema),
      testNumber,
      validationFeedback
    })).questions,
    (questions) => {
      if (questions.length !== 15) throw new Error("The test generator must return exactly 15 questions.");
      if (!hasSqlLearningTestDifficultyDistribution(questions)) {
        throw new Error("The generated test must contain five beginner, five intermediate, and five advanced questions.");
      }
      const seen = new Set<string>();
      for (const question of questions) {
        const signature = question.reference_sql.toLowerCase().replace(/\s+/g, " ").trim();
        const titleSignature = question.title.toLowerCase().replace(/\s+/g, " ").trim();
        if (question.title.trim().length < 8 || question.context.trim().length < 30 ||
            question.task.trim().length < 20 || question.required_output.trim().length < 10 ||
            question.hint.trim().length < 10 || question.explanation.trim().length < 30) {
          throw new Error("The generated test contains an incomplete question.");
        }
        if (!signature || seen.has(signature) || seen.has(`title:${titleSignature}`)) {
          throw new Error("The generated test contains missing or duplicate questions.");
        }
        seen.add(signature);
        seen.add(`title:${titleSignature}`);
      }
    },
    (sql) => executeReadOnly(workspace.schema_name, sql),
    "practice-test"
  );
  const questions: SqlLearningPracticeQuestion[] = validated.questions.map((question, index) => ({
    ...question,
    id: `${topicId}-test-${testNumber}-question-${index + 1}`,
    expected: validated.expected[index]
  }));

  const document: SqlLearningTest = {
    _id: testId,
    id: testId,
    user_id: userId,
    topic_id: topicId,
    module_id: found.module.id,
    test_number: testNumber,
    database_id: String(workspace.id),
    questions,
    status: "ready",
    created_at: new Date()
  };
  await tests.updateOne(
    { _id: testId, database_id: String(workspace.id) },
    { $setOnInsert: document },
    { upsert: true }
  );
  return { status: "ok" as const, test: await tests.findOne({ _id: testId, database_id: String(workspace.id) }) };
}

async function generateSqlLearningAssessment(userId: string, moduleId: string, useCustom: boolean, assessmentKind: "module" | "interview") {
  const module = (await getUserCurriculum(userId, useCustom)).find((candidate) => candidate.id === moduleId);
  if (!module) return { status: "not_found" as const };
  const workspace = await getPracticeWorkspace(userId);
  const tests = mongoCollection<SqlLearningTest>("sql_learning_tests");
  const topicId = assessmentKind === "module" ? `module-assessment:${moduleId}` : `sql-mock-interview:${moduleId}`;
  const testId = `${userId}:${topicId}:${assessmentKind}:${workspace.id}`;
  const existing = await tests.findOne({ _id: testId, user_id: userId, database_id: workspace.id });
  if (existing && assessmentKind === "module") return { status: "ok" as const, test: existing };
  if (existing && assessmentKind === "interview") {
    const answered = await mongoCollection("sql_learning_test_attempts").aggregate<{ _id: string }>([
      { $match: { user_id: userId, test_id: testId } },
      { $group: { _id: "$question_id" } }
    ]).toArray();
    const expired = existing.interview_started_at &&
      Date.now() >= existing.interview_started_at.getTime() + 45 * 60_000;
    if (!expired && answered.length < existing.questions.length) return { status: "ok" as const, test: existing };
    const newTestId = `${testId}:${crypto.randomUUID()}`;
    const { interview_started_at: _startedAt, ...reusableTest } = existing;
    const retake: SqlLearningTest = {
      ...reusableTest,
      _id: newTestId,
      id: newTestId,
      questions: existing.questions.map((question, index) => ({
        ...question,
        id: `${topicId}-interview-${crypto.randomUUID()}-${index + 1}`
      })),
      created_at: new Date()
    };
    await tests.insertOne(retake);
    return { status: "ok" as const, test: retake };
  }
  const schema = await getPracticeSchema(workspace);
  const validated = await generateValidatedSqlLearningQuestions(
    async (validationFeedback) => (await generateSqlLearningTest({
      topic: assessmentKind === "module"
        ? module.topics.map((topic) => topic.title).join(", ")
        : `SQL mock interview across the concepts: ${module.topics.map((topic) => topic.title).join(", ")}`,
      module: assessmentKind === "module" ? module.title : `Full SQL Mock Interview — ${module.title}`,
      schema: JSON.stringify(schema),
      testNumber: 1,
      questionCount: 30,
      validationFeedback
    })).questions,
    (questions) => {
      if (!hasSqlLearningDifficultyDistribution(questions, 30)) {
        throw new Error("The generated module assessment must contain 30 questions: ten at each difficulty.");
      }
      const seen = new Set<string>();
      for (const question of questions) {
        const signature = question.reference_sql.toLowerCase().replace(/\s+/g, " ").trim();
        const titleSignature = question.title.toLowerCase().replace(/\s+/g, " ").trim();
        if ([question.title, question.context, question.task, question.required_output, question.hint, question.explanation].some((value) => !value?.trim()) ||
            !signature || seen.has(signature) || seen.has(`title:${titleSignature}`)) {
          throw new Error("The generated module assessment contains incomplete or duplicate questions.");
        }
        seen.add(signature);
        seen.add(`title:${titleSignature}`);
      }
    },
    (sql) => executeReadOnly(workspace.schema_name, sql),
    assessmentKind === "module" ? "module-assessment" : "mock-interview"
  );
  const questions: SqlLearningPracticeQuestion[] = validated.questions.map((question, index) => ({
    ...question,
    id: `${moduleId}-${assessmentKind}-question-${index + 1}`,
    expected: validated.expected[index]
  }));
  for (let index = questions.length - 1; index > 0; index -= 1) {
    const swapIndex = crypto.randomInt(index + 1);
    [questions[index], questions[swapIndex]] = [questions[swapIndex], questions[index]];
  }
  const document: SqlLearningTest = {
    _id: testId,
    id: testId,
    user_id: userId,
    topic_id: topicId,
    module_id: module.id,
    test_number: 1,
    assessment_kind: assessmentKind,
    database_id: workspace.id,
    questions,
    status: "ready",
    created_at: new Date()
  };
  await tests.updateOne(
    { _id: testId, database_id: workspace.id },
    { $setOnInsert: document },
    { upsert: true }
  );
  return { status: "ok" as const, test: await tests.findOne({ _id: testId, database_id: workspace.id }) };
}

export async function generateSqlLearningModuleAssessment(userId: string, moduleId: string, useCustom = false) {
  return generateSqlLearningAssessment(userId, moduleId, useCustom, "module");
}

export async function generateSqlLearningMockInterview(userId: string, moduleId: string, useCustom = false) {
  return generateSqlLearningAssessment(userId, moduleId, useCustom, "interview");
}

export async function getSqlLearningPracticeTest(userId: string, testId: string) {
  const test = await mongoCollection<SqlLearningTest>("sql_learning_tests").findOne({ _id: testId, user_id: userId });
  if (!test) return null;
  const attemptsCollection = mongoCollection("sql_learning_test_attempts");
  const [attempts, latestAttempts] = await Promise.all([
    attemptsCollection.find({ user_id: userId, test_id: testId })
    .sort({ created_at: -1 })
    .limit(100)
    .toArray(),
    attemptsCollection.aggregate<{ _id: string; correct: boolean }>([
      { $match: { user_id: userId, test_id: testId } },
      { $sort: { created_at: -1 } },
      { $group: { _id: "$question_id", correct: { $first: "$correct" } } }
    ]).toArray()
  ]);
  const result = summarizeSqlLearningTestAttempts(
    latestAttempts.map((attempt) => ({ question_id: attempt._id, correct: attempt.correct })),
    test.questions.length
  );
  return {
    id: test.id,
    topicId: test.topic_id,
    moduleId: test.module_id,
    assessmentKind: test.assessment_kind || "topic",
    startedAt: test.interview_started_at || null,
    testNumber: test.test_number,
    status: test.status,
    result,
    questionResults: latestAttempts.map((attempt) => ({ questionId: attempt._id, correct: attempt.correct })),
    questions: test.questions.map(hideSqlLearningQuestionSolution),
    attempts: attempts.map(({ _id: _id, ...attempt }) => attempt)
  };
}

async function updateChecklistAfterCompletedTest(userId: string, test: SqlLearningTest) {
  const attempts = await mongoCollection("sql_learning_test_attempts").aggregate<{ _id: string }>([
    { $match: { user_id: userId, test_id: test.id } },
    { $group: { _id: "$question_id" } }
  ]).toArray();
  if (attempts.length < test.questions.length) return;
  if (test.assessment_kind === "module") {
    const module = (await getUserCurriculum(userId)).find((candidate) => candidate.id === test.module_id);
    if (module) await Promise.all(module.topics.map((topic) => saveChecklist(userId, topic.id, "moduleAssessment", true)));
    return;
  }
  if (test.test_number >= 1 && test.test_number <= 5 && findCurriculumTopic(test.topic_id, await getUserCurriculum(userId))) {
    await saveChecklist(userId, test.topic_id, `practiceTest${test.test_number}` as SqlLearningChecklistKey, true);
  }
}

export async function submitSqlLearningPracticeAnswer(userId: string, testId: string, questionId: string, sql: string) {
  const test = await mongoCollection<SqlLearningTest>("sql_learning_tests").findOne({ _id: testId, user_id: userId, status: "ready" });
  if (!test) return { status: "not_found" as const };
  if (test.assessment_kind === "interview" &&
      (!test.interview_started_at || Date.now() >= test.interview_started_at.getTime() + 45 * 60_000)) {
    throw new Error(test.interview_started_at ? "The SQL mock interview time limit has expired." : "Start the SQL mock interview timer before submitting answers.");
  }
  const question = test.questions.find((item) => item.id === questionId);
  if (!question) return { status: "not_found" as const };
  const workspace = await getWorkspaceByOwnedId(userId, test.database_id);
  if (!workspace) return { status: "not_found" as const };

  const started = Date.now();
  try {
    const result = await executeReadOnly(workspace.schema_name, sql);
    const correct = sqlLearningResultsMatch(result, question.expected);
    const attempt = {
      _id: crypto.randomUUID(),
      user_id: userId,
      test_id: testId,
      topic_id: test.topic_id,
      question_id: questionId,
      sql,
      correct,
      execution_ms: result.executionMs || Date.now() - started,
      actual: result,
      created_at: new Date()
    };
    await mongoCollection("sql_learning_test_attempts").insertOne(attempt);
    await updateChecklistAfterCompletedTest(userId, test);
    return {
      status: "ok" as const,
      correct,
      result,
      explanation: correct ? question.explanation : undefined,
      attemptId: attempt._id
    };
  } catch (error) {
    const attempt = {
      _id: crypto.randomUUID(),
      user_id: userId,
      test_id: testId,
      topic_id: test.topic_id,
      question_id: questionId,
      sql,
      correct: false,
      error: error instanceof Error ? error.message : "SQL query failed.",
      execution_ms: Date.now() - started,
      created_at: new Date()
    };
    await mongoCollection("sql_learning_test_attempts").insertOne(attempt);
    await updateChecklistAfterCompletedTest(userId, test);
    throw error;
  }
}

export async function startSqlLearningMockInterview(userId: string, testId: string) {
  const tests = mongoCollection<SqlLearningTest>("sql_learning_tests");
  const test = await tests.findOne({ _id: testId, user_id: userId, status: "ready", assessment_kind: "interview" });
  if (!test) return null;
  const startedAt = test.interview_started_at || new Date();
  if (!test.interview_started_at) {
    await tests.updateOne(
      { _id: testId, user_id: userId, assessment_kind: "interview", interview_started_at: { $exists: false } },
      { $set: { interview_started_at: startedAt } }
    );
  }
  const saved = await tests.findOne({ _id: testId, user_id: userId, assessment_kind: "interview" });
  if (!saved?.interview_started_at) throw new Error("SQL mock interview start time could not be saved.");
  return { startedAt: saved.interview_started_at, expiresAt: new Date(saved.interview_started_at.getTime() + 45 * 60_000) };
}

export async function getSqlLearningPracticeSolution(userId: string, testId: string, questionId: string) {
  const test = await mongoCollection<SqlLearningTest>("sql_learning_tests").findOne({ _id: testId, user_id: userId, status: "ready" });
  const question = test?.questions.find((item) => item.id === questionId);
  if (!question) return null;
  return { referenceSql: question.reference_sql, expected: question.expected, explanation: question.explanation };
}

export async function editSqlLearningCustomTestQuestion(userId: string, testId: string, questionId: string, input: {
  title: string; difficulty: "beginner" | "intermediate" | "advanced"; context: string; task: string; required_output: string; reference_sql: string; hint: string; explanation: string;
}) {
  const tests = mongoCollection<SqlLearningTest>("sql_learning_tests");
  const test = await tests.findOne({ _id: testId, user_id: userId, status: "ready" });
  if (!test) return null;
  const question = test.questions.find((item) => item.id === questionId);
  if (!question) return null;
  if ([input.title, input.context, input.task, input.required_output, input.reference_sql, input.hint, input.explanation].some((value) => !value.trim())) {
    throw new Error("Complete every question field before saving.");
  }
  const workspace = await getWorkspaceByOwnedId(userId, test.database_id);
  if (!workspace) return null;
  const expected = await executeReadOnly(workspace.schema_name, input.reference_sql);
  const updatedQuestion = { ...question, ...input, expected };
  await tests.updateOne(
    { _id: testId, user_id: userId, "questions.id": questionId },
    { $set: { "questions.$": updatedQuestion, updated_at: new Date() } }
  );
  return { id: questionId, expected };
}

export async function runSqlLearningQuery(userId: string, databaseId: string, sql: string) {
  const workspace = await getWorkspaceByOwnedId(userId, databaseId);
  if (!workspace) return { status: "not_found" as const };
  return { status: "ok" as const, result: await executeReadOnly(String(workspace.schema_name), sql) };
}

async function getWorkspaceByOwnedId(userId: string, workspaceId: string): Promise<PracticeWorkspace | null> {
  const workspace = await mongoCollection("app_databases").findOne({
    $or: [{ _id: workspaceId }, { id: workspaceId }],
    owner_user_id: userId
  });
  if (!workspace) return null;
  if (typeof workspace.id !== "string" || typeof workspace.schema_name !== "string") {
    throw new Error("SQL Lab workspace metadata is invalid.");
  }
  return {
    id: workspace.id,
    name: typeof workspace.name === "string" ? workspace.name : undefined,
    schema_name: workspace.schema_name
  };
}

const revisionReasons = ["theory_not_clear", "forgot_concept", "low_test_score", "coding_mistakes", "interview_preparation", "manual_request"] as const;
const revisionPriorities = ["high", "medium", "low"] as const;

export async function markSqlLearningTopicForRevision(
  userId: string,
  topicId: string,
  priority: typeof revisionPriorities[number],
  reason: typeof revisionReasons[number],
  notes = ""
) {
  const found = findCurriculumTopic(topicId, await getUserCurriculum(userId));
  if (!found) return null;
  const now = new Date();
  await mongoCollection<RevisionItem>("sql_learning_revision_items").updateOne(
    { user_id: userId, topic_id: topicId },
    {
      $set: { module_id: found.module.id, priority, reason, notes, status: "pending", updated_at: now },
      $setOnInsert: { user_id: userId, topic_id: topicId, created_at: now }
    },
    { upsert: true }
  );
  await mongoCollection<SqlLearningTopicProgress>("sql_learning_topic_progress").updateOne(
    { user_id: userId, topic_id: topicId },
    {
      $set: { status: "in_progress", last_studied_at: now, updated_at: now },
      $setOnInsert: { user_id: userId, topic_id: topicId, module_id: found.module.id, created_at: now, first_studied_at: now }
    },
    { upsert: true }
  );
  return { topicId, priority, reason, status: "pending" as const };
}

export async function startSqlLearningRevision(userId: string, topicId: string) {
  const item = await mongoCollection<RevisionItem>("sql_learning_revision_items").findOne({ user_id: userId, topic_id: topicId });
  if (!item) return null;
  const now = new Date();
  const sessionId = crypto.randomUUID();
  const practiceTests = await mongoCollection<SqlLearningTest>("sql_learning_tests")
    .find({ user_id: userId, topic_id: topicId, assessment_kind: { $ne: "module" }, status: "ready" })
    .toArray();
  let scoreBefore: number | null = null;
  for (const test of practiceTests) {
    const answers = await mongoCollection("sql_learning_test_attempts").aggregate<{ _id: string; correct: boolean }>([
      { $match: { user_id: userId, test_id: test.id } },
      { $sort: { created_at: -1 } },
      { $group: { _id: "$question_id", correct: { $first: "$correct" } } }
    ]).toArray();
    const summary = summarizeSqlLearningTestAttempts(
      answers.map((answer) => ({ question_id: answer._id, correct: answer.correct })),
      test.questions.length
    );
    if (summary.answeredQuestions && (scoreBefore === null || summary.score > scoreBefore)) scoreBefore = summary.score;
  }
  await mongoCollection("sql_learning_revision_sessions").insertOne({
    _id: sessionId,
    id: sessionId,
    user_id: userId,
    topic_id: topicId,
    module_id: item.module_id,
    status: "in_progress",
    score_before: scoreBefore,
    started_at: now,
    created_at: now
  });
  await mongoCollection<RevisionItem>("sql_learning_revision_items").updateOne(
    { user_id: userId, topic_id: topicId },
    { $set: { status: "in_progress", updated_at: now } }
  );
  return { sessionId, topicId, startedAt: now };
}

export async function completeSqlLearningRevision(userId: string, sessionId: string, testId: string, notes = "") {
  const sessions = mongoCollection("sql_learning_revision_sessions");
  const session = await sessions.findOne({ _id: sessionId, user_id: userId, status: "in_progress" });
  if (!session) return { status: "not_found" as const };
  const test = await getSqlLearningPracticeTest(userId, testId);
  if (!test || test.topicId !== session.topic_id || !test.result.completed) {
    throw new Error("Complete every question in a practice test for this topic before finishing the revision.");
  }
  const revisionItems = mongoCollection<RevisionItem>("sql_learning_revision_items");
  const item = await revisionItems.findOne({ user_id: userId, topic_id: String(session.topic_id) });
  const previousScore = typeof session.score_before === "number"
    ? session.score_before
    : typeof item?.last_score === "number" ? item.last_score : null;
  const now = new Date();
  const completedSessions = await mongoCollection("sql_learning_revision_sessions")
    .countDocuments({ user_id: userId, topic_id: session.topic_id, status: "completed" });
  const intervals = await mongoCollection("sql_learning_revision_settings").findOne({ _id: userId });
  const configuredDays = Array.isArray(intervals?.intervals) ? intervals.intervals as number[] : [1, 3, 7, 14, 30];
  const delayDays = configuredDays[Math.min(completedSessions, configuredDays.length - 1)] || 30;
  const nextRevisionAt = new Date(now.getTime() + delayDays * 86400_000);
  const improvement = previousScore === null ? null : test.result.score - previousScore;
  await sessions.updateOne(
    { _id: sessionId, user_id: userId, status: "in_progress" },
    { $set: { status: "completed", completed_at: now, duration_seconds: Math.max(0, Math.round((now.getTime() - new Date(session.started_at).getTime()) / 1000)), score_before: previousScore, score_after: test.result.score, accuracy_improvement: improvement, notes } }
  );
  await revisionItems.updateOne(
    { user_id: userId, topic_id: String(session.topic_id) },
    { $set: { status: "completed", last_score: test.result.score, next_revision_at: nextRevisionAt, updated_at: now } }
  );
  await saveChecklist(userId, String(session.topic_id), "revisionCompleted", true);
  return {
    status: "ok" as const,
    sessionId,
    revisionNumber: completedSessions + 1,
    scoreBefore: previousScore,
    scoreAfter: test.result.score,
    accuracyImprovement: improvement,
    nextRevisionAt
  };
}

export async function getSqlLearningRevisionCenter(userId: string) {
  const [items, sessions, curriculum, settings, completedSessionCount, sessionCounts] = await Promise.all([
    mongoCollection<RevisionItem>("sql_learning_revision_items").find({ user_id: userId }).sort({ priority: 1, updated_at: -1 }).toArray(),
    mongoCollection("sql_learning_revision_sessions").find({ user_id: userId, status: "completed" }).sort({ completed_at: -1 }).limit(50).toArray(),
    getUserCurriculum(userId),
    mongoCollection("sql_learning_revision_settings").findOne({ _id: userId }),
    mongoCollection("sql_learning_revision_sessions").countDocuments({ user_id: userId, status: "completed" }),
    mongoCollection("sql_learning_revision_sessions").aggregate<{ _id: string; count: number }>([
      { $match: { user_id: userId, status: "completed" } },
      { $group: { _id: "$topic_id", count: { $sum: 1 } } }
    ]).toArray()
  ]);
  const topics = new Map(curriculum.flatMap((module) => module.topics.map((topic) => [topic.id, { topic, module }] as const)));
  const countsByTopic = new Map(sessionCounts.map((entry) => [entry._id, entry.count]));
  const revisions = items.flatMap((item) => {
    const found = topics.get(item.topic_id);
    if (!found) return [];
    return [{
      topicId: item.topic_id,
      topicTitle: found.topic.title,
      moduleId: item.module_id,
      moduleTitle: found.module.title,
      status: item.status,
      priority: item.priority,
      reason: item.reason,
      notes: item.notes || "",
      revisionCount: countsByTopic.get(item.topic_id) || 0,
      nextRevisionAt: item.next_revision_at || null,
      lastScore: item.last_score ?? null,
      updatedAt: item.updated_at
    }];
  });
  const scoreImprovements = sessions
    .map((session) => session.accuracy_improvement)
    .filter((value): value is number => typeof value === "number");
  const recommendations = revisions
    .filter((item) => item.status !== "completed")
    .map((item) => {
      const due = item.nextRevisionAt ? new Date(item.nextRevisionAt).getTime() <= Date.now() : false;
      const score = item.lastScore;
      const reason = due
        ? "Scheduled revision is due."
        : score !== null && score < 60
          ? "Recent practice score is below 60%."
          : score === null
            ? "Complete a practice test to establish a baseline."
            : item.priority === "high"
              ? "Marked high priority for review."
              : "Continue the spaced-revision schedule.";
      const rank = (due ? 30 : 0) + (score !== null && score < 60 ? 20 : 0) + (item.priority === "high" ? 10 : 0);
      return { topicId: item.topicId, topicTitle: item.topicTitle, moduleTitle: item.moduleTitle, reason, priority: item.priority, lastScore: score, nextRevisionAt: item.nextRevisionAt, rank };
    })
    .sort((a, b) => b.rank - a.rank || (a.lastScore ?? -1) - (b.lastScore ?? -1))
    .slice(0, 5)
    .map(({ rank: _rank, ...item }) => item);
  return {
    intervals: Array.isArray(settings?.intervals) ? settings.intervals : [1, 3, 7, 14, 30],
    totalTopics: revisions.length,
    highPriority: revisions.filter((item) => item.priority === "high" && item.status !== "completed").length,
    mediumPriority: revisions.filter((item) => item.priority === "medium" && item.status !== "completed").length,
    lowPriority: revisions.filter((item) => item.priority === "low" && item.status !== "completed").length,
    completedSessions: completedSessionCount,
    masteredTopics: revisions.filter((item) => item.lastScore !== null && item.lastScore >= 85).length,
    weakTopics: revisions.filter((item) => item.lastScore !== null && item.lastScore < 60).length,
    dueTopics: revisions.filter((item) => item.nextRevisionAt && new Date(item.nextRevisionAt) <= new Date()).length,
    analytics: {
      sessionsAnalyzed: sessions.length,
      averageScoreImprovement: scoreImprovements.length
        ? Math.round(scoreImprovements.reduce((sum, value) => sum + value, 0) / scoreImprovements.length * 10) / 10
        : null,
      improvedSessions: scoreImprovements.filter((value) => value > 0).length,
      declinedSessions: scoreImprovements.filter((value) => value < 0).length
    },
    recommendations,
    recentSessions: sessions.slice(0, 10).map((session) => ({
      topicId: session.topic_id,
      topicTitle: topics.get(String(session.topic_id))?.topic.title || "Archived topic",
      completedAt: session.completed_at,
      scoreBefore: session.score_before ?? null,
      scoreAfter: session.score_after ?? null,
      accuracyImprovement: session.accuracy_improvement ?? null
    })),
    revisions
  };
}

export async function saveSqlLearningRevisionSettings(userId: string, intervals: number[]) {
  await mongoCollection("sql_learning_revision_settings").updateOne(
    { _id: userId },
    { $set: { user_id: userId, intervals, updated_at: new Date() } },
    { upsert: true }
  );
  return { intervals };
}

export async function saveSqlLearningTopicNote(userId: string, topicId: string, note: string, bookmarked: boolean) {
  if (!findCurriculumTopic(topicId, await getUserCurriculum(userId))) return false;
  const now = new Date();
  await mongoCollection("sql_learning_topic_notes").updateOne(
    { user_id: userId, topic_id: topicId },
    { $set: { note, bookmarked, updated_at: now }, $setOnInsert: { user_id: userId, topic_id: topicId, created_at: now } },
    { upsert: true }
  );
  return true;
}

export async function askSqlLearningTutor(input: {
  userId: string;
  topicId: string;
  action: "hint" | "explain" | "debug" | "improve";
  question: string;
  sql: string;
  error?: string;
  testId?: string;
  questionId?: string;
}) {
  const found = findCurriculumTopic(input.topicId, await getUserCurriculum(input.userId));
  if (!found) return null;
  const workspace = await getFirstPracticeWorkspace(input.userId);
  const schema = workspace ? await getPracticeSchema(workspace) : { tables: [], relationships: [] };
  let expectedOutput = "";
  let previousAttempts = "";
  if (input.testId && input.questionId) {
    const test = await mongoCollection<SqlLearningTest>("sql_learning_tests").findOne({
      _id: input.testId,
      user_id: input.userId,
      ...(input.topicId.startsWith("module-assessment:") ? {} : { topic_id: input.topicId })
    });
    const question = test?.questions.find((item) => item.id === input.questionId);
    if (question) {
      expectedOutput = JSON.stringify({ columns: question.expected.columns, rows: question.expected.rows });
      const attempts = await mongoCollection("sql_learning_test_attempts")
        .find({ user_id: input.userId, test_id: input.testId, question_id: input.questionId }, { projection: { sql: 1, error: 1, correct: 1, created_at: 1 } })
        .sort({ created_at: -1 })
        .limit(5)
        .toArray();
      previousAttempts = JSON.stringify(attempts.map((attempt) => ({
        sql: attempt.sql,
        error: attempt.error || null,
        correct: attempt.correct
      })));
    }
  }
  const { sqlLearningTutor } = await import("./ai.js");
  return sqlLearningTutor({
    topic: found.topic.title,
    module: found.module.title,
    action: input.action,
    question: input.question,
    schema: JSON.stringify(schema),
    sql: input.sql,
    error: input.error || "",
    expectedOutput,
    previousAttempts
  });
}

export async function createSqlLearningCustomCurriculum(userId: string) {
  const collection = mongoCollection("sql_learning_custom_curricula");
  let personal = await collection.findOne({ _id: userId });
  if (!personal) {
    const modules = JSON.parse(JSON.stringify(await mongoCollection<SqlLearningModule>("sql_learning_modules").find().sort({ order: 1 }).toArray()));
    await collection.insertOne({ _id: userId, user_id: userId, modules, created_at: new Date(), updated_at: new Date() });
    personal = await collection.findOne({ _id: userId });
  }
  if (!personal) throw new Error("Personal curriculum could not be created.");
  return { created: true, modules: personal.modules };
}

export async function getSqlLearningCustomCurriculum(userId: string) {
  const personal = await mongoCollection("sql_learning_custom_curricula").findOne({ _id: userId }, { projection: { _id: 0, modules: 1, updated_at: 1 } });
  return { created: Boolean(personal), modules: personal?.modules || null, updatedAt: personal?.updated_at || null };
}

export async function resetSqlLearningCustomCurriculum(userId: string) {
  await mongoCollection("sql_learning_custom_curricula").deleteOne({ _id: userId });
  return { restored: true };
}

async function updateCustomCurriculum(userId: string, modules: CurriculumModule[]) {
  await mongoCollection("sql_learning_custom_curricula").updateOne(
    { _id: userId },
    { $set: { modules, updated_at: new Date() } }
  );
  return modules;
}

export async function editSqlLearningCustomModule(userId: string, moduleId: string, input: {
  title?: string; order?: number; difficulty?: string; description?: string; archived?: boolean;
}) {
  const curriculum = await getSqlLearningCustomCurriculum(userId);
  if (!curriculum.created || !curriculum.modules) return null;
  const modules = curriculum.modules as CurriculumModule[];
  const module = modules.find((item) => item.id === moduleId);
  if (!module) return null;
  Object.assign(module, input);
  if (input.order !== undefined) {
    modules.sort((left, right) => left.order - right.order);
    const currentIndex = modules.findIndex((item) => item.id === moduleId);
    modules.splice(currentIndex, 1);
    modules.splice(Math.min(input.order - 1, modules.length), 0, module);
    modules.forEach((item, index) => { item.order = index + 1; });
  }
  await updateCustomCurriculum(userId, modules);
  return module;
}

export async function addSqlLearningCustomModule(userId: string, title: string) {
  const curriculum = await getSqlLearningCustomCurriculum(userId);
  if (!curriculum.created || !curriculum.modules) return null;
  const modules = curriculum.modules as CurriculumModule[];
  const id = `custom-module-${crypto.randomUUID()}`;
  const module: CurriculumModule = { id, order: modules.length + 1, title, topics: [], description: "", difficulty: "beginner", archived: false };
  modules.push(module);
  await updateCustomCurriculum(userId, modules);
  return module;
}

export async function duplicateSqlLearningCustomModule(userId: string, moduleId: string) {
  const curriculum = await getSqlLearningCustomCurriculum(userId);
  if (!curriculum.created || !curriculum.modules) return null;
  const modules = curriculum.modules as CurriculumModule[];
  const source = modules.find((item) => item.id === moduleId);
  if (!source) return null;
  const id = `custom-module-${crypto.randomUUID()}`;
  const copy: CurriculumModule = {
    ...JSON.parse(JSON.stringify(source)) as CurriculumModule,
    id,
    title: `${source.title} (copy)`,
    order: modules.length + 1,
    archived: false,
    topics: source.topics.map((topic, index) => ({
      ...topic,
      id: `custom-topic-${crypto.randomUUID()}`,
      order: index + 1,
      archived: false
    }))
  };
  modules.push(copy);
  await updateCustomCurriculum(userId, modules);
  return copy;
}

export async function addSqlLearningCustomTopic(userId: string, moduleId: string, title: string) {
  const curriculum = await getSqlLearningCustomCurriculum(userId);
  if (!curriculum.created || !curriculum.modules) return null;
  const modules = curriculum.modules as CurriculumModule[];
  const module = modules.find((item) => item.id === moduleId);
  if (!module) return null;
  const topic: SqlLearningTopic = { id: `custom-topic-${crypto.randomUUID()}`, title, order: module.topics.length + 1, description: "", difficulty: "beginner", archived: false };
  module.topics.push(topic);
  await updateCustomCurriculum(userId, modules);
  return topic;
}

export async function duplicateSqlLearningCustomTopic(userId: string, moduleId: string, topicId: string) {
  const curriculum = await getSqlLearningCustomCurriculum(userId);
  if (!curriculum.created || !curriculum.modules) return null;
  const modules = curriculum.modules as CurriculumModule[];
  const module = modules.find((item) => item.id === moduleId);
  const source = module?.topics.find((topic) => topic.id === topicId);
  if (!module || !source) return null;
  const duplicate: SqlLearningTopic = {
    ...source,
    id: `custom-topic-${crypto.randomUUID()}`,
    title: `${source.title} (copy)`,
    order: module.topics.length + 1,
    archived: false
  };
  module.topics.push(duplicate);
  await updateCustomCurriculum(userId, modules);
  return duplicate;
}

export async function editSqlLearningCustomTopic(userId: string, moduleId: string, topicId: string, input: {
  title?: string; order?: number; difficulty?: string; description?: string; archived?: boolean; moveToModuleId?: string;
}) {
  const curriculum = await getSqlLearningCustomCurriculum(userId);
  if (!curriculum.created || !curriculum.modules) return null;
  const modules = curriculum.modules as CurriculumModule[];
  const source = modules.find((item) => item.id === moduleId);
  const topicIndex = source?.topics.findIndex((topic) => topic.id === topicId) ?? -1;
  if (!source || topicIndex < 0) return null;
  const [topic] = source.topics.splice(topicIndex, 1);
  Object.assign(topic, { ...input, moveToModuleId: undefined });
  if (input.moveToModuleId) {
    const destination = modules.find((item) => item.id === input.moveToModuleId);
    if (!destination) {
      source.topics.splice(topicIndex, 0, topic);
      return null;
    }
    const order = Math.min(input.order || destination.topics.length + 1, destination.topics.length + 1);
    destination.topics.splice(order - 1, 0, topic);
    destination.topics.forEach((item, index) => { item.order = index + 1; });
  } else {
    const order = Math.min(input.order || topicIndex + 1, source.topics.length + 1);
    source.topics.splice(order - 1, 0, topic);
    source.topics.forEach((item, index) => { item.order = index + 1; });
  }
  await updateCustomCurriculum(userId, modules);
  return topic;
}

export async function updateSqlLearningCustomLesson(userId: string, topicId: string, input: {
  theory: string; syntax: string; examples: Omit<SqlLearningExample, "expected">[];
}) {
  const found = findCurriculumTopic(topicId, await getUserCurriculum(userId));
  if (!found) return null;
  if (input.theory.trim().length < 200 || !input.syntax.trim() || input.examples.length !== 5) {
    throw new Error("A custom lesson needs detailed theory, syntax, and exactly five examples.");
  }
  const workspace = await getPracticeWorkspace(userId);
  const examples: SqlLearningExample[] = [];
  for (const example of input.examples) {
    if (!example.sql.trim() || !example.title.trim() || !example.problem.trim() || !example.explanation.trim()) {
      throw new Error("Every custom example needs a title, problem, explanation, and SQL query.");
    }
    examples.push({ ...example, expected: await executeReadOnly(workspace.schema_name, example.sql) });
  }
  const now = new Date();
  await mongoCollection("sql_learning_user_content_overrides").updateOne(
    { user_id: userId, topic_id: topicId, database_id: workspace.id },
    {
      $set: { user_id: userId, topic_id: topicId, database_id: workspace.id, theory: input.theory, syntax: input.syntax, examples, updated_at: now },
      $setOnInsert: { created_at: now }
    },
    { upsert: true }
  );
  return { theory: input.theory, syntax: input.syntax, examples, updatedAt: now };
}

export async function resetSqlLearningCustomLesson(userId: string, topicId: string) {
  await mongoCollection("sql_learning_user_content_overrides").deleteOne({ user_id: userId, topic_id: topicId });
  return { restored: true };
}
