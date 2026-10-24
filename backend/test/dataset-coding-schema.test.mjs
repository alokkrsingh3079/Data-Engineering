import test from 'node:test';
import assert from 'node:assert/strict';
import { datasetCodingQuestionSchema, parseJsonLike, parseStructuredJsonLike } from '../src/ai.ts';
import { executeOnRunner, normalizeRunnerInput } from '../src/runners.ts';

test('dataset coding output schema matches the PySpark execution contract', () => {
  assert.equal(
    datasetCodingQuestionSchema.properties.function_name.pattern,
    '^[a-zA-Z_][a-zA-Z0-9_]{0,100}$'
  );
  assert.equal(datasetCodingQuestionSchema.properties.test_cases.minItems, 2);
  assert.equal(datasetCodingQuestionSchema.properties.test_cases.maxItems, 2);
  assert.equal(datasetCodingQuestionSchema.properties.test_cases.items.properties.input_json.minLength, 2);
  assert.equal(datasetCodingQuestionSchema.properties.test_cases.items.properties.expected_json.minLength, 2);
});

test('parseJsonLike repairs common malformed JSON from model output', () => {
  const input = "{ 'department': 'Engineering', 'employees': [{ 'name': 'Alice', 'salary': 50000, },], }";
  const parsed = parseJsonLike(input);

  assert.deepEqual(parsed, {
    department: 'Engineering',
    employees: [{ name: 'Alice', salary: 50000 }]
  });
});

test('executeOnRunner accepts the Spark runner summary payload shape', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    status: 'failed',
    executionMs: 48,
    tests: [
      { name: 'case_1', passed: false, status: 'incorrect', message: 'Wrong result' },
      { name: 'case_2', passed: true, status: 'succeeded' }
    ],
    output: { columns: ['department'], rows: [{ department: 'Engineering' }] },
    message: 'One test failed'
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });

  try {
    const result = await executeOnRunner({
      language: 'pyspark',
      taskId: 'demo-task',
      functionName: 'filter_employees_by_department',
      code: 'def filter_employees_by_department(df): return df',
      testCases: [
        { name: 'case_1', input: { department: 'Engineering' }, expected: [{ department: 'Engineering' }] },
        { name: 'case_2', input: { department: 'Marketing' }, expected: [] }
      ]
    });
    assert.equal(result.status, 'failed');
    assert.equal(result.correct, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('executeOnRunner accepts successful runner responses using the real success status', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    status: 'succeeded',
    executionMs: 40,
    tests: [
      { name: 'case_1', passed: true, status: 'succeeded' },
      { name: 'case_2', passed: true, status: 'succeeded' }
    ],
    output: { columns: ['employee_id'], rows: [{ employee_id: 'E02004' }] },
    message: null
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });

  try {
    const result = await executeOnRunner({
      language: 'pyspark',
      taskId: 'demo-task-pass',
      functionName: 'filter_employees_by_department',
      code: 'def filter_employees_by_department(df): return df',
      testCases: [
        { name: 'case_1', input: { department: 'Engineering' }, expected: [{ employee_id: 'E02004' }] },
        { name: 'case_2', input: { department: 'Sales' }, expected: [{ employee_id: 'E09999' }] }
      ]
    });
    assert.equal(result.status, 'succeeded');
    assert.equal(result.correct, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('parseJsonLike repairs truncated nested JSON emitted by the model', () => {
  const input = '{"input":[{"employee_id":"E02004","full_name":"Cameron Lo","job_title":"Network Administrator","department":"IT","business_unit":"Research & Development","gender":"Male","ethnicity":"Asian","age":"34"';

  const parsed = parseJsonLike(input);

  assert.ok(parsed && typeof parsed === 'object');
  assert.equal((parsed).input[0].employee_id, 'E02004');
  assert.equal((parsed).input[0].department, 'IT');
  assert.equal((parsed).input[0].age, '34');
});

test('normalizeRunnerInput unwraps single-key input envelopes before execution', () => {
  const input = { input: [{ employee_id: 'E02004', department: 'IT' }] };

  assert.deepEqual(normalizeRunnerInput(input), [{ employee_id: 'E02004', department: 'IT' }]);
  assert.deepEqual(normalizeRunnerInput({ department: 'IT' }), { department: 'IT' });
});

test('parseJsonLike accepts real single-key input wrappers emitted by the model', () => {
  const input = '{"input": [{"employee_id":"E02001","full_name":"Alice Perez","department":"IT","annual_salary":"95000"},{"employee_id":"E02002","full_name":"Ben Chen","department":"IT","annual_salary":"108500"}] }\n\nThe response above is the generated dataset payload.';

  const parsed = parseJsonLike(input);

  assert.ok(parsed && typeof parsed === 'object');
  assert.equal(Array.isArray(parsed.input), true);
  assert.equal(parsed.input[0].employee_id, 'E02001');
  assert.equal(parsed.input[1].full_name, 'Ben Chen');
});

test('parseJsonLike strips trailing closing braces left after a valid array payload', () => {
  const value = '[{"employee_id":"E02001","full_name":"Alice Perez","annual_salary":"95000"},{"employee_id":"E02002","full_name":"Ben Chen","annual_salary":"108500"},{"employee_id":"E02005","full_name":"Emma Singh","annual_salary":"101200"}]}';

  const parsed = parseJsonLike(value);

  assert.ok(Array.isArray(parsed));
  assert.equal(parsed.length, 3);
  assert.equal(parsed[2].employee_id, 'E02005');
});

test('executeOnRunner accepts legacy runner payloads with null output and numeric strings', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    status: 'passed',
    executionMs: '92',
    tests: [
      { name: 'case_1', passed: true },
      { name: 'case_2', passed: true }
    ],
    output: null,
    message: null
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });

  try {
    const result = await executeOnRunner({
      language: 'pyspark',
      taskId: 'legacy-runner-payload',
      functionName: 'filter_employees_by_department',
      code: 'def filter_employees_by_department(df): return df',
      testCases: [
        { name: 'case_1', input: { input: [{ employee_id: 'E02004', department: 'IT' }] }, expected: [{ employee_id: 'E02004', department: 'IT' }] },
        { name: 'case_2', input: { input: [{ employee_id: 'E02005', department: 'Sales' }] }, expected: [{ employee_id: 'E02005', department: 'Sales' }] }
      ]
    });
    assert.equal(result.status, 'passed');
    assert.equal(result.correct, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('parseStructuredJsonLike accepts fenced and malformed JSON from the AI response', () => {
  const text = "```json\n{\n  \"questions\": [{\n    \"title\": \"Filter Employees by Department\",\n    \"difficulty\": \"beginner\",\n    \"topic\": \"Filtering and projection\",\n    \"test_cases\": [{\n      \"name\": \"case_1\",\n      \"input_json\": \"{\\\"department\\\": \\\"Engineering\\\"}\",\n      \"expected_json\": \"[{\\\"employee_id\\\": \\\"E02002\\\"}]\"\n    },],\n  }],\n}\n```\n";

  const parsed = parseStructuredJsonLike(text);
  assert.ok(parsed && typeof parsed === 'object');
  assert.equal(Array.isArray((parsed).questions), true);
  assert.equal((parsed).questions[0].title, 'Filter Employees by Department');
});
