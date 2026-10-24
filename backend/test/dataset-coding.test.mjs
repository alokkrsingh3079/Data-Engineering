import test from "node:test";
import assert from "node:assert/strict";
import { validateDatasetCodingInput } from "../src/dataset-coding.ts";

const columns = ["employee_id", "department", "annual_salary"];

test("accepts complete dataset records including null values", () => {
  assert.equal(validateDatasetCodingInput([
    { employee_id: "E1", department: "IT", annual_salary: null },
    { employee_id: "E2", department: "Sales", annual_salary: "$50,000" }
  ], columns, "case_1"), null);
});

test("rejects test records that omit dataset columns", () => {
  assert.match(
    validateDatasetCodingInput([{ employee_id: "E1", annual_salary: "$50,000" }], columns, "case_1"),
    /missing dataset columns: department/
  );
});

test("rejects test records with columns outside the selected table schema", () => {
  assert.match(
    validateDatasetCodingInput([{ employee_id: "E1", department: "IT", annual_salary: "$50,000", age: 34 }], columns, "case_1"),
    /unknown columns: age/
  );
});

test("requires non-empty lists of dataset records", () => {
  assert.match(validateDatasetCodingInput([], columns, "case_1"), /non-empty list/);
  assert.match(validateDatasetCodingInput([{ department: "IT" }, "not a record"], columns, "case_1"), /non-empty list/);
});
