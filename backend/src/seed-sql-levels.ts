import "dotenv/config";
import crypto from "node:crypto";
import { generateQuestions, openai } from "./ai.js";
import { closePracticePools, executeReadOnly, pool, schemaSnapshot } from "./db.js";
import { connectMongo, closeMongo } from "./mongo.js";
import { migrateLegacyQuestions } from "./questions.js";

const levels = [..."ABCDEFGHIJKLMNOPQR"].map((code, index) => {
  const band = index < 4 ? "VERY EASY" : index < 8 ? "EASY" : index < 11 ? "MEDIUM" : index < 14 ? "HARD" : "VERY HARD";
  const difficulty = index < 8 ? "beginner" : index < 11 ? "intermediate" : index < 14 ? "advanced" : "very-advanced";
  const focus = [
    "single-table SELECT, projection, aliases, and basic ordering",
    "simple equality, range, IN, and NULL filters",
    "sorting, limiting, string matching, and distinct values",
    "basic aggregates, grouping, and calculated columns",
    "inner joins between employees, departments, and jobs",
    "multiple predicates, CASE expressions, and grouped summaries",
    "LEFT JOIN, missing relationships, HAVING, and zero-count groups",
    "aggregate comparisons and practical data-quality checks",
    "scalar subqueries and comparisons with department-level metrics",
    "CTEs, conditional aggregation, and multi-step reporting",
    "anti-joins, correlated subqueries, and validation exceptions",
    "ROW_NUMBER, RANK, and top-per-department analysis",
    "window aggregates, salary distributions, and tie handling",
    "multi-CTE reconciliation across the four actual demo tables",
    "advanced window frames, layered CTEs, and robust tie-breaking",
    "complex exception detection using jobs, employees, and departments",
    "combined analytical windows, conditional aggregates, and anti-joins",
    "the most advanced valid analysis possible using only this demo schema"
  ][index];
  return { code, band, difficulty, focus };
});

type GeneratedQuestion = {
  title: string;
  topic: string;
  context: string;
  task: string;
  required_output: string;
  reference_sql: string;
  tags: string[];
  difficulty: string;
  expected_json: unknown;
};

function normalize(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

async function generateLevelQuestions(schema: string, schemaName: string, level: typeof levels[number], existingTitles: Set<string>, existingSql: Set<string>): Promise<GeneratedQuestion[]> {
  const accepted: GeneratedQuestion[] = [];
  let attempts = 0;
  while (accepted.length < 15 && attempts < 8) {
    attempts += 1;
    const batchSize = Math.min(8, 15 - accepted.length + 2);
    const recentTitles = [...existingTitles].slice(-35).join("; ");
    const promptTopic = `SQL Level ${level.code} (${level.band}). Focus: ${level.focus}. Create distinct, data-engineering interview tasks using only the supplied schema. Avoid these existing question titles/intents: ${recentTitles}`;
    const batch = await generateQuestions(schema, batchSize, level.difficulty, promptTopic);
    for (const candidate of batch.questions) {
      if (accepted.length >= 15) break;
      if (typeof candidate.title !== "string" || typeof candidate.reference_sql !== "string") continue;
      const titleKey = normalize(candidate.title);
      const sqlKey = normalize(candidate.reference_sql);
      if (!titleKey || existingTitles.has(titleKey) || existingSql.has(sqlKey)) continue;
      try {
        const expected = await executeReadOnly(schemaName, candidate.reference_sql);
        const tags = [...new Set([...(Array.isArray(candidate.tags) ? candidate.tags : []), `level:${level.code}`, `level-band:${level.band}`])];
        accepted.push({ ...candidate, difficulty: level.difficulty, tags, expected_json: expected });
        existingTitles.add(titleKey);
        existingSql.add(sqlKey);
      } catch {
        continue;
      }
    }
    console.log(`Level ${level.code}: ${accepted.length}/15 validated`);
  }
  if (accepted.length !== 15) throw new Error(`Could not validate 15 unique SQL questions for level ${level.code}; validated ${accepted.length}. Nothing has been inserted.`);
  return accepted;
}

async function main() {
  if (!openai) throw new Error("OPENAI_API_KEY is not configured; no questions were inserted.");
  await connectMongo();
  const database = (await pool.query("SELECT id,schema_name FROM app_databases WHERE slug='demo-ecommerce'")).rows[0];
  if (!database) throw new Error("The local demo-ecommerce database was not found.");

  const existingBank = await pool.query("SELECT id,tags FROM challenges WHERE database_id=$1 AND source='level-bank'", [database.id]);
  if (existingBank.rowCount) {
    if (existingBank.rowCount !== 270) throw new Error(`A partial SQL level bank already exists (${existingBank.rowCount}/270); no existing questions were changed.`);
    await migrateLegacyQuestions(String(database.id));
    console.log("The 270-question SQL level bank already exists and is available in MongoDB.");
    return;
  }

  const schema = JSON.stringify(await schemaSnapshot(String(database.schema_name)));
  const existing = await pool.query("SELECT title,reference_sql FROM challenges WHERE database_id=$1", [database.id]);
  const titles = new Set<string>(existing.rows.map((question: any) => normalize(String(question.title))));
  const sqlStatements = new Set<string>(existing.rows.map((question: any) => normalize(String(question.reference_sql))));
  const generated: { level: typeof levels[number]; question: GeneratedQuestion }[] = [];

  for (const level of levels) {
    const questions = await generateLevelQuestions(schema, String(database.schema_name), level, titles, sqlStatements);
    generated.push(...questions.map(question => ({ level, question })));
  }

  if (generated.length !== 270) throw new Error(`Expected 270 questions, got ${generated.length}; no questions were inserted.`);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const level of levels) {
      const items = generated.filter(item => item.level.code === level.code);
      const setId = crypto.randomUUID();
      const now = new Date();
      await client.query(
        "INSERT INTO question_sets(id,database_id,name,count_requested,accepted_count,rejected_count,status,settings,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)",
        [setId, database.id, `SQL Level ${level.code} · ${level.band}`, 15, 15, 0, "completed", JSON.stringify({ learning_level: level.code, difficulty_band: level.band, source: "level-bank" }), now]
      );
      for (const { question } of items) {
        await client.query(
          "INSERT INTO challenges(id,database_id,question_set_id,title,difficulty,topic,context,task,required_output,reference_sql,expected_json,tags,source,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)",
          [crypto.randomUUID(), database.id, setId, question.title, question.difficulty, question.topic, question.context, question.task, question.required_output, question.reference_sql, JSON.stringify(question.expected_json), JSON.stringify(question.tags), "level-bank", now]
        );
      }
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  await migrateLegacyQuestions(String(database.id));
  console.log("Inserted 270 validated SQL questions: 15 for each level A–R.");
}

main().catch(error => {
  console.error((error as Error).message);
  process.exitCode = 1;
}).finally(async () => {
  await closePracticePools();
  await closeMongo();
  await pool.end();
});