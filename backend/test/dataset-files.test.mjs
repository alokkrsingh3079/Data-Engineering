import test from "node:test";
import assert from "node:assert/strict";
import { inferDatasetColumnType, MAX_DATASET_BYTES, parseDatasetFile } from "../src/dataset-files.ts";

test("parses CSV quoting, escaped quotes, nulls, and safe column names", () => {
  const parsed = parseDatasetFile("Retail data.csv", Buffer.from('Customer ID,Name,Name\n1,"A, Inc.","He said ""yes"""\n2,,B\n'));
  assert.deepEqual(parsed.columns, ["customer_id", "name", "name_2"]);
  assert.deepEqual(parsed.rows, [
    { customer_id: "1", name: "A, Inc.", name_2: 'He said "yes"' },
    { customer_id: "2", name: null, name_2: "B" }
  ]);
});

test("parses JSON arrays, wrapped rows, and JSON Lines", () => {
  assert.deepEqual(parseDatasetFile("data.json", Buffer.from('{"rows":[{"Event ID":1},{"Event ID":2}]}')).rows, [
    { event_id: 1 }, { event_id: 2 }
  ]);
  assert.deepEqual(parseDatasetFile("data.jsonl", Buffer.from('{"id":1}\n{"id":2}\n')).rows, [{ id: 1 }, { id: 2 }]);
});

test("rejects unsupported, malformed, inconsistent, and oversized datasets", () => {
  assert.throws(() => parseDatasetFile("dataset.xlsx", Buffer.from("not xlsx")), /Supported formats/);
  assert.throws(() => parseDatasetFile("broken.json", Buffer.from("{")), /malformed/);
  assert.throws(() => parseDatasetFile("broken.csv", Buffer.from("a,b\n1\n")), /same number/);
  assert.throws(() => parseDatasetFile("large.csv", Buffer.alloc(MAX_DATASET_BYTES + 1)), /up to 5 MB/);
});

test("infers primitive SQL types conservatively", () => {
  assert.equal(inferDatasetColumnType(["1", "2"]), "BIGINT");
  assert.equal(inferDatasetColumnType(["1.5", "2"]), "DOUBLE PRECISION");
  assert.equal(inferDatasetColumnType(["true", "false"]), "BOOLEAN");
  assert.equal(inferDatasetColumnType(["1", "not a number"]), "TEXT");
  assert.equal(inferDatasetColumnType(["0012", "0007"]), "TEXT");
});
