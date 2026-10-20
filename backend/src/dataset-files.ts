export const MAX_DATASET_BYTES = 5 * 1024 * 1024;
export const MAX_DATASET_ROWS = 10_000;
export const MAX_DATASET_COLUMNS = 80;

export type ParsedDataset = {
  rows: Record<string, unknown>[];
  columns: string[];
  filename: string;
};

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

export function parseDatasetFile(filename: string, bytes: Buffer): ParsedDataset {
  if (!bytes.length || bytes.length > MAX_DATASET_BYTES) throw new Error("Upload a non-empty dataset up to 5 MB.");
  const extension = filename.toLowerCase().slice(filename.lastIndexOf("."));
  if (![".csv", ".json", ".jsonl"].includes(extension)) throw new Error("Supported formats are CSV, JSON, and JSON Lines (.jsonl).");
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new Error("Dataset must be valid UTF-8 text.");
  }
  const parsed = extension === ".csv" ? csvRows(text) : jsonRows(text, extension);
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
