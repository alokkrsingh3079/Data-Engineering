import { parse } from "pgsql-ast-parser";

const importStatementTypes = new Set(["create table", "insert", "alter table"]);
const blockedFunctions = new Set([
  "dblink",
  "lo_export",
  "lo_import",
  "nextval",
  "pg_advisory_lock",
  "pg_advisory_lock_shared",
  "pg_advisory_xact_lock",
  "pg_cancel_backend",
  "pg_notify",
  "pg_read_binary_file",
  "pg_read_file",
  "pg_sleep",
  "pg_stat_file",
  "pg_terminate_backend",
  "set_config",
  "setval"
]);

function parseWorkspaceSql(schemaName: string, sql: string): any[] {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(schemaName)) throw new Error("Invalid schema");
  if (!sql.trim()) throw new Error("SQL is empty");

  let statements: any[];
  try {
    statements = parse(sql) as any[];
  } catch {
    throw new Error("SQL could not be safely validated");
  }
  if (!statements.length) throw new Error("SQL is empty");

  const visit = (value: unknown): void => {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    for (const [key, child] of Object.entries(value)) {
      if (key === "schema" && typeof child === "string" && child.toLowerCase() !== schemaName.toLowerCase()) {
        throw new Error("SQL may only reference the current practice workspace");
      }
      if (
        key === "function" &&
        child &&
        typeof child === "object" &&
        "name" in child &&
        typeof child.name === "string" &&
        blockedFunctions.has(child.name.toLowerCase())
      ) {
        throw new Error("This PostgreSQL function is not available in practice queries");
      }
      visit(child);
    }
  };

  statements.forEach(visit);
  return statements;
}

export function validatePracticeRead(schemaName: string, sql: string): string {
  const statements = parseWorkspaceSql(schemaName, sql);
  if (statements.length !== 1 || !["select", "with"].includes(String(statements[0].type))) {
    throw new Error("Practice execution only permits one SELECT/WITH query");
  }
  return sql.trim().replace(/;\s*$/, "");
}

export function validatePracticeImport(schemaName: string, sql: string): string {
  const statements = parseWorkspaceSql(schemaName, sql);
  if (statements.some((statement) => !importStatementTypes.has(String(statement.type)))) {
    throw new Error("Imports may only create or alter workspace tables and insert rows");
  }
  return sql;
}

export function limitPracticeResult<T>(rows: T[], maxBytes = 1024 * 1024): { rows: T[]; truncated: boolean } {
  const limited: T[] = [];
  let size = 2;
  for (const row of rows) {
    const rowSize = Buffer.byteLength(JSON.stringify(row));
    if (size + rowSize > maxBytes) return { rows: limited, truncated: true };
    limited.push(row);
    size += rowSize + 1;
  }
  return { rows: limited, truncated: false };
}