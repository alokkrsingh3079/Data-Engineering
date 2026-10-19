import test from 'node:test';
import assert from 'node:assert/strict';
import { limitPracticeResult, validatePracticeImport, validatePracticeRead } from '../src/sql-guard.ts';

test('workspace reads allow local tables and CTEs', () => {
  assert.equal(validatePracticeRead('practice_one', 'SELECT * FROM employees'), 'SELECT * FROM employees');
  assert.match(validatePracticeRead('practice_one', 'WITH recent AS (SELECT * FROM events) SELECT * FROM recent'), /^WITH/);
});

test('workspace reads reject cross-schema references, multiple statements, and mutations', () => {
  assert.throws(() => validatePracticeRead('practice_one', 'SELECT * FROM practice_two.employees'), /current practice workspace/);
  assert.throws(() => validatePracticeRead('practice_one', 'WITH x AS (SELECT * FROM practice_two.secret) SELECT * FROM x'), /current practice workspace/);
  assert.throws(() => validatePracticeRead('practice_one', 'SELECT 1; SELECT 2'), /one SELECT\/WITH/);
  assert.throws(() => validatePracticeRead('practice_one', 'DELETE FROM employees'), /one SELECT\/WITH/);
  assert.throws(() => validatePracticeRead('practice_one', 'SELECT pg_sleep(10)'), /function is not available/);
  assert.throws(() => validatePracticeRead('practice_one', 'SELECT nextval(\'seq\')'), /function is not available/);
});

test('practice result serialization is bounded by response bytes', () => {
  assert.deepEqual(limitPracticeResult([{ value: 'ok' }, { value: 'too large' }], 18), {
    rows: [{ value: 'ok' }],
    truncated: true
  });
});

test('practice imports only allow local table DDL and inserts', () => {
  assert.match(validatePracticeImport('practice_one', 'CREATE TABLE employees (id INT); INSERT INTO employees VALUES (1);'), /CREATE TABLE/);
  assert.throws(() => validatePracticeImport('practice_one', 'INSERT INTO practice_two.employees VALUES (1)'), /current practice workspace/);
  assert.throws(() => validatePracticeImport('practice_one', 'SET search_path TO public'));
  assert.throws(() => validatePracticeImport('practice_one', 'DROP SCHEMA practice_two CASCADE'));
});