import test from 'node:test';
import assert from 'node:assert/strict';
import { datasetCodingQuestionSchema } from '../src/ai.ts';

test('dataset coding output schema matches the PySpark execution contract', () => {
  assert.equal(
    datasetCodingQuestionSchema.properties.function_name.pattern,
    '^[a-zA-Z_][a-zA-Z0-9_]{0,100}$'
  );
  assert.equal(datasetCodingQuestionSchema.properties.test_cases.minItems, 2);
  assert.equal(datasetCodingQuestionSchema.properties.test_cases.maxItems, 2);
});
