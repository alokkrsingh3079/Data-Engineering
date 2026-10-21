import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { cancelSparkJob, createSparkJob, executeOnRunner, getSparkJob, isRunnerConfigured, runnerHealth } from '../src/runners.ts';

test('Python and Spark runners remain unavailable until trusted endpoints are configured', async () => {
  const variables = ['PYTHON_RUNNER_URL', 'PYTHON_RUNNER_TOKEN', 'SPARK_RUNNER_URL', 'SPARK_RUNNER_TOKEN', 'SPARK_RUNNER_ALLOW_PRIVATE_HTTP'];
  const previous = Object.fromEntries(variables.map((key) => [key, process.env[key]]));
  const previousMode = process.env.NODE_ENV;
  try {
    for (const key of variables) delete process.env[key];
    assert.deepEqual(await runnerHealth('python'), { configured: false, available: false, diagnostic: 'Runner URL or token is missing or invalid.' });
    assert.deepEqual(await runnerHealth('pyspark'), { configured: false, available: false, diagnostic: 'Runner URL or token is missing or invalid.' });
    process.env.PYTHON_RUNNER_URL = 'http://runner.example.test';
    process.env.PYTHON_RUNNER_TOKEN = 'test-token';
    process.env.NODE_ENV = 'production';
    assert.equal(isRunnerConfigured('python'), false);
    process.env.PYTHON_RUNNER_URL = 'https://runner.example.test';
    assert.equal(isRunnerConfigured('python'), true);
    process.env.SPARK_RUNNER_URL = 'http://spark_runner:4021';
    process.env.SPARK_RUNNER_TOKEN = 'test-token';
    assert.equal(isRunnerConfigured('pyspark'), false);
    process.env.SPARK_RUNNER_ALLOW_PRIVATE_HTTP = 'true';
    assert.equal(isRunnerConfigured('pyspark'), true);
    process.env.SPARK_RUNNER_URL = 'http://runner.example.test';
    assert.equal(isRunnerConfigured('pyspark'), false);
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
    if (request.url === '/health') {
      assert.equal(request.headers.authorization, undefined);
      response.writeHead(200).end('ok');
      return;
    }
    if (request.headers.authorization !== 'Bearer isolated-test-token') {
      response.writeHead(401).end();
      return;
    }
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const payload = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    assert.equal(payload.language, 'python');
    assert.equal(payload.code, 'def solve(): return 1');
    response.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({
      status: 'passed', executionMs: 12, tests: payload.testCases.map((testCase) => ({ name: testCase.name, passed: true })), message: null
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

test('runner health reports upstream HTTP failures without sending the runner token', async (t) => {
  const server = createServer((request, response) => {
    assert.equal(request.headers.authorization, undefined);
    response.writeHead(503).end('unavailable');
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));

  const previousUrl = process.env.SPARK_RUNNER_URL;
  const previousToken = process.env.SPARK_RUNNER_TOKEN;
  const previousMode = process.env.NODE_ENV;
  process.env.SPARK_RUNNER_URL = `http://127.0.0.1:${server.address().port}`;
  process.env.SPARK_RUNNER_TOKEN = 'health-test-token';
  process.env.NODE_ENV = 'development';
  try {
    assert.deepEqual(await runnerHealth('pyspark'), {
      configured: true,
      available: false,
      diagnostic: 'Runner returned HTTP 503.'
    });
  } finally {
    if (previousUrl === undefined) delete process.env.SPARK_RUNNER_URL;
    else process.env.SPARK_RUNNER_URL = previousUrl;
    if (previousToken === undefined) delete process.env.SPARK_RUNNER_TOKEN;
    else process.env.SPARK_RUNNER_TOKEN = previousToken;
    if (previousMode === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousMode;
  }
});

test('runner execution reports credential rejection without exposing the token', async (t) => {
  const server = createServer((request, response) => {
    assert.equal(request.headers.authorization, 'Bearer execution-test-token');
    response.writeHead(401).end(JSON.stringify({ error: 'Authentication required' }));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));

  const previousUrl = process.env.SPARK_RUNNER_URL;
  const previousToken = process.env.SPARK_RUNNER_TOKEN;
  const previousMode = process.env.NODE_ENV;
  process.env.SPARK_RUNNER_URL = `http://127.0.0.1:${server.address().port}`;
  process.env.SPARK_RUNNER_TOKEN = 'execution-test-token';
  process.env.NODE_ENV = 'development';
  try {
    const result = await executeOnRunner({
      language: 'pyspark',
      taskId: 'generated-question',
      functionName: 'solve',
      code: 'def solve(input): return input',
      testCases: [{ name: 'sample', input: { input: [] }, expected: [] }]
    });
    assert.deepEqual(result, {
      status: 'error',
      message: 'Execution service rejected its credentials (HTTP 401). Check that SPARK_RUNNER_TOKEN matches the runner.'
    });
    assert.doesNotMatch(JSON.stringify(result), /execution-test-token/);
  } finally {
    if (previousUrl === undefined) delete process.env.SPARK_RUNNER_URL;
    else process.env.SPARK_RUNNER_URL = previousUrl;
    if (previousToken === undefined) delete process.env.SPARK_RUNNER_TOKEN;
    else process.env.SPARK_RUNNER_TOKEN = previousToken;
    if (previousMode === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousMode;
  }
});

test('Spark job adapter authenticates queue requests and validates owner-facing job results', async (t) => {
  const jobId = 'f1d59c24-249c-4b99-8b4c-77a0f54e6821';
  const seen = [];
  const server = createServer(async (request, response) => {
    if (request.headers.authorization !== 'Bearer spark-queue-token') {
      response.writeHead(401).end();
      return;
    }
    if (request.method === 'POST' && request.url === '/v1/jobs') {
      const chunks = [];
      for await (const chunk of request) chunks.push(chunk);
      seen.push(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      response.writeHead(202, { 'content-type': 'application/json' }).end(JSON.stringify({ jobId, status: 'queued', createdAt: '2026-10-19T00:00:00.000Z' }));
      return;
    }
    if (request.method === 'GET' && request.url === `/v1/jobs/${jobId}`) {
      response.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({
        jobId, status: 'succeeded', createdAt: '2026-10-19T00:00:00.000Z', startedAt: '2026-10-19T00:00:01.000Z', finishedAt: '2026-10-19T00:00:02.000Z',
        result: { status: 'passed', executionMs: 1000, tests: [{ name: 'public sample', passed: true, status: 'succeeded', executionMs: 1000 }], output: { columns: ['event_type', 'count'], schema: [{ name: 'event_type', type: 'string' }, { name: 'count', type: 'bigint' }], rows: [{ event_type: 'view', count: 2 }], console: 'done' }, message: null }
      }));
      return;
    }
    if (request.method === 'DELETE' && request.url === `/v1/jobs/${jobId}`) {
      response.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ jobId, status: 'cancelled' }));
      return;
    }
    response.writeHead(404).end();
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const previousUrl = process.env.SPARK_RUNNER_URL;
  const previousToken = process.env.SPARK_RUNNER_TOKEN;
  const previousMode = process.env.NODE_ENV;
  process.env.SPARK_RUNNER_URL = `http://127.0.0.1:${server.address().port}`;
  process.env.SPARK_RUNNER_TOKEN = 'spark-queue-token';
  process.env.NODE_ENV = 'development';
  try {
    const created = await createSparkJob({
      taskId: 'pyspark-event-counts', functionName: 'count_by_event_type', code: 'def count_by_event_type(events): return events',
      testCases: [{ name: 'public sample', input: [{ event_type: 'view' }], expected: [{ event_type: 'view', count: 1 }] }], returnOutput: true
    });
    assert.equal(created.status, 'ok');
    assert.equal(created.job.jobId, jobId);
    assert.equal(seen[0].language, 'pyspark');
    assert.equal(seen[0].functionName, 'count_by_event_type');
    assert.equal(seen[0].returnOutput, true);
    const status = await getSparkJob(jobId);
    assert.equal(status.status, 'ok');
    assert.equal(status.job.result.output.rows[0].count, 2);
    assert.equal((await cancelSparkJob(jobId)).status, 'cancelled');
  } finally {
    if (previousUrl === undefined) delete process.env.SPARK_RUNNER_URL;
    else process.env.SPARK_RUNNER_URL = previousUrl;
    if (previousToken === undefined) delete process.env.SPARK_RUNNER_TOKEN;
    else process.env.SPARK_RUNNER_TOKEN = previousToken;
    if (previousMode === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousMode;
  }
});