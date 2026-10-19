import test from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword } from '../src/auth.ts';

test('scrypt password hashes verify correct passwords and reject malformed values safely', () => {
  const stored = hashPassword('correct-horse-battery');
  assert.equal(verifyPassword('correct-horse-battery', stored), true);
  assert.equal(verifyPassword('incorrect-password', stored), false);
  assert.equal(verifyPassword('anything', ''), false);
  assert.equal(verifyPassword('anything', 'not-a-hash'), false);
  assert.equal(verifyPassword('anything', null), false);
});