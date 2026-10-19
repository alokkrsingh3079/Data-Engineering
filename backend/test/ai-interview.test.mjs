import test from 'node:test';
import assert from 'node:assert/strict';
import { interviewFeedbackSchema } from '../src/ai.ts';

test('interview feedback schema enforces bounded rubric scores and structured fields', () => {
  const valid = {
    correctness: 4,
    completeness: 3,
    reasoning: 4,
    tradeoffs: 2,
    strengths: ['Identifies the batch boundary.'],
    gaps: ['Explain duplicate-safe retries.'],
    referenceAnswer: 'Commit progress after a durable, validated sink write.',
    followUpQuestion: 'How would you replay a late-arriving record?'
  };
  assert.equal(interviewFeedbackSchema.parse(valid).correctness, 4);
  assert.equal(interviewFeedbackSchema.safeParse({ ...valid, correctness: 9 }).success, false);
  assert.equal(interviewFeedbackSchema.safeParse({ ...valid, hiddenExtra: true }).success, false);
});