import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import pg from 'pg';
import { parse as parsePgConnectionString } from 'pg-connection-string';
import { closePracticePools, createPracticeSchema, derivePracticeRoleCredentials, dropPracticeSchema, executeImport, executeReadOnly, pool } from '../src/db.ts';

const { Client } = pg;

test('workspace role credentials are deterministic and schema-specific', () => {
  const first = derivePracticeRoleCredentials('practice_one', 'stable-test-secret');
  const repeated = derivePracticeRoleCredentials('practice_one', 'stable-test-secret');
  const other = derivePracticeRoleCredentials('practice_two', 'stable-test-secret');
  assert.deepEqual(first, repeated);
  assert.notEqual(first.name, other.name);
  assert.notEqual(first.password, other.password);
  assert.throws(() => derivePracticeRoleCredentials('invalid-schema;DROP', 'stable-test-secret'));
});

test('PostgreSQL workspace roles isolate practice schemas', { skip: process.env.RUN_POSTGRES_INTEGRATION !== '1' }, async () => {
  const suffix = crypto.randomUUID().replaceAll('-', '').slice(0, 10);
  const leftSchema = `it_left_${suffix}`;
  const rightSchema = `it_right_${suffix}`;
  const leftRole = derivePracticeRoleCredentials(leftSchema);
  const rightRole = derivePracticeRoleCredentials(rightSchema);

  try {
    await createPracticeSchema(leftSchema);
    await createPracticeSchema(rightSchema);
    await executeImport(leftSchema, 'CREATE TABLE sample (id INT PRIMARY KEY); INSERT INTO sample VALUES (1)');
    await executeImport(rightSchema, 'CREATE TABLE secret (id INT PRIMARY KEY); INSERT INTO secret VALUES (99)');

    await pool.query(`ALTER ROLE ${leftRole.name} PASSWORD 'stale-integration-test-password'`);
    await closePracticePools();
    const result = await executeReadOnly(leftSchema, 'SELECT id FROM sample');
    assert.equal(result.rows[0].id, 1);

    const practiceConnectionString = process.env.PRACTICE_DATABASE_URL || process.env.DATABASE_URL;
    assert.ok(practiceConnectionString, 'A practice or primary database URL is required for the integration test');
    const leftClient = new Client({
      ...parsePgConnectionString(practiceConnectionString),
      user: leftRole.name,
      password: leftRole.password
    });
    await leftClient.connect();
    try {
      const access = await leftClient.query(
        'SELECT current_user, has_schema_privilege(current_user, $1, \'USAGE\') AS can_use, has_schema_privilege(current_user, $1, \'CREATE\') AS can_create',
        [rightSchema]
      );
      assert.equal(access.rows[0].current_user, leftRole.name);
      assert.equal(access.rows[0].can_use, false);
      assert.equal(access.rows[0].can_create, false);
      const roleLimits = await leftClient.query(
        'SELECT rolsuper, rolcreatedb, rolcreaterole FROM pg_roles WHERE rolname = current_user'
      );
      assert.deepEqual(roleLimits.rows[0], { rolsuper: false, rolcreatedb: false, rolcreaterole: false });
      await assert.rejects(leftClient.query(`SELECT * FROM ${rightSchema}.secret`), { code: '42501' });
      await assert.rejects(leftClient.query(`CREATE TABLE ${rightSchema}.injected (id INT)`), { code: '42501' });
    } finally {
      await leftClient.end();
    }
  } finally {
    await closePracticePools();
    await dropPracticeSchema(leftSchema);
    await dropPracticeSchema(rightSchema);
    const remainingRoles = await pool.query('SELECT rolname FROM pg_roles WHERE rolname = ANY($1)', [[leftRole.name, rightRole.name]]);
    assert.equal(remainingRoles.rowCount, 0);
    await pool.end();
  }
});