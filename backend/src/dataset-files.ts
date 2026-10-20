import { parquetMetadata, parquetReadObjects, parquetSchema } from "hyparquet";
import { parse, type CreateTableStatement, type InsertStatement, type Statement } from "pgsql-ast-parser";
import { validatePracticeImport } from "./sql-guard.js";

export const MAX_DATASET_BYTES = 5 * 1024 * 1024;
export const MAX_DATASET_ROWS = 10_000;
export const MAX_DATASET_COLUMNS = 80;
export const MAX_DATASET_TABLES = 20;

export type ParsedDataset = {
  rows: Record<string, unknown>[];
  columns: string[];
  filename: string;
};

export type ParsedSqlDatabase = {
  filename: string;
  sql: string;
  tableCount: number;
  insertedRows: number;
};

function rejectSqlFunctionCalls(value: unknown): void {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach(rejectSqlFunctionCalls);
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    if (key === "function") throw new Error("SQL imports do not allow function calls in schema or row expressions.");
    rejectSqlFunctionCalls(child);
  }
}

function parseCsv(text: string): string[][] {
  const records: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
    } else if (character === '"' && field.length === 0) {
      quoted = true;
    } else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n" || character === "\r") {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      row.push(field);
      field = "";
      if (row.some(value => value.length > 0)) records.push(row);
      row = [];
    } else {
      field += character;
    }
  }
  if (quoted) throw new Error("CSV contains an unterminated quoted field.");
  row.push(field);
  if (row.some(value => value.length > 0)) records.push(row);
  return records;
}

function safeColumnNames(raw: string[]): string[] {
  if (!raw.length || raw.length > MAX_DATASET_COLUMNS) throw new Error(`Datasets must have between 1 and ${MAX_DATASET_COLUMNS} columns.`);
  const seen = new Set<string>();
  return raw.map((value, index) => {
    const normalized = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
    const base = /^[a-z_]/.test(normalized) ? normalized : `column_${index + 1}`;
    let name = base.slice(0, 55);
    let suffix = 2;
    while (seen.has(name)) {
      name = `${base.slice(0, 52)}_${suffix}`;
      suffix += 1;
    }
    seen.add(name);
    return name;
  });
}

function csvRows(text: string): { columns: string[]; rows: Record<string, unknown>[] } {
  const records = parseCsv(text.replace(/^\uFEFF/, ""));
  if (records.length < 2) throw new Error("CSV must contain a header and at least one data row.");
  const width = records[0].length;
  if (records.some(record => record.length !== width)) throw new Error("CSV rows must all have the same number of columns.");
  if (records.length - 1 > MAX_DATASET_ROWS) throw new Error(`Datasets are limited to ${MAX_DATASET_ROWS.toLocaleString()} rows.`);
  const columns = safeColumnNames(records[0]);
  const rows = records.slice(1).map(record => Object.fromEntries(columns.map((column, index) => [column, record[index] === "" ? null : record[index]])));
  return { columns, rows };
}

function jsonRows(text: string, extension: string): { columns: string[]; rows: Record<string, unknown>[] } {
  let values: unknown[];
  try {
    values = extension === ".jsonl"
      ? text.split(/\r?\n/).filter(line => line.trim()).map(line => JSON.parse(line))
      : (() => {
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) return parsed;
        if (!parsed || typeof parsed !== "object") return [];
        const rows = (parsed as Record<string, unknown>).rows;
        return Array.isArray(rows) ? rows : [];
      })();
  } catch {
    throw new Error("JSON data is malformed.");
  }
  if (!values.length || values.length > MAX_DATASET_ROWS) throw new Error(`JSON datasets must contain 1 to ${MAX_DATASET_ROWS.toLocaleString()} rows.`);
  if (values.some(value => !value || typeof value !== "object" || Array.isArray(value))) throw new Error("Each JSON row must be an object.");
  const sourceColumns = [...new Set(values.flatMap(value => Object.keys(value as Record<string, unknown>)))];
  const columns = safeColumnNames(sourceColumns);
  const rows = values.map(value => {
    const source = value as Record<string, unknown>;
    return Object.fromEntries(sourceColumns.map((key, index) => [columns[index], source[key] ?? null]));
  });
  return { columns, rows };
}

function parquetCell(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Uint8Array) return Buffer.from(value).toString("base64");
  if (typeof value === "number" && !Number.isFinite(value)) return String(value);
  if (typeof value === "object") {
    return JSON.stringify(value, (_key, item: unknown) => typeof item === "bigint" ? item.toString() : item);
  }
  return value;
}

export function parseSqlDatabaseFile(filename: string, bytes: Buffer, schemaName: string): ParsedSqlDatabase {
  if (!bytes.length || bytes.length > MAX_DATASET_BYTES) throw new Error("Upload a non-empty SQL file up to 5 MB.");
  if (filename.toLowerCase().slice(filename.lastIndexOf(".")) !== ".sql") {
    throw new Error("SQL database imports require a .sql file.");
  }

  let sql: string;
  try {
    sql = new TextDecoder("utf-8", { fatal: true }).decode(bytes).replace(/^\uFEFF/, "");
  } catch {
    throw new Error("SQL file must be valid UTF-8 text.");
  }

  let statements: Statement[];
  try {
    statements = parse(sql);
  } catch {
    throw new Error("SQL file is malformed or uses unsupported PostgreSQL syntax.");
  }
  validatePracticeImport(schemaName, sql);
  if (!statements.length) throw new Error("SQL file is empty.");
  statements.forEach(rejectSqlFunctionCalls);

  const createStatements = statements.filter((statement): statement is CreateTableStatement => statement.type === "create table");
  if (!createStatements.length) throw new Error("SQL file must define at least one table with CREATE TABLE.");
  if (createStatements.length > MAX_DATASET_TABLES) {
    throw new Error(`SQL databases are limited to ${MAX_DATASET_TABLES} tables.`);
  }
  for (const statement of createStatements) {
    if (
      statement.temporary ||
      statement.unlogged ||
      statement.inherits?.length ||
      statement.columns.some(column => column.kind === "like table")
    ) {
      throw new Error("SQL imports support regular tables with explicit columns only.");
    }
    const columns = statement.columns.filter(column => column.kind === "column");
    if (!columns.length || columns.length > MAX_DATASET_COLUMNS) {
      throw new Error(`Each SQL table must have between 1 and ${MAX_DATASET_COLUMNS} columns.`);
    }
    const identifiers = [statement.name.name, ...columns.map(column => column.name.name)];
    if (identifiers.some(identifier => !/^[a-zA-Z_][a-zA-Z0-9_]{0,62}$/.test(identifier))) {
      throw new Error("SQL table and column names must use standard PostgreSQL identifiers up to 63 characters.");
    }
  }

  let insertedRows = 0;
  for (const statement of statements) {
    if (statement.type === "create table" || statement.type === "alter table") continue;
    if (statement.type !== "insert") {
      throw new Error("SQL imports support only CREATE TABLE, INSERT ... VALUES, and ALTER TABLE statements.");
    }
    const insert = statement as InsertStatement;
    if (insert.insert.type !== "values") {
      throw new Error("SQL imports support INSERT ... VALUES only; INSERT ... SELECT is not supported.");
    }
    insertedRows += insert.insert.values.length;
    if (insertedRows > MAX_DATASET_ROWS) {
      throw new Error(`SQL databases are limited to ${MAX_DATASET_ROWS.toLocaleString()} inserted rows in total.`);
    }
  }

  return { filename: filename.slice(0, 180), sql, tableCount: createStatements.length, insertedRows };
}

async function parquetRows(bytes: Buffer): Promise<{ columns: string[]; rows: Record<string, unknown>[] }> {
  if (bytes.length < 12 || bytes.subarray(0, 4).toString("ascii") !== "PAR1" || bytes.subarray(-4).toString("ascii") !== "PAR1") {
    throw new Error("Parquet file is invalid or incomplete.");
  }

  let metadata: ReturnType<typeof parquetMetadata>;
  try {
    metadata = parquetMetadata(bytes);
  } catch (error) {
    throw new Error("Parquet file metadata could not be read.", { cause: error });
  }

  const rowCount = Number(metadata.num_rows);
  if (!Number.isSafeInteger(rowCount) || rowCount < 1) throw new Error("Parquet datasets must contain at least one data row.");
  if (rowCount > MAX_DATASET_ROWS) throw new Error(`Datasets are limited to ${MAX_DATASET_ROWS.toLocaleString()} rows.`);

  let sourceColumns: string[];
  try {
    sourceColumns = parquetSchema(metadata).children.map(child => child.element.name);
  } catch (error) {
    throw new Error("Parquet file schema could not be read.", { cause: error });
  }
  const columns = safeColumnNames(sourceColumns);

  let values: Awaited<ReturnType<typeof parquetReadObjects>>;
  try {
    const file = Uint8Array.from(bytes).buffer;
    values = await parquetReadObjects({ file, metadata });
  } catch (error) {
    throw new Error("Parquet file data could not be decoded.", { cause: error });
  }
  if (values.length !== rowCount) throw new Error("Parquet row data does not match its metadata.");

  const rows = values.map(value => Object.fromEntries(
    sourceColumns.map((source, index) => [columns[index], parquetCell(value[source])])
  ));
  return { columns, rows };
}

export async function parseDatasetFile(filename: string, bytes: Buffer): Promise<ParsedDataset> {
  if (!bytes.length || bytes.length > MAX_DATASET_BYTES) throw new Error("Upload a non-empty dataset up to 5 MB.");
  const extension = filename.toLowerCase().slice(filename.lastIndexOf("."));
  if (![".csv", ".json", ".jsonl", ".parquet"].includes(extension)) {
    throw new Error("Supported formats are CSV, JSON, JSON Lines (.jsonl), and Parquet (.parquet). SQL database files are imported separately.");
  }
  let parsed: { columns: string[]; rows: Record<string, unknown>[] };
  if (extension === ".parquet") {
    parsed = await parquetRows(bytes);
  } else {
    let text: string;
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      throw new Error("Dataset must be valid UTF-8 text.");
    }
    parsed = extension === ".csv" ? csvRows(text) : jsonRows(text, extension);
  }
  return { ...parsed, filename: filename.slice(0, 180) };
}

export function inferDatasetColumnType(values: unknown[]): "BOOLEAN" | "BIGINT" | "DOUBLE PRECISION" | "TEXT" {
  const present = values.filter(value => value !== null && value !== undefined && value !== "");
  if (present.length && present.every(value => value === true || value === false || value === "true" || value === "false")) return "BOOLEAN";
  const numericString = (value: unknown): value is string => typeof value === "string" && !/^-?0\d/.test(value);
  if (present.length && present.every(value => typeof value === "number" && Number.isInteger(value) || numericString(value) && /^-?\d+$/.test(value))) return "BIGINT";
  if (present.length && present.every(value => typeof value === "number" && Number.isFinite(value) || numericString(value) && /^-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(value))) return "DOUBLE PRECISION";
  return "TEXT";
}
