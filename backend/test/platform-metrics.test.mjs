import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizePlatformQuestionCounts } from '../src/ops.ts';

test('platform question total counts one SQL catalog plus published learning questions', () => {
  assert.deepEqual(
    summarizePlatformQuestionCounts(282, 0, 1362, 0),
    { total: 1644, ai: 0 }
  );
});

test('platform AI question total combines canonical SQL and learning AI questions', () => {
  assert.deepEqual(
    summarizePlatformQuestionCounts(282, 3, 1362, 5),
    { total: 1644, ai: 8 }
  );
});
