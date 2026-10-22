import test from 'node:test';
import assert from 'node:assert/strict';
import { datasetCodingQuestionSchema, parseDatasetCodingTestCases } from '../src/ai.ts';

test('dataset coding output schema matches the PySpark execution contract', () => {
  assert.equal(
    datasetCodingQuestionSchema.properties.function_name.pattern,
    '^[a-zA-Z_][a-zA-Z0-9_]{0,100}$'
  );
  assert.equal(datasetCodingQuestionSchema.properties.test_cases.minItems, 2);
  assert.equal(datasetCodingQuestionSchema.properties.test_cases.maxItems, 2);
});

test('Python dataset test inputs may be any JSON value, including row arrays', () => {
  const cases = parseDatasetCodingTestCases('python', [
    { input_json: '[{"department":"IT"}]', expected_json: '[{"department":"IT"}]' },
    { input_json: '[]', expected_json: '[]' }
  ]);
  assert.deepEqual(cases.map(({ input, expected }) => ({ input, expected })), [
    { input: [{ department: 'IT' }], expected: [{ department: 'IT' }] },
    { input: [], expected: [] }
  ]);
});

test('PySpark dataset test inputs must be objects containing DataFrame rows', () => {
  assert.deepEqual(parseDatasetCodingTestCases('pyspark', [
    { input_json: '{"input":[{"department":"IT"}]}', expected_json: '[{"department":"IT"}]' }
  ])[0].input, { input: [{ department: 'IT' }] });
  assert.throws(
    () => parseDatasetCodingTestCases('pyspark', [{ input_json: '[]', expected_json: '[]' }]),
    /PySpark test input must be a JSON object/
  );
});
