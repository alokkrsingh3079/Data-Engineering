import crypto from "node:crypto";
import type { Document } from "mongodb";
import { mongoCollection } from "./mongo.js";
import { pool, createPracticeSchema, dropPracticeSchema, executeImport, grantPracticeSchema, listTables, quoteIdent } from "./db.js";
import { createWorkspace, deleteWorkspaceRecord } from "./workspaces.js";
import { inferDatasetColumnType, MAX_DATASET_COLUMNS, MAX_DATASET_ROWS, MAX_DATASET_TABLES, parseDatasetFile, parseSqlDatabaseFile, type ParsedDataset } from "./dataset-files.js";

type DatasetRecord = Document & {
  _id: string;
  id: string;
  owner_user_id: string;
  database_id: string;
  name: string;
  description: string;
  filename: string;
  table_name: string;
  table_names?: string[];
  columns: string[];
  row_count: number;
  created_at: Date;
};

const datasets = () => mongoCollection<DatasetRecord>("question_datasets");

function safeValue(value: unknown): unknown {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "object") return JSON.stringify(value);
  return value;
}

function sqlValue(value: unknown, type: string): unknown {
  const safe = safeValue(value);
  if (safe === null || type === "TEXT") return safe;
  if (type === "BOOLEAN") return safe === true || safe === "true";
  if (type === "BIGINT") {
    const integer = String(safe);
    if (!/^-?\d+$/.test(integer)) throw new Error("Dataset contains an invalid integer value.");
    return integer;
  }
  if (type === "DOUBLE PRECISION") {
    const number = Number(safe);
    if (!Number.isFinite(number)) throw new Error("Dataset contains an invalid numeric value.");
    return number;
  }
  return safe;
}

function normalizeName(value: string, fallback: string): string {
  const normalized = value.trim().replace(/\s+/g, " ").slice(0, 100);
  return normalized || fallback;
}

function databaseNames(filename: string, datasetId: string) {
  const base = filename.replace(/\.[^.]+$/, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 35) || "dataset";
  const suffix = datasetId.replaceAll("-", "").slice(0, 8);
  return {
    slug: `dataset-${base}-${suffix}`,
    schemaName: `question_dataset_${base.replaceAll("-", "_").slice(0, 35)}_${suffix}`
  };
}

async function insertRows(schemaName: string, parsed: ParsedDataset, tableName: string): Promise<void> {
  const columnTypes = parsed.columns.map(column => inferDatasetColumnType(parsed.rows.map(row => row[column])));
  const qualifiedTable = `${quoteIdent(schemaName)}.${quoteIdent(tableName)}`;
  const definitions = parsed.columns.map((column, index) => `${quoteIdent(column)} ${columnTypes[index]}`).join(", ");
  await pool.query(`CREATE TABLE ${qualifiedTable} (${definitions})`);
  const batchSize = 200;
  for (let offset = 0; offset < parsed.rows.length; offset += batchSize) {
    const batch = parsed.rows.slice(offset, offset + batchSize);
    const params: unknown[] = [];
    const tuples = batch.map((row, rowIndex) => `(${parsed.columns.map((column, columnIndex) => {
      params.push(sqlValue(row[column], columnTypes[columnIndex]));
      return `$${rowIndex * parsed.columns.length + columnIndex + 1}`;
    }).join(", ")})`);
    await pool.query(
      `INSERT INTO ${qualifiedTable} (${parsed.columns.map(column => quoteIdent(column)).join(", ")}) VALUES ${tuples.join(", ")}`,
      params
    );
  }
  await grantPracticeSchema(schemaName);
}

export async function createQuestionDataset(userId: string, filename: string, bytes: Buffer) {
  const id = crypto.randomUUID();
  const databaseId = crypto.randomUUID();
  const { slug, schemaName } = databaseNames(filename, id);
  const databaseName = normalizeName(filename.replace(/\.[^.]+$/, ""), "Uploaded dataset");
  const isSqlDatabase = filename.toLowerCase().endsWith(".sql");
  const parsed = isSqlDatabase ? null : await parseDatasetFile(filename, bytes);
  const parsedSql = isSqlDatabase ? parseSqlDatabaseFile(filename, bytes, schemaName) : null;
  const tableName = "dataset";
  const description = "";
  const createdAt = new Date();
  const workspace = {
    id: databaseId,
    name: databaseName,
    slug,
    schema_name: schemaName,
    dialect: "postgresql",
    description: `Question Generation dataset: ${databaseName}`,
    owner_user_id: userId,
    created_at: createdAt
  };

  await createPracticeSchema(schemaName);
  try {
    let tableNames: string[];
    let defaultTableName: string;
    let totalRows = 0;
    if (parsedSql) {
      await executeImport(schemaName, parsedSql.sql);
      const importedTables: { name: string; columns: { column_name: string }[] }[] = await listTables(schemaName);
      if (!importedTables.length) throw new Error("SQL file did not create any tables.");
      if (importedTables.length > MAX_DATASET_TABLES) {
        throw new Error(`SQL databases are limited to ${MAX_DATASET_TABLES} tables.`);
      }
      const rowCounts = new Map<string, number>();
      for (const table of importedTables) {
        if (!/^[a-zA-Z_][a-zA-Z0-9_]{0,62}$/.test(table.name) || !table.columns.length || table.columns.length > MAX_DATASET_COLUMNS) {
          throw new Error("SQL table and column names must use standard PostgreSQL identifiers, with no more than 80 columns per table.");
        }
        if (table.columns.some(column => !/^[a-zA-Z_][a-zA-Z0-9_]{0,62}$/.test(column.column_name))) {
          throw new Error("SQL table and column names must use standard PostgreSQL identifiers up to 63 characters.");
        }
        const result = await pool.query(`SELECT count(*)::int AS count FROM ${quoteIdent(schemaName)}.${quoteIdent(table.name)}`);
        const count = Number(result.rows[0].count);
        totalRows += count;
        rowCounts.set(table.name, count);
        if (totalRows > MAX_DATASET_ROWS) {
          throw new Error(`SQL databases are limited to ${MAX_DATASET_ROWS.toLocaleString()} rows in total.`);
        }
      }
      tableNames = importedTables.map(table => table.name);
      defaultTableName = importedTables.find(table => (rowCounts.get(table.name) || 0) > 0)?.name || importedTables[0].name;
    } else {
      await insertRows(schemaName, parsed!, tableName);
      tableNames = [tableName];
      defaultTableName = tableName;
      totalRows = parsed!.rows.length;
    }
    await pool.query(
      "INSERT INTO app_databases(id,name,slug,schema_name,dialect,description,owner_user_id) VALUES($1,$2,$3,$4,'postgresql',$5,$6)",
      [databaseId, databaseName, slug, schemaName, workspace.description, userId]
    );
    await createWorkspace(workspace);
    const record: DatasetRecord = {
      _id: id,
      id,
      owner_user_id: userId,
      database_id: databaseId,
      name: databaseName,
      description,
      filename: parsedSql?.filename || parsed!.filename,
      table_name: defaultTableName,
      table_names: tableNames,
      columns: parsed?.columns || [],
      row_count: totalRows,
      created_at: createdAt
    };
    await datasets().insertOne(record);
    return await getQuestionDataset(userId, id);
  } catch (error) {
    await datasets().deleteOne({ _id: id });
    await pool.query("DELETE FROM app_databases WHERE id=$1", [databaseId]);
    await deleteWorkspaceRecord(databaseId);
    await dropPracticeSchema(schemaName);
    throw error;
  }
}

export async function getQuestionDataset(userId: string, id: string) {
  const record = await datasets().findOne({ _id: id, owner_user_id: userId });
  if (!record) return null;
  const workspace = await pool.query(
    "SELECT id,name,slug,schema_name,dialect,description,created_at FROM app_databases WHERE id=$1 AND owner_user_id=$2",
    [record.database_id, userId]
  );
  if (!workspace.rowCount) return null;
  const schemaName = String(workspace.rows[0].schema_name);
  const tableNames = (record.table_names?.length ? record.table_names : [record.table_name]).slice(0, MAX_DATASET_TABLES);
  const tables: {
    name: string;
    row_count: number;
    columns: { name: string; type: string; nullCount: number }[];
    preview: Record<string, unknown>[];
  }[] = [];
  let totalRows = 0;
  for (const tableName of tableNames) {
    if (!/^[a-zA-Z_][a-zA-Z0-9_]{0,62}$/.test(tableName)) throw new Error("Dataset contains an invalid table name.");
    const columns = await pool.query(
      "SELECT column_name,data_type FROM information_schema.columns WHERE table_schema=$1 AND table_name=$2 ORDER BY ordinal_position",
      [schemaName, tableName]
    );
    if (!columns.rowCount || columns.rows.length > MAX_DATASET_COLUMNS || columns.rows.some(row => !/^[a-zA-Z_][a-zA-Z0-9_]{0,62}$/.test(String(row.column_name)))) {
      throw new Error("Dataset table schema is invalid or unavailable.");
    }
    const table = `${quoteIdent(schemaName)}.${quoteIdent(tableName)}`;
    const aggregate = await pool.query(
      `SELECT count(*)::int AS row_count${columns.rows.map((column, index) => `, count(*) FILTER (WHERE ${quoteIdent(String(column.column_name))} IS NULL)::int AS null_${index}`).join("")} FROM ${table}`
    );
    const sample = await pool.query(`SELECT * FROM ${table} LIMIT 10`);
    const rowCount = Number(aggregate.rows[0].row_count);
    totalRows += rowCount;
    tables.push({
      name: tableName,
      row_count: rowCount,
      columns: columns.rows.map((column, index) => ({
        name: String(column.column_name),
        type: String(column.data_type),
        nullCount: Number(aggregate.rows[0][`null_${index}`])
      })),
      preview: sample.rows
    });
  }
  const selectedTable = tables.find(table => table.name === record.table_name) || tables[0];
  if (!selectedTable) return null;
  return {
    ...record,
    row_count: totalRows,
    tables,
    database: {
      id: String(workspace.rows[0].id),
      name: String(workspace.rows[0].name),
      dialect: String(workspace.rows[0].dialect),
      schemaName: String(workspace.rows[0].schema_name)
    },
    columns: selectedTable.columns,
    preview: selectedTable.preview
  };
}

export async function listQuestionDatasets(userId: string) {
  const records = await datasets().find({ owner_user_id: userId }).sort({ created_at: -1 }).toArray();
  const items = await Promise.all(records.map(record => getQuestionDataset(userId, String(record._id))));
  return items.filter((item): item is NonNullable<typeof item> => item !== null);
}

export async function updateQuestionDataset(userId: string, id: string, name: string, description: string) {
  const record = await datasets().findOne({ _id: id, owner_user_id: userId });
  if (!record) return null;
  const safeName = normalizeName(name, "Uploaded dataset");
  const safeDescription = description.trim().slice(0, 1000);
  const [updated] = await Promise.all([
    datasets().findOneAndUpdate(
      { _id: id, owner_user_id: userId },
      { $set: { name: safeName, description: safeDescription } },
      { returnDocument: "after" }
    ),
    pool.query("UPDATE app_databases SET name=$1,description=$2 WHERE id=$3 AND owner_user_id=$4", [
      safeName,
      `Question Generation dataset: ${safeName}`,
      record.database_id,
      userId
    ]),
    mongoCollection("app_databases").updateOne({ _id: record.database_id, owner_user_id: userId }, { $set: { name: safeName, description: `Question Generation dataset: ${safeName}` } })
  ]);
  return updated;
}

export async function deleteQuestionDataset(userId: string, id: string) {
  const record = await datasets().findOne({ _id: id, owner_user_id: userId });
  if (!record) return false;
  const workspace = await pool.query("SELECT schema_name FROM app_databases WHERE id=$1 AND owner_user_id=$2", [record.database_id, userId]);
  if (!workspace.rowCount) return false;
  const questionIds = await mongoCollection("learning_questions")
    .find({ dataset_id: id, owner_user_id: userId }, { projection: { _id: 1 } })
    .toArray();
  const ids = questionIds.map(question => String(question._id));
  if (ids.length) {
    await Promise.all([
      mongoCollection("learning_attempts").deleteMany({ user_id: userId, question_id: { $in: ids } }),
      mongoCollection("learning_bookmarks").deleteMany({ user_id: userId, question_id: { $in: ids } }),
      mongoCollection("learning_revision_marks").deleteMany({ user_id: userId, question_id: { $in: ids } }),
      mongoCollection("learning_question_progress").deleteMany({ user_id: userId, question_id: { $in: ids } }),
      mongoCollection("spark_execution_jobs").deleteMany({ user_id: userId, question_id: { $in: ids } }),
      mongoCollection("learning_questions").deleteMany({ _id: { $in: ids }, owner_user_id: userId })
    ]);
  }
  await dropPracticeSchema(String(workspace.rows[0].schema_name));
  await pool.query("DELETE FROM app_databases WHERE id=$1 AND owner_user_id=$2", [record.database_id, userId]);
  await deleteWorkspaceRecord(record.database_id);
  await datasets().deleteOne({ _id: id, owner_user_id: userId });
  return true;
}
