import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { executeOnRunner, isRunnerConfigured, runnerHealth } from '../src/runners.ts';

test('Python and Spark runners remain unavailable until trusted endpoints are configured', async () => {
  const variables = ['PYTHON_RUNNER_URL', 'PYTHON_RUNNER_TOKEN', 'SPARK_RUNNER_URL', 'SPARK_RUNNER_TOKEN'];
  const previous = Object.fromEntries(variables.map((key) => [key, process.env[key]]));
  const previousMode = process.env.NODE_ENV;
  try {
    for (const key of variables) delete process.env[key];
    assert.deepEqual(await runnerHealth('python'), { configured: false, available: false });
    assert.deepEqual(await runnerHealth('pyspark'), { configured: false, available: false });
    process.env.PYTHON_RUNNER_URL = 'http://runner.example.test';
    process.env.PYTHON_RUNNER_TOKEN = 'test-token';
    process.env.NODE_ENV = 'production';
    assert.equal(isRunnerConfigured('python'), false);
    process.env.PYTHON_RUNNER_URL = 'https://runner.example.test';
    assert.equal(isRunnerConfigured('python'), true);
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    if (previousMode === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousMode;
  }
});

test('external runner adapter authenticates requests and validates returned test summaries', async (t) => {
  const server = createServer(async (request, response) => {
    if (request.headers.authorization !== 'Bearer isolated-test-token') {
      response.writeHead(401).end();
      return;
    }
    if (request.url === '/health') {
      response.writeHead(200).end('ok');
      return;
    }
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const payload = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    assert.equal(payload.language, 'python');
    assert.equal(payload.code, 'def solve(): return 1');
    response.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({
      status: 'passed', executionMs: 12, tests: payload.testCases.map((testCase) => ({ name: testCase.name, passed: true }))
    }));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));

  const previousUrl = process.env.PYTHON_RUNNER_URL;
  const previousToken = process.env.PYTHON_RUNNER_TOKEN;
  const previousMode = process.env.NODE_ENV;
  process.env.PYTHON_RUNNER_URL = `http://127.0.0.1:${server.address().port}`;
  process.env.PYTHON_RUNNER_TOKEN = 'isolated-test-token';
  process.env.NODE_ENV = 'development';
  try {
    assert.deepEqual(await runnerHealth('python'), { configured: true, available: true });
    const result = await executeOnRunner({
      language: 'python', taskId: 'unit-task', code: 'def solve(): return 1',
      testCases: [{ name: 'sample', input: null, expected: 1 }, { name: 'hidden', input: null, expected: 1 }]
    });
    assert.equal(result.status, 'passed');
    assert.equal(result.correct, true);
    assert.equal(result.tests.length, 2);
  } finally {
    if (previousUrl === undefined) delete process.env.PYTHON_RUNNER_URL;
    else process.env.PYTHON_RUNNER_URL = previousUrl;
    if (previousToken === undefined) delete process.env.PYTHON_RUNNER_TOKEN;
    else process.env.PYTHON_RUNNER_TOKEN = previousToken;
    if (previousMode === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousMode;
  }
});