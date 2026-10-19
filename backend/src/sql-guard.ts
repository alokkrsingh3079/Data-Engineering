import { parse } from "pgsql-ast-parser";

const importStatementTypes = new Set(["create table", "insert", "alter table"]);

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