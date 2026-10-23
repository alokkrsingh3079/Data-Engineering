import test from 'node:test';
import assert from 'node:assert/strict';
import { parseAllowedOrigins, isAllowedOrigin } from '../src/cors-config.ts';

test('parseAllowedOrigins normalizes comma and newline separated values', () => {
  const origins = parseAllowedOrigins('https://app.example.com,\nhttp://localhost:5173,  https://app.example.com  ');

  assert.deepEqual(origins, [
    'https://app.example.com',
    'http://localhost:5173'
  ]);
});

test('isAllowedOrigin accepts exact allowed origins and localhost variations', () => {
  const original = process.env.ALLOWED_ORIGIN;
  process.env.ALLOWED_ORIGIN = 'https://app.example.com, http://localhost:5173';

  try {
    assert.equal(isAllowedOrigin('https://app.example.com'), true);
    assert.equal(isAllowedOrigin('http://localhost:5173'), true);
    assert.equal(isAllowedOrigin('http://127.0.0.1:5173'), true);
    assert.equal(isAllowedOrigin('https://evil.example.com'), false);
  } finally {
    if (original === undefined) {
      delete process.env.ALLOWED_ORIGIN;
    } else {
      process.env.ALLOWED_ORIGIN = original;
    }
  }
});
