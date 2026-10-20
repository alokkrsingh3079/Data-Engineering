import test from "node:test";
import assert from "node:assert/strict";
import { parquetWriteBuffer } from "hyparquet-writer";
import { inferDatasetColumnType, MAX_DATASET_BYTES, parseDatasetFile, parseSqlDatabaseFile } from "../src/dataset-files.ts";

test("parses CSV quoting, escaped quotes, nulls, and safe column names", async () => {
  const parsed = await parseDatasetFile("Retail data.csv", Buffer.from('Customer ID,Name,Name\n1,"A, Inc.","He said ""yes"""\n2,,B\n'));
  assert.deepEqual(parsed.columns, ["customer_id", "name", "name_2"]);
  assert.deepEqual(parsed.rows, [
    { customer_id: "1", name: "A, Inc.", name_2: 'He said "yes"' },
    { customer_id: "2", name: null, name_2: "B" }
  ]);
});

test("parses JSON arrays, wrapped rows, and JSON Lines", async () => {
  assert.deepEqual((await parseDatasetFile("data.json", Buffer.from('{"rows":[{"Event ID":1},{"Event ID":2}]}'))).rows, [
    { event_id: 1 }, { event_id: 2 }
  ]);
  assert.deepEqual((await parseDatasetFile("data.jsonl", Buffer.from('{"id":1}\n{"id":2}\n'))).rows, [{ id: 1 }, { id: 2 }]);
});

test("parses Parquet into normalized rows and preserves scalar values", async () => {
  const parquet = parquetWriteBuffer({
    columnData: [
      { name: "Employee ID", data: [1, 2], type: "INT32" },
      { name: "Department", data: ["Sales", "Engineering"], type: "STRING" },
      { name: "Salary", data: [45000.5, 62000], type: "DOUBLE" },
      { name: "External ID", data: [9007199254740993n, 2n], type: "INT64" }
    ]
  });
  const parsed = await parseDatasetFile("employees.parquet", Buffer.from(parquet));
  assert.deepEqual(parsed.columns, ["employee_id", "department", "salary", "external_id"]);
  assert.deepEqual(parsed.rows, [
    { employee_id: 1, department: "Sales", salary: 45000.5, external_id: "9007199254740993" },
    { employee_id: 2, department: "Engineering", salary: 62000, external_id: "2" }
  ]);
});

test("rejects invalid Parquet files and unsupported formats", async () => {
  await assert.rejects(parseDatasetFile("invalid.parquet", Buffer.from("not parquet")), /invalid or incomplete/);
  await assert.rejects(parseDatasetFile("dataset.xlsx", Buffer.from("not xlsx")), /Supported formats/);
});

test("rejects malformed and oversized text datasets", async () => {
  await assert.rejects(parseDatasetFile("broken.json", Buffer.from("{")), /malformed/);
  await assert.rejects(parseDatasetFile("broken.csv", Buffer.from("a,b\n1\n")), /same number/);
  await assert.rejects(parseDatasetFile("large.csv", Buffer.alloc(MAX_DATASET_BYTES + 1)), /up to 5 MB/);
});

test("accepts a bounded PostgreSQL schema and data script for isolated import", () => {
  const sql = `CREATE TABLE departments (department_id INT PRIMARY KEY, department_name TEXT NOT NULL);
CREATE TABLE employees (employee_id INT PRIMARY KEY, department_id INT, salary NUMERIC);
ALTER TABLE employees ADD CONSTRAINT employees_department_fk FOREIGN KEY (department_id) REFERENCES departments(department_id);
INSERT INTO departments VALUES (1, 'Sales'), (2, 'Engineering');
INSERT INTO employees VALUES (10, 1, 50000), (11, 2, 60000);`;
  const parsed = parseSqlDatabaseFile("company.sql", Buffer.from(sql), "qg_test");
  assert.equal(parsed.tableCount, 2);
  assert.equal(parsed.insertedRows, 4);
  assert.equal(parsed.filename, "company.sql");
});

test("rejects unsafe SQL imports, SELECT inserts, foreign schemas, and excessive rows", () => {
  assert.throws(() => parseSqlDatabaseFile("unsafe.sql", Buffer.from("DROP TABLE users;"), "qg_test"), /only create or alter workspace tables and insert rows/i);
  assert.throws(() => parseSqlDatabaseFile("select.sql", Buffer.from("CREATE TABLE a (id INT); INSERT INTO a SELECT id FROM b;"), "qg_test"), /INSERT \.\.\. SELECT/);
  assert.throws(() => parseSqlDatabaseFile("schema.sql", Buffer.from("CREATE TABLE public.a (id INT);"), "qg_test"), /current practice workspace/i);
  assert.throws(() => parseSqlDatabaseFile("function.sql", Buffer.from("CREATE TABLE a (files TEXT DEFAULT pg_ls_dir('/'));"), "qg_test"), /function calls/i);
  const rows = Array.from({ length: 10_001 }, (_, index) => `(${index})`).join(",");
  assert.throws(() => parseSqlDatabaseFile("large.sql", Buffer.from(`CREATE TABLE a (id INT); INSERT INTO a VALUES ${rows};`), "qg_test"), /limited to 10,000 inserted rows/);
});

test("infers primitive SQL types conservatively", () => {
  assert.equal(inferDatasetColumnType(["1", "2"]), "BIGINT");
  assert.equal(inferDatasetColumnType(["1.5", "2"]), "DOUBLE PRECISION");
  assert.equal(inferDatasetColumnType(["true", "false"]), "BOOLEAN");
  assert.equal(inferDatasetColumnType(["1", "not a number"]), "TEXT");
  assert.equal(inferDatasetColumnType(["0012", "0007"]), "TEXT");
});
