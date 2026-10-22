import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { runSandboxedPython, verifySandbox } from '../src/runner-service.ts';

test('bubblewrap Python runner isolates execution and checks hidden cases', async (context) => {
  if (!fs.existsSync('/usr/bin/bwrap') || !fs.existsSync('/usr/bin/prlimit') || !fs.existsSync('/usr/bin/python3')) {
    context.skip('bubblewrap, prlimit, or system Python is unavailable');
    return;
  }
  try {
    await verifySandbox();
  } catch {
    context.skip('unprivileged namespace sandbox is unavailable in this environment');
    return;
  }

  const code = `def dedupe_events(records):
    latest = {}
    for record in records:
        key = record["event_id"]
        if key not in latest or record["occurred_at"] > latest[key]["occurred_at"]:
            latest[key] = record
    return [latest[key] for key in sorted(latest)]
`;
  const result = await runSandboxedPython({
    taskId: 'python-dedupe-events',
    language: 'python',
    code,
    testCases: [
      { name: 'sorts and keeps latest', input: [{ event_id: 'b', occurred_at: '2025-02-01T00:00:00Z' }, { event_id: 'a', occurred_at: '2025-01-01T00:00:00Z' }, { event_id: 'b', occurred_at: '2025-03-01T00:00:00Z' }], expected: [{ event_id: 'a', occurred_at: '2025-01-01T00:00:00Z' }, { event_id: 'b', occurred_at: '2025-03-01T00:00:00Z' }] },
      { name: 'empty input', input: [], expected: [] }
    ]
  });
  assert.equal(result.status, 'passed');
  assert.deepEqual(result.tests.map((item) => item.passed), [true, true]);
});

test('bubblewrap Python runner reports failed and invalid submissions', async (context) => {
  if (!fs.existsSync('/usr/bin/bwrap') || !fs.existsSync('/usr/bin/prlimit') || !fs.existsSync('/usr/bin/python3')) {
    context.skip('bubblewrap, prlimit, or system Python is unavailable');
    return;
  }
  try { await verifySandbox(); } catch { context.skip('namespace sandbox unavailable'); return; }
  const base = { taskId: 'python-dedupe-events', language: 'python', testCases: [{ name: 'expected empty', input: [], expected: [] }] };
  const incorrect = await runSandboxedPython({ ...base, code: 'def dedupe_events(records): return [1]' });
  assert.equal(incorrect.status, 'failed');
  const invalid = await runSandboxedPython({ ...base, code: 'raise RuntimeError("test error")' });
  assert.equal(invalid.status, 'error');
  assert.equal(invalid.tests[0].passed, false);
  const timeout = await runSandboxedPython({ ...base, code: 'while True: pass' });
  assert.equal(timeout.status, 'timeout');
});